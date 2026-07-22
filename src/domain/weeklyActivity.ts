import {
  naturalWeekRange,
  summarizeInventoryWeeklyChange,
  type InventoryWeekReport,
} from "./inventory";
import { accountIds } from "./types";
import type {
  AccountId,
  SilverExpenseRecord,
  TaskCompletionRecord,
} from "./types";

export interface WeeklyAccountActivitySummary {
  accountId: AccountId;
  currentSilverWan: number | null;
  inventoryNetChangeWan: number | null;
  taskSilverExpenseWan: number;
  manualSilverExpenseWan: number;
  totalSilverExpenseWan: number;
  reconciledSilverExpenseWan: number;
  harvestedSilverWan: number | null;
  taskCompletions: TaskCompletionRecord[];
  manualExpenses: SilverExpenseRecord[];
}

export interface WeeklyActivitySummary {
  weekStart: string;
  reportEnd: string;
  recordedDays: number;
  latestInventoryDate: string | null;
  currentSilverWan: number | null;
  inventoryNetChangeWan: number | null;
  inventoryChangeFrom: string | null;
  inventoryChangeTo: string | null;
  taskSilverExpenseWan: number;
  manualSilverExpenseWan: number;
  totalSilverExpenseWan: number;
  reconciledSilverExpenseWan: number;
  pendingReconciliationSilverExpenseWan: number;
  harvestedSilverWan: number | null;
  unassignedManualSilverExpenseWan: number;
  accountSummaries: WeeklyAccountActivitySummary[];
  taskCompletions: TaskCompletionRecord[];
  manualExpenses: SilverExpenseRecord[];
}

