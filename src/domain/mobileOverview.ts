import type { InventoryWeekReport } from "./inventory";
import type { MainlineAccountProjection } from "./mainline";
import type { AccountTaskPlan } from "./plans";
import { accountIds } from "./types";
import type { AccountId, SilverExpenseRecord, TaskCompletionRecord } from "./types";
import type { WeeklyAccountActivitySummary } from "./weeklyActivity";

export type MobileWeekDayState = "recorded" | "today-pending" | "missed" | "future";

export interface MobileWeekDayOverview {
  date: string;
  weekday: InventoryWeekReport["days"][number]["weekday"];
  state: MobileWeekDayState;
  hasInventory: boolean;
  taskCompletionCount: number;
  expenseCount: number;
}

export interface AccountOverview {
  accountId: AccountId;
  weekly: WeeklyAccountActivitySummary | null;
  projection: MainlineAccountProjection | null;
  pendingTaskCount: number;
}

/** Join every account-facing surface by account ID and keep one canonical order. */
export function buildAccountOverview(
  summaries: WeeklyAccountActivitySummary[],
  projections: MainlineAccountProjection[],
  taskPlans: AccountTaskPlan[],
): AccountOverview[] {
  const summaryByAccount = new Map(summaries.map((summary) => [summary.accountId, summary]));
  const projectionByAccount = new Map(projections.map((projection) => [projection.accountId, projection]));
  const planByAccount = new Map(taskPlans.map((plan) => [plan.accountId, plan]));

  return accountIds.map((accountId) => ({
    accountId,
    weekly: summaryByAccount.get(accountId) || null,
    projection: projectionByAccount.get(accountId) || null,
    pendingTaskCount: planByAccount.get(accountId)?.tasks.filter((task) => !task.done).length || 0,
  }));
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
