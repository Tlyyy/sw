import type { ConnectionStatus } from "@instantdb/core";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { instantWorkspaceId, syncCryptoConfig } from "../../instant.config";
import { createWorkspaceBackup } from "../persistence/state";
import type { SyncDatabase } from "../sync/instant";
import { syncReconnectConfig } from "../sync/reconnect";
import type { CloudWorkspace } from "../sync/types";
import { useInventoryStore } from "./inventory";
import { usePublishStore } from "./publish";
import { useSettingsStore } from "./settings";
import { useSyncStore } from "./sync";
import { uiStorageKey, useUiStore } from "./ui";

const instant = vi.hoisted(() => ({
  getSyncDatabase: vi.fn(),
  resetSyncDatabase: vi.fn(),
}));
const syncCrypto = vi.hoisted(() => ({
  deriveCapability: vi.fn(async (_key: unknown) => "test-capability"),
  hashWorkspaceContent: vi.fn(async (_value: unknown) => "test-hash"),
  decryptWorkspace: vi.fn(async () => ""),
  encryptWorkspace: vi.fn(async () => ({ iv: "test-iv", ciphertext: "test-ciphertext" })),
}));

vi.mock("../sync/instant", () => instant);
vi.mock("../sync/crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../sync/crypto")>();
  return { ...actual, ...syncCrypto };
});

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

type QueryResponse = { data: { workspaces: unknown[] }; error?: { message: string } };

function createFakeDatabase() {
  let connectionCallback: ((status: ConnectionStatus) => void) | undefined;
  let queryCallback: ((response: QueryResponse) => void) | undefined;
  const txNode: Record<string, unknown> = {};
  txNode.ruleParams = vi.fn(() => txNode);
  txNode.update = vi.fn((value: unknown) => ({ value }));
  const raw = {
    subscribeConnectionStatus: vi.fn((callback: typeof connectionCallback) => {
      connectionCallback = callback;
      return vi.fn();
    }),
    subscribeQuery: vi.fn((_query: unknown, callback: typeof queryCallback, _options: unknown) => {
      queryCallback = callback;
      return vi.fn();
    }),
    queryOnce: vi.fn(async () => ({ data: { workspaces: [] } })),
    transact: vi.fn(async () => ({ status: "synced" as const })),
    tx: { workspaces: new Proxy({}, { get: () => txNode }) },
    shutdown: vi.fn(),
  };
  return {
    db: raw as unknown as SyncDatabase,
    raw,
    emitConnection: (status: ConnectionStatus) => connectionCallback?.(status),
    emitRows: (rows: unknown[] = []) => queryCallback?.({ data: { workspaces: rows } }),
  };
}

class FakeDocument extends EventTarget {
  hidden = false;
}

