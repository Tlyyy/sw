<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  buildInventoryWeekReport,
  inventoryRegularEggValueWan,
  inventorySilverWithRegularEggsWan,
  naturalWeekRange,
  summarizeInventoryWeeklyChange,
  type InventorySnapshotComparison,
  type InventoryWeekDaySlot,
} from "../domain/inventory";
import type { AccountId, InventoryAccountDelta, InventoryBalance, InventorySnapshot } from "../domain/types";
import AppIcon from "./AppIcon.vue";
import {
  createInventoryReportShareImage,
  type InventoryReportShareData,
} from "./inventoryReportShareImage";

type InventoryReportView = "summary" | "matrix";
type InventoryMatrixMetric = "silverWan" | "silverWithRegularEggsWan" | "dedicatedEggs" | "regularEggs" | "innerShardCount";

const props = defineProps<{
  snapshots: InventorySnapshot[];
  currentDate: string;
}>();

const emit = defineEmits<{
  record: [date: string];
  remove: [date: string];
}>();

const accountOrder: AccountId[] = ["FC", "LG1", "LG2", "PT", "MYT"];
const weekdayLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"] as const;
const matrixMetricOptions: Array<{ key: InventoryMatrixMetric; label: string; unit: string }> = [
  { key: "silverWan", label: "银子", unit: "万" },
  { key: "silverWithRegularEggsWan", label: "银+蛋", unit: "万" },
  { key: "dedicatedEggs", label: "专用蛋", unit: "个" },
  { key: "regularEggs", label: "普通蛋", unit: "个" },
  { key: "innerShardCount", label: "内丹碎片", unit: "个" },
];
const selectedAnchor = ref(props.currentDate);
const expandedDate = ref<string | null>(null);
const reportView = ref<InventoryReportView>("summary");
const matrixMetric = ref<InventoryMatrixMetric>("silverWan");
const sharingReport = ref(false);
const shareNotice = ref("");
let shareNoticeTimer: number | null = null;
const report = computed(() => buildInventoryWeekReport(props.snapshots, selectedAnchor.value));
const weeklyTotals = computed(() => report.value.weeklyChange
  ? summarizeInventoryWeeklyChange(report.value.weeklyChange.deltas)
  : null);
const selectedMatrixMetric = computed(() => matrixMetricOptions.find((item) => item.key === matrixMetric.value) || matrixMetricOptions[0]!);
const currentWeek = computed(() => naturalWeekRange(props.currentDate));
const isCurrentWeek = computed(() => report.value.weekStart === currentWeek.value.weekStart);
const canViewNextWeek = computed(() => report.value.weekStart < currentWeek.value.weekStart);
const latestRecordedDay = computed(() => [...report.value.days].reverse().find((day) => day.snapshot) || null);
const shareButtonLabel = computed(() => reportView.value === "summary"
  ? "分享当前库存汇总"
  : `分享${selectedMatrixMetric.value.label}按日对比`);

watch(() => props.currentDate, (date) => {
  selectedAnchor.value = date;
});

