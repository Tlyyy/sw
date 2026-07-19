<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  buildInventoryWeekReport,
  naturalWeekRange,
  type InventorySnapshotComparison,
  type InventoryWeekDaySlot,
} from "../domain/inventory";
import type { AccountId, InventoryBalance, InventorySnapshot } from "../domain/types";
import AppIcon from "./AppIcon.vue";

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
const selectedAnchor = ref(props.currentDate);
const expandedDate = ref<string | null>(null);
const report = computed(() => buildInventoryWeekReport(props.snapshots, selectedAnchor.value));
const currentWeek = computed(() => naturalWeekRange(props.currentDate));
const isCurrentWeek = computed(() => report.value.weekStart === currentWeek.value.weekStart);
const canViewNextWeek = computed(() => report.value.weekStart < currentWeek.value.weekStart);

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
  if (value === 0) return `0${unit}`;
  return `${value > 0 ? "+" : ""}${numberLabel(value)}${unit}`;
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

function toggleDay(day: InventoryWeekDaySlot) {
  if (!day.snapshot) return;
  expandedDate.value = expandedDate.value === day.date ? null : day.date;
}
</script>

<template>
  <section class="settings-section inventory-week-report" aria-labelledby="inventory-week-report-title" data-testid="inventory-week-report">
    <div class="section-head weekly-report-head">
      <div>
        <h2 id="inventory-week-report-title">每周库存报表</h2>
        <p>每周固定按周一到周日查看；有记录的日期显示日报，没有记录的日期保持空白。</p>
      </div>
      <span>{{ report.recordedDays }} / 7 天有记录</span>
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

    <div class="weekly-change-panel">
      <header>
        <div>
          <h3>本周净变化</h3>
          <p v-if="report.weeklyChange">
            {{ weeklyBasisLabel() }} · {{ report.weeklyChange.fromEffectiveDate }} → {{ report.weeklyChange.toEffectiveDate }}（{{ report.weeklyChange.intervalDays }} 天）
          </p>
          <p v-else-if="report.recordedDays === 0">本周尚无实际库存记录，周变化暂时留空。</p>
          <p v-else>本周只有一份记录且没有更早基线，暂时无法计算变化。</p>
        </div>
      </header>
      <div v-if="report.weeklyChange" class="weekly-change-table" role="table" aria-label="五账号本周库存净变化">
        <div class="weekly-change-head" role="row">
          <span role="columnheader">账号</span><span role="columnheader">专</span><span role="columnheader">普</span><span role="columnheader">银 / 万</span><span role="columnheader">碎</span>
        </div>
        <div v-for="accountId in accountOrder" :key="accountId" class="weekly-change-row" role="row">
          <strong role="cell" :class="`account-pill account-${accountId.toLowerCase()}`">{{ accountId }}</strong>
          <b role="cell" :class="deltaTone(report.weeklyChange.deltas[accountId].dedicatedEggs)">{{ signedValue(report.weeklyChange.deltas[accountId].dedicatedEggs) }}</b>
          <b role="cell" :class="deltaTone(report.weeklyChange.deltas[accountId].regularEggs)">{{ signedValue(report.weeklyChange.deltas[accountId].regularEggs) }}</b>
          <b role="cell" :class="deltaTone(report.weeklyChange.deltas[accountId].silverWan)">{{ signedValue(report.weeklyChange.deltas[accountId].silverWan) }}</b>
          <b role="cell" :class="deltaTone(report.weeklyChange.deltas[accountId].innerShardCount)">{{ report.weeklyChange.deltas[accountId].innerShardCount === null ? "—" : signedValue(report.weeklyChange.deltas[accountId].innerShardCount) }}</b>
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
        :class="{ recorded: day.snapshot, expanded: expandedDate === day.date }"
        :data-date="day.date"
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
  </section>
</template>