let networkState: { onLine: boolean };
let fakeDocument: FakeDocument;
let fakeWindow: EventTarget;
let databases: ReturnType<typeof createFakeDatabase>[];

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.stubGlobal("localStorage", new MemoryStorage());
  networkState = { onLine: true };
  fakeDocument = new FakeDocument();
  fakeWindow = Object.assign(new EventTarget(), {
    setTimeout: (...args: Parameters<typeof setTimeout>) => globalThis.setTimeout(...args),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(id),
  });
  vi.stubGlobal("navigator", networkState);
  vi.stubGlobal("document", fakeDocument);
  vi.stubGlobal("window", fakeWindow);
  setActivePinia(createPinia());
  databases = [];
  instant.getSyncDatabase.mockReset();
  instant.resetSyncDatabase.mockReset().mockReturnValue(true);
  syncCrypto.deriveCapability.mockReset().mockResolvedValue("test-capability");
  syncCrypto.hashWorkspaceContent.mockReset().mockResolvedValue("test-hash");
  syncCrypto.decryptWorkspace.mockReset().mockResolvedValue("");
  syncCrypto.encryptWorkspace.mockReset().mockResolvedValue({ iv: "test-iv", ciphertext: "test-ciphertext" });
  instant.getSyncDatabase.mockImplementation(() => {
    const fixture = createFakeDatabase();
    databases.push(fixture);
    return fixture.db;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function startStore() {
  const store = useSyncStore();
  await store.start({} as CryptoKey);
  expect(databases).toHaveLength(1);
  return store;
}

async function advanceToWatchdogReconnect() {
  await vi.advanceTimersByTimeAsync(20_000);
  await vi.advanceTimersByTimeAsync(syncReconnectConfig.baseDelayMs);
}

describe("sync store schema compatibility", () => {
  it("upgrades a legacy confirmed hash when the same cloud record gains default fields", async () => {
    syncCrypto.hashWorkspaceContent.mockImplementation(async (value) => {
      const parts = value as { settings?: { gemPlan?: unknown } };
      return parts.settings?.gemPlan ? "normalized-hash" : "legacy-hash";
    });
    const inventory = useInventoryStore();
    const settings = useSettingsStore();
    const publish = usePublishStore();
    const ui = useUiStore();
    const updatedAt = Date.parse("2026-07-20T14:46:11.000Z");
    const remoteBackup = createWorkspaceBackup({
      inventory: inventory.exportState(),
      settings: settings.exportState(),
      publish: publish.exportState(),
      ui: ui.exportState(),
    }, () => new Date(updatedAt));
    delete (remoteBackup.settings as Partial<typeof remoteBackup.settings>).gemPlan;
    syncCrypto.decryptWorkspace.mockResolvedValue(JSON.stringify(remoteBackup));
    localStorage.setItem("sw.sync.meta.v1", JSON.stringify({
      version: 1,
      revision: 7,
      contentHash: "legacy-hash",
      mutationId: "confirmed-mutation",
      updatedAt,
    }));
    const remoteRecord: CloudWorkspace = {
      id: instantWorkspaceId,
      capability: "test-capability",
      cryptoVersion: syncCryptoConfig.legacyVersion,
      payloadVersion: syncCryptoConfig.payloadVersion,
      revision: 7,
      mutationId: "confirmed-mutation",
      writerId: "remote-writer",
      updatedAt,
      iv: "remote-iv",
      ciphertext: "remote-ciphertext",
    };

    const store = await startStore();
    databases[0].emitConnection("authenticated");
    databases[0].emitRows([remoteRecord]);
    await vi.advanceTimersByTimeAsync(0);

    expect(store.status).toBe("synced");
    expect(store.errorMessage).toBe("");
    expect(store.hasConflict).toBe(false);
    expect(store.passwordRotationRequired).toBe(true);
    expect(databases[0].raw.transact).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("sw.sync.meta.v1") || "null")).toMatchObject({
      version: 2,
      revision: 7,
      contentHash: "normalized-hash",
      mutationId: "confirmed-mutation",
      updatedAt,
    });
    store.stop();
  });

  it("continues to reject an older cloud revision", async () => {
    const inventory = useInventoryStore();
    const settings = useSettingsStore();
    const publish = usePublishStore();
    const ui = useUiStore();
    const remoteBackup = createWorkspaceBackup({
      inventory: inventory.exportState(), settings: settings.exportState(),
      publish: publish.exportState(), ui: ui.exportState(),
    });
    syncCrypto.decryptWorkspace.mockResolvedValue(JSON.stringify(remoteBackup));
    localStorage.setItem("sw.sync.meta.v1", JSON.stringify({
      version: 2,
      revision: 8,
      contentHash: "test-hash",
      mutationId: "newer-mutation",
      updatedAt: 8_000,
    }));
    const remoteRecord: CloudWorkspace = {
      id: instantWorkspaceId,
      capability: "test-capability",
      cryptoVersion: syncCryptoConfig.version,
      payloadVersion: syncCryptoConfig.payloadVersion,
      revision: 7,
      mutationId: "older-mutation",
      writerId: "remote-writer",
      updatedAt: 7_000,
      iv: "remote-iv",
      ciphertext: "remote-ciphertext",
    };

    const store = await startStore();
    databases[0].emitConnection("authenticated");
    databases[0].emitRows([remoteRecord]);
    await vi.advanceTimersByTimeAsync(0);

    expect(store.status).toBe("error");
    expect(store.errorMessage).toContain("早于本机已确认记录");
    expect(databases[0].raw.transact).not.toHaveBeenCalled();
    store.stop();
  });

  it("continues to reject a fork with the same revision", async () => {
    const inventory = useInventoryStore();
    const settings = useSettingsStore();
    const publish = usePublishStore();
    const ui = useUiStore();
    const updatedAt = 8_000;
    const remoteBackup = createWorkspaceBackup({
      inventory: inventory.exportState(), settings: settings.exportState(),
      publish: publish.exportState(), ui: ui.exportState(),
    });
    syncCrypto.decryptWorkspace.mockResolvedValue(JSON.stringify(remoteBackup));
    localStorage.setItem("sw.sync.meta.v1", JSON.stringify({
      version: 2,
      revision: 8,
      contentHash: "test-hash",
      mutationId: "confirmed-mutation",
      updatedAt,
    }));
    const remoteRecord: CloudWorkspace = {
      id: instantWorkspaceId,
      capability: "test-capability",
      cryptoVersion: syncCryptoConfig.version,
      payloadVersion: syncCryptoConfig.payloadVersion,
      revision: 8,
      mutationId: "forked-mutation",
      writerId: "remote-writer",
      updatedAt,
      iv: "remote-iv",
      ciphertext: "remote-ciphertext",
    };

    const store = await startStore();
    databases[0].emitConnection("authenticated");
    databases[0].emitRows([remoteRecord]);
    await vi.advanceTimersByTimeAsync(0);

    expect(store.status).toBe("error");
    expect(store.errorMessage).toContain("同版本的不同数据");
    expect(databases[0].raw.transact).not.toHaveBeenCalled();
    store.stop();
  });

  it("keeps strict hash checks after the local metadata has been upgraded", async () => {
    syncCrypto.hashWorkspaceContent
      .mockResolvedValueOnce("confirmed-hash")
      .mockResolvedValueOnce("changed-hash");
    const inventory = useInventoryStore();
    const settings = useSettingsStore();
    const publish = usePublishStore();
    const ui = useUiStore();
    const updatedAt = 9_000;
    const remoteBackup = createWorkspaceBackup({
      inventory: inventory.exportState(), settings: settings.exportState(),
      publish: publish.exportState(), ui: ui.exportState(),
    });
    syncCrypto.decryptWorkspace.mockResolvedValue(JSON.stringify(remoteBackup));
    localStorage.setItem("sw.sync.meta.v1", JSON.stringify({
      version: 2,
      revision: 9,
      contentHash: "confirmed-hash",
      mutationId: "confirmed-mutation",
      updatedAt,
    }));
    const remoteRecord: CloudWorkspace = {
      id: instantWorkspaceId,
      capability: "test-capability",
      cryptoVersion: syncCryptoConfig.version,
      payloadVersion: syncCryptoConfig.payloadVersion,
      revision: 9,
      mutationId: "confirmed-mutation",
      writerId: "remote-writer",
      updatedAt,
      iv: "remote-iv",
      ciphertext: "changed-ciphertext",
    };

    const store = await startStore();
    databases[0].emitConnection("authenticated");
    databases[0].emitRows([remoteRecord]);
    await vi.advanceTimersByTimeAsync(0);

    expect(store.status).toBe("error");
    expect(store.errorMessage).toContain("同版本的不同数据");
    expect(databases[0].raw.transact).not.toHaveBeenCalled();
    store.stop();
  });
});

