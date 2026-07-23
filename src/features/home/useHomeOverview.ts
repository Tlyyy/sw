import { computed } from "vue";
import { buildInventoryWeekReport } from "../../domain/inventory";
import { buildMainlineProjection } from "../../domain/mainline";
import {
  buildAccountOverview,
  buildMobileWeekOverview,
  type AccountOverview,
  type MobileWeekDayOverview,
  type MobileWeekDayState,
} from "../../domain/mobileOverview";
import { buildTaskPlans } from "../../domain/plans";
import { buildWeeklyActivitySummary } from "../../domain/weeklyActivity";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";

export const weekdayLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"] as const;

export function useHomeOverview() {
  const inventory = useInventoryStore();
  const settings = useSettingsStore();
  const catalog = useCatalogStore();

  inventory.hydrate();

  const today = computed(() => settings.planningAsOfDate);
  const report = computed(() => buildInventoryWeekReport(inventory.snapshots, today.value));
  const weeklyActivity = computed(() => buildWeeklyActivitySummary(
    report.value,
    settings.taskCompletions,
    settings.silverExpenses,
    today.value,
  ));
  const weekDays = computed(() => buildMobileWeekOverview(
    report.value,
    today.value,
    settings.taskCompletions,
    settings.silverExpenses,
  ));
  const todayOverview = computed(() => weekDays.value.find((day) => day.date === today.value) || null);
  const planningState = computed(() => settings.snapshot(
    inventory.planningResources,
    inventory.latestSnapshot?.effectiveDate || null,
  ));
  const taskPlans = computed(() => buildTaskPlans(catalog.data, catalog.pets, planningState.value));
  const projections = computed(() => buildMainlineProjection(taskPlans.value, inventory.snapshots, {
    buyWan: settings.taskSettings.eggPriceWan,
    sellWan: catalog.data.beastConfig.eggSellPriceWan,
  }));
  const accountRows = computed(() => buildAccountOverview(
    weeklyActivity.value.accountSummaries,
    projections.value,
    taskPlans.value,
  ));

  const todayHeading = computed(() => {
    if (todayOverview.value?.hasInventory) return "今天库存已记录";
    if ((todayOverview.value?.taskCompletionCount || 0) + (todayOverview.value?.expenseCount || 0) > 0) {
      return "今天已有动态，库存待补";
    }
    return "今天还没有记录";
  });

  const todayDescription = computed(() => {
    const taskCount = todayOverview.value?.taskCompletionCount || 0;
    const expenseCount = todayOverview.value?.expenseCount || 0;
    if (todayOverview.value?.hasInventory) {
      const details = [taskCount ? `${taskCount} 项任务` : "", expenseCount ? `${expenseCount} 笔支出` : ""].filter(Boolean);
      return details.length ? `库存已保存 · 另有${details.join("、")}` : "库存已保存，可继续补充任务或收支";
    }
    if (taskCount || expenseCount) return "任务或支出已经记下，再补一份库存就完整了";
    return "补充库存、完成任务或记录支出";
  });

  return {
    accountRows,
    report,
    today,
    todayDescription,
    todayHeading,
    todayOverview,
    weekDays,
    weeklyActivity,
  };
}

export function shortRange(start: string, end: string) {
  const [, startMonth, startDay] = start.split("-");
  const [, endMonth, endDay] = end.split("-");
  return `${Number(startMonth)}月${Number(startDay)}日—${Number(endMonth)}月${Number(endDay)}日`;
}

export function dayNumber(value: string) {
  return Number(value.slice(-2));
}

export function shortDay(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

export function dayStateLabel(state: MobileWeekDayState) {
  if (state === "recorded") return "已记录";
  if (state === "today-pending") return "待记录";
  if (state === "missed") return "未记录";
  return "未来";
}

export function dayAriaLabel(day: MobileWeekDayOverview) {
  const details = [
    day.hasInventory ? "库存已记录" : "",
    day.taskCompletionCount ? `完成 ${day.taskCompletionCount} 项任务` : "",
    day.expenseCount ? `${day.expenseCount} 笔支出` : "",
  ].filter(Boolean);
  return `${weekdayLabels[day.weekday - 1]} ${day.date}，${details.length ? details.join("，") : dayStateLabel(day.state)}`;
}

export function wanLabel(value: number | null, signed = false) {
  if (value === null) return "待计算";
  const normalized = Number(value.toFixed(2));
  const prefix = signed && normalized > 0 ? "+" : "";
  return `${prefix}${normalized.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}万`;
}

export function accountTaskLabel(row: AccountOverview) {
  if (!row.projection) return "任务状态待同步";
  if (!row.projection.currentTask) return "主线任务已完成";
  return `${row.projection.currentTask.typeLabel} · ${row.projection.currentTask.actionLabel}`;
}
