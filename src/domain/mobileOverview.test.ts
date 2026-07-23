import { describe, expect, it } from "vitest";
import { buildInventoryWeekReport } from "./inventory";
import type { MainlineAccountProjection } from "./mainline";
import { buildMobileAccountOverview, buildMobileWeekOverview } from "./mobileOverview";
import type { AccountTaskPlan } from "./plans";
import type { AccountId, InventorySnapshot, SilverExpenseRecord, TaskCompletionRecord } from "./types";
import type { WeeklyAccountActivitySummary } from "./weeklyActivity";

function snapshot(effectiveDate: string): InventorySnapshot {
  const balance = { dedicatedEggs: 1, regularEggs: 2, silverWan: 3, innerShardCount: 4 };
  return {
    effectiveDate,
    recordedAt: `${effectiveDate}T02:00:00.000Z`,
    accounts: { FC: balance, LG1: balance, LG2: balance, PT: balance, MYT: balance },
  };
}

describe("buildMobileWeekOverview", () => {
  it("distinguishes inventory, task and expense activity from future and missed days", () => {
    const report = buildInventoryWeekReport([snapshot("2026-07-20")], "2026-07-22");
    const completions = [{ completedOn: "2026-07-21" }] as TaskCompletionRecord[];
    const expenses = [{ effectiveDate: "2026-07-22" }] as SilverExpenseRecord[];

    const days = buildMobileWeekOverview(report, "2026-07-22", completions, expenses);

    expect(days.map((day) => day.state)).toEqual([
      "recorded",
      "recorded",
      "recorded",
      "future",
      "future",
      "future",
      "future",
    ]);
    expect(days[0]).toMatchObject({ hasInventory: true, taskCompletionCount: 0, expenseCount: 0 });
    expect(days[1]).toMatchObject({ hasInventory: false, taskCompletionCount: 1, expenseCount: 0 });
    expect(days[2]).toMatchObject({ hasInventory: false, taskCompletionCount: 0, expenseCount: 1 });
  });

  it("marks an empty current day as pending and an empty past day as missed", () => {
    const report = buildInventoryWeekReport([], "2026-07-22");
    const days = buildMobileWeekOverview(report, "2026-07-22", [], []);

    expect(days[0].state).toBe("missed");
    expect(days[1].state).toBe("missed");
    expect(days[2].state).toBe("today-pending");
  });
});

function accountSummary(accountId: AccountId, marker: number): WeeklyAccountActivitySummary {
  return {
    accountId,
    currentSilverWan: marker,
    inventoryNetChangeWan: marker,
    taskSilverExpenseWan: 0,
    manualSilverExpenseWan: marker,
    totalSilverExpenseWan: marker,
    reconciledSilverExpenseWan: marker,
    pendingReconciliationSilverExpenseWan: 0,
    harvestedSilverWan: marker,
    taskCompletions: Array.from({ length: marker }, (_, index) => ({ taskId: `${accountId}:${index}` })) as TaskCompletionRecord[],
    manualExpenses: [],
  };
}

function accountProjection(accountId: AccountId): MainlineAccountProjection {
  return { accountId, currentTask: { id: `${accountId}:current`, accountId } } as MainlineAccountProjection;
}

function accountPlan(accountId: AccountId, pending: number): AccountTaskPlan {
  return {
    accountId,
    tasks: Array.from({ length: pending }, (_, index) => ({ id: `${accountId}:${index}`, done: false })),
  } as AccountTaskPlan;
}

describe("buildMobileAccountOverview", () => {
  it("joins shuffled account data by ID and returns the canonical account order", () => {
    const rows = buildMobileAccountOverview(
      [accountSummary("MYT", 5), accountSummary("PT", 3), accountSummary("FC", 1), accountSummary("LG2", 4), accountSummary("LG1", 2)],
      [accountProjection("LG2"), accountProjection("FC"), accountProjection("MYT"), accountProjection("LG1"), accountProjection("PT")],
      [accountPlan("PT", 3), accountPlan("MYT", 5), accountPlan("LG1", 2), accountPlan("FC", 1), accountPlan("LG2", 4)],
    );

    expect(rows.map((row) => row.accountId)).toEqual(["FC", "LG1", "PT", "LG2", "MYT"]);
    expect(rows.map((row) => row.weekly?.harvestedSilverWan)).toEqual([1, 2, 3, 4, 5]);
    expect(rows.map((row) => row.projection?.accountId)).toEqual(["FC", "LG1", "PT", "LG2", "MYT"]);
    expect(rows.map((row) => row.pendingTaskCount)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps a missing account visible without borrowing another account's values", () => {
    const rows = buildMobileAccountOverview(
      [accountSummary("FC", 1)],
      [accountProjection("FC")],
      [accountPlan("FC", 1)],
    );
    const lg1 = rows.find((row) => row.accountId === "LG1");

    expect(rows).toHaveLength(5);
    expect(lg1).toEqual({ accountId: "LG1", weekly: null, projection: null, pendingTaskCount: 0 });
  });
});
