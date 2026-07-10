import { computed, ref } from "vue";
import { defineStore } from "pinia";

const sessionKey = "sw-site-auth-session";
const rememberKey = "sw-site-auth-until";
const salt = "sw-pet-auth-20260709";
const passwordHash = "e3ff871f9c52cd13db70f1fbb02502984837cf23c762a437e324f6cb71fdc892";

export const useAuthStore = defineStore("auth", () => {
  const unlocked = ref(sessionStorage.getItem(sessionKey) === "1" || Number(localStorage.getItem(rememberKey) || 0) > Date.now());
  const busy = ref(false);
  const error = ref("");
  const isUnlocked = computed(() => unlocked.value);
  async function login(password: string, remember: boolean) {
    busy.value = true; error.value = "";
    try {
      const bytes = new TextEncoder().encode(`${salt}:${password}`);
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      if (hash !== passwordHash) { error.value = "密码不对，再试一次。"; return false; }
      sessionStorage.setItem(sessionKey, "1");
      if (remember) localStorage.setItem(rememberKey, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
      unlocked.value = true;
      return true;
    } catch { error.value = "当前浏览器无法完成本地密码校验。"; return false; }
    finally { busy.value = false; }
  }
  function logout() { sessionStorage.removeItem(sessionKey); localStorage.removeItem(rememberKey); unlocked.value = false; }
  return { isUnlocked, busy, error, login, logout };
});
