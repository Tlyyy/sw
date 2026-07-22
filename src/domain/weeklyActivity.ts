import {
  naturalWeekRange,
  summarizeInventoryWeeklyChange,
  type InventoryWeekReport,
} from "./inventory";
import type { SilverExpenseRecord, TaskCompletionRecord } from "./types";

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
  harvestedSilverWan: number | null;
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
  const currentSilverWan = latestRecordedDay?.snapshot
    ? normalizeWan(Object.values(latestRecordedDay.snapshot.accounts).reduce((sum, balance) => sum + balance.silverWan, 0))
    : null;

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
    harvestedSilverWan: inventoryNetChangeWan === null
      ? null
      : normalizeWan(inventoryNetChangeWan + totalSilverExpenseWan),
    taskCompletions: completions,
    manualExpenses: expenses,
  };
}

export function taskCompletionResourceLabel(record: TaskCompletionRecord) {
  if (record.resourceKind === "silver") return `${normalizeWan(record.resourceAmount)} 万银子`;
  if (record.resourceKind === "eggs") return `${normalizeWan(record.resourceAmount)} 个蛋`;
  return `${normalizeWan(record.resourceAmount)} 片内丹碎片`;
}
