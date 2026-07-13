import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { accountIds } from "../domain/types";
import type { AccountId, InventoryBalance } from "../domain/types";
import { inventoryStorageKey, legacyInventoryStorageKey, useInventoryStore } from "./inventory";

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
    innerShardCount: seed * 3 + index,
  }])) as Record<AccountId, InventoryBalance>;
}

function legacyBalances(seed: number) {
  return Object.fromEntries(accountIds.map((accountId, index) => [accountId, {
    dedicatedEggs: seed + index,
    regularEggs: seed * 2 + index,
    silverWan: seed * 10 + index,
  }]));
}

describe("inventory store", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    setActivePinia(createPinia());
  });

  it("persists v2 and derives every planning resource from the latest snapshot", () => {
    const inventory = useInventoryStore();
    inventory.hydrate();

    inventory.saveSnapshot({ effectiveDate: "2026-07-11", accounts: balances(10) });
    expect(JSON.parse(localStorage.getItem(inventoryStorageKey) || "null").version).toBe(2);
    expect(inventory.planningResources.FC).toEqual({ silverWan: 100, eggCount: 30, innerShardCount: 30 });

    inventory.saveSnapshot({ effectiveDate: "2026-07-01", accounts: balances(1) });
    expect(inventory.snapshots.map((item) => item.effectiveDate)).toEqual(["2026-07-01", "2026-07-11"]);
    expect(inventory.planningResources.FC).toEqual({ silverWan: 100, eggCount: 30, innerShardCount: 30 });
  });

  it("migrates v1 storage and marks missing inner fragments for manual completion", () => {
    localStorage.setItem(legacyInventoryStorageKey, JSON.stringify({
      version: 1,
      snapshots: [{
        effectiveDate: "2026-07-11",
        recordedAt: "2026-07-11T12:00:00.000Z",
        accounts: legacyBalances(10),
      }],
    }));

    const inventory = useInventoryStore();
    inventory.hydrate();
    expect(inventory.latestSnapshot?.accounts.FC.innerShardCount).toBeNull();
    expect(inventory.planningResources.FC.innerShardCount).toBeNull();
    expect(JSON.parse(localStorage.getItem(inventoryStorageKey) || "null").version).toBe(2);
  });

  it("validates imports atomically", () => {
    const inventory = useInventoryStore();
    inventory.hydrate();
    inventory.saveSnapshot({ effectiveDate: "2026-07-11", accounts: balances(10) });

    expect(() => inventory.importData('{"version":2,"snapshots":[{}]}')).toThrow();
    expect(inventory.snapshots).toHaveLength(1);
    expect(inventory.latestSnapshot?.effectiveDate).toBe("2026-07-11");
  });

  it("recomputes planning resources after removing or clearing snapshots", () => {
    const inventory = useInventoryStore();
    inventory.hydrate();
    inventory.saveSnapshot({ effectiveDate: "2026-07-11", accounts: balances(10) });
    inventory.saveSnapshot({ effectiveDate: "2026-07-12", accounts: balances(20) });

    inventory.removeSnapshot("2026-07-12");
    expect(inventory.planningResources.FC).toEqual({ silverWan: 100, eggCount: 30, innerShardCount: 30 });

    inventory.clear();
    expect(inventory.planningResources.FC).toEqual({ silverWan: 0, eggCount: 0, innerShardCount: null, inventoryRecorded: false });
  });
});
