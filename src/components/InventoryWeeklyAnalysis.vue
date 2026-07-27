<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import {
  inventoryRegularEggValueWan,
  inventorySilverWithRegularEggsWan,
  summarizeInventoryWeeklyChange,
  type InventoryWeekDaySlot,
  type InventoryWeekReport,
} from "../domain/inventory";
import { accountIds } from "../domain/types";
import type { AccountId, InventoryAccountDelta, InventoryBalance, InventorySnapshot } from "../domain/types";
import AppIcon from "./AppIcon.vue";
import WeeklyActivityPanel from "./WeeklyActivityPanel.vue";
import {
  createInventoryReportShareImage,
  type InventoryReportShareData,
} from "./inventoryReportShareImage";

type InventoryReportView = "summary" | "matrix";
type InventoryMatrixMetric = "silverWan" | "silverWithRegularEggsWan" | "regularEggs";

const props = withDefaults(defineProps<{
  report: InventoryWeekReport;
  currentDate: string;
  showActivity?: boolean;
  initialView?: InventoryReportView;
}>(), { showActivity: true, initialView: "matrix" });

const accountOrder: AccountId[] = [...accountIds];
const weekdayLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"] as const;
const matrixMetricOptions: Array<{ key: InventoryMatrixMetric; label: string; unit: string }> = [
  { key: "silverWan", label: "银子", unit: "万" },
  { key: "silverWithRegularEggsWan", label: "银+蛋", unit: "万" },
  { key: "regularEggs", label: "普通蛋", unit: "个" },
];

const reportView = ref<InventoryReportView>(props.initialView);
const matrixMetric = ref<InventoryMatrixMetric>("silverWan");
const sharingReport = ref(false);
const shareNotice = ref("");
let shareNoticeTimer: number | null = null;

const weeklyTotals = computed(() => props.report.weeklyChange
  ? summarizeInventoryWeeklyChange(props.report.weeklyChange.deltas)
  : null);
const selectedMatrixMetric = computed(() => matrixMetricOptions.find((item) => item.key === matrixMetric.value) || matrixMetricOptions[0]!);
const latestRecordedDay = computed(() => [...props.report.days].reverse().find((day) => day.snapshot) || null);
const shareButtonLabel = computed(() => reportView.value === "summary"
  ? "分享当前库存汇总"
  : `生成并分享${selectedMatrixMetric.value.label}库存周报`);

onBeforeUnmount(() => {
  if (shareNoticeTimer !== null) window.clearTimeout(shareNoticeTimer);
});

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
  return deltaMetricValue(props.report.weeklyChange?.deltas[accountId]);
}

function weeklyMatrixTotal(): number | null {
  return sumKnownValues(accountOrder.map((accountId) => weeklyMatrixValue(accountId)));
}

function averageMatrixValue(value: number | null): number | null {
  const intervalDays = props.report.weeklyChange?.intervalDays || 0;
  if (value === null || intervalDays <= 0) return null;
  return value / intervalDays;
}

function matrixValueLabel(value: number | null) {
  return value === null ? "—" : signedValue(value);
}