describe("sync store mobile recovery", () => {
  it("rebuilds a connection that never authenticates", async () => {
    const store = await startStore();
    await advanceToWatchdogReconnect();
    expect(databases).toHaveLength(2);
    store.stop();
  });

  it("lets the InstantDB client recover a closed socket before the watchdog intervenes", async () => {
    const store = await startStore();
    databases[0].emitConnection("authenticated");
    databases[0].emitConnection("closed");
    await vi.advanceTimersByTimeAsync(19_999);
    expect(databases).toHaveLength(1);
    databases[0].emitConnection("authenticated");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(databases).toHaveLength(1);
    store.stop();
  });

  it("does not loop automatically after the server rejects initialization", async () => {
    const store = await startStore();
    databases[0].emitConnection("errored");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(databases).toHaveLength(1);
    expect(store.status).toBe("error");
    store.stop();
  });

  it("lets InstantDB recover when the network returns and rebuilds only after the watchdog", async () => {
    const store = await startStore();
    databases[0].emitConnection("authenticated");
    networkState.onLine = false;
    fakeWindow.dispatchEvent(new Event("offline"));
    databases[0].emitConnection("closed");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(databases).toHaveLength(1);

    networkState.onLine = true;
    fakeWindow.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(databases).toHaveLength(1);
    await advanceToWatchdogReconnect();
    expect(databases).toHaveLength(2);
    store.stop();
  });

  it("health-checks a resumed authenticated session and rebuilds it when the check hangs", async () => {
    const store = await startStore();
    databases[0].emitConnection("authenticated");
    databases[0].raw.queryOnce.mockImplementation(() => new Promise(() => undefined));

    fakeDocument.hidden = true;
    fakeDocument.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(syncReconnectConfig.backgroundRestartThresholdMs);
    fakeDocument.hidden = false;
    fakeDocument.dispatchEvent(new Event("visibilitychange"));

    await advanceToWatchdogReconnect();
    expect(databases[0].raw.queryOnce).toHaveBeenCalledTimes(1);
    expect(databases).toHaveLength(2);
    store.stop();
  });

  it("removes recovery listeners and timers after sync stops", async () => {
    const store = await startStore();
    databases[0].emitConnection("closed");
    store.stop();
    networkState.onLine = false;
    fakeWindow.dispatchEvent(new Event("offline"));
    networkState.onLine = true;
    fakeWindow.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(databases).toHaveLength(1);
  });

  it("abandons a timed-out cloud write, preserves the local edit, and reconnects", async () => {
    syncCrypto.hashWorkspaceContent.mockImplementation(async (value) => JSON.stringify(value));
    const inventory = useInventoryStore();
    const settings = useSettingsStore();
    const publish = usePublishStore();
    const ui = useUiStore();
    const remoteBackup = createWorkspaceBackup({
      inventory: inventory.exportState(),
      settings: settings.exportState(),
      publish: publish.exportState(),
      ui: ui.exportState(),
    }, () => new Date("2026-07-19T00:00:00.000Z"));
    syncCrypto.decryptWorkspace.mockResolvedValue(JSON.stringify(remoteBackup));

    const remoteRecord: CloudWorkspace = {
      id: instantWorkspaceId,
      capability: "test-capability",
      cryptoVersion: syncCryptoConfig.version,
      payloadVersion: syncCryptoConfig.payloadVersion,
      revision: 1,
      mutationId: "remote-mutation-1",
      writerId: "remote-writer",
      updatedAt: Date.parse("2026-07-19T00:00:00.000Z"),
      iv: "remote-iv",
      ciphertext: "remote-ciphertext",
    };

    const store = await startStore();
    databases[0].emitConnection("authenticated");
    databases[0].emitRows([remoteRecord]);
    await vi.advanceTimersByTimeAsync(0);
    expect(store.status).toBe("synced");

    databases[0].raw.transact.mockImplementation(() => new Promise<never>(() => undefined));
    ui.recentAccount = "FC";
    await vi.advanceTimersByTimeAsync(0);
    expect(store.status).toBe("syncing");

    await vi.advanceTimersByTimeAsync(900);
    expect(databases[0].raw.transact).toHaveBeenCalledTimes(1);
    expect(store.status).toBe("syncing");

    await vi.advanceTimersByTimeAsync(20_000);
    await vi.advanceTimersByTimeAsync(syncReconnectConfig.baseDelayMs);

    expect(store.status).not.toBe("syncing");
    expect(ui.recentAccount).toBe("FC");
    expect(JSON.parse(localStorage.getItem(uiStorageKey) || "null")?.recentAccount).toBe("FC");
    expect(instant.resetSyncDatabase).toHaveBeenCalledWith(databases[0].db);
    expect(databases).toHaveLength(2);

    databases[1].emitConnection("authenticated");
    databases[1].emitRows([remoteRecord]);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(120);
    expect(databases[1].raw.transact).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(store.status).toBe("synced");
    expect(ui.recentAccount).toBe("FC");
    store.stop();
  });
});
