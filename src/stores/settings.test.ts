import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { catalog } from "../data/catalog";
import { legacySettingsStorageKey, previousSettingsStorageKey, settingsStorageKey, useSettingsStore } from "./settings";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

describe("settings store persistence", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    setActivePinia(createPinia());
  });

  it("migrates the v2 envelope and writes validated v4 state", () => {
    localStorage.setItem(legacySettingsStorageKey, JSON.stringify({ version: 2, settings: { weeklyEggs: 7.5 } }));
    const settings = useSettingsStore();
    settings.hydrate();
    expect(settings.taskSettings.weeklyEggs).toBe(7.5);
    expect(settings.gemPlan).toEqual({ targetLevel: "13", weeklyIncomeWan: 88 });
    expect(JSON.parse(localStorage.getItem(settingsStorageKey) || "null").version).toBe(4);
  });

  it("prefers and migrates v3 state before an older v2 fallback", () => {
    const previous = {
      ...useSettingsStore().exportState(),
      version: 3,
      settings: { ...catalog.beastConfig.taskDefaultSettings, weeklySilverWan: 77 },
    } as Record<string, unknown>;
    delete previous.taskCompletions;
    delete previous.silverExpenses;
    localStorage.setItem(previousSettingsStorageKey, JSON.stringify(previous));
    localStorage.setItem(legacySettingsStorageKey, JSON.stringify({ version: 2, settings: { weeklySilverWan: 11 } }));

    setActivePinia(createPinia());
    const settings = useSettingsStore();
    settings.hydrate();
    expect(settings.taskSettings.weeklySilverWan).toBe(77);
    expect(settings.exportState()).toMatchObject({ version: 4, taskCompletions: [], silverExpenses: [] });
  });

  it("persists the standalone gem target and weekly input", () => {
    const settings = useSettingsStore();
    settings.hydrate();
    expect(settings.setGemPlanTargetLevel("14★★")).toBe(true);
    settings.setGemPlanWeeklyIncome(120);
    expect(settings.exportState().gemPlan).toEqual({ targetLevel: "14★★", weeklyIncomeWan: 120 });
    expect(settings.setGemPlanTargetLevel("不存在")).toBe(false);
    expect(settings.gemPlan.targetLevel).toBe("14★★");
  });

  it("does not report success or append history for incomplete, duplicate or invalid prices", () => {
    const settings = useSettingsStore();
    settings.hydrate();
    const items = catalog.gemMarketSnapshots.at(-1)!.items;
    expect(settings.setGemPrice(items[0].name, 0.4)).toBe(false);
    expect(settings.gemPriceOverrides).not.toHaveProperty(items[0].name);
    expect(settings.recordGemPrices("manual", items.slice(0, 5))).toBe(false);
    expect(settings.recordGemPrices("manual", [...items.slice(0, 5), items[0]])).toBe(false);
    expect(settings.recordGemPrices("manual", items.map((item, index) => ({ ...item, price: index ? item.price : 0 })))).toBe(false);
    expect(settings.recordGemPrices("manual", items.map((item, index) => ({ ...item, price: index ? item.price : 0.4 })))).toBe(false);
    expect(settings.gemPriceHistory).toHaveLength(0);
    expect(settings.recordGemPrices("manual", items)).toBe(true);
    expect(settings.gemPriceHistory).toHaveLength(1);
  });

  it("adds inventory and current dates only to runtime planning snapshots", () => {
    const settings = useSettingsStore();
    settings.hydrate();
    const persistedBefore = settings.exportState();
    const snapshot = settings.snapshot(
      structuredClone(catalog.beastConfig.taskDefaultResources),
      "2026-07-12",
      "2026-07-13",
    );

    expect(snapshot).toMatchObject({ inventoryEffectiveDate: "2026-07-12", asOfDate: "2026-07-13" });
    expect(settings.exportState()).toEqual(persistedBefore);
    expect(settings.exportState()).not.toHaveProperty("inventoryEffectiveDate");
    expect(settings.exportState()).not.toHaveProperty("asOfDate");
    const persisted = JSON.parse(localStorage.getItem(settingsStorageKey) || "null");
    expect(persisted).not.toHaveProperty("inventoryEffectiveDate");
    expect(persisted).not.toHaveProperty("asOfDate");

    settings.refreshPlanningAsOfDate(new Date("2026-07-12T16:00:00.000Z"));
    expect(settings.planningAsOfDate).toBe("2026-07-13");
    expect(settings.exportState()).toEqual(persistedBefore);
  });

  it("resets task completion and price overrides independently", () => {
    const settings = useSettingsStore();
    settings.hydrate();
    settings.setTaskDone("FC:snake1:skin", true);
    settings.setTaskPrice("FC:snake1:skin", 321);
    settings.setTaskDone("LG1:snake1:skin", true);

    settings.resetTaskCompletionOverrides();
    expect(settings.taskOverrides).toEqual({ "FC:snake1:skin": { priceWan: 321 } });

    settings.setTaskDone("FC:snake1:skin", true);
    settings.resetTaskPriceOverrides();
    expect(settings.taskOverrides).toEqual({ "FC:snake1:skin": { done: true } });

    settings.setTaskPrice("FC:snake1:skin", 456);
    settings.resetTaskPrice("FC:snake1:skin");
    expect(settings.taskOverrides).toEqual({ "FC:snake1:skin": { done: true } });
  });

  it("records task completion facts and manual silver expenses for weekly reports", () => {
    const settings = useSettingsStore();
    settings.hydrate();
    const completion = settings.completeTask({
      id: "FC:snake1:skin",
      accountId: "FC",
      typeLabel: "剑气蛇",
      actionLabel: "皮肤",
      kind: "进阶",
      resourceType: "wan",
      priceWan: 30,
      eggCount: 0,
      shardCount: 0,
    }, "2026-07-22", () => new Date("2026-07-22T02:00:00.000Z"));
    const expense = settings.addSilverExpense({
      effectiveDate: "2026-07-22",
      amountWan: 12.5,
      note: " 购买材料 ",
    }, () => new Date("2026-07-22T03:00:00.000Z"));

    expect(completion).toMatchObject({ completedOn: "2026-07-22", silverSpentWan: 30, resourceKind: "silver" });
    expect(expense).toMatchObject({ effectiveDate: "2026-07-22", amountWan: 12.5, note: "购买材料" });
    expect(settings.exportState().taskCompletions).toHaveLength(1);
    expect(settings.exportState().silverExpenses).toHaveLength(1);

    settings.setTaskDone("FC:snake1:skin", false);
    expect(settings.taskCompletions).toEqual([]);
    settings.removeSilverExpense(expense!.id);
    expect(settings.silverExpenses).toEqual([]);
  });
});
