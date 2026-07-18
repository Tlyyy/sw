import { computed, ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import { cleanupCredentials, deleteCredential, loadCredential, saveCredential } from "../sync/credentialStore";
import { deriveRootKey } from "../sync/crypto";
import { InvalidCloudCredentialError, validateCloudCredential } from "../sync/validateCredential";
import { useSyncStore } from "./sync";

const sessionKey = "sw-site-auth-session";
const rememberKey = "sw-site-auth-until";
const e2eSessionKey = "sw-e2e-auth-v1";
const rememberDuration = 7 * 24 * 60 * 60 * 1000;

function isLocalAutomationSession() {
  if (typeof location === "undefined" || typeof navigator === "undefined") return false;
  const isLoopback = location.hostname === "127.0.0.1" || location.hostname === "localhost";
  return isLoopback && navigator.webdriver === true && sessionStorage.getItem(e2eSessionKey) === "1";
}

interface SessionHandle {
  version: 1;
  id: string;
}

interface RememberHandle extends SessionHandle {
  expiresAt: number;
}

function parseHandle<T extends SessionHandle>(value: string | null, remembered = false): T | null {
  try {
    const parsed = JSON.parse(value || "null") as Partial<RememberHandle> | null;
    if (!parsed || parsed.version !== 1 || typeof parsed.id !== "string" || !parsed.id) return null;
    if (remembered && (!Number.isFinite(parsed.expiresAt) || Number(parsed.expiresAt) <= Date.now())) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

export const useAuthStore = defineStore("auth", () => {
  const unlocked = ref(false);
  const restoring = ref(true);
  const busy = ref(false);
  const error = ref("");
  const warning = ref("");
  const changingPassword = ref(false);
  const passwordChangeError = ref("");
  const credentialKey = shallowRef<CryptoKey | null>(null);
  const automationUnlocked = ref(isLocalAutomationSession());
  const isUnlocked = computed(() => automationUnlocked.value || (unlocked.value && credentialKey.value !== null));
  let activeCredentialId: string | null = null;
  let restorePromise: Promise<void> | null = null;
  let generation = 0;

  const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("sw-auth-v1");

  function clearHandles(preserveRemembered = false) {
    sessionStorage.removeItem(sessionKey);
    sessionStorage.removeItem(e2eSessionKey);
    if (!preserveRemembered) localStorage.removeItem(rememberKey);
  }

  function referencedCredentialIds() {
    const session = parseHandle<SessionHandle>(sessionStorage.getItem(sessionKey));
    const remembered = parseHandle<RememberHandle>(localStorage.getItem(rememberKey), true);
    return [...new Set([session?.id, remembered?.id, activeCredentialId].filter((value): value is string => Boolean(value)))];
  }

  async function lock(notifyOtherTabs: boolean, preserveCredentialId: string | null = null) {
    generation += 1;
    useSyncStore().stop();
    const ids = referencedCredentialIds().filter((id) => id !== preserveCredentialId);
    clearHandles(Boolean(preserveCredentialId));
    activeCredentialId = null;
    credentialKey.value = null;
    unlocked.value = false;
    automationUnlocked.value = false;
    restoring.value = false;
    changingPassword.value = false;
    error.value = "";
    warning.value = "";
    passwordChangeError.value = "";
    if (notifyOtherTabs) channel?.postMessage({ type: "logout" });
    await Promise.all(ids.map((id) => deleteCredential(id).catch(() => undefined)));
  }

  channel?.addEventListener("message", (event) => {
    if (event.data?.type === "logout") void lock(false);
    if (event.data?.type === "password-changed") {
      const preservedId = typeof event.data.credentialId === "string" ? event.data.credentialId : null;
      void lock(false, preservedId);
    }
  });

  async function restore() {
    if (restorePromise) return restorePromise;
    const restoreGeneration = generation;
    restorePromise = (async () => {
      restoring.value = true;
      warning.value = "";
      // Automated localhost runs render the UI without receiving a cloud key.
      // This keeps E2E coverage isolated from real synced data.
      if (automationUnlocked.value) {
        restoring.value = false;
        return;
      }
      // Session-only keys now stay in memory. Remove handles created by older
      // builds instead of restoring their IndexedDB key.
      sessionStorage.removeItem(sessionKey);
      const remembered = parseHandle<RememberHandle>(localStorage.getItem(rememberKey), true);
      if (!remembered) localStorage.removeItem(rememberKey);
      const handle = remembered;
      try {
        if (!handle) {
          await cleanupCredentials([]).catch(() => undefined);
          return;
        }
        const stored = await loadCredential(handle.id);
        const expired = stored?.expiresAt !== null && Number(stored?.expiresAt) <= Date.now();
        if (generation !== restoreGeneration) return;
        if (!stored || expired) {
          clearHandles();
          if (stored) await deleteCredential(stored.id).catch(() => undefined);
          return;
        }
        activeCredentialId = stored.id;
        credentialKey.value = stored.key;
        unlocked.value = true;
        await cleanupCredentials([stored.id]).catch(() => undefined);
      } catch {
        if (generation !== restoreGeneration) return;
        clearHandles();
        warning.value = "无法恢复云同步解锁密钥，请重新输入密码。";
      } finally {
        if (generation === restoreGeneration) restoring.value = false;
      }
    })();
    return restorePromise;
  }

  async function login(password: string, remember: boolean) {
    busy.value = true;
    error.value = "";
    warning.value = "";
    passwordChangeError.value = "";
    const loginGeneration = ++generation;
    try {
      const rootKey = await deriveRootKey(password);
      if (generation !== loginGeneration) return false;
      try {
        await validateCloudCredential(rootKey);
      } catch (cause) {
        if (generation !== loginGeneration) return false;
        error.value = cause instanceof InvalidCloudCredentialError
          ? "密码不对，再试一次。"
          : cause instanceof Error && /版本过新/.test(cause.message)
            ? cause.message
            : "暂时连不上云端，首次解锁需要联网；已记住的设备可直接恢复。";
        return false;
      }
      if (generation !== loginGeneration) return false;
      const priorIds = referencedCredentialIds();
      clearHandles();
      activeCredentialId = null;
      if (remember) {
        const id = crypto.randomUUID();
        const expiresAt = Date.now() + rememberDuration;
        try {
          await saveCredential({ id, key: rootKey, mode: "remember", createdAt: Date.now(), expiresAt });
          if (generation !== loginGeneration) {
            await deleteCredential(id).catch(() => undefined);
            return false;
          }
          localStorage.setItem(rememberKey, JSON.stringify({ version: 1, id, expiresAt } satisfies RememberHandle));
          activeCredentialId = id;
          priorIds.filter((priorId) => priorId !== id).forEach((priorId) => void deleteCredential(priorId).catch(() => undefined));
        } catch {
          await deleteCredential(id).catch(() => undefined);
          if (generation !== loginGeneration) return false;
          clearHandles();
          warning.value = "已解锁，但浏览器无法保存云同步密钥；刷新后需要重新输入密码。";
        }
      } else {
        priorIds.forEach((priorId) => void deleteCredential(priorId).catch(() => undefined));
      }
      if (generation !== loginGeneration) return false;
      credentialKey.value = rootKey;
      unlocked.value = true;
      return true;
    } catch {
      error.value = "当前浏览器无法完成安全密码校验。";
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function changePassword(nextPassword: string) {
    passwordChangeError.value = "";
    warning.value = "";
    if (Array.from(nextPassword).length < 16) {
      passwordChangeError.value = "新密码至少需要 16 个字符，建议使用一条只用于本应用的长口令。";
      return false;
    }
    if (!credentialKey.value || !unlocked.value) {
      passwordChangeError.value = "当前解锁密钥不可用，请重新登录后再试。";
      return false;
    }

    changingPassword.value = true;
    const changeGeneration = ++generation;
    const priorIds = referencedCredentialIds();
    const remembered = parseHandle<RememberHandle>(localStorage.getItem(rememberKey), true);
    const shouldRemember = Boolean(remembered && remembered.id === activeCredentialId);
    try {
      const nextKey = await deriveRootKey(nextPassword);
      if (generation !== changeGeneration) return false;
      await useSyncStore().rotateEncryptionKey(nextKey);
      if (generation !== changeGeneration) return false;

      let nextCredentialId: string | null = null;
      if (shouldRemember) {
        const id = crypto.randomUUID();
        const expiresAt = Date.now() + rememberDuration;
        try {
          await saveCredential({ id, key: nextKey, mode: "remember", createdAt: Date.now(), expiresAt });
          if (generation !== changeGeneration) {
            await deleteCredential(id).catch(() => undefined);
            return false;
          }
          localStorage.setItem(rememberKey, JSON.stringify({ version: 1, id, expiresAt } satisfies RememberHandle));
          nextCredentialId = id;
        } catch {
          await deleteCredential(id).catch(() => undefined);
          if (generation !== changeGeneration) return false;
          clearHandles();
          warning.value = "密码已更换，但浏览器无法记住新密钥；刷新后需要联网重新输入新密码。";
        }
      } else {
        clearHandles();
      }

      activeCredentialId = nextCredentialId;
      credentialKey.value = nextKey;
      unlocked.value = true;
      priorIds.filter((id) => id !== nextCredentialId).forEach((id) => void deleteCredential(id).catch(() => undefined));
      channel?.postMessage({ type: "password-changed", credentialId: nextCredentialId });
      return true;
    } catch (error) {
      if (generation !== changeGeneration) return false;
      passwordChangeError.value = error instanceof Error ? error.message : "密码更换失败，请稍后重试。";
      return false;
    } finally {
      if (generation === changeGeneration) changingPassword.value = false;
    }
  }

  function logout() {
    void lock(true);
  }

  return {
    isUnlocked, restoring, busy, error, warning, credentialKey,
    changingPassword, passwordChangeError,
    restore, login, changePassword, logout,
  };
});
