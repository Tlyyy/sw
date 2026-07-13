import { reactive, ref, watch } from "vue";
import { defineStore } from "pinia";
import { catalog } from "../data/catalog";
import type { AccountId, BeastResource, BeastTaskSettings, GemMarketItem, GemPriceHistoryEntry, GemPriceHistorySource } from "../domain/types";
import type { PlanningState, TaskOverride } from "../domain/plans";
import { createGemPriceHistoryEntry, normalizeGemPriceHistory } from "../domain/gemPriceHistory";
import { parseSettingsState, type SettingsState } from "../persistence/state";

export const settingsStorageKey = "sw.app.settings.v3";
export const legacySettingsStorageKey = "sw.app.settings.v2";
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export const useSettingsStore = defineStore("settings", () => {
  const hydrated = ref(false);
  const gemPriceOverrides = reactive<Record<string, number>>({});
  const taskSettings = reactive<BeastTaskSettings>(clone(catalog.beastConfig.taskDefaultSettings));
  const taskOverrides = reactive<Record<string, TaskOverride>>({});
  const gemPriceHistory = ref<GemPriceHistoryEntry[]>([]);

  const marketNames = catalog.gemMarketSnapshots.at(-1)?.items.map((item) => item.name) || [];

  function setState(value: SettingsState) {
    Object.keys(gemPriceOverrides).forEach((key) => delete gemPriceOverrides[key]);
    Object.keys(taskSettings).forEach((key) => delete (taskSettings as Partial<BeastTaskSettings>)[key as keyof BeastTaskSettings]);
    Object.keys(taskOverrides).forEach((key) => delete taskOverrides[key]);
    Object.assign(gemPriceOverrides, value.gemPriceOverrides);
    Object.assign(taskSettings, value.settings);
    Object.assign(taskOverrides, value.overrides);
    gemPriceHistory.value = normalizeGemPriceHistory(value.gemPriceHistory, marketNames);
  }

  function snapshot(resources: Record<AccountId, BeastResource>): PlanningState {
    return { gemPriceOverrides: { ...gemPriceOverrides }, settings: { ...taskSettings }, resources: clone(resources), overrides: clone(taskOverrides) };
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
      version: 3,
      gemPriceOverrides: { ...gemPriceOverrides },
      settings: { ...taskSettings },
      overrides: clone(taskOverrides),
      gemPriceHistory: clone(gemPriceHistory.value),
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
      const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(settingsStorageKey) || localStorage.getItem(legacySettingsStorageKey);
      if (raw) setState(parseSettingsState(raw, catalog.beastConfig.taskDefaultSettings, marketNames));
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
  function setTaskSetting(field: keyof BeastTaskSettings, value: string | number) { (taskSettings as Record<string, string | number>)[field] = field === "startDate" ? String(value) : Math.max(0, Number(value) || 0); }
  function setTaskDone(id: string, done: boolean) { taskOverrides[id] = { ...(taskOverrides[id] || {}), done }; }
  function setTaskPrice(id: string, value: number) { taskOverrides[id] = { ...(taskOverrides[id] || {}), priceWan: Math.max(0, Number(value) || 0) }; }
  function resetTaskSettings() {
    Object.assign(taskSettings, clone(catalog.beastConfig.taskDefaultSettings));
  }
  function resetTaskOverrides() {
    Object.keys(taskOverrides).forEach((key) => delete taskOverrides[key]);
  }
  function resetTasks() { resetTaskSettings(); resetTaskOverrides(); }
  function resetAllPlanningData() { resetGemPrices(); clearGemPriceHistory(); resetTasks(); }

  watch([gemPriceOverrides, taskSettings, taskOverrides, gemPriceHistory], persist, { deep: true });
  return {
    hydrated, gemPriceOverrides, gemPriceHistory, taskSettings, taskOverrides,
    hydrate, snapshot, exportState, replaceState, setGemPrice, resetGemPrices, setTaskSetting, setTaskDone, setTaskPrice,
    recordGemPrices, removeGemPriceHistory, clearGemPriceHistory,
    resetTaskSettings, resetTaskOverrides, resetTasks, resetAllPlanningData,
  };
});