function matrixBasisLabel(day: InventoryWeekDaySlot) {
  if (!day.snapshot) return day.date > props.currentDate ? "尚未到日期" : "未记录";
  if (!day.comparison) return "暂无基线";
  return `较前次 · ${day.comparison.intervalDays}天`;
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
    weekStart: props.report.weekStart,
    weekEnd: props.report.weekEnd,
    recordedDays: props.report.recordedDays,
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
    const weeklyChange = props.report.weeklyChange;
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
    rows: props.report.days.map((day) => ({
      label: `${weekdayLabels[day.weekday - 1]} ${formatShortDate(day.date)}`,
      basis: matrixBasisLabel(day),
      values: [...accountOrder.map((accountId) => dayMatrixValue(day, accountId)), dayMatrixTotal(day)],
    })),
    weeklyTotal: { label: "本周合计", values: [...weeklyValues, weeklyTotalValue] },
    dailyAverage: {
      label: "区间日均",
      values: [...weeklyValues.map((value) => averageMatrixValue(value)), averageMatrixValue(weeklyTotalValue)],
    },
    intervalLabel: props.report.weeklyChange ? `${props.report.weeklyChange.intervalDays} 天区间` : "暂无完整区间",
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
  <section class="inventory-weekly-analysis" data-testid="inventory-week-report" aria-label="库存周报分析">
    <div class="inventory-analysis-controls">
      <div class="segmented weekly-view-switch" role="group" aria-label="周报视图">
        <button type="button" :class="{ active: reportView === 'summary' }" :aria-pressed="reportView === 'summary'" @click="reportView = 'summary'">汇总视图</button>
        <button type="button" :class="{ active: reportView === 'matrix' }" :aria-pressed="reportView === 'matrix'" @click="reportView = 'matrix'">按日对比</button>
      </div>
      <div class="inventory-analysis-actions">
        <p>{{ reportView === "summary" ? "查看本周合计与比较基线" : "按一个指标横向比较五个账号" }}</p>
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
          <span>
            {{ sharingReport ? "生成中…" : (reportView === "matrix" ? "生成并分享库存周报" : "分享库存汇总") }}
          </span>
        </button>
      </div>
    </div>

    <p v-if="shareNotice" class="inventory-share-notice" role="status">{{ shareNotice }}</p>

    <template v-if="reportView === 'summary'">
      <div v-if="report.weeklyChange" class="weekly-change-panel">
        <div class="weekly-change-table" role="table" aria-label="五账号本周库存净变化">
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
            <b role="cell" :class="deltaTone(weeklyTotals.directSilverWan)" :aria-label="`纯银子净变化合计 ${signedValue(weeklyTotals.directSilverWan)} 万，不含普通蛋折算`">{{ signedValue(weeklyTotals.directSilverWan) }}</b>
            <b role="cell" :class="deltaTone(weeklyTotals.totalSilverWan)" :aria-label="`银子加普通蛋折算合计 ${signedValue(weeklyTotals.totalSilverWan)} 万，普通蛋按每个 ${inventoryRegularEggValueWan} 万折算`">{{ signedValue(weeklyTotals.totalSilverWan) }}</b>
            <b role="cell" :class="deltaTone(weeklyTotals.innerShardCount)">{{ weeklyTotals.innerShardCount === null ? "—" : signedValue(weeklyTotals.innerShardCount) }}</b>
          </div>
        </div>
      </div>
    </template>

    <section v-else class="inventory-daily-matrix" aria-label="按日库存变化">
      <div class="inventory-matrix-toolbar">
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
      </div>

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
              :class="{ today: day.date === currentDate, missing: !day.snapshot }"
              :aria-current="day.date === currentDate ? 'date' : undefined"
            >
              <th scope="row">
                <strong>{{ weekdayLabels[day.weekday - 1] }} <span>{{ formatShortDate(day.date) }}</span></strong>
                <small>{{ matrixBasisLabel(day) }}</small>
              </th>
              <td v-for="accountId in accountOrder" :key="accountId" :class="deltaTone(dayMatrixValue(day, accountId))"><b>{{ matrixValueLabel(dayMatrixValue(day, accountId)) }}</b></td>
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

    <WeeklyActivityPanel v-if="props.showActivity" :report="report" :current-date="currentDate" />
  </section>
</template>

<style scoped>
.inventory-weekly-analysis {
  min-width: 0;
}

.inventory-analysis-controls {
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 9px 14px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-subtle);
}

.inventory-analysis-actions {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.inventory-analysis-actions p {
  color: var(--color-text-muted);
  font-size: 12px !important;
  line-height: 1.4;
}

.weekly-view-switch,
.matrix-metric-switch {
  display: inline-grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(max-content, 1fr);
  overflow: hidden;
  padding: 3px;
  border: 1px solid var(--color-border);
  border-radius: 7px;
  background: var(--color-surface);
}

.weekly-view-switch button,
.matrix-metric-switch button {
  min-height: 36px;
  padding: 0 13px;
  border: 0;
  border-radius: 5px;
  color: var(--color-text-muted);
  background: transparent;
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
}

.weekly-view-switch button:hover,
.matrix-metric-switch button:hover {
  color: var(--color-accent-strong);
  background: var(--color-accent-soft);
}

.weekly-view-switch button.active,
.matrix-metric-switch button.active {
  color: var(--color-text-on-strong);
  background: var(--color-accent);
}

.inventory-report-share-button {
  min-width: 78px;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--color-accent) 42%, var(--color-border));
  border-radius: 7px;
  color: var(--color-accent-strong);
  background: var(--color-surface);
  font-size: 13px;
  font-weight: 800;
}

.inventory-report-share-button:hover,
.inventory-report-share-button:focus-visible {
  background: var(--color-accent-soft);
}

.inventory-report-share-button:disabled {
  cursor: wait;
  opacity: .58;
}

.inventory-report-share-button :deep(svg) {
  width: 17px;
  height: 17px;
}

.inventory-report-share-button.loading :deep(svg) {
  animation: inventory-share-spin .75s linear infinite;
}

.inventory-share-notice {
  position: fixed;
  right: 20px;
  bottom: 24px;
  z-index: 70;
  max-width: calc(100vw - 40px);
  margin: 0;
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, var(--color-accent) 36%, var(--color-border));
  border-radius: 8px;
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-surface) 94%, var(--color-accent-soft));
  box-shadow: 0 8px 24px rgba(20, 37, 34, .16);
  font-size: 13px;
  font-weight: 750;
}

.weekly-change-panel,
.inventory-daily-matrix {
  overflow: hidden;
  margin: 12px;
  border: 1px solid var(--color-border);
  border-radius: 7px;
  background: var(--color-surface);
}

.inventory-matrix-toolbar {
  padding: 7px 10px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-subtle);
}

.weekly-change-head,
.weekly-change-row {
  display: grid;
  grid-template-columns: minmax(68px, 1fr) repeat(5, minmax(72px, 1fr));
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 6px 14px;
  border-bottom: 1px solid var(--color-border);
  font-size: 15px;
}

.weekly-change-head {
  min-height: 40px;
  color: var(--color-text-muted);
  background: #f6f8f7;
  font-size: 13px;
  font-weight: 800;
}

