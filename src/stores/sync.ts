import { computed, nextTick, ref, shallowRef, watch, type WatchStopHandle } from "vue";
import { defineStore } from "pinia";
import type { ConnectionStatus } from "@instantdb/core";
import { catalog } from "../data/catalog";
import { publishDefaults } from "../domain/publish";
import { createWorkspaceBackup, parseWorkspaceBackup, type WorkspaceBackup } from "../persistence/state";
import { instantWorkspaceId, syncCryptoConfig } from "../../instant.config";
import { canonicalStringify, decryptWorkspace, deriveCapability, encryptWorkspace, hashWorkspaceContent, type WorkspaceCryptoMetadata } from "../sync/crypto";
import { getSyncDatabase, resetSyncDatabase, type SyncDatabase } from "../sync/instant";
import { observeSyncRecovery, reconnectDelayMs, type SyncRecoverySignal } from "../sync/reconnect";
import { recordMetadata, type CloudWorkspace } from "../sync/types";
import { validateCloudCredential } from "../sync/validateCredential";
import { useInventoryStore } from "./inventory";
import { useAccountingStore } from "./accounting";
import { usePublishStore } from "./publish";
import { useSettingsStore } from "./settings";
import { useUiStore } from "./ui";

const syncMetaKey = "sw.sync.meta.v1";
const syncMetaVersion = 4;
const writerIdKey = "sw.sync.writer.v1";
const uploadDebounceMs = 900;
const connectionTimeoutMs = 20_000;
const transactionTimeoutMs = 20_000;
const defaultPublishOptions = {
  mode: "sale", format: "markdown", ...publishDefaults.sale,
  includeStats: true, includeSkills: true, includeNotes: true, allShots: true,
};
const defaultUiState = {
  version: 2, accountScope: "ALL", recentAccount: "LG2", matrixDensity: "compact",
  matrixDisplay: { stats: true, aptitudes: true, skills: true },
};

type SyncStatus = "local" | "connecting" | "syncing" | "synced" | "offline" | "conflict" | "error";

class SyncTransactionTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncTransactionTimeoutError";
  }
}

interface WorkspaceParts {
  inventory: ReturnType<ReturnType<typeof useInventoryStore>["exportState"]>;
  accounting: ReturnType<ReturnType<typeof useAccountingStore>["exportState"]>;
  settings: ReturnType<ReturnType<typeof useSettingsStore>["exportState"]>;
  publish: ReturnType<ReturnType<typeof usePublishStore>["exportState"]>;
  ui: ReturnType<ReturnType<typeof useUiStore>["exportState"]>;
}

interface SyncMeta {
  version: 1 | 2 | 3 | typeof syncMetaVersion;
  revision: number;
  contentHash: string;
  mutationId: string;
  updatedAt: number;
}

interface RemoteCandidate {
  record: CloudWorkspace;
  backup: WorkspaceBackup;
  contentHash: string;
}

function loadSyncMeta(): SyncMeta | null {
  try {
    const value = JSON.parse(localStorage.getItem(syncMetaKey) || "null") as Partial<SyncMeta> | null;
    if (!value || (value.version !== 1 && value.version !== 2 && value.version !== 3 && value.version !== syncMetaVersion)
      || !Number.isInteger(value.revision) || Number(value.revision) < 1
      || typeof value.contentHash !== "string" || typeof value.mutationId !== "string" || !Number.isFinite(value.updatedAt)) return null;
    return value as SyncMeta;
  } catch {
    return null;
  }
}

function saveSyncMeta(meta: SyncMeta) {
  try {
    localStorage.setItem(syncMetaKey, JSON.stringify(meta));
  } catch {
    // Local business state remains the source of recovery if metadata storage is unavailable.
  }
}

function matchesConfirmedRecord(record: CloudWorkspace, meta: SyncMeta) {
  return record.revision === meta.revision
    && record.mutationId === meta.mutationId
    && record.updatedAt === meta.updatedAt;
}

function confirmedContentMatches(meta: SyncMeta, contentHash: string) {
  // Older hashes were calculated after schema normalization without
  // recording the schema version. An additive default can therefore change
  // the hash of the same authenticated cloud record. Trust its stable record
  // identity once, then persist a strict current-version hash for future checks.
  return meta.version < syncMetaVersion || contentHash === meta.contentHash;
}

function getWriterId() {
  const existing = localStorage.getItem(writerIdKey);
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  const value = crypto.randomUUID();
  try { localStorage.setItem(writerIdKey, value); } catch { /* use the in-memory id */ }
  return value;
}

function partsFromBackup(backup: WorkspaceBackup): WorkspaceParts {
  return {
    inventory: backup.inventory,
    accounting: backup.accounting,
    settings: backup.settings,
    publish: backup.publish,
    ui: backup.ui,
  };
}

