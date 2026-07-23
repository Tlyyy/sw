<script setup lang="ts">
import { ref, watch } from "vue";
import {
  canRecordInventoryDate,
  type InventorySnapshotComparison,
  type InventoryWeekDaySlot,
  type InventoryWeekReport,
} from "../domain/inventory";
import { accountIds } from "../domain/types";
import type { AccountId, InventoryBalance, InventorySnapshot } from "../domain/types";
import AppIcon from "./AppIcon.vue";

const props = defineProps<{
  report: InventoryWeekReport;
  currentDate: string;
}>();

const emit = defineEmits<{
  record: [date: string];
  remove: [date: string];
}>();

const accountOrder: AccountId[] = [...accountIds];
const weekdayLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"] as const;
const expandedDate = ref<string | null>(null);

watch(() => props.report.weekStart, () => {
  expandedDate.value = null;
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

function signedValue(value: number) {
  const normalized = Number(value.toFixed(2));
  if (normalized === 0) return "0";
  return `${normalized > 0 ? "+" : ""}${numberLabel(normalized)}`;
}

function deltaTone(value: number | null) {
  if (value === null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

function comparisonLabel(comparison: InventorySnapshotComparison | null) {
  if (!comparison) return "首份记录，暂无变化基线";
  return `较 ${comparison.fromEffectiveDate} · 相隔 ${comparison.intervalDays} 天`;
}

function isRecordable(date: string) {
  return canRecordInventoryDate(date, props.currentDate);
}

function statusLabel(day: InventoryWeekDaySlot) {
  if (day.snapshot) return "已记录";
  return isRecordable(day.date) ? "未记录" : "尚未到";
}

function toggleDay(day: InventoryWeekDaySlot) {
  if (!day.snapshot) return;
  expandedDate.value = expandedDate.value === day.date ? null : day.date;
}
</script>

<template>
  <div class="inventory-record-table" role="table" aria-label="周一到周日库存记录">
    <div class="inventory-record-head" role="row">
      <span role="columnheader">日期</span>
      <span role="columnheader">状态</span>
      <span role="columnheader">五号库存合计</span>
      <span role="columnheader">操作</span>
    </div>

    <div
      v-for="day in report.days"
      :key="day.date"
      class="inventory-record-entry"
      :class="{
        expanded: expandedDate === day.date,
        today: day.date === currentDate,
        upcoming: !day.snapshot && !isRecordable(day.date),
      }"
      role="rowgroup"
      :data-date="day.date"
    >
      <div class="inventory-record-row" role="row" :aria-current="day.date === currentDate ? 'date' : undefined">
        <div class="inventory-record-identity" role="cell">
          <strong>{{ weekdayLabels[day.weekday - 1] }}</strong>
          <span>{{ formatShortDate(day.date) }}</span>
        </div>

        <span
          class="inventory-record-status"
          :class="{ recorded: day.snapshot, upcoming: !day.snapshot && !isRecordable(day.date) }"
          role="cell"
        >{{ statusLabel(day) }}</span>

        <div v-if="day.snapshot" class="inventory-record-totals" role="cell" :aria-label="`${day.date} 五号库存合计`">
          <span>专 <b>{{ numberLabel(snapshotTotals(day.snapshot).dedicatedEggs) }}</b></span>
          <span>普 <b>{{ numberLabel(snapshotTotals(day.snapshot).regularEggs) }}</b></span>
          <span>银 <b>{{ numberLabel(snapshotTotals(day.snapshot).silverWan) }}万</b></span>
          <span>碎 <b>{{ snapshotTotals(day.snapshot).innerShardCount ?? "待补" }}</b></span>
        </div>
        <p v-else class="inventory-record-empty" role="cell">{{ isRecordable(day.date) ? "等待补录" : "到日期后可录入" }}</p>

        <div class="inventory-record-action-cell" role="cell">
          <button
            v-if="day.snapshot"
            :id="`inventory-record-toggle-${day.date}`"
            class="inventory-record-action"
            type="button"
            :aria-expanded="expandedDate === day.date"
            :aria-label="`${expandedDate === day.date ? '收起' : '查看'}${day.date}库存日报`"
            @click="toggleDay(day)"
          >
            <span>{{ expandedDate === day.date ? "收起" : "查看" }}</span><AppIcon name="chevron-right" />
          </button>
          <button
            v-else-if="isRecordable(day.date)"
            class="inventory-record-action record"
            type="button"
            :aria-label="`补录${day.date}库存`"
            @click="emit('record', day.date)"
          >补录</button>
          <span v-else class="inventory-record-action unavailable" :aria-label="`${day.date}尚未到日期`">尚未到</span>
        </div>
      </div>

      <section
        v-if="day.snapshot && expandedDate === day.date"
        class="inventory-record-detail"
        :aria-labelledby="`inventory-record-toggle-${day.date}`"
      >
        <header>
          <p><strong>{{ day.date }} 日报</strong><span>{{ comparisonLabel(day.comparison) }}</span></p>
          <div>
            <button type="button" class="text-button" @click="emit('record', day.date)">修改这一天</button>
            <button type="button" class="text-button danger-text" @click="emit('remove', day.date)">删除记录</button>
          </div>
        </header>

        <div class="inventory-record-account-table" role="table" :aria-label="`${day.date} 五账号库存明细`">
          <div v-for="accountId in accountOrder" :key="accountId" class="inventory-record-account-row" role="row">
            <strong role="cell" :class="`account-pill account-${accountId.toLowerCase()}`">{{ accountId }}</strong>
            <span role="cell"><small>专用蛋</small><b>{{ day.snapshot.accounts[accountId].dedicatedEggs }}</b><em v-if="day.comparison" :class="deltaTone(day.comparison.deltas[accountId].dedicatedEggs)">{{ signedValue(day.comparison.deltas[accountId].dedicatedEggs) }}</em></span>
            <span role="cell"><small>普通蛋</small><b>{{ day.snapshot.accounts[accountId].regularEggs }}</b><em v-if="day.comparison" :class="deltaTone(day.comparison.deltas[accountId].regularEggs)">{{ signedValue(day.comparison.deltas[accountId].regularEggs) }}</em></span>
            <span role="cell"><small>银 / 万</small><b>{{ numberLabel(day.snapshot.accounts[accountId].silverWan) }}</b><em v-if="day.comparison" :class="deltaTone(day.comparison.deltas[accountId].silverWan)">{{ signedValue(day.comparison.deltas[accountId].silverWan) }}</em></span>
            <span role="cell"><small>内丹碎片</small><b>{{ day.snapshot.accounts[accountId].innerShardCount ?? "待补" }}</b><em v-if="day.comparison" :class="deltaTone(day.comparison.deltas[accountId].innerShardCount)">{{ day.comparison.deltas[accountId].innerShardCount === null ? "—" : signedValue(day.comparison.deltas[accountId].innerShardCount) }}</em></span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.inventory-record-table {
  overflow: hidden;
  margin: 12px;
  border: 1px solid var(--radar-line);
  border-radius: 7px;
  background: var(--radar-surface);
}

.inventory-record-head,
.inventory-record-row {
  display: grid;
  grid-template-columns: 112px 88px minmax(300px, 1fr) 84px;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 7px 14px;
  border-bottom: 1px solid var(--radar-line);
}

.inventory-record-head {
  min-height: 40px;
  color: var(--radar-muted);
  background: #f6f8f7;
  font-size: 13px;
  font-weight: 800;
}

.inventory-record-entry:last-child > .inventory-record-row {
  border-bottom: 0;
}

.inventory-record-entry.expanded > .inventory-record-row,
.inventory-record-entry.today > .inventory-record-row {
  background: color-mix(in srgb, var(--radar-cyan) 7%, #ffffff);
}

.inventory-record-entry.today > .inventory-record-row {
  box-shadow: inset 3px 0 var(--radar-cyan);
}

.inventory-record-entry.upcoming > .inventory-record-row {
  color: var(--radar-muted);
  background: #fafbfb;
}

.inventory-record-identity {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.inventory-record-identity strong {
  color: var(--radar-ink);
  font-size: 15px;
}

.inventory-record-entry.today .inventory-record-identity strong {
  color: var(--radar-cyan-strong);
}

.inventory-record-identity span {
  color: var(--radar-muted);
  font-size: 13px;
}

.inventory-record-status {
  justify-self: start;
  min-height: 26px;
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border: 1px solid var(--radar-line-strong);
  border-radius: 999px;
  color: var(--radar-muted);
  background: #ffffff;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.inventory-record-status.recorded {
  border-color: color-mix(in srgb, var(--radar-success) 45%, var(--radar-line));
  color: var(--radar-success);
  background: color-mix(in srgb, var(--radar-success) 9%, #ffffff);
}

.inventory-record-status.upcoming {
  border-style: dashed;
  color: var(--radar-faint);
  background: #f7f8f8;
}

.inventory-record-totals {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(72px, 1fr));
  gap: 10px;
  color: var(--radar-muted);
  font-size: 14px;
}

.inventory-record-totals span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inventory-record-totals b {
  color: var(--radar-ink);
}

.inventory-record-empty {
  color: var(--radar-muted);
  font-size: 13px !important;
}

.inventory-record-action-cell {
  display: flex;
  justify-content: flex-end;
}

.inventory-record-action {
  min-width: 72px;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 0 8px;
  border: 1px solid var(--radar-line-strong);
  border-radius: 6px;
  color: var(--radar-cyan-strong);
  background: var(--radar-cyan-soft);
  font-size: 14px;
  font-weight: 800;
}

.inventory-record-action :deep(svg) {
  width: 16px;
  height: 16px;
  transition: transform .16s ease;
}

.inventory-record-entry.expanded .inventory-record-action :deep(svg) {
  transform: rotate(90deg);
}

.inventory-record-action.record {
  border-color: color-mix(in srgb, var(--radar-amber) 45%, var(--radar-line));
  color: var(--radar-amber-strong);
  background: var(--radar-amber-soft);
}

.inventory-record-action.unavailable {
  border-style: dashed;
  color: var(--radar-muted);
  background: #f7f8f8;
  cursor: default;
}

.inventory-record-detail {
  padding: 13px 14px 14px;
  border-bottom: 1px solid var(--radar-line-strong);
  background: var(--radar-surface-2);
}

.inventory-record-detail > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 10px;
}

.inventory-record-detail > header p {
  display: grid;
  gap: 2px;
}

.inventory-record-detail > header p span {
  color: var(--radar-muted);
  font-size: 13px;
}

.inventory-record-detail > header > div {
  display: flex;
  gap: 8px;
}

.inventory-record-account-table {
  border-top: 1px solid var(--radar-line);
}

.inventory-record-account-row {
  display: grid;
  grid-template-columns: 70px repeat(4, minmax(82px, 1fr));
  align-items: center;
  gap: 8px;
  min-height: 56px;
  padding: 7px 10px;
  border-bottom: 1px solid var(--radar-line);
}

.inventory-record-account-row > span {
  min-width: 0;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1px 6px;
}

.inventory-record-account-row small {
  grid-column: 1 / -1;
  color: var(--radar-muted);
  font-size: 12px;
}

.inventory-record-account-row b,
.inventory-record-account-row em {
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.inventory-record-account-row em {
  justify-self: end;
  font-style: normal;
  font-weight: 750;
}

.positive { color: var(--radar-success); }
.negative { color: var(--radar-danger); }
.neutral { color: var(--radar-muted); }

@media (max-width: 720px) {
  .inventory-record-table {
    margin: 10px;
  }

  .inventory-record-head {
    display: none;
  }

  .inventory-record-row {
    grid-template-columns: 64px minmax(0, 1fr) 72px;
    gap: 7px;
    min-height: 76px;
    padding: 9px 10px;
  }

  .inventory-record-identity {
    display: grid;
    gap: 1px;
  }

  .inventory-record-status {
    grid-column: 2;
    grid-row: 1;
    align-self: start;
  }

  .inventory-record-totals,
  .inventory-record-empty {
    grid-column: 2;
    grid-row: 1;
    align-self: end;
    padding-top: 25px;
  }

  .inventory-record-totals {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 2px 8px;
    font-size: 13px;
  }

  .inventory-record-action-cell {
    grid-column: 3;
    grid-row: 1;
  }

  .inventory-record-action {
    min-width: 68px;
    min-height: 44px;
    padding-inline: 5px;
  }

  .inventory-record-detail {
    padding: 11px 10px 13px;
  }

  .inventory-record-detail > header {
    align-items: stretch;
    flex-direction: column;
  }

  .inventory-record-detail > header > div {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .inventory-record-detail .text-button {
    min-height: 44px;
  }

  .inventory-record-account-row {
    grid-template-columns: 58px repeat(4, minmax(0, 1fr));
    gap: 5px;
    padding-inline: 5px;
  }

  .inventory-record-account-row > span {
    grid-template-columns: minmax(0, 1fr);
    text-align: center;
  }

  .inventory-record-account-row small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
  }

  .inventory-record-account-row em {
    justify-self: center;
    font-size: 12px;
  }
}
</style>