function normalizeWan(value: number) {
  const rounded = Math.round((value + Math.sign(value) * Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function reportEndFor(report: InventoryWeekReport, currentDate: string) {
  const currentWeek = naturalWeekRange(currentDate);
  if (report.weekStart === currentWeek.weekStart) return currentDate < report.weekEnd ? currentDate : report.weekEnd;
  return report.weekEnd < currentDate ? report.weekEnd : currentDate;
}

function inRange(value: string, start: string, end: string) {
  return value >= start && value <= end;
}

/**
 * Reconcile a natural week through the requested calendar day.
 * Gross harvest is derived from the inventory balance change plus known
 * direct-silver spending, so spending does not make earned silver disappear.
 */
export function buildWeeklyActivitySummary(
  report: InventoryWeekReport,
  taskCompletions: TaskCompletionRecord[],
  manualExpenses: SilverExpenseRecord[],
  currentDate: string,
): WeeklyActivitySummary {
  const reportEnd = reportEndFor(report, currentDate);
  const daysToDate = report.days.filter((day) => day.date <= reportEnd);
  const latestRecordedDay = [...daysToDate].reverse().find((day) => day.snapshot) || null;
  const completions = taskCompletions
    .filter((entry) => inRange(entry.completedOn, report.weekStart, reportEnd))
    .sort((left, right) => right.completedOn.localeCompare(left.completedOn) || right.recordedAt.localeCompare(left.recordedAt));
  const expenses = manualExpenses
    .filter((entry) => inRange(entry.effectiveDate, report.weekStart, reportEnd))
    .sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate) || right.recordedAt.localeCompare(left.recordedAt));
  const taskSilverExpenseWan = normalizeWan(completions.reduce((sum, entry) => sum + entry.silverSpentWan, 0));
  const manualSilverExpenseWan = normalizeWan(expenses.reduce((sum, entry) => sum + entry.amountWan, 0));
  const totalSilverExpenseWan = normalizeWan(taskSilverExpenseWan + manualSilverExpenseWan);
  const usableChange = report.weeklyChange && report.weeklyChange.toEffectiveDate <= reportEnd
    ? report.weeklyChange
    : null;
  const inventoryNetChangeWan = usableChange
    ? summarizeInventoryWeeklyChange(usableChange.deltas).directSilverWan
    : null;
  const reconciledCompletions = usableChange
    ? completions.filter((entry) => entry.completedOn > usableChange.fromEffectiveDate && entry.completedOn <= usableChange.toEffectiveDate)
    : [];
  const reconciledExpenses = usableChange
    ? expenses.filter((entry) => entry.effectiveDate > usableChange.fromEffectiveDate && entry.effectiveDate <= usableChange.toEffectiveDate)
    : [];
  const reconciledSilverExpenseWan = normalizeWan(
    reconciledCompletions.reduce((sum, entry) => sum + entry.silverSpentWan, 0)
    + reconciledExpenses.reduce((sum, entry) => sum + entry.amountWan, 0),
  );
  const pendingReconciliationSilverExpenseWan = normalizeWan(totalSilverExpenseWan - reconciledSilverExpenseWan);
  const currentSilverWan = latestRecordedDay?.snapshot
    ? normalizeWan(Object.values(latestRecordedDay.snapshot.accounts).reduce((sum, balance) => sum + balance.silverWan, 0))
    : null;
  const accountSummaries = accountIds.map((accountId) => {
    const accountCompletions = completions.filter((entry) => entry.accountId === accountId);
    const accountExpenses = expenses.filter((entry) => entry.accountId === accountId);
    const accountTaskExpenseWan = normalizeWan(accountCompletions.reduce((sum, entry) => sum + entry.silverSpentWan, 0));
    const accountManualExpenseWan = normalizeWan(accountExpenses.reduce((sum, entry) => sum + entry.amountWan, 0));
    const accountTotalExpenseWan = normalizeWan(accountTaskExpenseWan + accountManualExpenseWan);
    const accountReconciledExpenseWan = normalizeWan(
      reconciledCompletions
        .filter((entry) => entry.accountId === accountId)
        .reduce((sum, entry) => sum + entry.silverSpentWan, 0)
      + reconciledExpenses
        .filter((entry) => entry.accountId === accountId)
        .reduce((sum, entry) => sum + entry.amountWan, 0),
    );
    const accountInventoryNetChangeWan = usableChange
      ? normalizeWan(usableChange.deltas[accountId].silverWan)
      : null;
    return {
      accountId,
      currentSilverWan: latestRecordedDay?.snapshot
        ? normalizeWan(latestRecordedDay.snapshot.accounts[accountId].silverWan)
        : null,
      inventoryNetChangeWan: accountInventoryNetChangeWan,
      taskSilverExpenseWan: accountTaskExpenseWan,
      manualSilverExpenseWan: accountManualExpenseWan,
      totalSilverExpenseWan: accountTotalExpenseWan,
      reconciledSilverExpenseWan: accountReconciledExpenseWan,
      harvestedSilverWan: accountInventoryNetChangeWan === null
        ? null
        : normalizeWan(accountInventoryNetChangeWan + accountReconciledExpenseWan),
      taskCompletions: accountCompletions,
      manualExpenses: accountExpenses,
    } satisfies WeeklyAccountActivitySummary;
  });
  const unassignedManualSilverExpenseWan = normalizeWan(expenses
    .filter((entry) => !entry.accountId)
    .reduce((sum, entry) => sum + entry.amountWan, 0));

  return {
    weekStart: report.weekStart,
    reportEnd,
    recordedDays: daysToDate.filter((day) => day.snapshot).length,
    latestInventoryDate: latestRecordedDay?.date || null,
    currentSilverWan,
    inventoryNetChangeWan,
    inventoryChangeFrom: usableChange?.fromEffectiveDate || null,
    inventoryChangeTo: usableChange?.toEffectiveDate || null,
    taskSilverExpenseWan,
    manualSilverExpenseWan,
    totalSilverExpenseWan,
    reconciledSilverExpenseWan,
    pendingReconciliationSilverExpenseWan,
    harvestedSilverWan: inventoryNetChangeWan === null
      ? null
      : normalizeWan(inventoryNetChangeWan + reconciledSilverExpenseWan),
    unassignedManualSilverExpenseWan,
    accountSummaries,
    taskCompletions: completions,
    manualExpenses: expenses,
  };
}

export function taskCompletionResourceLabel(record: TaskCompletionRecord) {
  if (record.resourceKind === "silver") return `${normalizeWan(record.resourceAmount)} 万银子`;
  if (record.resourceKind === "eggs") return `${normalizeWan(record.resourceAmount)} 个蛋`;
  return `${normalizeWan(record.resourceAmount)} 片内丹碎片`;
}
