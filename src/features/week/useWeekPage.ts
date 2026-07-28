import { computed, watch } from "vue";
import { storeToRefs } from "pinia";
import { buildInventoryWeekReport, naturalWeekRange } from "../../domain/inventory";
import { buildMobileWeekOverview, type MobileWeekDayOverview } from "../../domain/mobileOverview";
import { buildWeeklyActivitySummary } from "../../domain/weeklyActivity";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";
import { useWeekDraftStore } from "../../stores/weekDraft";

export function useWeekPage() {
  const inventory = useInventoryStore();
  const settings = useSettingsStore();
  const ui = useUiStore();
  const weekDraft = useWeekDraftStore();

  inventory.hydrate();
  weekDraft.initialize(settings.planningAsOfDate);

  const { selectedAnchor } = storeToRefs(weekDraft);
  const currentDate = computed(() => settings.planningAsOfDate);
  const report = computed(() => buildInventoryWeekReport(inventory.snapshots, selectedAnchor.value));
  const currentWeek = computed(() => naturalWeekRange(currentDate.value));
  const isCurrentWeek = computed(() => report.value.weekStart === currentWeek.value.weekStart);
  const canViewNextWeek = computed(() => report.value.weekStart < currentWeek.value.weekStart);
  const activity = computed(() => buildWeeklyActivitySummary(
    report.value,
    settings.taskCompletions,
    settings.silverExpenses,
    currentDate.value,
  ));
  const weekDays = computed(() => buildMobileWeekOverview(
    report.value,
    currentDate.value,
    settings.taskCompletions,
    settings.silverExpenses,
  ));
  const dateRangeLabel = computed(() => `${report.value.weekStart} 至 ${report.value.weekEnd}`);
  const weekdayLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"] as const;

  watch(currentDate, (date, previousDate) => {
    const previousCurrentWeek = naturalWeekRange(previousDate);
    if (report.value.weekStart === previousCurrentWeek.weekStart) selectedAnchor.value = date;
  });

  function shiftDate(value: string, days: number) {
    const [year, month, day] = value.split("-").map(Number);
    const shifted = new Date(Date.UTC(year, month - 1, day + days));
    return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
  }

  function moveWeek(days: -7 | 7) {
    if (days > 0 && !canViewNextWeek.value) return;
    selectedAnchor.value = shiftDate(report.value.weekStart, days);
  }

  function returnToCurrentWeek() {
    selectedAnchor.value = currentDate.value;
  }

  function dayNumber(value: string) {
    return Number(value.slice(-2));
  }

  function dayStateLabel(day: MobileWeekDayOverview) {
    if (day.date === currentDate.value) return "今天";
    if (day.state === "recorded") return "已记";
    if (day.state === "future") return "未来";
    return "未记";
  }

  function compactWanLabel(value: number | null, signed = false) {
    if (value === null) return "—";
    const normalized = Number(value.toFixed(2));
    const prefix = signed && normalized > 0 ? "+" : "";
    return `${prefix}${normalized.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
  }

  function valueTone(value: number | null) {
    if (value === null || value === 0) return "neutral";
    return value > 0 ? "positive" : "negative";
  }

  function openSupplementSheet() {
    ui.openRecordSheet("inventory", {
      sourcePath: "/week",
      returnTo: "/week",
      effectiveDate: activity.value.reportEnd,
    });
  }

  return {
    currentDate,
    report,
    isCurrentWeek,
    canViewNextWeek,
    activity,
    weekDays,
    dateRangeLabel,
    weekdayLabels,
    moveWeek,
    returnToCurrentWeek,
    dayNumber,
    dayStateLabel,
    compactWanLabel,
    valueTone,
    openSupplementSheet,
  };
}
