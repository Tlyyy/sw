import type { InventoryWeekReport } from "./inventory";
import type { SilverExpenseRecord, TaskCompletionRecord } from "./types";

export type MobileWeekDayState = "recorded" | "today-pending" | "missed" | "future";

export interface MobileWeekDayOverview {
  date: string;
  weekday: InventoryWeekReport["days"][number]["weekday"];
  state: MobileWeekDayState;
  hasInventory: boolean;
  taskCompletionCount: number;
  expenseCount: number;
}
/**
 * Build the seven-day rhythm shown on the mobile home screen.
 * A day counts as recorded when it contains any user-created weekly activity,
 * while the individual activity flags keep the UI honest about what was saved.
 */
export function buildMobileWeekOverview(
  report: InventoryWeekReport,
  currentDate: string,
  taskCompletions: TaskCompletionRecord[],
  silverExpenses: SilverExpenseRecord[],
): MobileWeekDayOverview[] {
  const taskCounts = new Map<string, number>();
  const expenseCounts = new Map<string, number>();

  taskCompletions.forEach((entry) => {
    taskCounts.set(entry.completedOn, (taskCounts.get(entry.completedOn) || 0) + 1);
  });
  silverExpenses.forEach((entry) => {
    expenseCounts.set(entry.effectiveDate, (expenseCounts.get(entry.effectiveDate) || 0) + 1);
  });

  return report.days.map((day) => {
    const taskCompletionCount = taskCounts.get(day.date) || 0;
    const expenseCount = expenseCounts.get(day.date) || 0;
    const hasInventory = Boolean(day.snapshot);
    const hasActivity = hasInventory || taskCompletionCount > 0 || expenseCount > 0;
    const state: MobileWeekDayState = day.date > currentDate
      ? "future"
      : hasActivity
        ? "recorded"
        : day.date === currentDate
          ? "today-pending"
          : "missed";

    return {
      date: day.date,
      weekday: day.weekday,
      state,
      hasInventory,
      taskCompletionCount,
      expenseCount,
    };
  });
}
