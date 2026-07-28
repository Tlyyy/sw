import { ref } from "vue";
import { defineStore } from "pinia";
import type { AccountId } from "../domain/types";

export type EarningsAccountScope = "all" | AccountId;
export type EarningsDailyMetric = "silverWan" | "silverWithRegularEggsWan";
export type EarningsDetailView = "ledger" | "intervals";

export const useEarningsDraftStore = defineStore("earnings-draft", () => {
  const selectedScope = ref<EarningsAccountScope>("all");
  const selectedAccount = ref<AccountId>("FC");
  const dailyTableMetric = ref<EarningsDailyMetric>("silverWithRegularEggsWan");
  const detailView = ref<EarningsDetailView>("ledger");
  const initialized = ref(false);

  function initialize(recentAccount: AccountId, requestedAccount: AccountId | null) {
    if (!initialized.value) {
      selectedAccount.value = requestedAccount || recentAccount;
      selectedScope.value = requestedAccount || "all";
      initialized.value = true;
      return;
    }
    applyRouteAccount(requestedAccount);
  }

  function applyRouteAccount(accountId: AccountId | null) {
    selectedScope.value = accountId || "all";
    if (accountId) selectedAccount.value = accountId;
  }

  return {
    selectedScope,
    selectedAccount,
    dailyTableMetric,
    detailView,
    initialized,
    initialize,
    applyRouteAccount,
  };
});
