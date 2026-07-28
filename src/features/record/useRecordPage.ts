import { computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useRoute, useRouter } from "vue-router";
import { buildInventoryWeekReport } from "../../domain/inventory";
import { buildTaskPlans } from "../../domain/plans";
import type { AccountId, InventorySnapshotInput } from "../../domain/types";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { useRecordDraftStore } from "../../stores/recordDraft";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";

export function useRecordPage() {
  const catalog = useCatalogStore();
  const inventory = useInventoryStore();
  const settings = useSettingsStore();
  const ui = useUiStore();
  const draft = useRecordDraftStore();
  const route = useRoute();
  const router = useRouter();
  const {
    inventoryDialogOpen,
    notice,
    expenseFormOpen,
    expenseAmount,
    expenseNote,
    expenseError,
    expenseDirty,
  } = storeToRefs(draft);

  inventory.hydrate();
  draft.ensureExpenseAccount(ui.recentAccount);

  const today = computed(() => settings.planningAsOfDate);
  const report = computed(() => buildInventoryWeekReport(inventory.snapshots, today.value));
  const todayInventory = computed(() => report.value.days.find((day) => day.date === today.value)?.snapshot || null);
  const planningState = computed(() => settings.snapshot(
    inventory.planningResources,
    inventory.latestSnapshot?.effectiveDate || null,
  ));
  const tasks = computed(() => buildTaskPlans(catalog.data, catalog.pets, planningState.value).flatMap((plan) => plan.tasks));
  const pendingTaskAccountCount = computed(() => new Set(tasks.value.filter((task) => !task.done).map((task) => task.accountId)).size);
  const completedToday = computed(() => settings.taskCompletions.filter((entry) => entry.completedOn === today.value));
  const completedTodayAccountCount = computed(() => new Set(completedToday.value.map((entry) => entry.accountId)).size);
  const expensesToday = computed(() => settings.silverExpenses.filter((entry) => entry.effectiveDate === today.value));
  const expenseTodayAccountCount = computed(() => new Set(expensesToday.value.flatMap((entry) => entry.accountId ? [entry.accountId] : [])).size);
  const accountTodayRows = computed(() => catalog.data.accounts.map((account) => ({
    accountId: account.id,
    accountLabel: account.label,
    taskCount: completedToday.value.filter((entry) => entry.accountId === account.id).length,
    expenseCount: expensesToday.value.filter((entry) => entry.accountId === account.id).length,
    inventoryRecorded: Boolean(todayInventory.value),
  })));
  const latestMarketRecord = computed(() => settings.gemPriceHistory.at(-1) || null);
  const expenseAccountId = computed<AccountId>({
    get: () => draft.expenseAccountId || ui.recentAccount,
    set: (accountId) => {
      draft.expenseAccountId = accountId;
      ui.recentAccount = accountId;
    },
  });

  onMounted(() => {
    if (route.query.open !== "inventory") return;

    if (!todayInventory.value) draft.openInventoryDialog();

    const remainingQuery = { ...route.query };
    delete remainingQuery.open;
    void router.replace({ query: remainingQuery });
  });

  function saveInventorySnapshot(snapshot: InventorySnapshotInput) {
    const updating = inventory.snapshots.some((item) => item.effectiveDate === snapshot.effectiveDate);
    inventory.saveSnapshot(snapshot);
    draft.closeInventoryDialog();
    draft.setNotice(`${updating ? "已更新" : "已保存"} ${snapshot.effectiveDate} 的五号库存`);
  }

  function selectAccount(accountId: AccountId) {
    ui.recentAccount = accountId;
    draft.expenseAccountId = accountId;
  }

  function saveExpense() {
    const accountId = expenseAccountId.value;
    const record = settings.addSilverExpense({
      effectiveDate: today.value,
      accountId,
      amountWan: Number(expenseAmount.value),
      note: expenseNote.value,
    });
    if (!record) {
      expenseError.value = "请填写有效金额和用途";
      return false;
    }
    draft.clearExpenseDraft(record.accountId || accountId);
    draft.setNotice(`已记录 ${record.accountId} 的 ${Number(record.amountWan.toFixed(2)).toLocaleString("zh-CN")} 万银子支出`);
    return true;
  }

  function shortDateTime(value: string) {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
  }

  return {
    catalog,
    inventory,
    ui,
    today,
    todayInventory,
    pendingTaskAccountCount,
    completedTodayAccountCount,
    expenseTodayAccountCount,
    accountTodayRows,
    latestMarketRecord,
    inventoryDialogOpen,
    notice,
    expenseFormOpen,
    expenseAccountId,
    expenseAmount,
    expenseNote,
    expenseError,
    expenseDirty,
    openInventoryDialog: draft.openInventoryDialog,
    closeInventoryDialog: draft.closeInventoryDialog,
    openExpenseForm: () => draft.openExpenseForm(ui.recentAccount),
    closeExpenseForm: draft.closeExpenseForm,
    toggleExpenseForm: () => draft.toggleExpenseForm(ui.recentAccount),
    cancelExpense: () => draft.clearExpenseDraft(expenseAccountId.value),
    saveInventorySnapshot,
    selectAccount,
    saveExpense,
    shortDateTime,
  };
}
