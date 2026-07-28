import { computed, onBeforeUnmount, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useRoute, useRouter } from "vue-router";
import {
  buildAccountingByAccount,
  normalizeAccountingEntries,
  type AccountingEntry,
  type AccountingResources,
} from "../../domain/accounting";
import { accountIds, type AccountId } from "../../domain/types";
import { useAccountingStore } from "../../stores/accounting";
import { useCatalogStore } from "../../stores/catalog";
import {
  useEarningsDraftStore,
  type EarningsAccountScope,
  type EarningsDailyMetric,
} from "../../stores/earningsDraft";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";
import { shareImageAccountColors } from "../../utils/shareImagePalette";
import {
  buildDailyEarningsShareData,
  createDailyEarningsShareImage,
} from "./dailyEarningsShareImage";
import { createEarningsShareImage } from "./earningsShareImage";

function queryAccount(value: unknown): AccountId | null {
  return typeof value === "string" && accountIds.includes(value as AccountId)
    ? value as AccountId
    : null;
}

export function useEarningsPage() {
  const route = useRoute();
  const router = useRouter();
  const catalog = useCatalogStore();
  const inventory = useInventoryStore();
  const accounting = useAccountingStore();
  const settings = useSettingsStore();
  const ui = useUiStore();
  const draft = useEarningsDraftStore();

  settings.hydrate();
  inventory.hydrate();
  accounting.hydrate();
  ui.hydrate();
  draft.initialize(ui.recentAccount, queryAccount(route.query.account));

  const {
    selectedScope,
    selectedAccount,
    dailyTableMetric,
    detailView,
  } = storeToRefs(draft);
  const ledgerNotice = ref("");
  const sharingIncome = ref(false);
  const sharingDailyIncome = ref(false);
  const sharingDailyIncomeWithEggs = ref(false);
  const incomeShareNotice = ref("");
  let incomeShareNoticeTimer: number | null = null;

  const reportByAccount = computed(() => buildAccountingByAccount({
    inventorySnapshots: inventory.snapshots,
    entries: accounting.entries,
    taskCompletions: settings.taskCompletions,
    silverExpenses: settings.silverExpenses,
    asOfDate: settings.planningAsOfDate,
  }));
  const summary = computed(() => reportByAccount.value[selectedAccount.value]);
  const dailyIncomeShareData = computed(() => buildDailyEarningsShareData(
    reportByAccount.value,
    settings.planningAsOfDate,
  ));
  const dailyIncomeWithEggsShareData = computed(() => buildDailyEarningsShareData(
    reportByAccount.value,
    settings.planningAsOfDate,
    "silverWithRegularEggsWan",
  ));
  const dailyTableData = computed(() => dailyTableMetric.value === "silverWithRegularEggsWan"
    ? dailyIncomeWithEggsShareData.value
    : dailyIncomeShareData.value);
  const dailyTableSummaryRows = computed(() => [
    dailyTableData.value.weeklyTotal,
    dailyTableData.value.dailyAverage,
  ]);
  const sharingDailyTable = computed(() => dailyTableMetric.value === "silverWithRegularEggsWan"
    ? sharingDailyIncomeWithEggs.value
    : sharingDailyIncome.value);
  const hasDailyIncomeToShare = computed(() => dailyIncomeShareData.value.recordedDays > 0);
  const sharingAnyIncome = computed(() => (
    sharingIncome.value
    || sharingDailyIncome.value
    || sharingDailyIncomeWithEggs.value
  ));
  const latestInterval = computed(() => summary.value.intervals.at(-1) || null);
  const latestSnapshot = computed(() => inventory.snapshots
    .filter((snapshot) => snapshot.effectiveDate <= settings.planningAsOfDate)
    .at(-1) || null);
  const selectedBalance = computed(() => latestSnapshot.value?.accounts[selectedAccount.value] || null);
  const normalizedEntries = computed(() => normalizeAccountingEntries({
    entries: accounting.entries,
    taskCompletions: settings.taskCompletions,
    silverExpenses: settings.silverExpenses,
  }));
  const ledgerEntries = computed(() => normalizedEntries.value
    .filter((entry) => entry.accountId === selectedAccount.value)
    .sort((left, right) => (
      right.effectiveDate.localeCompare(left.effectiveDate)
      || right.occurredAt.localeCompare(left.occurredAt)
      || right.recordedAt.localeCompare(left.recordedAt)
    ))
    .slice(0, 30));
  const storedEntryIds = computed(() => new Set(accounting.entries.map((entry) => entry.id)));
  const pendingEntryIds = computed(() => new Set(summary.value.pending.entries.map((entry) => entry.id)));
  const recentCrossDayIntervals = computed(() => [...summary.value.intervals]
    .filter((interval) => interval.kind !== "daily")
    .reverse()
    .slice(0, 8));
  const latestTitle = computed(() => {
    const interval = latestInterval.value;
    if (!interval) return "最近实际所得";
    return interval.kind === "daily"
      ? `${shortDate(interval.toDate)} 实际所得`
      : `最近 ${interval.intervalDays} 天实际所得`;
  });
  const shareButtonText = computed(() => latestInterval.value?.kind === "daily"
    ? `${selectedAccount.value}·当日`
    : `${selectedAccount.value}·区间`);
  const shareButtonLabel = computed(() => latestInterval.value
    ? `分享 ${selectedAccount.value} ${latestTitle.value}图片`
    : `${selectedAccount.value} 暂无可分享的实际所得`);
  const dailyShareButtonLabel = computed(() => hasDailyIncomeToShare.value
    ? `分享五个账号 ${dailyIncomeShareData.value.weekStart} 至 ${dailyIncomeShareData.value.weekEnd} 每日实际所得图片`
    : "本周暂无可分享的五账号每日实际所得");
  const dailyWithEggsShareButtonLabel = computed(() => hasDailyIncomeToShare.value
    ? `分享五个账号 ${dailyIncomeWithEggsShareData.value.weekStart} 至 ${dailyIncomeWithEggsShareData.value.weekEnd} 每日实际所得银加蛋折银图片`
    : "本周暂无可分享的五账号每日实际所得银加蛋折银");
  const dailyTableShareButtonLabel = computed(() => dailyTableMetric.value === "silverWithRegularEggsWan"
    ? dailyWithEggsShareButtonLabel.value
    : dailyShareButtonLabel.value);

  watch(() => route.query.account, (value) => {
    draft.applyRouteAccount(queryAccount(value));
  });
  watch(selectedAccount, (accountId) => {
    ui.recentAccount = accountId;
  });
  onBeforeUnmount(() => {
    if (incomeShareNoticeTimer !== null) window.clearTimeout(incomeShareNoticeTimer);
  });

  function selectAccount(scope: EarningsAccountScope) {
    selectedScope.value = scope;
    if (scope === "all") {
      const query = { ...route.query };
      delete query.account;
      void router.replace({ query });
      return;
    }
    selectedAccount.value = scope;
    void router.replace({ query: { ...route.query, account: scope } });
  }
  function setDailyTableMetric(metric: EarningsDailyMetric) {
    dailyTableMetric.value = metric;
  }
  function numberLabel(value: number, suffix = "") {
    const normalized = Number(value.toFixed(2));
    return `${normalized > 0 ? "+" : ""}${normalized.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}${suffix}`;
  }
  function dailyTableValueLabel(value: number | null) {
    return value === null ? "—" : numberLabel(value);
  }
  function dailyTableValueTone(value: number | null) {
    if (value === null) return "unknown";
    if (value > 0) return "positive";
    if (value < 0) return "negative";
    return "neutral";
  }
  function compactDailyBasis(value: string) {
    return value
      .replace("连续库存 · ", "")
      .replace("尚未到日期", "未到日期")
      .replace(/^\d+ 天区间，非单日$/, "跨天区间");
  }
  function wanLabel(value: number | null | undefined, signed = true) {
    if (value === null || value === undefined) return "—";
    const normalized = Number(value.toFixed(2));
    return `${signed && normalized > 0 ? "+" : ""}${normalized.toLocaleString("zh-CN", { maximumFractionDigits: 2 })} 万`;
  }
  function inventoryCountLabel(value: number | null | undefined, suffix: string) {
    if (value === undefined) return "—";
    if (value === null) return "未知";
    return `${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })} ${suffix}`;
  }
  function shortDate(date: string) {
    const [, month, day] = date.split("-").map(Number);
    return `${month}月${day}日`;
  }
  function intervalRange(entry: { fromDate: string; toDate: string }) {
    return `${shortDate(entry.fromDate)} → ${shortDate(entry.toDate)}`;
  }
  function showIncomeShareNotice(message: string) {
    incomeShareNotice.value = message;
    if (incomeShareNoticeTimer !== null) window.clearTimeout(incomeShareNoticeTimer);
    incomeShareNoticeTimer = window.setTimeout(() => {
      incomeShareNotice.value = "";
      incomeShareNoticeTimer = null;
    }, 2_800);
  }
  function downloadShareImage(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  async function shareDailyIncome(metric: EarningsDailyMetric = "silverWan") {
    if (!hasDailyIncomeToShare.value || sharingAnyIncome.value) return;
    const withEggs = metric === "silverWithRegularEggsWan";
    const sharingState = withEggs ? sharingDailyIncomeWithEggs : sharingDailyIncome;
    sharingState.value = true;
    try {
      const data = withEggs ? dailyIncomeWithEggsShareData.value : dailyIncomeShareData.value;
      const blob = createDailyEarningsShareImage(data);
      const fileName = withEggs
        ? `五号每日实际所得-银加蛋折银-${data.weekStart}-${data.weekEnd}.png`
        : `五号每日实际所得-${data.weekStart}-${data.weekEnd}.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      const nativeShareData: ShareData = {
        files: [file],
        title: withEggs ? "五号每日实际所得 · 银+蛋折银" : "五号每日实际所得",
      };
      const supportsFileShare = typeof navigator.share === "function"
        && typeof navigator.canShare === "function"
        && navigator.canShare(nativeShareData);
      if (supportsFileShare) {
        try {
          await navigator.share(nativeShareData);
          showIncomeShareNotice(withEggs ? "五号银+蛋折银图片已打开系统分享" : "五号每日所得图片已打开系统分享");
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      downloadShareImage(blob, fileName);
      showIncomeShareNotice(withEggs ? "五号银+蛋折银图片已下载" : "五号每日所得图片已下载");
    } catch {
      showIncomeShareNotice("图片生成失败，请重试");
    } finally {
      sharingState.value = false;
    }
  }
  function shareVisibleDailyIncome() {
    void shareDailyIncome(dailyTableMetric.value);
  }
  async function shareLatestIncome() {
    const interval = latestInterval.value;
    if (!interval || sharingAnyIncome.value) return;
    sharingIncome.value = true;
    try {
      const blob = createEarningsShareImage({
        accountId: selectedAccount.value,
        accountTone: shareImageAccountColors[selectedAccount.value],
        kind: interval.kind,
        fromDate: interval.fromDate,
        toDate: interval.toDate,
        intervalDays: interval.intervalDays,
        inventoryNetChange: interval.inventoryNetChange,
        ledgerImpact: interval.ledgerImpact,
        actualIncome: interval.actualIncome,
        settledEntryCount: interval.entries.length,
      });
      const reportName = interval.kind === "daily" ? "每日实际所得" : "区间实际所得";
      const rangeName = interval.kind === "daily" ? interval.toDate : `${interval.fromDate}-${interval.toDate}`;
      const fileName = `${selectedAccount.value}-${rangeName}-${reportName}.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      const nativeShareData: ShareData = { files: [file], title: `${selectedAccount.value} ${reportName}` };
      const supportsFileShare = typeof navigator.share === "function"
        && typeof navigator.canShare === "function"
        && navigator.canShare(nativeShareData);
      if (supportsFileShare) {
        try {
          await navigator.share(nativeShareData);
          showIncomeShareNotice("实际所得图片已打开系统分享");
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      downloadShareImage(blob, fileName);
      showIncomeShareNotice("实际所得图片已下载");
    } catch {
      showIncomeShareNotice("图片生成失败，请重试");
    } finally {
      sharingIncome.value = false;
    }
  }
  function entryKind(entry: AccountingEntry) {
    const kinds = new Set(entry.legs.map((leg) => leg.kind));
    if (kinds.has("transfer-out")) return "转出";
    if (kinds.has("transfer-in")) return "转入";
    if (kinds.has("adjustment-increase")) return "非收益增加";
    if (kinds.has("adjustment-decrease")) return "非收益减少";
    if (entry.source === "task-progress") return "任务进度";
    if (entry.taskId) return "任务支出";
    return "其他支出";
  }
  function entryTone(entry: AccountingEntry) {
    const kind = entry.legs[0]?.kind;
    if (kind === "transfer-in" || kind === "transfer-out") return "transfer";
    if (kind === "adjustment-increase" || kind === "adjustment-decrease") return "adjustment";
    return "expense";
  }
  function entryResourceText(entry: AccountingEntry) {
    const totals = entry.legs.reduce<AccountingResources>((sum, leg) => ({
      silverWan: sum.silverWan + leg.resources.silverWan,
      dedicatedEggs: sum.dedicatedEggs + leg.resources.dedicatedEggs,
      regularEggs: sum.regularEggs + leg.resources.regularEggs,
      innerShards: (sum.innerShards || 0) + (leg.resources.innerShards || 0),
    }), { silverWan: 0, dedicatedEggs: 0, regularEggs: 0, innerShards: 0 });
    return [
      totals.silverWan ? `${Number(totals.silverWan.toFixed(2)).toLocaleString("zh-CN")} 万银子` : "",
      totals.dedicatedEggs ? `${totals.dedicatedEggs} 专用蛋` : "",
      totals.regularEggs ? `${totals.regularEggs} 普通蛋` : "",
      totals.innerShards ? `${totals.innerShards} 碎片` : "",
    ].filter(Boolean).join(" · ") || "0 支出";
  }
  function canVoid(entry: AccountingEntry) {
    return storedEntryIds.value.has(entry.id) && (entry.status || "confirmed") === "confirmed";
  }
  function voidLedgerEntry(entry: AccountingEntry) {
    if (!canVoid(entry)) return;
    const linked = entry.groupId ? "，同一笔转账的两端会一起撤销" : "";
    if (!confirm(`确认撤销这笔“${entryKind(entry)}”记录${linked}？库存不会改变。`)) return;
    if (accounting.voidEntry(entry.id)) ledgerNotice.value = "已撤销实际流水；库存没有变化。";
  }

  return {
    accountIds,
    catalog,
    selectedScope,
    selectedAccount,
    dailyTableMetric,
    detailView,
    ledgerNotice,
    incomeShareNotice,
    sharingIncome,
    sharingDailyTable,
    sharingAnyIncome,
    reportByAccount,
    summary,
    dailyTableData,
    dailyTableSummaryRows,
    hasDailyIncomeToShare,
    latestInterval,
    latestSnapshot,
    selectedBalance,
    ledgerEntries,
    pendingEntryIds,
    recentCrossDayIntervals,
    shareButtonText,
    shareButtonLabel,
    dailyTableShareButtonLabel,
    selectAccount,
    setDailyTableMetric,
    dailyTableValueLabel,
    dailyTableValueTone,
    compactDailyBasis,
    wanLabel,
    inventoryCountLabel,
    shortDate,
    intervalRange,
    shareVisibleDailyIncome,
    shareLatestIncome,
    entryKind,
    entryTone,
    entryResourceText,
    canVoid,
    voidLedgerEntry,
  };
}
