import { describe, expect, it } from "vitest";
import { buildInventoryWeekReport } from "./inventory";
import { buildMobileWeekOverview } from "./mobileOverview";
import type { InventorySnapshot, SilverExpenseRecord, TaskCompletionRecord } from "./types";

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