export const useSyncStore = defineStore("sync", () => {
  const inventory = useInventoryStore();
  const accounting = useAccountingStore();
  const settings = useSettingsStore();
  const publish = usePublishStore();
  const ui = useUiStore();

  const status = ref<SyncStatus>("local");
  const active = ref(false);
  const lastSyncedAt = ref<number | null>(null);
  const errorMessage = ref("");
  const conflictMessage = ref("");
  const conflictCandidate = shallowRef<RemoteCandidate | null>(null);
  const passwordRotationRequired = ref(false);
  const statusLabel = computed(() => ({
    local: "仅本机",
    connecting: "正在连接云端",
    syncing: "正在同步",
    synced: "云端已同步",
    offline: "离线，已存本机",
    conflict: "需要选择版本",
    error: "云同步失败",
  })[status.value]);
  const statusTone = computed(() => ({
    local: "neutral", connecting: "info", syncing: "info", synced: "success",
    offline: "warning", conflict: "warning", error: "danger",
  })[status.value]);
  const isBusy = computed(() => status.value === "connecting" || status.value === "syncing");

  let rootKey: CryptoKey | null = null;
  let capability = "";
  let writerId = "";
  let database: SyncDatabase | null = null;
  let connectionStatus: ConnectionStatus | null = null;
  let unsubscribeQuery: (() => void) | null = null;
  let unsubscribeConnection: (() => void) | null = null;
  let stopLocalWatch: WatchStopHandle | null = null;
  let uploadTimer: number | undefined;
  let connectionTimer: number | undefined;
  let reconnectTimer: number | undefined;
  let stopRecoveryObserver: (() => void) | null = null;
  let reconnectAttempt = 0;
  let connectionTimedOut = false;
  let generation = 0;
  let initialized = false;
  let hasQueryResult = false;
  let latestRows: CloudWorkspace[] = [];
  let remoteRecord: CloudWorkspace | null = null;
  let syncedHash = "";
  let localDirty = false;
  let uploading = false;
  let pendingMutationId = "";
  let localChangeSequence = 0;
  let applyingRemote = false;
  let remoteProcessing: Promise<void> = Promise.resolve();
  let activeRefreshToken: symbol | null = null;
  let rotationToken: symbol | null = null;
  let cancelTransactionWait: (() => void) | null = null;

  const marketNames = catalog.gemMarketSnapshots.at(-1)?.items.map((item) => item.name) || [];

  function workspaceParts(): WorkspaceParts {
    return {
      inventory: inventory.exportState(),
      accounting: accounting.exportState(),
      settings: settings.exportState(),
      publish: publish.exportState(),
      ui: ui.exportState(),
    };
  }

  function hasMeaningfulLocalData(parts: WorkspaceParts) {
    return parts.inventory.snapshots.length > 0
      || parts.accounting.entries.length > 0
      || Object.keys(parts.settings.gemPriceOverrides).length > 0
      || Object.keys(parts.settings.overrides).length > 0
      || parts.settings.taskCompletions.length > 0
      || parts.settings.silverExpenses.length > 0
      || parts.settings.gemPriceHistory.length > 0
      || JSON.stringify(parts.settings.settings) !== JSON.stringify(catalog.beastConfig.taskDefaultSettings)
      || parts.publish.selectedIds.length > 0
      || canonicalStringify(parts.publish.options) !== canonicalStringify(defaultPublishOptions)
      // Merely opening the publish page generates a default preview. Only a
      // manual draft (or selected items/options above) represents user data.
      || parts.publish.draft !== parts.publish.generatedSource
      || canonicalStringify(parts.ui) !== canonicalStringify(defaultUiState);
  }

  function updateStatus() {
    if (!active.value) {
      status.value = "local";
      return;
    }
    if (conflictCandidate.value) {
      status.value = "conflict";
      return;
    }
    if (errorMessage.value) {
      status.value = "error";
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      status.value = "offline";
      return;
    }
    if (connectionTimedOut || connectionStatus === "closed" || connectionStatus === "errored") {
      status.value = "offline";
      return;
    }
    if (connectionStatus !== "authenticated" || !initialized) {
      status.value = "connecting";
      return;
    }
    status.value = uploading || localDirty ? "syncing" : "synced";
  }

  function friendlyError(error: unknown) {
    const raw = error instanceof Error ? error.message : String(error || "");
    if (/permission|rule|schema|attribute|attr/i.test(raw)) return "云端结构或权限尚未生效，请稍后重试。";
    if (/network|offline|socket|fetch|connection/i.test(raw)) return "暂时连不上云端；数据仍已保存在本机。";
    return raw ? `同步失败：${raw}` : "云同步暂时失败；数据仍已保存在本机。";
  }

  function isRetryableSyncError(error: unknown) {
    const raw = error instanceof Error ? error.message : String(error || "");
    return /network|offline|socket|fetch|connection|timeout|enqueued|网络|离线|连接|超时/i.test(raw);
  }

  function clearUploadTimer() {
    if (uploadTimer !== undefined) window.clearTimeout(uploadTimer);
    uploadTimer = undefined;
  }

  function clearConnectionTimer() {
    if (connectionTimer !== undefined) window.clearTimeout(connectionTimer);
    connectionTimer = undefined;
  }

  function clearReconnectTimer() {
    if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  }

  function waitForCloudTransaction<T>(transaction: Promise<T>, message: string) {
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      let timeout: number | undefined;
      let cancel: () => void = () => undefined;
      const finish = (settle: () => void) => {
        if (settled) return;
        settled = true;
        if (timeout !== undefined) window.clearTimeout(timeout);
        if (cancelTransactionWait === cancel) cancelTransactionWait = null;
        settle();
      };
      cancel = () => finish(() => reject(new Error("同步会话已结束")));
      cancelTransactionWait = cancel;
      timeout = window.setTimeout(
        () => finish(() => reject(new SyncTransactionTimeoutError(message))),
        transactionTimeoutMs,
      );
      transaction.then(
        (value) => finish(() => resolve(value)),
        (error) => finish(() => reject(error)),
      );
    });
  }

  function discardUncertainDatabase(sessionDatabase: SyncDatabase) {
    if (database !== sessionDatabase) return;
    unsubscribeQuery?.();
    unsubscribeConnection?.();
    unsubscribeQuery = null;
    unsubscribeConnection = null;
    if (resetSyncDatabase(sessionDatabase)) database = null;
    connectionStatus = "closed";
    connectionTimedOut = true;
  }

  function canReconnectNow() {
    const online = typeof navigator === "undefined" || navigator.onLine;
    const visible = typeof document === "undefined" || !document.hidden;
    return online && visible;
  }

  function scheduleReconnect(sessionGeneration: number, immediate = false) {
    const key = rootKey;
    if (!key || !active.value || rotationToken || !canReconnectNow()) return;
    if (reconnectTimer !== undefined) {
      if (!immediate) return;
      clearReconnectTimer();
    }
    const delay = immediate ? 0 : reconnectDelayMs(reconnectAttempt);
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = undefined;
      if (generation !== sessionGeneration || !active.value || rootKey !== key || !canReconnectNow()) return;
      reconnectAttempt += 1;
      void start(key, { reconnecting: true });
    }, delay);
  }

  function armConnectionTimeout(sessionGeneration: number) {
    clearConnectionTimer();
    if (!canReconnectNow()) return;
    connectionTimedOut = false;
    connectionTimer = window.setTimeout(() => {
      connectionTimer = undefined;
      if (generation !== sessionGeneration || connectionStatus === "authenticated") return;
      connectionTimedOut = true;
      updateStatus();
      scheduleReconnect(sessionGeneration);
    }, connectionTimeoutMs);
  }

  function recoverConnection(signal: SyncRecoverySignal) {
    const key = rootKey;
    if (!active.value || !key) return;
    if (!canReconnectNow()) {
      updateStatus();
      return;
    }
    if (signal.forceCheck && uploading && database) {
      // Mobile browsers can suspend the SDK transaction timer while the app
      // is in the background. Rebuild from a fresh remote query instead of
      // leaving the header stuck on “syncing” after the app resumes.
      discardUncertainDatabase(database);
      updateStatus();
      scheduleReconnect(generation, true);
      return;
    }
    if (connectionTimedOut || !database || connectionStatus === null) {
      scheduleReconnect(generation, true);
      return;
    }
    if (connectionStatus === "authenticated") {
      void refreshRemote().then(() => {
        if (localDirty && !conflictCandidate.value) scheduleUpload(80);
      });
      return;
    }
    if (connectionStatus === "errored") {
      if (signal.forceCheck) {
        errorMessage.value = "";
        scheduleReconnect(generation, true);
      }
      return;
    }
    if (connectionTimer === undefined) {
      armConnectionTimeout(generation);
    }
  }

  function attachRecoveryObserver() {
    stopRecoveryObserver?.();
    if (typeof window === "undefined" || typeof document === "undefined") return;
    stopRecoveryObserver = observeSyncRecovery({
      onRecovery: recoverConnection,
      onOffline: () => {
        clearConnectionTimer();
        clearReconnectTimer();
        updateStatus();
      },
      onHidden: () => {
        clearConnectionTimer();
        clearReconnectTimer();
      },
    });
  }

  function scheduleUpload(delay = uploadDebounceMs) {
    clearUploadTimer();
    if (!active.value || !initialized || !localDirty || conflictCandidate.value) return;
    uploadTimer = window.setTimeout(() => void uploadLocalWorkspace(), delay);
    updateStatus();
  }

  function applyBackup(backup: WorkspaceBackup) {
    const previous = workspaceParts();
    try {
      inventory.replaceState(backup.inventory);
      accounting.replaceState(backup.accounting);
      settings.replaceState(backup.settings);
      publish.replaceState(backup.publish);
      ui.replaceState(backup.ui);
    } catch (cause) {
      try { inventory.replaceState(previous.inventory); } catch { /* best-effort rollback */ }
      try { accounting.replaceState(previous.accounting); } catch { /* best-effort rollback */ }
      try { settings.replaceState(previous.settings); } catch { /* best-effort rollback */ }
      try { publish.replaceState(previous.publish); } catch { /* best-effort rollback */ }
      try { ui.replaceState(previous.ui); } catch { /* best-effort rollback */ }
      throw cause;
    }
  }

  async function decodeRecord(record: CloudWorkspace) {
    if (!rootKey) throw new Error("同步密钥不可用");
    if (record.id !== instantWorkspaceId || record.capability !== capability || !Number.isInteger(record.revision) || record.revision < 1) {
      throw new Error("云端记录校验失败");
    }
    const raw = await decryptWorkspace(rootKey, { iv: record.iv, ciphertext: record.ciphertext }, recordMetadata(record));
    const backup = parseWorkspaceBackup(raw, catalog.beastConfig.taskDefaultSettings, marketNames);
    const contentHash = await hashWorkspaceContent(partsFromBackup(backup));
    return { record, backup, contentHash } satisfies RemoteCandidate;
  }

  function persistConfirmedState(candidate: RemoteCandidate) {
    remoteRecord = candidate.record;
    syncedHash = candidate.contentHash;
    passwordRotationRequired.value = candidate.record.cryptoVersion < syncCryptoConfig.version;
    lastSyncedAt.value = candidate.record.updatedAt;
    saveSyncMeta({
      version: syncMetaVersion,
      revision: candidate.record.revision,
      contentHash: candidate.contentHash,
      mutationId: candidate.record.mutationId,
      updatedAt: candidate.record.updatedAt,
    });
  }

  function remoteHasAdvancedPast(record: CloudWorkspace) {
    return Boolean(remoteRecord && (
      remoteRecord.revision > record.revision
      || (remoteRecord.revision === record.revision
        && (remoteRecord.mutationId !== record.mutationId || remoteRecord.ciphertext !== record.ciphertext))
    ));
  }

  async function acceptRemote(candidate: RemoteCandidate, sessionGeneration: number) {
    applyingRemote = true;
    try {
      // Apply and validate every local partition before recording the remote
      // revision as confirmed. A failed replacement must remain retryable.
      applyBackup(candidate.backup);
      await nextTick();
      if (generation !== sessionGeneration) return;
      clearUploadTimer();
      persistConfirmedState(candidate);
      localDirty = false;
      errorMessage.value = "";
      updateStatus();
    } finally {
      applyingRemote = false;
    }
    if (generation === sessionGeneration) await handleLocalChange(sessionGeneration);
  }

  function openConflict(candidate: RemoteCandidate, message: string) {
    remoteRecord = candidate.record;
    conflictCandidate.value = candidate;
    conflictMessage.value = message;
    localDirty = true;
    clearUploadTimer();
    updateStatus();
  }

  async function processRemoteRecord(record: CloudWorkspace | null, sessionGeneration: number) {
    if (generation !== sessionGeneration || !active.value) return;
    if (!record) {
      if (!initialized) {
        initialized = true;
        remoteRecord = null;
        localDirty = false;
        clearUploadTimer();
        errorMessage.value = "云端工作区不可见：密码可能已在另一台设备更换，请退出后用新密码登录。";
        updateStatus();
      }
      return;
    }

    if (uploading && record.mutationId === pendingMutationId) return;
    const candidate = await decodeRecord(record);
    if (generation !== sessionGeneration) return;
    passwordRotationRequired.value = candidate.record.cryptoVersion < syncCryptoConfig.version;

    const confirmedMeta = loadSyncMeta();
    if (confirmedMeta && candidate.record.revision < confirmedMeta.revision) {
      errorMessage.value = "云端返回了早于本机已确认记录的数据，已停止自动覆盖。";
      updateStatus();
      return;
    }
    if (confirmedMeta && candidate.record.revision === confirmedMeta.revision
      && (!matchesConfirmedRecord(candidate.record, confirmedMeta)
        || !confirmedContentMatches(confirmedMeta, candidate.contentHash))) {
      errorMessage.value = "云端返回了同版本的不同数据，已停止自动覆盖。";
      updateStatus();
      return;
    }

    if (remoteRecord && record.revision < remoteRecord.revision) return;
    if (remoteRecord && record.revision === remoteRecord.revision) {
      if (record.mutationId !== remoteRecord.mutationId || record.ciphertext !== remoteRecord.ciphertext) {
        errorMessage.value = "云端返回了同版本的不同数据，已停止自动覆盖。";
        updateStatus();
      }
      return;
    }

    const localParts = workspaceParts();
    const localFingerprint = canonicalStringify(localParts);
    const localHash = await hashWorkspaceContent(localParts);
    if (generation !== sessionGeneration) return;
    // Hashing yields to the browser. If the user edits during that gap, the
    // decision below must not apply a remote snapshot over the newer local
    // state. Compare the current value synchronously before the first remote
    // mutation; this also catches edits whose Vue watcher has not flushed yet.
    if (canonicalStringify(workspaceParts()) !== localFingerprint) {
      localDirty = true;
      openConflict(candidate, "收到云端更新时本机仍在修改，请选择保留云端版本或当前本机版本。");
      return;
    }
    if (conflictCandidate.value) {
      if (localHash === candidate.contentHash) {
        conflictCandidate.value = null;
        conflictMessage.value = "";
        await acceptRemote(candidate, sessionGeneration);
      } else {
        openConflict(candidate, "等待选择期间云端又有更新，请选择保留最新云端版本或当前本机版本。");
      }
      return;
    }
    if (!initialized) {
      initialized = true;
      const meta = loadSyncMeta();
      const remoteMatchesLastConfirmed = Boolean(meta
        && matchesConfirmedRecord(candidate.record, meta)
        && confirmedContentMatches(meta, candidate.contentHash));
      if (remoteMatchesLastConfirmed && localHash !== candidate.contentHash) {
        // Only this device changed since the last confirmed base, so an
        // offline edit can resume automatically without a false conflict.
        persistConfirmedState(candidate);
        localDirty = true;
        errorMessage.value = "";
        scheduleUpload(80);
        return;
      }
      const changedSinceLastSync = Boolean(meta && localHash !== meta.contentHash);
      const firstDeviceConflict = !meta && hasMeaningfulLocalData(localParts) && localHash !== candidate.contentHash;
      if ((changedSinceLastSync || firstDeviceConflict || localDirty) && localHash !== candidate.contentHash) {
        openConflict(candidate, "这台设备和云端都有不同数据，请选择保留哪一份。");
        return;
      }
      await acceptRemote(candidate, sessionGeneration);
      return;
    }

    const hasLocalChanges = localHash !== syncedHash;
    if ((hasLocalChanges || localDirty || uploading) && localHash !== candidate.contentHash) {
      openConflict(candidate, "另一台设备已更新云端，而本机也有未同步修改。");
      return;
    }
    await acceptRemote(candidate, sessionGeneration);
  }

  async function processQueryRows(rows: CloudWorkspace[], sessionGeneration: number) {
    if (generation !== sessionGeneration || connectionStatus !== "authenticated" || !hasQueryResult) return;
    try {
      const matching = rows.filter((row) => row.id === instantWorkspaceId);
      if (matching.length > 1) throw new Error("云端存在重复工作区记录");
      await processRemoteRecord(matching[0] || null, sessionGeneration);
      if (generation === sessionGeneration) reconnectAttempt = 0;
    } catch (error) {
      if (generation !== sessionGeneration) return;
      errorMessage.value = friendlyError(error);
      updateStatus();
    }
  }

  function processLatestQuery(sessionGeneration: number) {
    // An authenticated connection can arrive before the first query result.
    // Do not enqueue the placeholder empty row set: if the real result lands
    // before the queued task runs, that stale snapshot would be mistaken for
    // a missing cloud workspace and could open a false conflict.
    if (!hasQueryResult) return Promise.resolve();
    const rows = [...latestRows];
    const processing = remoteProcessing.then(() => processQueryRows(rows, sessionGeneration));
    remoteProcessing = processing.catch(() => undefined);
    return processing;
  }

  async function handleLocalChange(sessionGeneration: number) {
    const sequence = ++localChangeSequence;
    if (applyingRemote) return;
    const contentHash = await hashWorkspaceContent(workspaceParts());
    if (generation !== sessionGeneration || sequence !== localChangeSequence) return;
    localDirty = contentHash !== syncedHash;
    if (localDirty) scheduleUpload();
    else updateStatus();
  }

  async function uploadLocalWorkspace() {
    clearUploadTimer();
    const sessionGeneration = generation;
    if (!active.value || !rootKey || !database || !initialized || !localDirty || conflictCandidate.value || uploading) return;
    if (connectionStatus !== "authenticated") {
      updateStatus();
      return;
    }
    const sessionDatabase = database;
    const sessionKey = rootKey;
    uploading = true;
    errorMessage.value = "";
    updateStatus();

    try {
      const parts = workspaceParts();
      const contentHash = await hashWorkspaceContent(parts);
      if (generation !== sessionGeneration || database !== sessionDatabase || rootKey !== sessionKey || !active.value) return;
      if (contentHash === syncedHash) {
        await handleLocalChange(sessionGeneration);
        return;
      }

      const metadata: WorkspaceCryptoMetadata = {
        capability,
        // Legacy records stay on v1 until the explicit password-rotation flow
        // re-encrypts them with a new, uncompromised credential.
        cryptoVersion: remoteRecord?.cryptoVersion || syncCryptoConfig.version,
        payloadVersion: syncCryptoConfig.payloadVersion,
        revision: (remoteRecord?.revision || 0) + 1,
        mutationId: crypto.randomUUID(),
        writerId,
        updatedAt: Date.now(),
      };
      const backup = createWorkspaceBackup(parts);
      const encrypted = await encryptWorkspace(sessionKey, backup, metadata);
      if (generation !== sessionGeneration || database !== sessionDatabase || rootKey !== sessionKey || !active.value || conflictCandidate.value) return;
      const record: CloudWorkspace = { id: instantWorkspaceId, ...metadata, ...encrypted };
      pendingMutationId = metadata.mutationId;
      const transaction = await waitForCloudTransaction(
        sessionDatabase.transact(sessionDatabase.tx.workspaces[instantWorkspaceId]
          .ruleParams({ capability })
          .update({ ...metadata, ...encrypted })),
        "云端写入超时",
      );
      if (generation !== sessionGeneration) return;
      if (transaction.status !== "synced") {
        // MemoryStorage deliberately has no durable outbox. Drop the queued
        // reactor so a refresh cannot mistake an optimistic write for an ack.
        discardUncertainDatabase(sessionDatabase);
        throw new Error("network transaction enqueued");
      }
      if (remoteHasAdvancedPast(record)) {
        return;
      }
      const candidate = { record, backup, contentHash } satisfies RemoteCandidate;
      persistConfirmedState(candidate);
      await handleLocalChange(sessionGeneration);
      if (generation !== sessionGeneration) return;
      if (remoteHasAdvancedPast(record)) return;
      errorMessage.value = "";
    } catch (error) {
      if (generation !== sessionGeneration) return;
      localDirty = true;
      const retryable = isRetryableSyncError(error);
      errorMessage.value = retryable ? "" : friendlyError(error);
      if (error instanceof SyncTransactionTimeoutError) discardUncertainDatabase(sessionDatabase);
      if (retryable) connectionTimedOut = true;
      void refreshRemote(true);
      if (retryable) scheduleReconnect(sessionGeneration);
    } finally {
      if (generation === sessionGeneration) {
        uploading = false;
        pendingMutationId = "";
        if (localDirty && !errorMessage.value && !conflictCandidate.value) scheduleUpload();
        updateStatus();
      }
    }
  }

  async function rotateEncryptionKey(nextKey: CryptoKey) {
    const oldKey = rootKey;
    const oldCapability = capability;
    const oldWriterId = writerId;
    const sessionGeneration = generation;
    if (!active.value || !oldKey || !database || !initialized || !remoteRecord) throw new Error("云同步尚未就绪，请稍后再试。");
    if (connectionStatus !== "authenticated") throw new Error("更换密码需要联网，请连接云端后再试。");
    if (uploading || localDirty || conflictCandidate.value) throw new Error("请先等待当前修改同步完成并解决冲突。");

    await remoteProcessing;
    if (generation !== sessionGeneration || uploading || localDirty || conflictCandidate.value) {
      throw new Error("同步状态刚刚发生变化，请确认同步完成后重试。");
    }

    const nextCapability = await deriveCapability(nextKey);
    if (nextCapability === oldCapability) throw new Error("新密码不能与当前密码相同。");
    const localParts = workspaceParts();
    const localFingerprint = canonicalStringify(localParts);
    const localHash = await hashWorkspaceContent(localParts);
    if (generation !== sessionGeneration || canonicalStringify(workspaceParts()) !== localFingerprint || localHash !== syncedHash) {
      throw new Error("本机数据刚刚发生变化，请等待同步完成后重试。");
    }

    // Drop subscriptions and optimistic storage before the fresh CAS read.
    // App.vue will start a new session after auth installs the new key.
    teardown();
    const currentRotation = Symbol("credential-rotation");
    rotationToken = currentRotation;
    const assertRotationActive = () => {
      if (rotationToken !== currentRotation) throw new Error("密码更换已取消。");
    };
    let rotationAcknowledged = false;
    let rotationDatabase: SyncDatabase | null = null;
    try {
      const verifiedOld = await validateCloudCredential(oldKey, { keepDatabase: true });
      assertRotationActive();
      const baseRecord = verifiedOld.record;
      const backup = parseWorkspaceBackup(verifiedOld.payload, catalog.beastConfig.taskDefaultSettings, marketNames);
      const verifiedHash = await hashWorkspaceContent(partsFromBackup(backup));
      assertRotationActive();
      if (verifiedHash !== localHash || canonicalStringify(workspaceParts()) !== localFingerprint) {
        throw new Error("云端或本机在更换密码前已有新修改，请重新同步后再试。");
      }

      const metadata: WorkspaceCryptoMetadata = {
        capability: nextCapability,
        cryptoVersion: syncCryptoConfig.version,
        payloadVersion: syncCryptoConfig.payloadVersion,
        revision: baseRecord.revision + 1,
        mutationId: crypto.randomUUID(),
        writerId: oldWriterId,
        updatedAt: Date.now(),
      };
      const encrypted = await encryptWorkspace(nextKey, verifiedOld.payload, metadata);
      assertRotationActive();
      if (canonicalStringify(workspaceParts()) !== localFingerprint) {
        throw new Error("本机数据在加密期间发生变化，请重新同步后再试。");
      }

      rotationDatabase = getSyncDatabase();
      assertRotationActive();
      const transaction = await rotationDatabase.transact(rotationDatabase.tx.workspaces[instantWorkspaceId]
        .ruleParams({
          capability: oldCapability,
          operation: "rotate",
          baseRevision: baseRecord.revision,
          mutationId: metadata.mutationId,
          nextCapability,
        })
        .update({ ...metadata, ...encrypted }));
      if (transaction.status !== "synced") {
        resetSyncDatabase(rotationDatabase);
        throw new Error("云端连接中断，密码尚未更换；恢复联网后可以重试。");
      }
      rotationAcknowledged = true;
      resetSyncDatabase(rotationDatabase);

      const verifiedNew = await validateCloudCredential(nextKey);
      if (verifiedNew.record.revision !== metadata.revision
        || verifiedNew.record.mutationId !== metadata.mutationId
        || verifiedNew.record.capability !== nextCapability) {
        throw new Error("云端确认结果与本次密码更换不一致，已停止自动写入。");
      }
      const confirmedBackup = parseWorkspaceBackup(verifiedNew.payload, catalog.beastConfig.taskDefaultSettings, marketNames);
      const confirmedHash = await hashWorkspaceContent(partsFromBackup(confirmedBackup));
      persistConfirmedState({
        record: verifiedNew.record,
        backup: confirmedBackup,
        contentHash: confirmedHash,
      });
      passwordRotationRequired.value = false;
      if (rotationToken === currentRotation) rotationToken = null;
    } catch (error) {
      if (rotationDatabase) resetSyncDatabase(rotationDatabase);
      // Before the server acknowledges rotation it is safe to resume the old
      // key. After acknowledgement, leave sync stopped: only a fresh query
      // with the new password may complete the local credential swap.
      const rotationStillActive = rotationToken === currentRotation;
      if (rotationStillActive) rotationToken = null;
      if (!rotationAcknowledged && rotationStillActive) void start(oldKey);
      if (rotationAcknowledged) {
        throw new Error("云端已接受密码更换，但最终复核被中断。请不要再用旧密码；联网后退出，并先尝试用刚输入的新密码登录。");
      }
      throw error;
    }
  }

  async function refreshRemote(keepError = false) {
    const sessionGeneration = generation;
    if (!active.value || !database || !capability || connectionStatus !== "authenticated") return;
    if (activeRefreshToken) return;
    const refreshToken = Symbol("sync-refresh");
    activeRefreshToken = refreshToken;
    let timeout: number | undefined;
    try {
      const response = await Promise.race([
        database.queryOnce({ workspaces: { $: { where: { id: instantWorkspaceId } } } }, { ruleParams: { capability } }),
        new Promise<never>((_, reject) => {
          timeout = window.setTimeout(() => reject(new Error("连接云端超时")), connectionTimeoutMs);
        }),
      ]);
      if (generation !== sessionGeneration) return;
      latestRows = response.data.workspaces as CloudWorkspace[];
      hasQueryResult = true;
      if (!keepError) errorMessage.value = "";
      await processLatestQuery(sessionGeneration);
    } catch (error) {
      if (generation !== sessionGeneration) return;
      const retryable = isRetryableSyncError(error);
      errorMessage.value = retryable ? "" : friendlyError(error);
      if (retryable) {
        connectionTimedOut = true;
        scheduleReconnect(sessionGeneration);
      }
      updateStatus();
    } finally {
      if (timeout !== undefined) window.clearTimeout(timeout);
      if (activeRefreshToken === refreshToken) activeRefreshToken = null;
    }
  }

  function teardown(options: { preserveReconnectAttempt?: boolean } = {}) {
    rotationToken = null;
    generation += 1;
    cancelTransactionWait?.();
    cancelTransactionWait = null;
    clearUploadTimer();
    clearConnectionTimer();
    clearReconnectTimer();
    unsubscribeQuery?.();
    unsubscribeConnection?.();
    stopLocalWatch?.();
    stopRecoveryObserver?.();
    // A pending Instant transaction may have reached the server without an
    // acknowledgement. Recreate the reactor from a clean remote query on the
    // next session instead of carrying an uncertain optimistic outbox across
    // logout/retry/key changes.
    if (database) resetSyncDatabase(database);
    unsubscribeQuery = null;
    unsubscribeConnection = null;
    stopLocalWatch = null;
    stopRecoveryObserver = null;
    rootKey = null;
    capability = "";
    writerId = "";
    database = null;
    connectionStatus = null;
    connectionTimedOut = false;
    initialized = false;
    hasQueryResult = false;
    latestRows = [];
    remoteRecord = null;
    syncedHash = "";
    localDirty = false;
    uploading = false;
    pendingMutationId = "";
    applyingRemote = false;
    remoteProcessing = Promise.resolve();
    activeRefreshToken = null;
    conflictCandidate.value = null;
    conflictMessage.value = "";
    errorMessage.value = "";
    if (!options.preserveReconnectAttempt) reconnectAttempt = 0;
    active.value = false;
    updateStatus();
  }

  async function start(key: CryptoKey, options: { reconnecting?: boolean } = {}) {
    teardown({ preserveReconnectAttempt: options.reconnecting });
    const sessionGeneration = generation;
    active.value = true;
    passwordRotationRequired.value = false;
    rootKey = key;
    writerId = getWriterId();
    attachRecoveryObserver();
    status.value = "connecting";
    try {
      capability = await deriveCapability(key);
      if (generation !== sessionGeneration) return;
      const meta = loadSyncMeta();
      if (meta) {
        syncedHash = meta.contentHash;
        lastSyncedAt.value = meta.updatedAt;
      }
      const initialHash = await hashWorkspaceContent(workspaceParts());
      if (generation !== sessionGeneration) return;
      localDirty = Boolean(meta && initialHash !== meta.contentHash);
      stopLocalWatch = watch(workspaceParts, () => void handleLocalChange(sessionGeneration), { deep: true });

      database = getSyncDatabase();
      unsubscribeConnection = database.subscribeConnectionStatus((nextStatus) => {
        if (generation !== sessionGeneration) return;
        connectionStatus = nextStatus;
        if (nextStatus === "authenticated") {
          clearConnectionTimer();
          clearReconnectTimer();
          connectionTimedOut = false;
          errorMessage.value = "";
          void processLatestQuery(sessionGeneration).then(() => {
            if (localDirty && !conflictCandidate.value) scheduleUpload(120);
          });
        } else if (nextStatus === "connecting" || nextStatus === "opened") {
          if (connectionTimer === undefined) armConnectionTimeout(sessionGeneration);
        } else if (nextStatus === "closed") {
          if (connectionTimer === undefined && canReconnectNow()) armConnectionTimeout(sessionGeneration);
        } else if (nextStatus === "errored") {
          clearConnectionTimer();
          clearReconnectTimer();
          connectionTimedOut = false;
          errorMessage.value = "云端拒绝了同步连接，请检查配置或稍后手动重试。";
        }
        updateStatus();
      });
      unsubscribeQuery = database.subscribeQuery(
        { workspaces: { $: { where: { id: instantWorkspaceId } } } },
        (response) => {
          if (generation !== sessionGeneration) return;
          if (response.error) {
            const retryable = isRetryableSyncError(response.error.message);
            errorMessage.value = retryable ? "" : friendlyError(response.error.message);
            if (retryable) {
              connectionTimedOut = true;
              scheduleReconnect(sessionGeneration);
            }
            updateStatus();
            return;
          }
          latestRows = response.data.workspaces as CloudWorkspace[];
          hasQueryResult = true;
          void processLatestQuery(sessionGeneration);
        },
        { ruleParams: { capability } },
      );
      if (canReconnectNow()) armConnectionTimeout(sessionGeneration);
    } catch (error) {
      if (generation !== sessionGeneration) return;
      errorMessage.value = friendlyError(error);
      updateStatus();
    }
  }

  async function useRemoteVersion() {
    const candidate = conflictCandidate.value;
    if (!candidate) return;
    const sessionGeneration = generation;
    conflictCandidate.value = null;
    conflictMessage.value = "";
    try {
      await acceptRemote(candidate, sessionGeneration);
    } catch (error) {
      if (generation !== sessionGeneration) return;
      conflictCandidate.value = candidate;
      conflictMessage.value = "云端版本暂时无法应用，本机数据未被覆盖。";
      errorMessage.value = friendlyError(error);
      updateStatus();
    }
  }

  function keepLocalVersion() {
    const candidate = conflictCandidate.value;
    if (!candidate) return;
    remoteRecord = candidate.record;
    conflictCandidate.value = null;
    conflictMessage.value = "";
    localDirty = true;
    errorMessage.value = "";
    scheduleUpload(80);
  }

  function retry() {
    const key = rootKey;
    if (key && (connectionTimedOut || !database || connectionStatus !== "authenticated")) {
      void start(key);
      return;
    }
    errorMessage.value = "";
    updateStatus();
    void refreshRemote().then(() => {
      if (localDirty && !conflictCandidate.value) scheduleUpload(80);
    });
  }

  function stop() {
    teardown();
  }

  return {
    status, statusLabel, statusTone, isBusy, active, lastSyncedAt, errorMessage,
    passwordRotationRequired,
    conflictMessage, hasConflict: computed(() => conflictCandidate.value !== null),
    start, stop, retry, rotateEncryptionKey, useRemoteVersion, keepLocalVersion,
  };
});