<style scoped>
.inventory-week-report { margin-top: 18px; }
.week-report-toolbar { min-height: 66px; display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px auto; align-items: center; gap: 10px; padding: 11px 0; border-bottom: 1px solid var(--radar-line); }
.week-shift-button { width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid var(--radar-line); border-radius: 4px; color: var(--radar-cyan); background: var(--radar-surface); }
.week-shift-button:disabled { color: var(--radar-muted); opacity: .38; cursor: not-allowed; }
.week-shift-button.previous :deep(svg) { transform: rotate(180deg); }
.week-range-title { min-width: 0; display: grid; gap: 2px; }
.week-range-title strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 16px; }
.week-range-title small { color: var(--radar-muted); font-size: 13px; }
.week-current-button { min-height: 40px; padding: 0 12px; border: 1px solid var(--radar-line); border-radius: 4px; color: var(--radar-cyan); background: var(--radar-cyan-soft); font-weight: 750; }
.weekly-change-panel { margin-top: 14px; border: 1px solid var(--radar-line); background: var(--radar-surface); }
.weekly-change-panel > header { padding: 13px 14px; border-bottom: 1px solid var(--radar-line); }
.weekly-change-panel h3 { font-size: 16px; }
.weekly-change-panel p { margin-top: 4px; color: var(--radar-muted); font-size: 13px; line-height: 1.5; }
.weekly-change-head,
.weekly-change-row { display: grid; grid-template-columns: minmax(68px, 1fr) repeat(4, minmax(72px, 1fr)); align-items: center; gap: 8px; min-height: 42px; padding: 6px 14px; border-bottom: 1px solid var(--radar-line); font-size: 13px; }
.weekly-change-head { min-height: 34px; color: var(--radar-muted); background: #141d1f; font-weight: 700; }
.weekly-change-row:last-child { border-bottom: 0; }
.weekly-change-row > .account-pill { justify-self: start; }
.weekly-change-head > :not(:first-child),
.weekly-change-row > :not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; }
.positive { color: var(--radar-success); }
.negative { color: var(--radar-danger); }
.neutral { color: var(--radar-muted); }
.week-day-table { margin-top: 14px; border: 1px solid var(--radar-line); background: var(--radar-surface); }
.week-day-table-head,
.week-day-row { display: grid; grid-template-columns: 105px 82px minmax(300px, 1fr) 82px; align-items: center; gap: 12px; min-height: 54px; padding: 7px 14px; border-bottom: 1px solid var(--radar-line); }
.week-day-table-head { min-height: 36px; color: var(--radar-muted); background: #141d1f; font-size: 13px; font-weight: 700; }
.week-day-entry:last-child > .week-day-row { border-bottom: 0; }
.week-day-entry.expanded > .week-day-row { background: var(--radar-cyan-soft); }
.week-day-identity { display: flex; align-items: baseline; gap: 8px; }
.week-day-identity strong { font-size: 14px; }
.week-day-identity span { color: var(--radar-muted); font-size: 13px; }
.week-day-status { justify-self: start; padding: 2px 7px; border: 1px solid var(--radar-line); border-radius: 999px; color: var(--radar-muted); font-size: 12px; font-weight: 750; }
.week-day-status.recorded { border-color: color-mix(in srgb, var(--radar-success) 45%, var(--radar-line)); color: var(--radar-success); background: color-mix(in srgb, var(--radar-success) 9%, transparent); }
.week-day-totals { min-width: 0; display: grid; grid-template-columns: repeat(4, minmax(72px, 1fr)); gap: 8px; color: var(--radar-muted); font-size: 13px; }
.week-day-totals span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.week-day-totals b { color: var(--radar-ink); }
.week-day-empty { color: var(--radar-muted); }
.week-day-action { min-width: 70px; min-height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: 3px; border: 1px solid var(--radar-line); border-radius: 4px; color: var(--radar-cyan); background: #192426; font-weight: 750; }
.week-day-action span { white-space: nowrap; }
.week-day-action :deep(svg) { width: 16px; height: 16px; transition: transform .16s ease; }
.week-day-entry.expanded .week-day-action :deep(svg) { transform: rotate(90deg); }
.week-day-action.record { color: var(--radar-amber-strong); }
.week-day-detail { padding: 14px; border-bottom: 1px solid var(--radar-line-strong); background: #111a1c; }
.week-day-detail > header { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 10px; }
.week-day-detail > header p { display: grid; gap: 2px; }
.week-day-detail > header p span { color: var(--radar-muted); font-size: 13px; }
.week-day-detail > header > div { display: flex; gap: 8px; }
.week-day-account-table { border-top: 1px solid var(--radar-line); }
.week-day-account-row { display: grid; grid-template-columns: 70px repeat(4, minmax(82px, 1fr)); align-items: center; gap: 8px; min-height: 62px; padding: 7px 10px; border-bottom: 1px solid var(--radar-line); }
.week-day-account-row > span { min-width: 0; display: grid; grid-template-columns: 1fr auto; gap: 1px 6px; }
.week-day-account-row small { grid-column: 1 / -1; color: var(--radar-muted); font-size: 12px; }
.week-day-account-row b { font-size: 14px; font-variant-numeric: tabular-nums; }
.week-day-account-row em { justify-self: end; font-size: 12px; font-style: normal; font-weight: 750; font-variant-numeric: tabular-nums; }

@media (max-width: 720px) {
  .weekly-report-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; }
  .weekly-report-head > span { align-self: start; white-space: nowrap; font-size: 12px; text-align: right; }
  .week-report-toolbar { grid-template-columns: 44px minmax(0, 1fr) 44px; gap: 7px; }
  .week-range-title { text-align: center; }
  .week-range-title strong { font-size: 14px; }
  .week-current-button { grid-column: 1 / -1; width: 100%; min-height: 44px; }
  .weekly-change-head,
  .weekly-change-row { grid-template-columns: 58px repeat(4, minmax(0, 1fr)); gap: 5px; padding-inline: 9px; }
  .weekly-change-row b { font-size: 12px; }
  .week-day-table-head { display: none; }
  .week-day-row { grid-template-columns: 64px minmax(0, 1fr) 62px; gap: 7px; min-height: 72px; padding: 9px 10px; }
  .week-day-identity { display: grid; gap: 1px; }
  .week-day-status { grid-column: 2; grid-row: 1; align-self: start; }
  .week-day-totals,
  .week-day-empty { grid-column: 2; grid-row: 1; align-self: end; padding-top: 22px; }
  .week-day-totals { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px 8px; }
  .week-day-totals span { font-size: 12px; }
  .week-day-action { grid-column: 3; grid-row: 1; min-width: 62px; min-height: 44px; gap: 1px; padding: 0 5px; font-size: 13px; }
  .week-day-detail { padding: 11px 10px 13px; }
  .week-day-detail > header { align-items: stretch; flex-direction: column; }
  .week-day-detail > header > div { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .week-day-detail .text-button { min-height: 44px; }
  .week-day-account-row { grid-template-columns: 58px repeat(4, minmax(0, 1fr)); gap: 5px; padding-inline: 5px; }
  .week-day-account-row > span { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1px; text-align: center; }
  .week-day-account-row small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
  .week-day-account-row em { justify-self: center; font-size: 11px; }
}
</style>
