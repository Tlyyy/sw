import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { catalog } from "../data/catalog";
import { legacySettingsStorageKey, settingsStorageKey, useSettingsStore } from "./settings";

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

  it("migrates the v2 envelope and writes validated v3 state", () => {
    localStorage.setItem(legacySettingsStorageKey, JSON.stringify({ version: 2, settings: { weeklyEggs: 7.5 } }));
    const settings = useSettingsStore();
    settings.hydrate();
    expect(settings.taskSettings.weeklyEggs).toBe(7.5);
    expect(JSON.parse(localStorage.getItem(settingsStorageKey) || "null").version).toBe(3);
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
});
