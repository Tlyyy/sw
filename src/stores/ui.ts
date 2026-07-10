import { reactive, ref, watch } from "vue";
import { defineStore } from "pinia";
import type { AccountId, AccountScope } from "../domain/types";

const storageKey = "sw.app.ui.v1";
export const useUiStore = defineStore("ui", () => {
  const accountScope = ref<AccountScope>("ALL");
  const recentAccount = ref<AccountId>("LG2");
  const matrixDensity = ref<"compact" | "comfortable">("compact");
  const matrixDisplay = reactive({ stats: true, aptitudes: true, skills: true });
  const commandOpen = ref(false);
  const mobileNavOpen = ref(false);
  function hydrate() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (value?.accountScope) accountScope.value = value.accountScope;
      if (value?.recentAccount) recentAccount.value = value.recentAccount;
      if (value?.matrixDensity) matrixDensity.value = value.matrixDensity;
      if (value?.matrixDisplay) Object.assign(matrixDisplay, value.matrixDisplay);
    } catch { /* defaults */ }
  }
  function resetPreferences() {
    accountScope.value = "ALL";
    recentAccount.value = "LG2";
    matrixDensity.value = "compact";
    Object.assign(matrixDisplay, { stats: true, aptitudes: true, skills: true });
  }
  watch([accountScope, recentAccount, matrixDensity, matrixDisplay], () => localStorage.setItem(storageKey, JSON.stringify({ accountScope: accountScope.value, recentAccount: recentAccount.value, matrixDensity: matrixDensity.value, matrixDisplay })), { deep: true });
  return { accountScope, recentAccount, matrixDensity, matrixDisplay, commandOpen, mobileNavOpen, hydrate, resetPreferences };
});