watch(() => report.value.weekStart, () => {
  expandedDate.value = null;
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
  selectedAnchor.value = props.currentDate;
}

function formatShortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function snapshotTotals(snapshot: InventorySnapshot): InventoryBalance {
  const balances = accountOrder.map((accountId) => snapshot.accounts[accountId]);
  return {
    dedicatedEggs: balances.reduce((sum, item) => sum + item.dedicatedEggs, 0),
    regularEggs: balances.reduce((sum, item) => sum + item.regularEggs, 0),
    silverWan: balances.reduce((sum, item) => sum + item.silverWan, 0),
    innerShardCount: balances.some((item) => item.innerShardCount === null)
      ? null
      : balances.reduce((sum, item) => sum + (item.innerShardCount || 0), 0),
  };
}

function numberLabel(value: number) {
  return Number.isInteger(value) ? value.toLocaleString() : Number(value.toFixed(2)).toLocaleString();
}

function signedValue(value: number, unit = "") {
  const normalized = Number(value.toFixed(2));
  if (normalized === 0) return `0${unit}`;
  return `${normalized > 0 ? "+" : ""}${numberLabel(normalized)}${unit}`;
}

function deltaTone(value: number | null) {
  if (value === null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

function comparisonLabel(comparison: InventorySnapshotComparison | null) {
  if (!comparison) return "首份记录，暂无变化基线";
  return `较 ${comparison.fromEffectiveDate} · 相隔 ${comparison.intervalDays} 天`;
}

function weeklyBasisLabel() {
  return report.value.weeklyChangeBasis === "before-week"
    ? "以上周前最近一份实际记录为基线"
    : "按本周首份与末份实际记录比较";
}

function deltaMetricValue(delta: InventoryAccountDelta | null | undefined): number | null {
  if (!delta) return null;
  if (matrixMetric.value === "silverWithRegularEggsWan") return inventorySilverWithRegularEggsWan(delta);
  return delta[matrixMetric.value];
}

function dayMatrixValue(day: InventoryWeekDaySlot, accountId: AccountId): number | null {
  return deltaMetricValue(day.comparison?.deltas[accountId]);
}

function sumKnownValues(values: Array<number | null>): number | null {
  if (values.some((value) => value === null)) return null;
  return values.reduce<number>((sum, value) => sum + (value || 0), 0);
}

function dayMatrixTotal(day: InventoryWeekDaySlot): number | null {
  return sumKnownValues(accountOrder.map((accountId) => dayMatrixValue(day, accountId)));
}

function weeklyMatrixValue(accountId: AccountId): number | null {
  return deltaMetricValue(report.value.weeklyChange?.deltas[accountId]);
}

function weeklyMatrixTotal(): number | null {
  return sumKnownValues(accountOrder.map((accountId) => weeklyMatrixValue(accountId)));
}

function averageMatrixValue(value: number | null): number | null {
  const intervalDays = report.value.weeklyChange?.intervalDays || 0;
  if (value === null || intervalDays <= 0) return null;
  return value / intervalDays;
}

function matrixValueLabel(value: number | null) {
  return value === null ? "—" : signedValue(value);
}

function matrixBasisLabel(day: InventoryWeekDaySlot) {
  if (!day.snapshot) return "未记录";
  if (!day.comparison) return "暂无基线";
  return `较前次 · ${day.comparison.intervalDays}天`;
}

function toggleDay(day: InventoryWeekDaySlot) {
  if (!day.snapshot) return;
  expandedDate.value = expandedDate.value === day.date ? null : day.date;
}

function shareBalanceValues(balance: InventoryBalance) {
  return [
    balance.dedicatedEggs,
    balance.regularEggs,
    balance.silverWan,
    inventorySilverWithRegularEggsWan(balance),
    balance.innerShardCount,
  ];
}

function buildShareData(): InventoryReportShareData {
  const common = {
    weekStart: report.value.weekStart,
    weekEnd: report.value.weekEnd,
    recordedDays: report.value.recordedDays,
  };

  if (reportView.value === "summary") {
    const latestDay = latestRecordedDay.value;
    const snapshot = latestDay?.snapshot
      ? {
          date: latestDay.date,
          rows: accountOrder.map((accountId) => ({
            label: accountId,
            values: shareBalanceValues(latestDay.snapshot!.accounts[accountId]),
          })),
          total: {
            label: "合计",
            values: shareBalanceValues(snapshotTotals(latestDay.snapshot)),
          },
        }
      : null;
    const weeklyChange = report.value.weeklyChange;
    const change = weeklyChange && weeklyTotals.value
      ? {
          caption: `${weeklyChange.fromEffectiveDate} → ${weeklyChange.toEffectiveDate} · ${weeklyChange.intervalDays} 天`,
          rows: accountOrder.map((accountId) => {
            const delta = weeklyChange.deltas[accountId];
            return {
              label: accountId,
              values: [
                delta.dedicatedEggs,
                delta.regularEggs,
                delta.silverWan,
                inventorySilverWithRegularEggsWan(delta),
                delta.innerShardCount,
              ],
            };
          }),
          total: {
            label: "合计",
            values: [
              weeklyTotals.value.dedicatedEggs,
              weeklyTotals.value.regularEggs,
              weeklyTotals.value.directSilverWan,
              weeklyTotals.value.totalSilverWan,
              weeklyTotals.value.innerShardCount,
            ],
          },
        }
      : null;

    return {
      ...common,
      view: "summary",
      snapshot,
      change,
      valuationNote: `银+蛋 = 银子 + 普通蛋 × ${inventoryRegularEggValueWan} 万/个`,
    };
  }

  const weeklyValues = accountOrder.map((accountId) => weeklyMatrixValue(accountId));
  const weeklyTotalValue = weeklyMatrixTotal();
  return {
    ...common,
    view: "matrix",
    metricLabel: selectedMatrixMetric.value.label,
    unit: selectedMatrixMetric.value.unit,
    conversionNote: matrixMetric.value === "silverWithRegularEggsWan"
      ? `银子 + 普通蛋 × ${inventoryRegularEggValueWan} 万/个`
      : null,
    rows: report.value.days.map((day) => ({
      label: `${weekdayLabels[day.weekday - 1]} ${formatShortDate(day.date)}`,
      basis: matrixBasisLabel(day),
      values: [...accountOrder.map((accountId) => dayMatrixValue(day, accountId)), dayMatrixTotal(day)],
    })),
    weeklyTotal: { label: "本周合计", values: [...weeklyValues, weeklyTotalValue] },
    dailyAverage: {
      label: "区间日均",
      values: [...weeklyValues.map((value) => averageMatrixValue(value)), averageMatrixValue(weeklyTotalValue)],
    },
    intervalLabel: report.value.weeklyChange ? `${report.value.weeklyChange.intervalDays} 天区间` : "暂无完整区间",
  };
}

function showShareNotice(message: string) {
  shareNotice.value = message;
  if (shareNoticeTimer !== null) window.clearTimeout(shareNoticeTimer);
  shareNoticeTimer = window.setTimeout(() => {
    shareNotice.value = "";
    shareNoticeTimer = null;
  }, 2_800);
}

function downloadShareImage(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function shareInventoryReport() {
  if (sharingReport.value) return;
  sharingReport.value = true;

  try {
    const shareData = buildShareData();
    const blob = createInventoryReportShareImage(shareData);
    const viewName = shareData.view === "summary" ? "库存汇总" : `${shareData.metricLabel}按日对比`;
    const fileName = `${viewName}-${shareData.weekStart}-${shareData.weekEnd}.png`;
    const file = new File([blob], fileName, { type: "image/png" });
    const nativeShareData: ShareData = { files: [file], title: viewName };
    const supportsFileShare = typeof navigator.share === "function"
      && typeof navigator.canShare === "function"
      && navigator.canShare(nativeShareData);

    if (supportsFileShare) {
      try {
        await navigator.share(nativeShareData);
        showShareNotice("库存图片已生成");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    downloadShareImage(blob, fileName);
    showShareNotice("库存图片已下载");
  } catch {
    showShareNotice("图片生成失败，请重试");
  } finally {
    sharingReport.value = false;
  }
}
</script>

<template>
  <section class="settings-section inventory-week-report inventory-report-surface" aria-labelledby="inventory-week-report-title" data-testid="inventory-week-report">
    <div class="section-head weekly-report-head">
      <div>
        <h2 id="inventory-week-report-title">每周库存报表</h2>
        <p>每周固定按周一到周日查看；有记录的日期显示日报，没有记录的日期保持空白。</p>
      </div>
      <span class="weekly-recorded-badge">{{ report.recordedDays }} / 7 天有记录</span>
    </div>

    <div class="week-report-toolbar" aria-label="周报日期切换">
      <button class="week-shift-button previous" type="button" aria-label="查看上一周" @click="moveWeek(-7)">
        <AppIcon name="chevron-right" />
      </button>
      <div class="week-range-title" aria-live="polite">
        <strong>{{ report.weekStart }} 至 {{ report.weekEnd }}</strong>
        <small>{{ isCurrentWeek ? "本周" : "历史周报" }}</small>
      </div>
      <button class="week-shift-button" type="button" aria-label="查看下一周" :disabled="!canViewNextWeek" @click="moveWeek(7)">
        <AppIcon name="chevron-right" />
      </button>
      <button v-if="!isCurrentWeek" class="week-current-button" type="button" @click="returnToCurrentWeek">回到本周</button>
    </div>

    <div class="week-view-controls">
      <div class="segmented weekly-view-switch" role="group" aria-label="周报视图">
        <button type="button" :class="{ active: reportView === 'summary' }" :aria-pressed="reportView === 'summary'" @click="reportView = 'summary'">汇总视图</button>
        <button type="button" :class="{ active: reportView === 'matrix' }" :aria-pressed="reportView === 'matrix'" @click="reportView = 'matrix'">按日对比</button>
      </div>
      <div class="week-view-actions">
        <p aria-live="polite">{{ reportView === "summary" ? "查看本周合计、每日记录与明细" : "按一个指标横向比较五个账号的每日净变化" }}</p>
        <button
          type="button"
          class="inventory-report-share-button"
          :class="{ loading: sharingReport }"
          :disabled="sharingReport"
          :aria-busy="sharingReport"
          :aria-label="shareButtonLabel"
          :title="shareButtonLabel"
          @click="shareInventoryReport"
        >
          <AppIcon :name="sharingReport ? 'refresh' : 'share'" />
          <span>分享</span>
        </button>
      </div>
    </div>

    <p v-if="shareNotice" class="inventory-share-notice" role="status">{{ shareNotice }}</p>

    <template v-if="reportView === 'summary'">
      <div class="weekly-change-panel">
      <header>
        <div>
          <h3>本周净变化</h3>
          <p v-if="report.weeklyChange">
            {{ weeklyBasisLabel() }} · {{ report.weeklyChange.fromEffectiveDate }} → {{ report.weeklyChange.toEffectiveDate }}（{{ report.weeklyChange.intervalDays }} 天）
          </p>
          <p v-if="report.weeklyChange" class="weekly-change-valuation-note">
            银 = 纯银子；银+蛋 = 纯银子 + 普通蛋 × {{ inventoryRegularEggValueWan }} 万/个
          </p>
          <p v-else-if="report.recordedDays === 0">本周尚无实际库存记录，周变化暂时留空。</p>
          <p v-else>本周只有一份记录且没有更早基线，暂时无法计算变化。</p>
        </div>
      </header>
      <div v-if="report.weeklyChange" class="weekly-change-table" role="table" aria-label="五账号本周库存净变化">
        <div class="weekly-change-head" role="row">
          <span role="columnheader">账号</span><span role="columnheader">专</span><span role="columnheader">普</span>
          <span class="weekly-money-header" role="columnheader"><span>银</span><small> / 万</small></span>
          <span class="weekly-money-header" role="columnheader"><span>银+蛋</span><small> / 万</small></span>
          <span role="columnheader">碎</span>
        </div>
        <div v-for="accountId in accountOrder" :key="accountId" class="weekly-change-row" role="row">
          <strong role="cell" :class="`account-pill account-${accountId.toLowerCase()}`">{{ accountId }}</strong>
          <b role="cell" :class="deltaTone(report.weeklyChange.deltas[accountId].dedicatedEggs)">{{ signedValue(report.weeklyChange.deltas[accountId].dedicatedEggs) }}</b>
          <b role="cell" :class="deltaTone(report.weeklyChange.deltas[accountId].regularEggs)">{{ signedValue(report.weeklyChange.deltas[accountId].regularEggs) }}</b>
          <b role="cell" :class="deltaTone(report.weeklyChange.deltas[accountId].silverWan)">{{ signedValue(report.weeklyChange.deltas[accountId].silverWan) }}</b>
          <b
            role="cell"
            :class="deltaTone(inventorySilverWithRegularEggsWan(report.weeklyChange.deltas[accountId]))"
            :aria-label="`${accountId} 银子加普通蛋折算 ${signedValue(inventorySilverWithRegularEggsWan(report.weeklyChange.deltas[accountId]))} 万`"
          >{{ signedValue(inventorySilverWithRegularEggsWan(report.weeklyChange.deltas[accountId])) }}</b>
          <b role="cell" :class="deltaTone(report.weeklyChange.deltas[accountId].innerShardCount)">{{ report.weeklyChange.deltas[accountId].innerShardCount === null ? "—" : signedValue(report.weeklyChange.deltas[accountId].innerShardCount) }}</b>
        </div>
        <div v-if="weeklyTotals" class="weekly-change-row weekly-change-total" role="row" aria-label="本周净变化合计">
          <strong role="rowheader">合计</strong>
          <b role="cell" :class="deltaTone(weeklyTotals.dedicatedEggs)">{{ signedValue(weeklyTotals.dedicatedEggs) }}</b>
          <b role="cell" :class="deltaTone(weeklyTotals.regularEggs)">{{ signedValue(weeklyTotals.regularEggs) }}</b>
          <b
            role="cell"
            :class="deltaTone(weeklyTotals.directSilverWan)"
            :aria-label="`纯银子净变化合计 ${signedValue(weeklyTotals.directSilverWan)} 万，不含普通蛋折算`"
          >{{ signedValue(weeklyTotals.directSilverWan) }}</b>
          <b
            role="cell"
            :class="deltaTone(weeklyTotals.totalSilverWan)"
            :aria-label="`银子加普通蛋折算合计 ${signedValue(weeklyTotals.totalSilverWan)} 万，普通蛋按每个 ${inventoryRegularEggValueWan} 万折算`"
          >{{ signedValue(weeklyTotals.totalSilverWan) }}</b>
          <b role="cell" :class="deltaTone(weeklyTotals.innerShardCount)">{{ weeklyTotals.innerShardCount === null ? "—" : signedValue(weeklyTotals.innerShardCount) }}</b>
        </div>
        </div>
      </div>

      <div class="week-day-table" role="table" aria-label="周一到周日库存日报">
        <div class="week-day-table-head" role="row">
          <span role="columnheader">日期</span><span role="columnheader">记录</span><span role="columnheader">五号库存合计</span><span role="columnheader">操作</span>
        </div>
        <article
          v-for="day in report.days"
          :key="day.date"
          class="week-day-entry"
          :class="{ recorded: day.snapshot, expanded: expandedDate === day.date, today: day.date === props.currentDate }"
          :data-date="day.date"
          :aria-current="day.date === props.currentDate ? 'date' : undefined"
        >
          <div class="week-day-row" role="row">
            <div class="week-day-identity" role="cell">
              <strong>{{ weekdayLabels[day.weekday - 1] }}</strong>
              <span>{{ formatShortDate(day.date) }}</span>
            </div>
            <span class="week-day-status" :class="day.snapshot ? 'recorded' : 'missing'" role="cell">{{ day.snapshot ? "已记录" : "未记录" }}</span>
            <div v-if="day.snapshot" class="week-day-totals" role="cell" :aria-label="`${day.date} 五号库存合计`">
              <span>专 <b>{{ numberLabel(snapshotTotals(day.snapshot).dedicatedEggs) }}</b></span>
              <span>普 <b>{{ numberLabel(snapshotTotals(day.snapshot).regularEggs) }}</b></span>
              <span>银 <b>{{ numberLabel(snapshotTotals(day.snapshot).silverWan) }}万</b></span>
              <span>碎 <b>{{ snapshotTotals(day.snapshot).innerShardCount ?? "待补" }}</b></span>
            </div>
            <p v-else class="week-day-empty" role="cell">—</p>
            <button
              v-if="day.snapshot"
              class="week-day-action"
              type="button"
              :aria-expanded="expandedDate === day.date"
              :aria-label="`${expandedDate === day.date ? '收起' : '查看'}${day.date}库存日报`"
              @click="toggleDay(day)"
            >
              <span>{{ expandedDate === day.date ? "收起" : "查看" }}</span><AppIcon name="chevron-right" />
            </button>
            <button v-else class="week-day-action record" type="button" :aria-label="`补录${day.date}库存`" @click="emit('record', day.date)">补录</button>
          </div>

          <div v-if="day.snapshot && expandedDate === day.date" class="week-day-detail">
            <header>
              <p><strong>{{ day.date }} 日报</strong><span>{{ comparisonLabel(day.comparison) }}</span></p>
              <div>
                <button type="button" class="text-button" @click="emit('record', day.date)">修改这一天</button>
                <button type="button" class="text-button danger-text" @click="emit('remove', day.date)">删除记录</button>
              </div>
            </header>
            <div class="week-day-account-table" role="table" :aria-label="`${day.date} 五账号库存明细`">
              <div v-for="accountId in accountOrder" :key="accountId" class="week-day-account-row" role="row">
                <strong role="cell" :class="`account-pill account-${accountId.toLowerCase()}`">{{ accountId }}</strong>
                <span role="cell"><small>专用蛋</small><b>{{ day.snapshot.accounts[accountId].dedicatedEggs }}</b><em v-if="day.comparison" :class="deltaTone(day.comparison.deltas[accountId].dedicatedEggs)">{{ signedValue(day.comparison.deltas[accountId].dedicatedEggs) }}</em></span>
                <span role="cell"><small>普通蛋</small><b>{{ day.snapshot.accounts[accountId].regularEggs }}</b><em v-if="day.comparison" :class="deltaTone(day.comparison.deltas[accountId].regularEggs)">{{ signedValue(day.comparison.deltas[accountId].regularEggs) }}</em></span>
                <span role="cell"><small>银 / 万</small><b>{{ numberLabel(day.snapshot.accounts[accountId].silverWan) }}</b><em v-if="day.comparison" :class="deltaTone(day.comparison.deltas[accountId].silverWan)">{{ signedValue(day.comparison.deltas[accountId].silverWan) }}</em></span>
                <span role="cell"><small>内丹碎片</small><b>{{ day.snapshot.accounts[accountId].innerShardCount ?? "待补" }}</b><em v-if="day.comparison" :class="deltaTone(day.comparison.deltas[accountId].innerShardCount)">{{ day.comparison.deltas[accountId].innerShardCount === null ? "—" : signedValue(day.comparison.deltas[accountId].innerShardCount) }}</em></span>
              </div>
            </div>
          </div>
        </article>
      </div>
    </template>

    <section v-else class="inventory-daily-matrix" aria-labelledby="inventory-daily-matrix-title">
      <header class="inventory-matrix-head">
        <div>
          <h3 id="inventory-daily-matrix-title">按日净变化</h3>
          <p>每格为该日期相对上一份实际快照的变化；未记录或没有更早基线时显示“—”。</p>
        </div>
        <div class="segmented matrix-metric-switch" role="group" aria-label="对比指标">
          <button
            v-for="item in matrixMetricOptions"
            :key="item.key"
            type="button"
            :class="{ active: matrixMetric === item.key }"
            :aria-pressed="matrixMetric === item.key"
            :aria-label="item.key === 'silverWithRegularEggsWan' ? `银子加普通蛋，普通蛋按每个 ${inventoryRegularEggValueWan} 万折算` : item.label"
            :title="item.key === 'silverWithRegularEggsWan' ? `银子 + 普通蛋 × ${inventoryRegularEggValueWan} 万/个` : undefined"
            @click="matrixMetric = item.key"
          >{{ item.label }}</button>
        </div>
      </header>

      <p class="inventory-matrix-context" aria-live="polite">
        当前指标：<strong>{{ selectedMatrixMetric.label }}</strong>
        <span>单位：{{ selectedMatrixMetric.unit }}</span>
        <span v-if="matrixMetric === 'silverWithRegularEggsWan'" class="matrix-conversion-note">折算：银子 + 普通蛋 × {{ inventoryRegularEggValueWan }} 万/个</span>
        <span v-if="report.weeklyChange">汇总区间：{{ report.weeklyChange.intervalDays }} 天</span>
      </p>

      <div class="inventory-matrix-scroll" tabindex="0" :aria-label="`${selectedMatrixMetric.label}按日净变化矩阵，可横向滚动`">
        <table class="inventory-matrix-table">
          <caption>{{ report.weekStart }} 至 {{ report.weekEnd }} 五账号{{ selectedMatrixMetric.label }}按日净变化</caption>
          <thead>
            <tr>
              <th scope="col">日期</th>
              <th v-for="accountId in accountOrder" :key="accountId" scope="col"><span :class="`account-pill account-${accountId.toLowerCase()}`">{{ accountId }}</span></th>
              <th class="matrix-total-column" scope="col">五号合计</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="day in report.days"
              :key="day.date"
              :class="{ today: day.date === props.currentDate, missing: !day.snapshot }"
              :aria-current="day.date === props.currentDate ? 'date' : undefined"
            >
              <th scope="row">
                <strong>{{ weekdayLabels[day.weekday - 1] }} <span>{{ formatShortDate(day.date) }}</span></strong>
                <small>{{ matrixBasisLabel(day) }}</small>
              </th>
              <td
                v-for="accountId in accountOrder"
                :key="accountId"
                :class="deltaTone(dayMatrixValue(day, accountId))"
              ><b>{{ matrixValueLabel(dayMatrixValue(day, accountId)) }}</b></td>
              <td class="matrix-total-column" :class="deltaTone(dayMatrixTotal(day))"><b>{{ matrixValueLabel(dayMatrixTotal(day)) }}</b></td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="matrix-week-total">
              <th scope="row"><strong>本周合计</strong><small>{{ report.weeklyChange ? `${report.weeklyChange.intervalDays} 天区间` : "暂无完整区间" }}</small></th>
              <td v-for="accountId in accountOrder" :key="accountId" :class="deltaTone(weeklyMatrixValue(accountId))"><b>{{ matrixValueLabel(weeklyMatrixValue(accountId)) }}</b></td>
              <td class="matrix-total-column" :class="deltaTone(weeklyMatrixTotal())"><b>{{ matrixValueLabel(weeklyMatrixTotal()) }}</b></td>
            </tr>
            <tr class="matrix-week-average">
              <th scope="row"><strong>区间日均</strong><small>按实际间隔天数折算</small></th>
              <td v-for="accountId in accountOrder" :key="accountId" :class="deltaTone(averageMatrixValue(weeklyMatrixValue(accountId)))"><b>{{ matrixValueLabel(averageMatrixValue(weeklyMatrixValue(accountId))) }}</b></td>
              <td class="matrix-total-column" :class="deltaTone(averageMatrixValue(weeklyMatrixTotal()))"><b>{{ matrixValueLabel(averageMatrixValue(weeklyMatrixTotal())) }}</b></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  </section>
</template>

<style scoped>
.inventory-week-report { margin-top: 18px; }
.week-report-toolbar { min-height: 66px; display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px auto; align-items: center; gap: 10px; padding: 11px 0; border-bottom: 1px solid var(--radar-line); }
.week-shift-button { width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid var(--radar-line); border-radius: 4px; color: var(--radar-cyan); background: var(--radar-surface); }
.week-shift-button:disabled { color: var(--radar-muted); opacity: .38; cursor: not-allowed; }
.week-shift-button.previous :deep(svg) { transform: rotate(180deg); }
.week-range-title { min-width: 0; display: grid; gap: 2px; }
.week-range-title strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 18px; }
.week-range-title small { color: var(--radar-muted); font-size: 15px; }
.week-current-button { min-height: 40px; padding: 0 12px; border: 1px solid var(--radar-line); border-radius: 4px; color: var(--radar-cyan); background: var(--radar-cyan-soft); font-weight: 750; }
.week-view-controls { grid-column: 1 / -1; min-height: 58px; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 9px 16px; border-bottom: 1px solid var(--radar-line); background: var(--radar-surface-2); }
.week-view-controls p { min-width: 0; color: var(--radar-muted); font-size: 13px; line-height: 1.45; text-align: right; }
.week-view-actions { min-width: 0; display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
.inventory-report-share-button { min-width: 82px; min-height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 12px; border: 1px solid color-mix(in srgb, var(--radar-cyan) 42%, var(--radar-line)); border-radius: 7px; color: var(--radar-cyan-strong); background: var(--radar-surface); font-size: 13px; font-weight: 800; }
.inventory-report-share-button:hover,
.inventory-report-share-button:focus-visible { background: var(--radar-cyan-soft); outline: 0; }
.inventory-report-share-button:focus-visible { box-shadow: inset 0 0 0 2px var(--radar-cyan); }
.inventory-report-share-button:disabled { cursor: wait; opacity: .58; }
.inventory-report-share-button :deep(svg) { width: 17px; height: 17px; }
.inventory-report-share-button.loading :deep(svg) { animation: inventory-share-spin .75s linear infinite; }
.inventory-share-notice { position: fixed; right: 20px; bottom: 24px; z-index: 70; max-width: calc(100vw - 40px); margin: 0; padding: 10px 14px; border: 1px solid color-mix(in srgb, var(--radar-cyan) 36%, var(--radar-line)); border-radius: 8px; color: var(--radar-ink); background: color-mix(in srgb, var(--radar-surface) 94%, var(--radar-cyan-soft)); box-shadow: 0 8px 24px rgba(20, 37, 34, .16); font-size: 13px; font-weight: 750; line-height: 1.35; }
@keyframes inventory-share-spin { to { transform: rotate(360deg); } }
.weekly-view-switch,
.matrix-metric-switch { display: inline-grid; grid-auto-flow: column; grid-auto-columns: minmax(max-content, 1fr); overflow: hidden; padding: 3px; border: 1px solid var(--radar-line); border-radius: 7px; background: var(--radar-surface); }
.weekly-view-switch button,
.matrix-metric-switch button { min-height: 34px; padding: 0 13px; border: 0; border-radius: 5px; color: var(--radar-muted); background: transparent; font-size: 13px; font-weight: 800; white-space: nowrap; }
.weekly-view-switch button:hover,
.matrix-metric-switch button:hover { color: var(--radar-cyan-strong); background: var(--radar-cyan-soft); }
.weekly-view-switch button.active,
.matrix-metric-switch button.active { border-color: var(--radar-cyan); color: #ffffff; background: var(--radar-cyan); box-shadow: none; }
.weekly-change-panel { margin-top: 14px; border: 1px solid var(--radar-line); background: var(--radar-surface); }
.weekly-change-panel > header { padding: 16px; border-bottom: 1px solid var(--radar-line); }
.weekly-change-panel h3 { font-size: 20px; }
.weekly-change-panel p { margin-top: 5px; color: var(--radar-muted); font-size: 16px; line-height: 1.55; }
.weekly-change-panel .weekly-change-valuation-note { color: var(--radar-cyan); }
.weekly-change-head,
.weekly-change-row { display: grid; grid-template-columns: minmax(68px, 1fr) repeat(5, minmax(72px, 1fr)); align-items: center; gap: 8px; min-height: 50px; padding: 8px 16px; border-bottom: 1px solid var(--radar-line); font-size: 16px; }
.weekly-change-head { min-height: 44px; color: var(--radar-ink); background: var(--radar-surface-3); font-weight: 800; }
.weekly-money-header small { font: inherit; }
.weekly-change-row:last-child { border-bottom: 0; }
.weekly-change-row > .account-pill { justify-self: start; }
.weekly-change-total { min-height: 54px; border-top: 2px solid var(--radar-cyan); color: var(--radar-ink); background: var(--radar-cyan-soft); }
.weekly-change-total > strong { justify-self: start; white-space: nowrap; }
.weekly-change-total > b { white-space: nowrap; font-weight: 800; }
.weekly-change-head > :not(:first-child),
.weekly-change-row > :not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; }
.positive { color: var(--radar-success); }
.negative { color: var(--radar-danger); }
.neutral { color: var(--radar-muted); }
.week-day-table { margin-top: 14px; border: 1px solid var(--radar-line); background: var(--radar-surface); }
.week-day-table-head,
.week-day-row { display: grid; grid-template-columns: 120px 96px minmax(300px, 1fr) 92px; align-items: center; gap: 14px; min-height: 62px; padding: 9px 16px; border-bottom: 1px solid var(--radar-line); }
.week-day-table-head { min-height: 44px; color: var(--radar-ink); background: var(--radar-surface-3); font-size: 15px; font-weight: 800; }
.week-day-entry:last-child > .week-day-row { border-bottom: 0; }
.week-day-entry.expanded > .week-day-row { background: var(--radar-cyan-soft); }
.week-day-identity { display: flex; align-items: baseline; gap: 8px; }
.week-day-identity strong { font-size: 16px; }
.week-day-identity span { color: var(--radar-muted); font-size: 15px; }
.week-day-status { justify-self: start; padding: 4px 9px; border: 1px solid var(--radar-line-strong); border-radius: 999px; color: var(--radar-muted); background: #ffffff; font-size: 14px; font-weight: 800; }
.week-day-status.recorded { border-color: color-mix(in srgb, var(--radar-success) 45%, var(--radar-line)); color: var(--radar-success); background: color-mix(in srgb, var(--radar-success) 9%, transparent); }
.week-day-totals { min-width: 0; display: grid; grid-template-columns: repeat(4, minmax(72px, 1fr)); gap: 10px; color: var(--radar-muted); font-size: 15px; }
.week-day-totals span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.week-day-totals b { color: var(--radar-ink); }
.week-day-empty { color: var(--radar-muted); }
.week-day-action { min-width: 78px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; border: 1px solid var(--radar-line-strong); border-radius: 5px; color: var(--radar-cyan-strong); background: var(--radar-cyan-soft); font-size: 16px; font-weight: 800; }
.week-day-action span { white-space: nowrap; }
.week-day-action :deep(svg) { width: 16px; height: 16px; transition: transform .16s ease; }
.week-day-entry.expanded .week-day-action :deep(svg) { transform: rotate(90deg); }
.week-day-action.record { border-color: color-mix(in srgb, var(--radar-amber) 45%, var(--radar-line)); color: var(--radar-amber-strong); background: var(--radar-amber-soft); }
.week-day-detail { padding: 16px; border-bottom: 1px solid var(--radar-line-strong); background: var(--radar-surface-2); }
.week-day-detail > header { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 10px; }
.week-day-detail > header p { display: grid; gap: 2px; }
.week-day-detail > header p span { color: var(--radar-muted); font-size: 15px; }
.week-day-detail > header > div { display: flex; gap: 8px; }
.week-day-account-table { border-top: 1px solid var(--radar-line); }
.week-day-account-row { display: grid; grid-template-columns: 70px repeat(4, minmax(82px, 1fr)); align-items: center; gap: 8px; min-height: 62px; padding: 7px 10px; border-bottom: 1px solid var(--radar-line); }
.week-day-account-row > span { min-width: 0; display: grid; grid-template-columns: 1fr auto; gap: 1px 6px; }
.week-day-account-row small { grid-column: 1 / -1; color: var(--radar-muted); font-size: 14px; }
.week-day-account-row b { font-size: 16px; font-variant-numeric: tabular-nums; }
.week-day-account-row em { justify-self: end; font-size: 14px; font-style: normal; font-weight: 750; font-variant-numeric: tabular-nums; }

.inventory-daily-matrix { grid-column: 1 / -1; min-width: 0; overflow: hidden; margin: 14px 16px 16px; border: 1px solid var(--radar-line); border-radius: 7px; background: var(--radar-surface); }
.inventory-matrix-head { min-height: 72px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 18px; padding: 12px 14px; border-bottom: 1px solid var(--radar-line); background: var(--radar-surface-2); }
.inventory-matrix-head > div:first-child { min-width: 0; }
.inventory-matrix-head h3 { color: var(--radar-ink); font-size: 18px; line-height: 1.3; }
.inventory-matrix-head p { margin-top: 3px; color: var(--radar-muted); font-size: 13px; line-height: 1.45; }
.inventory-matrix-context { min-height: 40px; display: flex; align-items: center; gap: 18px; padding: 7px 14px; border-bottom: 1px solid var(--radar-line); color: var(--radar-muted); background: color-mix(in srgb, var(--radar-cyan) 5%, #ffffff); font-size: 13px; }
.inventory-matrix-context strong { color: var(--radar-cyan-strong); }
.inventory-matrix-context .matrix-conversion-note { color: var(--radar-cyan-strong); font-weight: 750; }
.inventory-matrix-scroll { min-width: 0; max-width: 100%; overflow-x: auto; overscroll-behavior-inline: contain; scrollbar-gutter: stable; }
.inventory-matrix-scroll:focus-visible { outline: 2px solid var(--radar-cyan); outline-offset: -2px; }
.inventory-matrix-table { width: 100%; min-width: 880px; border-spacing: 0; border-collapse: separate; table-layout: fixed; color: var(--radar-ink); font-size: 14px; font-variant-numeric: tabular-nums; }
.inventory-matrix-table caption { position: absolute; width: 1px; height: 1px; overflow: hidden; margin: -1px; padding: 0; border: 0; clip: rect(0 0 0 0); white-space: nowrap; }
.inventory-matrix-table th,
.inventory-matrix-table td { height: 48px; padding: 7px 12px; border-right: 1px solid var(--radar-line); border-bottom: 1px solid var(--radar-line); text-align: right; vertical-align: middle; }
.inventory-matrix-table tr > :last-child { border-right: 0; }
.inventory-matrix-table thead th { height: 42px; color: var(--radar-muted); background: #f6f8f7; font-size: 12px; font-weight: 800; }
.inventory-matrix-table thead th:first-child,
.inventory-matrix-table tbody th,
.inventory-matrix-table tfoot th { width: 156px; text-align: left; }
.inventory-matrix-table thead th:not(:first-child) { text-align: center; }
.inventory-matrix-table tbody th { background: #ffffff; }
.inventory-matrix-table tbody th strong,
.inventory-matrix-table tfoot th strong { display: block; font-size: 14px; line-height: 1.25; }
.inventory-matrix-table tbody th strong span { margin-left: 4px; color: var(--radar-muted); font-weight: 650; }
.inventory-matrix-table tbody th small,
.inventory-matrix-table tfoot th small { display: block; margin-top: 2px; color: var(--radar-muted); font-size: 11px; font-weight: 650; line-height: 1.25; white-space: nowrap; }
.inventory-matrix-table tbody td { background: #ffffff; }
.inventory-matrix-table tbody td b,
.inventory-matrix-table tfoot td b { font-size: 14px; font-weight: 800; white-space: nowrap; }
.inventory-matrix-table tbody tr:hover th,
.inventory-matrix-table tbody tr:hover td { background: color-mix(in srgb, var(--radar-cyan) 4%, #ffffff); }
.inventory-matrix-table tbody tr.today th,
.inventory-matrix-table tbody tr.today td { background: var(--radar-cyan-soft); }
.inventory-matrix-table tbody tr.today th { box-shadow: inset 3px 0 var(--radar-cyan); }
.inventory-matrix-table tbody tr.missing td b { color: color-mix(in srgb, var(--radar-muted) 72%, transparent); }
.inventory-matrix-table .matrix-total-column { background: color-mix(in srgb, var(--radar-cyan) 4%, #ffffff); font-weight: 850; }
.inventory-matrix-table tfoot th,
.inventory-matrix-table tfoot td { background: color-mix(in srgb, var(--radar-cyan) 8%, #ffffff); }
.inventory-matrix-table tfoot .matrix-week-total > * { border-top: 2px solid var(--radar-cyan); }
.inventory-matrix-table tfoot .matrix-week-average > * { border-bottom: 0; background: color-mix(in srgb, var(--radar-cyan) 4%, #ffffff); }
.inventory-matrix-table tfoot .matrix-total-column { background: color-mix(in srgb, var(--radar-cyan) 13%, #ffffff); }

@media (max-width: 720px) {
  .weekly-report-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; }
  .weekly-report-head > span { align-self: start; white-space: nowrap; font-size: 14px; text-align: right; }
  .week-report-toolbar { grid-template-columns: 44px minmax(0, 1fr) 44px; gap: 7px; }
  .week-range-title { text-align: center; }
  .week-range-title strong { font-size: 15px; }
  .week-current-button { grid-column: 1 / -1; width: 100%; min-height: 44px; }
  .weekly-change-table { overflow-x: auto; overscroll-behavior-inline: contain; }
  .weekly-change-head,
  .weekly-change-row { min-width: 520px; grid-template-columns: 64px repeat(5, minmax(72px, 1fr)); gap: 4px; padding-inline: 9px; }
  .weekly-change-head { font-size: 14px; }
  .weekly-money-header { display: grid; justify-items: end; gap: 1px; line-height: 1.05; }
  .weekly-money-header small { font-size: 13px; font-weight: 700; }
  .weekly-change-row b { font-size: 15px; }
  .week-day-table-head { display: none; }
  .week-day-row { grid-template-columns: 64px minmax(0, 1fr) 62px; gap: 7px; min-height: 72px; padding: 9px 10px; }
  .week-day-identity { display: grid; gap: 1px; }
  .week-day-status { grid-column: 2; grid-row: 1; align-self: start; }
  .week-day-totals,
  .week-day-empty { grid-column: 2; grid-row: 1; align-self: end; padding-top: 22px; }
  .week-day-totals { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px 8px; }
  .week-day-totals span { font-size: 14px; }
  .week-day-action { grid-column: 3; grid-row: 1; min-width: 62px; min-height: 44px; gap: 1px; padding: 0 5px; font-size: 15px; }
  .week-day-detail { padding: 11px 10px 13px; }
  .week-day-detail > header { align-items: stretch; flex-direction: column; }
  .week-day-detail > header > div { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .week-day-detail .text-button { min-height: 44px; }
  .week-day-account-row { grid-template-columns: 58px repeat(4, minmax(0, 1fr)); gap: 5px; padding-inline: 5px; }
  .week-day-account-row > span { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1px; text-align: center; }
  .week-day-account-row small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
  .week-day-account-row em { justify-self: center; font-size: 13px; }
}

/* Compact report workspace: the data and interactions stay unchanged. */
.inventory-report-surface {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(440px, .72fr);
  overflow: hidden;
  margin: 14px 0 0;
  border: 1px solid var(--radar-line);
  border-radius: 8px;
  background: var(--radar-surface);
}

.weekly-report-head {
  grid-column: 1;
  align-items: center;
  min-height: 78px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--radar-line);
}

.weekly-report-head h2 {
  font-size: 21px;
  line-height: 1.25;
}

.weekly-report-head p {
  max-width: 700px;
  margin-top: 2px;
  font-size: 13px !important;
  line-height: 1.45;
}

.weekly-recorded-badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 2px 9px;
  border: 1px solid color-mix(in srgb, var(--radar-cyan) 34%, var(--radar-line));
  border-radius: 999px;
  color: var(--radar-cyan-strong) !important;
  background: var(--radar-cyan-soft);
  font-size: 13px !important;
  font-weight: 800;
  line-height: 1.2 !important;
  white-space: nowrap;
}

.week-report-toolbar {
  grid-column: 2;
  grid-template-columns: 38px minmax(0, 1fr) 38px auto;
  min-height: 78px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--radar-line);
}

.week-shift-button {
  width: 38px;
  height: 38px;
  border-radius: 6px;
}

.week-range-title {
  justify-items: center;
  text-align: center;
}

.week-range-title strong {
  font-size: 16px;
}

.week-range-title small {
  font-size: 13px !important;
  line-height: 1.3;
}

.week-current-button {
  min-height: 38px;
  border-radius: 6px;
  font-size: 14px;
}

.weekly-change-panel {
  grid-column: 1 / -1;
  overflow: hidden;
  margin: 14px 16px 0;
  border-radius: 7px;
}

.weekly-change-panel > header {
  padding: 11px 14px 10px;
  background: var(--radar-surface-2);
}

.weekly-change-panel h3 {
  font-size: 18px;
  line-height: 1.3;
}

.weekly-change-panel p {
  margin-top: 2px;
  font-size: 13px !important;
  line-height: 1.45;
}

.weekly-change-panel .weekly-change-valuation-note {
  font-weight: 700;
}

.weekly-change-head,
.weekly-change-row {
  min-height: 44px;
  padding: 6px 14px;
  font-size: 15px;
}

.weekly-change-head {
  min-height: 40px;
  color: var(--radar-muted);
  background: #f6f8f7;
  font-size: 13px;
}

.weekly-change-row > b {
  font-size: 15px;
}

.weekly-change-total {
  min-height: 48px;
  border-top-width: 1px;
}

.week-day-table {
  grid-column: 1 / -1;
  overflow: hidden;
  margin: 12px 16px 16px;
  border-radius: 7px;
}

.week-day-table-head,
.week-day-row {
  grid-template-columns: 112px 88px minmax(300px, 1fr) 82px;
  min-height: 52px;
  gap: 12px;
  padding: 6px 14px;
}

.week-day-table-head {
  min-height: 40px;
  color: var(--radar-muted);
  background: #f6f8f7;
  font-size: 13px;
}

.week-day-entry.today > .week-day-row {
  background: color-mix(in srgb, var(--radar-cyan) 7%, #ffffff);
  box-shadow: inset 3px 0 var(--radar-cyan);
}

.week-day-entry.today .week-day-identity strong {
  color: var(--radar-cyan-strong);
}

.week-day-identity strong {
  font-size: 15px;
}

.week-day-identity span {
  font-size: 13px;
}

.week-day-status {
  min-height: 26px;
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 12px;
}

.week-day-totals {
  font-size: 14px;
}

.week-day-action {
  min-width: 72px;
  min-height: 38px;
  border-radius: 6px;
  font-size: 14px;
}

.week-day-detail {
  padding: 13px 14px 14px;
}

.week-day-account-row {
  min-height: 56px;
}

@media (max-width: 1100px) {
  .inventory-report-surface {
    grid-template-columns: minmax(0, 1fr);
  }

  .weekly-report-head,
  .week-report-toolbar {
    grid-column: 1;
  }

  .weekly-report-head {
    min-height: 72px;
  }

  .week-report-toolbar {
    min-height: 62px;
    padding-block: 10px;
  }
}

@media (max-width: 720px) {
  .inventory-report-surface {
    border-radius: 7px;
  }

  .weekly-report-head {
    grid-template-columns: minmax(0, 1fr) auto;
    min-height: 0;
    padding: 12px;
  }

  .weekly-report-head h2 {
    font-size: 19px;
  }

  .weekly-report-head p {
    display: none;
  }

  .weekly-recorded-badge {
    font-size: 12px !important;
  }

  .week-report-toolbar {
    grid-template-columns: 40px minmax(0, 1fr) 40px;
    gap: 7px;
    min-height: 60px;
    padding: 9px 10px;
  }

  .week-shift-button {
    width: 40px;
    height: 40px;
  }

  .week-current-button {
    grid-column: 1 / -1;
    width: 100%;
    min-height: 44px;
  }

  .week-view-controls {
    align-items: center;
    flex-direction: row;
    gap: 7px;
    padding: 8px 10px;
  }

  .week-view-actions {
    flex: 0 0 auto;
    gap: 0;
  }

  .week-view-actions p {
    display: none;
  }

  .weekly-view-switch {
    flex: 1 1 auto;
    width: auto;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-flow: row;
  }

  .inventory-report-share-button {
    width: 44px;
    min-width: 44px;
    min-height: 44px;
    padding: 0;
  }

  .inventory-report-share-button span {
    display: none;
  }

  .inventory-share-notice {
    right: 16px;
    bottom: calc(76px + env(safe-area-inset-bottom));
    max-width: calc(100vw - 32px);
  }

  .weekly-view-switch button,
  .matrix-metric-switch button {
    min-height: 44px;
    padding-inline: 8px;
  }

  .inventory-daily-matrix {
    margin: 10px;
  }

  .inventory-matrix-head {
    align-items: stretch;
    flex-direction: column;
    gap: 10px;
    padding: 11px 10px;
  }

  .inventory-matrix-head h3 {
    font-size: 17px;
  }

  .matrix-metric-switch {
    width: 100%;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    grid-auto-flow: row;
  }

  .matrix-metric-switch button {
    grid-column: span 2;
    overflow: hidden;
    padding-inline: 6px;
    text-overflow: ellipsis;
  }

  .matrix-metric-switch button:nth-last-child(-n + 2) {
    grid-column: span 3;
  }

  .inventory-matrix-context {
    flex-wrap: wrap;
    gap: 3px 14px;
    padding: 7px 10px;
    font-size: 12px;
  }

  .inventory-matrix-context strong {
    margin-right: auto;
  }

  .inventory-matrix-table {
    min-width: 760px;
  }

  .inventory-matrix-table th,
  .inventory-matrix-table td {
    height: 46px;
    padding-inline: 9px;
  }

  .inventory-matrix-table thead th:first-child,
  .inventory-matrix-table tbody th,
  .inventory-matrix-table tfoot th {
    width: 132px;
  }

  .weekly-change-panel {
    margin: 10px 10px 0;
  }

  .weekly-change-panel > header {
    padding: 10px;
  }

  .weekly-change-panel h3 {
    font-size: 17px;
  }

  .weekly-change-head,
  .weekly-change-row {
    grid-template-columns: 64px repeat(5, minmax(72px, 1fr));
    min-width: 520px;
    gap: 4px;
    padding-inline: 9px;
  }

  .week-day-table {
    margin: 10px;
  }

  .week-day-table-head {
    display: none;
  }

  .week-day-row {
    grid-template-columns: 64px minmax(0, 1fr) 62px;
    gap: 7px;
    min-height: 72px;
    padding: 9px 10px;
  }

  .week-day-status {
    grid-column: 2;
    grid-row: 1;
    align-self: start;
  }

  .week-day-totals,
  .week-day-empty {
    grid-column: 2;
    grid-row: 1;
    align-self: end;
    padding-top: 22px;
  }

  .week-day-totals {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 2px 8px;
  }

  .week-day-action {
    grid-column: 3;
    grid-row: 1;
    min-width: 62px;
    min-height: 44px;
    padding-inline: 5px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .inventory-report-share-button.loading :deep(svg) {
    animation: none;
  }
}
</style>
