import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { accountIds } from "../domain/types";
import type { AccountId, InventoryBalance } from "../domain/types";
import { useInventoryStore, inventoryStorageKey } from "./inventory";
import { useSettingsStore } from "./settings";
import { catalog } from "../data/catalog";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

function balances(seed: number) {
  return Object.fromEntries(accountIds.map((accountId, index) => [accountId, {
    dedicatedEggs: seed + index,
    regularEggs: seed * 2 + index,
    silverWan: seed * 10 + index,
  }])) as Record<AccountId, InventoryBalance>;
}

describe("inventory store", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    setActivePinia(createPinia());
  });

  it("persists to v1 storage and syncs only a new latest snapshot to legacy resources", () => {
    const settings = useSettingsStore();
    const inventory = useInventoryStore();
    inventory.hydrate();
    const originalShards = settings.resources.FC.innerShardCount;

    inventory.saveSnapshot({ effectiveDate: "2026-07-11", accounts: balances(10) });
    expect(JSON.parse(localStorage.getItem(inventoryStorageKey) || "null").version).toBe(1);
    expect(settings.resources.FC).toEqual({ silverWan: 100, eggCount: 30, innerShardCount: originalShards });

    inventory.saveSnapshot({ effectiveDate: "2026-07-01", accounts: balances(1) });
    expect(inventory.snapshots.map((item) => item.effectiveDate)).toEqual(["2026-07-01", "2026-07-11"]);
    expect(settings.resources.FC).toEqual({ silverWan: 100, eggCount: 30, innerShardCount: originalShards });
  });

  it("validates imports atomically", () => {
    const inventory = useInventoryStore();
    inventory.hydrate();
    inventory.saveSnapshot({ effectiveDate: "2026-07-11", accounts: balances(10) });

    expect(() => inventory.importData('{"version":1,"snapshots":[{}]}')).toThrow();
    expect(inventory.snapshots).toHaveLength(1);
    expect(inventory.latestSnapshot?.effectiveDate).toBe("2026-07-11");
  });

  it("restores default egg and silver values after the last snapshot is removed while preserving shards", () => {
    const settings = useSettingsStore();
    const inventory = useInventoryStore();
    inventory.hydrate();
    settings.setResource("FC", "innerShardCount", 77);
    inventory.saveSnapshot({ effectiveDate: "2026-07-11", accounts: balances(10) });

    inventory.removeSnapshot("2026-07-11");
    expect(settings.resources.FC).toEqual({
      eggCount: catalog.beastConfig.taskDefaultResources.FC.eggCount,
      silverWan: catalog.beastConfig.taskDefaultResources.FC.silverWan,
      innerShardCount: 77,
    });

    inventory.saveSnapshot({ effectiveDate: "2026-07-12", accounts: balances(20) });
    inventory.clear();
    expect(settings.resources.FC.innerShardCount).toBe(77);
    expect(settings.resources.FC.eggCount).toBe(catalog.beastConfig.taskDefaultResources.FC.eggCount);
  });
});
