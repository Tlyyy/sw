import { reactive, ref, watch } from "vue";
import { defineStore } from "pinia";
import { catalog } from "../data/catalog";
import type { AccountId, BeastResource, BeastTaskSettings, GemMarketItem, GemPriceHistoryEntry, GemPriceHistorySource } from "../domain/types";
import type { PlanningState, TaskOverride } from "../domain/plans";
import { createGemPriceHistoryEntry, normalizeGemPriceHistory } from "../domain/gemPriceHistory";

const storageKey = "sw.app.settings.v2";
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export const useSettingsStore = defineStore("settings", () => {
  const hydrated = ref(false);
  const gemPriceOverrides = reactive<Record<string, number>>({});
  const taskSettings = reactive<BeastTaskSettings>(clone(catalog.beastConfig.taskDefaultSettings));
  const resources = reactive<Record<AccountId, BeastResource>>(clone(catalog.beastConfig.taskDefaultResources));
  const taskOverrides = reactive<Record<string, TaskOverride>>({});
  const gemPriceHistory = ref<GemPriceHistoryEntry[]>([]);

  const marketNames = catalog.gemMarketSnapshots.at(-1)?.items.map((item) => item.name) || [];

  function apply(value: Partial<PlanningState> & { gemPriceHistory?: unknown }) {
    Object.assign(gemPriceOverrides, value.gemPriceOverrides || {});
    Object.assign(taskSettings, value.settings || {});
    Object.entries(value.resources || {}).forEach(([key, row]) => Object.assign(resources[key as AccountId], row));
    Object.assign(taskOverrides, value.overrides || {});
    gemPriceHistory.value = normalizeGemPriceHistory(value.gemPriceHistory, marketNames);
  }

  function snapshot(): PlanningState {
    return { gemPriceOverrides: { ...gemPriceOverrides }, settings: { ...taskSettings }, resources: clone(resources), overrides: clone(taskOverrides) };
  }

  function persist() {
    if (!hydrated.value) return;
    localStorage.setItem(storageKey, JSON.stringify({ version: 2, ...snapshot(), gemPriceHistory: gemPriceHistory.value }));
  }

  function hydrate() {
    if (hydrated.value) return;
    try {
      const current = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (current?.version === 2) apply(current);
    } catch {
      // Invalid local data falls back to validated defaults.
    }
    hydrated.value = true;
    persist();
  }

  function setGemPrice(name: string, value: number) {
    const base = catalog.gemMarketSnapshots.at(-1)?.items.find((item) => item.name === name)?.price;
    if (Number(value) === Number(base)) delete gemPriceOverrides[name];
    else gemPriceOverrides[name] = Math.max(0, Math.round(Number(value) || 0));
  }
  function resetGemPrices() { Object.keys(gemPriceOverrides).forEach((key) => delete gemPriceOverrides[key]); }
  function recordGemPrices(source: GemPriceHistorySource, items: GemMarketItem[]) {
    const capturedAt = new Date().toISOString();
    const entry = createGemPriceHistoryEntry(items, source, capturedAt, `${capturedAt}:${source}:${gemPriceHistory.value.length}`);
    if (entry.items.length !== marketNames.length) return;
    gemPriceHistory.value.push(entry);
  }
  function removeGemPriceHistory(id: string) {
    gemPriceHistory.value = gemPriceHistory.value.filter((entry) => entry.id !== id);
  }
  function clearGemPriceHistory() { gemPriceHistory.value = []; }
  function setResource(accountId: AccountId, field: keyof BeastResource, value: number) { resources[accountId][field] = Math.max(0, Number(value) || 0); }
  function setTaskSetting(field: keyof BeastTaskSettings, value: string | number) { (taskSettings as Record<string, string | number>)[field] = field === "startDate" ? String(value) : Math.max(0, Number(value) || 0); }
  function setTaskDone(id: string, done: boolean) { taskOverrides[id] = { ...(taskOverrides[id] || {}), done }; }
  function setTaskPrice(id: string, value: number) { taskOverrides[id] = { ...(taskOverrides[id] || {}), priceWan: Math.max(0, Number(value) || 0) }; }
  function resetTaskSettings() {
    Object.assign(taskSettings, clone(catalog.beastConfig.taskDefaultSettings));
  }
  function resetResources() {
    Object.entries(clone(catalog.beastConfig.taskDefaultResources)).forEach(([key, row]) => Object.assign(resources[key as AccountId], row));
  }
  function resetTaskOverrides() {
    Object.keys(taskOverrides).forEach((key) => delete taskOverrides[key]);
  }
  function resetTasks() { resetTaskSettings(); resetResources(); resetTaskOverrides(); }
  function resetAllPlanningData() { resetGemPrices(); clearGemPriceHistory(); resetTasks(); }

  watch([gemPriceOverrides, taskSettings, resources, taskOverrides, gemPriceHistory], persist, { deep: true });
  return {
    hydrated, gemPriceOverrides, gemPriceHistory, taskSettings, resources, taskOverrides,
    hydrate, snapshot, setGemPrice, resetGemPrices, setResource, setTaskSetting, setTaskDone, setTaskPrice,
    recordGemPrices, removeGemPriceHistory, clearGemPriceHistory,
    resetTaskSettings, resetResources, resetTaskOverrides, resetTasks, resetAllPlanningData,
  };
});
