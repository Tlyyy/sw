import { ref } from "vue";
import { defineStore } from "pinia";
import type { AccountScope } from "../domain/types";

export type EvidenceAccountScope = AccountScope | "PUBLIC";
export type EvidenceKind = "ALL" | "pet" | "equipment" | "market";

export const useAssetDraftStore = defineStore("asset-draft", () => {
  const evidenceQuery = ref("");
  const evidenceAccount = ref<EvidenceAccountScope>("ALL");
  const evidenceKind = ref<EvidenceKind>("ALL");
  const initialized = ref(false);

  function initialize(accountScope: AccountScope) {
    if (initialized.value) return;
    evidenceAccount.value = accountScope;
    initialized.value = true;
  }

  return {
    evidenceQuery,
    evidenceAccount,
    evidenceKind,
    initialized,
    initialize,
  };
});
