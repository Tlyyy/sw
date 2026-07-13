import { reactive, ref, watch } from "vue";
import { defineStore } from "pinia";
import type { AccountId, AccountScope } from "../domain/types";
import { parseUiState, type UiState } from "../persistence/state";

export const uiStorageKey = "sw.app.ui.v2";
export const legacyUiStorageKey = "sw.app.ui.v1";
export const useUiStore = defineStore("ui", () => {
  const hydrated = ref(false);
  const accountScope = ref<AccountScope>("ALL");
  const recentAccount = ref<AccountId>("LG2");
  const matrixDensity = ref<"compact" | "comfortable">("compact");
  const matrixDisplay = reactive({ stats: true, aptitudes: true, skills: true });
  const commandOpen = ref(false);
  const mobileNavOpen = ref(false);
  function setState(value: UiState) {
    accountScope.value = value.accountScope;
    recentAccount.value = value.recentAccount;
    matrixDensity.value = value.matrixDensity;
    Object.keys(matrixDisplay).forEach((key) => delete (matrixDisplay as Partial<UiState["matrixDisplay"]>)[key as keyof UiState["matrixDisplay"]]);
    Object.assign(matrixDisplay, value.matrixDisplay);
  }
  function exportState(): UiState {
    return { version: 2, accountScope: accountScope.value, recentAccount: recentAccount.value, matrixDensity: matrixDensity.value, matrixDisplay: { ...matrixDisplay } };
  }
  function replaceState(value: unknown) {
    setState(parseUiState(value));
    if (!hydrated.value) hydrated.value = true;
    persist();
  }
  function hydrate() {
    if (hydrated.value) return;
    try {
      const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(uiStorageKey) || localStorage.getItem(legacyUiStorageKey);
      if (raw) setState(parseUiState(raw));
    } catch { /* defaults */ }
    hydrated.value = true;
    persist();
  }
  function resetPreferences() {
    accountScope.value = "ALL";
    recentAccount.value = "LG2";
    matrixDensity.value = "compact";
    Object.assign(matrixDisplay, { stats: true, aptitudes: true, skills: true });
  }
  function persist() {
    if (!hydrated.value || typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(uiStorageKey, JSON.stringify(exportState()));
    } catch {
      // Preferences remain usable in memory when storage is unavailable.
    }
  }
  watch([accountScope, recentAccount, matrixDensity, matrixDisplay], persist, { deep: true });
  return { hydrated, accountScope, recentAccount, matrixDensity, matrixDisplay, commandOpen, mobileNavOpen, hydrate, exportState, replaceState, resetPreferences };
});
