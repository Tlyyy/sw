import { reactive, ref, watch } from "vue";
import { defineStore } from "pinia";
import { catalog } from "../data/catalog";
import type {
  AccountId,
  BeastResource,
  BeastTaskSettings,
  GemMarketItem,
  GemPlanSettings,
  GemPriceHistoryEntry,
  GemPriceHistorySource,
  SilverExpenseRecord,
  TaskCompletionRecord,
} from "../domain/types";
import { shanghaiDateKey, type PlanningState, type ScheduledTask, type TaskOverride } from "../domain/plans";
import { createGemPriceHistoryEntry, normalizeGemPriceHistory } from "../domain/gemPriceHistory";
import { defaultGemPlanSettings } from "../domain/gems";
import { parseSettingsState, type SettingsState } from "../persistence/state";

export const settingsStorageKey = "sw.app.settings.v4";
export const previousSettingsStorageKey = "sw.app.settings.v3";
export const legacySettingsStorageKey = "sw.app.settings.v2";
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export const useSettingsStore = defineStore("settings", () => {
  const hydrated = ref(false);
  const gemPriceOverrides = reactive<Record<string, number>>({});
  const taskSettings = reactive<BeastTaskSettings>(clone(catalog.beastConfig.taskDefaultSettings));
  const taskOverrides = reactive<Record<string, TaskOverride>>({});
  const taskCompletions = ref<TaskCompletionRecord[]>([]);
  const silverExpenses = ref<SilverExpenseRecord[]>([]);
  const gemPriceHistory = ref<GemPriceHistoryEntry[]>([]);
  const gemPlan = reactive<GemPlanSettings>({ ...defaultGemPlanSettings });
  const planningAsOfDate = ref(shanghaiDateKey());

  const marketNames = catalog.gemMarketSnapshots.at(-1)?.items.map((item) => item.name) || [];

  function setState(value: SettingsState) {
    Object.keys(gemPriceOverrides).forEach((key) => delete gemPriceOverrides[key]);
    Object.keys(taskSettings).forEach((key) => delete (taskSettings as Partial<BeastTaskSettings>)[key as keyof BeastTaskSettings]);
    Object.keys(taskOverrides).forEach((key) => delete taskOverrides[key]);
    Object.assign(gemPriceOverrides, value.gemPriceOverrides);
    Object.assign(taskSettings, value.settings);
    Object.assign(taskOverrides, value.overrides);
    taskCompletions.value = clone(value.taskCompletions);
    silverExpenses.value = clone(value.silverExpenses);
    gemPriceHistory.value = normalizeGemPriceHistory(value.gemPriceHistory, marketNames);
    Object.assign(gemPlan, value.gemPlan);
    if (!catalog.gemUpgradeSteps.some((step) => step.to === gemPlan.targetLevel)) gemPlan.targetLevel = defaultGemPlanSettings.targetLevel;
  }

  function snapshot(
    resources: Record<AccountId, BeastResource>,
    inventoryEffectiveDate: string | null = null,
    asOfDate = planningAsOfDate.value,
  ): PlanningState {
    return {
      gemPriceOverrides: { ...gemPriceOverrides },
      settings: { ...taskSettings },
      asOfDate,
      inventoryEffectiveDate,
      resources: clone(resources),
      overrides: clone(taskOverrides),
    };
  }

  function refreshPlanningAsOfDate(now: Date | number = Date.now()) {
    planningAsOfDate.value = shanghaiDateKey(now);
  }

  function persist() {
    if (!hydrated.value || typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(settingsStorageKey, JSON.stringify(exportState()));
    } catch {
      // Keep validated in-memory state usable when browser storage is unavailable.
    }
  }

  function exportState(): SettingsState {
    return {
      version: 4,
      gemPriceOverrides: { ...gemPriceOverrides },
      settings: { ...taskSettings },
      overrides: clone(taskOverrides),
      taskCompletions: clone(taskCompletions.value),
      silverExpenses: clone(silverExpenses.value),
      gemPriceHistory: clone(gemPriceHistory.value),
      gemPlan: { ...gemPlan },
    };
  }

  function replaceState(value: unknown) {
    const parsed = parseSettingsState(value, catalog.beastConfig.taskDefaultSettings, marketNames);
    setState(parsed);
    if (!hydrated.value) hydrated.value = true;
    persist();
  }

  function hydrate() {
    if (hydrated.value) return;
    try {
      const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(settingsStorageKey);
      const previous = typeof localStorage === "undefined" ? null : localStorage.getItem(previousSettingsStorageKey);
      const legacy = typeof localStorage === "undefined" ? null : localStorage.getItem(legacySettingsStorageKey);
      if (raw || previous || legacy) setState(parseSettingsState(raw || previous || legacy, catalog.beastConfig.taskDefaultSettings, marketNames));
    } catch {
      // Invalid local data falls back to validated defaults.
    }
    hydrated.value = true;
    persist();
  }

  function setGemPrice(name: string, value: number) {
    const normalized = Math.round(Number(value));
    if (!marketNames.includes(name) || !Number.isFinite(normalized) || normalized < 1) return false;
    const base = catalog.gemMarketSnapshots.at(-1)?.items.find((item) => item.name === name)?.price;
    if (normalized === Number(base)) delete gemPriceOverrides[name];
    else gemPriceOverrides[name] = normalized;
    return true;
  }
  function resetGemPrices() { Object.keys(gemPriceOverrides).forEach((key) => delete gemPriceOverrides[key]); }
  function recordGemPrices(source: GemPriceHistorySource, items: GemMarketItem[]) {
    const validItems = marketNames.flatMap((name) => {
      const matching = items.filter((item) => item.name === name);
      const normalized = Math.round(Number(matching[0]?.price));
      if (matching.length !== 1 || !Number.isFinite(normalized) || normalized < 1) return [];
      return [{ name, price: normalized }];
    });
    if (items.length !== marketNames.length || validItems.length !== marketNames.length) return false;
    const capturedAt = new Date().toISOString();
    const entry = createGemPriceHistoryEntry(validItems, source, capturedAt, `${capturedAt}:${source}:${gemPriceHistory.value.length}`);
    gemPriceHistory.value.push(entry);
    return true;
  }
  function removeGemPriceHistory(id: string) {
    gemPriceHistory.value = gemPriceHistory.value.filter((entry) => entry.id !== id);
  }
  function clearGemPriceHistory() { gemPriceHistory.value = []; }
  function setGemPlanTargetLevel(value: string) {
    if (!catalog.gemUpgradeSteps.some((step) => step.to === value)) return false;
    gemPlan.targetLevel = value;
    return true;
  }
  function setGemPlanWeeklyIncome(value: number) {
    const candidate = Number(value);
    const normalized = Number.isFinite(candidate) ? Math.max(0, candidate) : 0;
    gemPlan.weeklyIncomeWan = normalized;
  }
  function setTaskSetting(field: keyof BeastTaskSettings, value: string | number) { (taskSettings as Record<string, string | number>)[field] = field === "startDate" ? String(value) : Math.max(0, Number(value) || 0); }
  function removeTaskCompletion(id: string) {
    taskCompletions.value = taskCompletions.value.filter((entry) => entry.taskId !== id);
  }
  function setTaskDone(id: string, done: boolean) {
    taskOverrides[id] = { ...(taskOverrides[id] || {}), done };
    if (!done) removeTaskCompletion(id);
  }
  function completeTask(
    task: Pick<ScheduledTask, "id" | "accountId" | "typeLabel" | "actionLabel" | "kind" | "resourceType" | "priceWan" | "eggCount" | "shardCount">,
    completedOn = planningAsOfDate.value,
    now = () => new Date(),
    settlement?: { silverSpentWan?: number },
  ) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(completedOn)) return null;
    const existing = taskCompletions.value.find((entry) => entry.taskId === task.id);
    if (taskOverrides[task.id]?.done && existing) return existing;
    const resourceKind = task.resourceType === "innerShard" ? "innerShards" : task.eggCount > 0 ? "eggs" : "silver";
    const resourceAmount = resourceKind === "innerShards" ? task.shardCount : resourceKind === "eggs" ? task.eggCount : task.priceWan;
    const settledSilver = Number(settlement?.silverSpentWan);
    const silverSpentWan = settlement?.silverSpentWan !== undefined && Number.isFinite(settledSilver)
      ? Math.max(0, settledSilver)
      : resourceKind === "silver" ? task.priceWan : 0;
    const record: TaskCompletionRecord = {
      taskId: task.id,
      completedOn,
      recordedAt: now().toISOString(),
      accountId: task.accountId,
      typeLabel: task.typeLabel,
      actionLabel: task.actionLabel,
      taskKind: task.kind,
      resourceKind,
      resourceAmount,
      silverSpentWan,
    };
    taskOverrides[task.id] = { ...(taskOverrides[task.id] || {}), done: true };
    taskCompletions.value = [...taskCompletions.value.filter((entry) => entry.taskId !== task.id), record]
      .sort((left, right) => left.completedOn.localeCompare(right.completedOn) || left.recordedAt.localeCompare(right.recordedAt));
    return record;
  }
  function addSilverExpense(
    input: Pick<SilverExpenseRecord, "effectiveDate" | "accountId" | "amountWan" | "note">,
    now = () => new Date(),
  ) {
    const amountWan = Number(input.amountWan);
    const note = input.note.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate) || !Number.isFinite(amountWan) || amountWan <= 0 || !note) return null;
    const recordedAt = now().toISOString();
    const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const record: SilverExpenseRecord = {
      id: `silver-expense:${suffix}`,
      effectiveDate: input.effectiveDate,
      recordedAt,
      accountId: input.accountId,
      amountWan,
      note: note.slice(0, 80),
    };
    silverExpenses.value = [...silverExpenses.value, record]
      .sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate) || left.recordedAt.localeCompare(right.recordedAt));
    return record;
  }
  function removeSilverExpense(id: string) {
    silverExpenses.value = silverExpenses.value.filter((entry) => entry.id !== id);
  }
  function setTaskPrice(id: string, value: number) { taskOverrides[id] = { ...(taskOverrides[id] || {}), priceWan: Math.max(0, Number(value) || 0) }; }
  function removeTaskOverrideField(id: string, field: keyof TaskOverride) {
    const override = taskOverrides[id];
    if (!override) return;
    delete override[field];
    if (!Object.keys(override).length) delete taskOverrides[id];
  }
  function resetTaskPrice(id: string) { removeTaskOverrideField(id, "priceWan"); }
  function resetTaskCompletionOverrides() {
    Object.keys(taskOverrides).forEach((id) => removeTaskOverrideField(id, "done"));
    taskCompletions.value = [];
  }
  function resetTaskPriceOverrides() {
    Object.keys(taskOverrides).forEach((id) => removeTaskOverrideField(id, "priceWan"));
  }
  function resetTaskSettings() {
    Object.assign(taskSettings, clone(catalog.beastConfig.taskDefaultSettings));
  }
  function resetTaskOverrides() {
    Object.keys(taskOverrides).forEach((key) => delete taskOverrides[key]);
    taskCompletions.value = [];
  }
  function resetSilverExpenses() { silverExpenses.value = []; }
  function resetTasks() { resetTaskSettings(); resetTaskOverrides(); }
  function resetGemPlan() { Object.assign(gemPlan, defaultGemPlanSettings); }
  function resetAllPlanningData() { resetGemPrices(); clearGemPriceHistory(); resetTasks(); resetSilverExpenses(); resetGemPlan(); }

  watch([gemPriceOverrides, taskSettings, taskOverrides, taskCompletions, silverExpenses, gemPriceHistory, gemPlan], persist, { deep: true });
  return {
    hydrated, gemPriceOverrides, gemPriceHistory, gemPlan, taskSettings, taskOverrides, taskCompletions, silverExpenses, planningAsOfDate,
    hydrate, snapshot, refreshPlanningAsOfDate, exportState, replaceState, setGemPrice, resetGemPrices, setTaskSetting, setTaskDone, completeTask, setTaskPrice,
    resetTaskPrice, resetTaskCompletionOverrides, resetTaskPriceOverrides,
    addSilverExpense, removeSilverExpense, resetSilverExpenses,
    recordGemPrices, removeGemPriceHistory, clearGemPriceHistory,
    setGemPlanTargetLevel, setGemPlanWeeklyIncome, resetGemPlan,
    resetTaskSettings, resetTaskOverrides, resetTasks, resetAllPlanningData,
  };
});
