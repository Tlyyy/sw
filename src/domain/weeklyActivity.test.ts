import { describe, expect, it } from "vitest";
import { buildInventoryWeekReport } from "./inventory";
import type { AccountId, InventorySnapshot, SilverExpenseRecord, TaskCompletionRecord } from "./types";
import { buildWeeklyActivitySummary } from "./weeklyActivity";

const accountIds: AccountId[] = ["FC", "LG1", "PT", "LG2", "MYT"];

function snapshot(effectiveDate: string, silverWan: number): InventorySnapshot {
  return {
    effectiveDate,
    recordedAt: `${effectiveDate}T02:00:00.000Z`,
    accounts: Object.fromEntries(accountIds.map((accountId) => [accountId, {
      dedicatedEggs: 0,
      regularEggs: 0,
      silverWan,
      innerShardCount: 0,
    }])) as InventorySnapshot["accounts"],
  };
}

function completion(overrides: Partial<TaskCompletionRecord> = {}): TaskCompletionRecord {
  return {
    taskId: "FC:snake1:skin",
    completedOn: "2026-07-21",
    recordedAt: "2026-07-21T02:00:00.000Z",
    accountId: "FC",
    typeLabel: "剑气蛇",
    actionLabel: "皮肤",
    taskKind: "进阶",
    resourceKind: "silver",
    resourceAmount: 30,
    silverSpentWan: 30,
    ...overrides,
  };
}

function expense(overrides: Partial<SilverExpenseRecord> = {}): SilverExpenseRecord {
  return {
    id: "expense-1",
    effectiveDate: "2026-07-22",
    recordedAt: "2026-07-22T02:00:00.000Z",
    accountId: "FC",
    amountWan: 10,
    note: "购买材料",
    ...overrides,
  };
}

describe("weekly activity summary", () => {
  it("stops the current report on today and adds known spending back to net inventory change", () => {
    const inventory = buildInventoryWeekReport([
      snapshot("2026-07-19", 100),
      snapshot("2026-07-22", 104),
    ], "2026-07-22");
    const summary = buildWeeklyActivitySummary(
      inventory,
      [completion(), completion({ taskId: "FC:future", completedOn: "2026-07-24", silverSpentWan: 90 })],
      [expense(), expense({ id: "future", effectiveDate: "2026-07-23", amountWan: 80 })],
      "2026-07-22",
    );

    expect(summary).toMatchObject({
      weekStart: "2026-07-20",
      reportEnd: "2026-07-22",
      inventoryNetChangeWan: 20,
      taskSilverExpenseWan: 30,
      manualSilverExpenseWan: 10,
      totalSilverExpenseWan: 40,
      harvestedSilverWan: 60,
      currentSilverWan: 520,
    });
    expect(summary.taskCompletions.map((entry) => entry.taskId)).toEqual(["FC:snake1:skin"]);
    expect(summary.manualExpenses.map((entry) => entry.id)).toEqual(["expense-1"]);
    expect(summary.accountSummaries).toHaveLength(5);
    expect(summary.accountSummaries.find((entry) => entry.accountId === "FC")).toMatchObject({
      currentSilverWan: 104,
      inventoryNetChangeWan: 4,
      taskSilverExpenseWan: 30,
      manualSilverExpenseWan: 10,
      totalSilverExpenseWan: 40,
      harvestedSilverWan: 44,
    });
    expect(summary.accountSummaries.find((entry) => entry.accountId === "LG1")).toMatchObject({
      currentSilverWan: 104,
      inventoryNetChangeWan: 4,
      totalSilverExpenseWan: 0,
      harvestedSilverWan: 4,
    });
    expect(summary.unassignedManualSilverExpenseWan).toBe(0);
  });

  it("lists non-silver task completions without treating their resource value as silver spending", () => {
    const inventory = buildInventoryWeekReport([snapshot("2026-07-22", 100)], "2026-07-22");
    const summary = buildWeeklyActivitySummary(inventory, [completion({
      resourceKind: "eggs",
      resourceAmount: 8,
      silverSpentWan: 0,
    })], [], "2026-07-22");

    expect(summary.taskCompletions).toHaveLength(1);
    expect(summary.taskSilverExpenseWan).toBe(0);
    expect(summary.harvestedSilverWan).toBeNull();
  });

  it("keeps legacy unassigned expenses in the total without inventing an account", () => {
    const inventory = buildInventoryWeekReport([
      snapshot("2026-07-19", 100),
      snapshot("2026-07-22", 104),
    ], "2026-07-22");
    const summary = buildWeeklyActivitySummary(inventory, [], [expense({ accountId: undefined })], "2026-07-22");

    expect(summary.harvestedSilverWan).toBe(30);
    expect(summary.unassignedManualSilverExpenseWan).toBe(10);
    expect(summary.accountSummaries.reduce((sum, account) => sum + (account.harvestedSilverWan ?? 0), 0)).toBe(20);
    expect(summary.accountSummaries.every((account) => account.manualSilverExpenseWan === 0)).toBe(true);
  });
});
