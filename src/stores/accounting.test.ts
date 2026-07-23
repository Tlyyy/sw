import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { accountingStorageKey, useAccountingStore } from "./accounting";
import { useInventoryStore } from "./inventory";
import type { AccountId, InventoryBalance, TaskCompletionRecord } from "../domain/types";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

const resources = (silverWan: number) => ({
  silverWan,
  dedicatedEggs: 0,
  regularEggs: 0,
  innerShards: 0,
});

const accountIds: AccountId[] = ["FC", "LG1", "PT", "LG2", "MYT"];
const inventoryBalance = (): InventoryBalance => ({
  silverWan: 100,
  dedicatedEggs: 5,
  regularEggs: 3,
  innerShardCount: 20,
});

describe("accounting store", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    setActivePinia(createPinia());
  });

  it("persists an independent task settlement without touching any other store", () => {
    const inventory = useInventoryStore();
    inventory.hydrate();
    inventory.saveSnapshot({
      effectiveDate: "2026-07-23",
      accounts: Object.fromEntries(accountIds.map((accountId) => [
        accountId,
        inventoryBalance(),
      ])) as Record<AccountId, InventoryBalance>,
    });
    const inventoryBeforeSettlement = inventory.exportState();

    const store = useAccountingStore();
    store.hydrate();
    const entry = store.addTaskSettlement({
      accountId: "FC",
      effectiveDate: "2026-07-23",
      occurredAt: "2026-07-23T02:00:00.000Z",
      taskId: "FC:snake1:book",
      source: "task-variable",
      resources: resources(18),
      note: "打书",
    }, () => new Date("2026-07-23T02:01:00.000Z"));

    expect(entry).toMatchObject({
      accountId: "FC",
      taskId: "FC:snake1:book",
      status: "confirmed",
      legs: [{ kind: "expense", resources: { silverWan: 18 } }],
    });
    expect(JSON.parse(localStorage.getItem(accountingStorageKey) || "null")).toMatchObject({
      version: 1,
      entries: [{ taskId: "FC:snake1:book" }],
    });
    expect(inventory.exportState()).toEqual(inventoryBeforeSettlement);
  });

  it("materializes a legacy completion exactly once unless a non-draft task entry is authoritative", () => {
    const store = useAccountingStore();
    store.hydrate();
    const completion: TaskCompletionRecord = {
      taskId: "LG1:snake1:skin",
      completedOn: "2026-07-22",
      recordedAt: "2026-07-22T03:04:05.000Z",
      accountId: "LG1",
      typeLabel: "剑气蛇",
      actionLabel: "皮肤",
      taskKind: "确认",
      resourceKind: "eggs",
      resourceAmount: 40,
      silverSpentWan: 6.5,
    };

    store.addEntry({
      accountId: completion.accountId,
      effectiveDate: completion.completedOn,
      occurredAt: completion.recordedAt,
      taskId: completion.taskId,
      source: "draft-correction",
      status: "draft",
      legs: [{ kind: "expense", resources: resources(1) }],
    });
    const materialized = store.materializeLegacyTaskCompletion(completion);

    expect(materialized).toEqual({
      id: "legacy-task:LG1:snake1:skin",
      accountId: "LG1",
      effectiveDate: "2026-07-22",
      occurredAt: "2026-07-22T03:04:05.000Z",
      recordedAt: "2026-07-22T03:04:05.000Z",
      taskId: "LG1:snake1:skin",
      source: "legacy-task-completion",
      status: "confirmed",
      note: "剑气蛇 · 皮肤",
      legs: [{
        kind: "expense",
        resources: {
          silverWan: 6.5,
          dedicatedEggs: 40,
          regularEggs: 0,
          innerShards: 0,
        },
      }],
    });
    expect(store.taskEntries(completion.taskId)).toEqual([materialized]);
    expect(store.materializeLegacyTaskCompletion(completion)).toBeNull();
    expect(store.entries.filter((entry) => entry.taskId === completion.taskId)).toHaveLength(2);
  });

  it("creates and voids both sides of one transfer together", () => {
    const store = useAccountingStore();
    store.hydrate();
    const transfer = store.addTransfer({
      fromAccountId: "FC",
      toAccountId: "LG1",
      effectiveDate: "2026-07-23",
      occurredAt: "2026-07-23T03:00:00.000Z",
      resources: resources(25),
      note: "账号间转银子",
    }, () => new Date("2026-07-23T03:01:00.000Z"));

    expect(transfer?.entries).toHaveLength(2);
    expect(new Set(store.entries.map((entry) => entry.legs[0].kind))).toEqual(new Set([
      "transfer-out",
      "transfer-in",
    ]));
    expect(store.voidEntry(transfer!.entries[0].id, () => new Date("2026-07-23T04:00:00.000Z"))).toBe(true);
    expect(store.entries.every((entry) => entry.status === "void")).toBe(true);
  });

  it("voids all instalments for one multi-day task without deleting their audit facts", () => {
    const store = useAccountingStore();
    store.hydrate();
    for (const [day, amount] of [["2026-07-22", 8], ["2026-07-23", 12]] as const) {
      store.addTaskSettlement({
        accountId: "PT",
        effectiveDate: day,
        occurredAt: `${day}T02:00:00.000Z`,
        taskId: "PT:snake1:talisman",
        source: "task-progress",
        resources: resources(amount),
      });
    }

    expect(store.taskEntries("PT:snake1:talisman")).toHaveLength(2);
    expect(store.voidTaskEntries("PT:snake1:talisman")).toBe(true);
    expect(store.taskEntries("PT:snake1:talisman")).toEqual([]);
    expect(store.entries).toHaveLength(2);
    expect(store.entries.every((entry) => entry.status === "void")).toBe(true);
  });
});