.weekly-change-row:last-child {
  border-bottom: 0;
}

.weekly-change-row > .account-pill {
  justify-self: start;
}

.weekly-change-row > b {
  font-size: 15px;
  white-space: nowrap;
}

.weekly-change-head > :not(:first-child),
.weekly-change-row > :not(:first-child) {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.weekly-change-total {
  min-height: 48px;
  border-top: 1px solid var(--color-accent);
  color: var(--color-text);
  background: var(--color-accent-soft);
}

.weekly-money-header small {
  font: inherit;
}

.positive { color: var(--color-success); }
.negative { color: var(--color-danger); }
.neutral { color: var(--color-text-muted); }

.inventory-matrix-scroll {
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-gutter: stable;
}

.inventory-matrix-scroll:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: -2px;
}

.inventory-matrix-table {
  width: 100%;
  min-width: 880px;
  border-spacing: 0;
  border-collapse: separate;
  table-layout: fixed;
  color: var(--color-text);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.inventory-matrix-table caption {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  margin: -1px;
  padding: 0;
  border: 0;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.inventory-matrix-table th,
.inventory-matrix-table td {
  height: 48px;
  padding: 7px 12px;
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  text-align: right;
  vertical-align: middle;
}

.inventory-matrix-table tr > :last-child {
  border-right: 0;
}

.inventory-matrix-table thead th {
  height: 42px;
  color: var(--color-text-muted);
  background: #f6f8f7;
  font-size: 12px;
  font-weight: 800;
}

.inventory-matrix-table thead th:first-child,
.inventory-matrix-table tbody th,
.inventory-matrix-table tfoot th {
  width: 156px;
  text-align: left;
}

.inventory-matrix-table thead th:not(:first-child) {
  text-align: center;
}

.inventory-matrix-table tbody th,
.inventory-matrix-table tbody td {
  background: var(--color-surface);
}

.inventory-matrix-table tbody th strong,
.inventory-matrix-table tfoot th strong {
  display: block;
  font-size: 14px;
}

.inventory-matrix-table tbody th strong span {
  margin-left: 4px;
  color: var(--color-text-muted);
  font-weight: 650;
}

.inventory-matrix-table tbody th small,
.inventory-matrix-table tfoot th small {
  display: block;
  margin-top: 2px;
  color: var(--color-text-muted);
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
}

.inventory-matrix-table tbody td b,
.inventory-matrix-table tfoot td b {
  font-size: 14px;
  font-weight: 800;
  white-space: nowrap;
}

.inventory-matrix-table tbody tr.today th,
.inventory-matrix-table tbody tr.today td {
  background: var(--color-accent-soft);
}

.inventory-matrix-table tbody tr.today th {
  box-shadow: inset 3px 0 var(--color-accent);
}

.inventory-matrix-table tbody tr.missing td b {
  color: color-mix(in srgb, var(--color-text-muted) 72%, transparent);
}

.inventory-matrix-table .matrix-total-column {
  background: color-mix(in srgb, var(--color-accent) 4%, #ffffff);
  font-weight: 850;
}

.inventory-matrix-table tfoot th,
.inventory-matrix-table tfoot td {
  background: color-mix(in srgb, var(--color-accent) 8%, #ffffff);
}

.inventory-matrix-table tfoot .matrix-week-total > * {
  border-top: 2px solid var(--color-accent);
}

.inventory-matrix-table tfoot .matrix-week-average > * {
  background: color-mix(in srgb, var(--color-accent) 4%, #ffffff);
}

@keyframes inventory-share-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 720px) {
  .inventory-analysis-controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 44px;
    gap: 6px;
    padding: 6px 10px;
  }

  .inventory-analysis-actions {
    width: 44px;
    gap: 0;
  }

  .inventory-analysis-actions p {
    display: none;
  }

  .weekly-view-switch {
    flex: 1 1 auto;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-flow: row;
  }

  .weekly-view-switch button,
  .matrix-metric-switch button {
    min-height: 44px;
    padding-inline: 8px;
  }

  .inventory-report-share-button {
    width: 44px;
    min-width: 44px;
    min-height: 44px;
    padding: 0;
  }

  .inventory-report-share-button span {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .inventory-share-notice {
    right: 16px;
    bottom: calc(76px + env(safe-area-inset-bottom));
    max-width: calc(100vw - 32px);
  }

  .weekly-change-panel,
  .inventory-daily-matrix {
    margin: 10px;
  }

  .weekly-change-table {
    overflow-x: auto;
    overscroll-behavior-inline: contain;
  }

  .weekly-change-head,
  .weekly-change-row {
    grid-template-columns: 64px repeat(5, minmax(72px, 1fr));
    min-width: 520px;
    gap: 4px;
    padding-inline: 9px;
  }

  .matrix-metric-switch {
    width: 100%;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-flow: row;
  }

  .matrix-metric-switch button {
    overflow: hidden;
    padding-inline: 6px;
    text-overflow: ellipsis;
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
}

@media (prefers-reduced-motion: reduce) {
  .inventory-report-share-button.loading :deep(svg) {
    animation: none;
  }
}
</style>
