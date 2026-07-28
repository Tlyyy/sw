import { computed, reactive, ref } from "vue";
import { defineStore } from "pinia";
import { accountIds, type AccountId, type InventoryBalance } from "../domain/types";

function emptyInventoryRows(): Record<AccountId, InventoryBalance> {
  return Object.fromEntries(accountIds.map((accountId) => [accountId, {
    dedicatedEggs: 0,
    regularEggs: 0,
    silverWan: 0,
    innerShardCount: 0,
  }])) as Record<AccountId, InventoryBalance>;
}

export const useRecordDraftStore = defineStore("record-draft", () => {
  const inventoryDialogOpen = ref(false);
  const inventoryDraftInitialized = ref(false);
  const inventoryDraftDate = ref("");
  const inventoryDraftRows = reactive<Record<AccountId, InventoryBalance>>(emptyInventoryRows());
  const inventoryDraftDirty = ref(false);
  const inventoryDraftActiveAccountIndex = ref(0);
  const inventoryDraftReviewedAccounts = ref<AccountId[]>([]);
  const notice = ref("");
  const expenseFormOpen = ref(false);
  const expenseAccountId = ref<AccountId | null>(null);
  const expenseAmount = ref<number | null>(null);
  const expenseNote = ref("");
  const expenseError = ref("");
  const expenseDirty = computed(() => (
    expenseAmount.value !== null
    || expenseNote.value.trim().length > 0
  ));

  function ensureExpenseAccount(accountId: AccountId) {
    if (!expenseAccountId.value) expenseAccountId.value = accountId;
  }

  function openInventoryDialog() {
    inventoryDialogOpen.value = true;
  }

  function closeInventoryDialog() {
    inventoryDialogOpen.value = false;
    discardInventoryDraft();
  }

  function initializeInventoryDraft(
    effectiveDate: string,
    accounts: Record<AccountId, InventoryBalance>,
  ) {
    if (inventoryDraftInitialized.value) return false;
    inventoryDraftDate.value = effectiveDate;
    accountIds.forEach((accountId) => {
      Object.assign(inventoryDraftRows[accountId], accounts[accountId]);
    });
    inventoryDraftDirty.value = false;
    inventoryDraftActiveAccountIndex.value = 0;
    inventoryDraftReviewedAccounts.value = [];
    inventoryDraftInitialized.value = true;
    return true;
  }

  function discardInventoryDraft() {
    inventoryDraftInitialized.value = false;
    inventoryDraftDate.value = "";
    accountIds.forEach((accountId) => {
      Object.assign(inventoryDraftRows[accountId], emptyInventoryRows()[accountId]);
    });
    inventoryDraftDirty.value = false;
    inventoryDraftActiveAccountIndex.value = 0;
    inventoryDraftReviewedAccounts.value = [];
  }

  function openExpenseForm(accountId: AccountId) {
    ensureExpenseAccount(accountId);
    expenseError.value = "";
    expenseFormOpen.value = true;
  }

  function closeExpenseForm() {
    expenseError.value = "";
    expenseFormOpen.value = false;
  }

  function toggleExpenseForm(accountId: AccountId) {
    if (expenseFormOpen.value) closeExpenseForm();
    else openExpenseForm(accountId);
    return expenseFormOpen.value;
  }

  function clearExpenseDraft(accountId?: AccountId) {
    expenseAmount.value = null;
    expenseNote.value = "";
    expenseError.value = "";
    expenseFormOpen.value = false;
    if (accountId) expenseAccountId.value = accountId;
  }

  function setNotice(message: string) {
    notice.value = message;
  }

  return {
    inventoryDialogOpen,
    inventoryDraftInitialized,
    inventoryDraftDate,
    inventoryDraftRows,
    inventoryDraftDirty,
    inventoryDraftActiveAccountIndex,
    inventoryDraftReviewedAccounts,
    notice,
    expenseFormOpen,
    expenseAccountId,
    expenseAmount,
    expenseNote,
    expenseError,
    expenseDirty,
    ensureExpenseAccount,
    openInventoryDialog,
    closeInventoryDialog,
    initializeInventoryDraft,
    discardInventoryDraft,
    openExpenseForm,
    closeExpenseForm,
    toggleExpenseForm,
    clearExpenseDraft,
    setNotice,
  };
});
