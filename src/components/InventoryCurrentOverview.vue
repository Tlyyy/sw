<script setup lang="ts">
import { computed } from "vue";
import { accountIds } from "../domain/types";
import type { AccountId, InventoryAccountDelta, InventorySnapshot } from "../domain/types";

const props = defineProps<{
  snapshot: InventorySnapshot;
  deltas: Record<AccountId, InventoryAccountDelta> | null;
}>();

const accountOrder: AccountId[] = [...accountIds];
const rows = computed(() => accountOrder.map((accountId) => ({
  accountId,
  balance: props.snapshot.accounts[accountId],
  delta: props.deltas?.[accountId] || null,
})));
const isComplete = computed(() => accountOrder.every((accountId) => props.snapshot.accounts[accountId].innerShardCount !== null));
const intervalDays = computed(() => props.deltas?.FC.intervalDays || 0);

function formatHistoryTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

function signedValue(value: number, unit = "") {
  if (value === 0) return `0${unit}`;
  return `${value > 0 ? "+" : ""}${Number.isInteger(value) ? value : Number(value.toFixed(2))}${unit}`;
}

function deltaTone(value: number | null) {
  if (value === null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}
</script>

<template>
  <section class="inventory-current-panel" aria-labelledby="inventory-current-title">
    <header class="inventory-current-head">
      <div>
        <p class="inventory-current-eyebrow">当前库存</p>
        <h2 id="inventory-current-title">截至 {{ snapshot.effectiveDate }}</h2>
        <p>实际录入于 {{ formatHistoryTime(snapshot.recordedAt) }}；这里只展示最新状态与相对前次变化。</p>
      </div>
      <span class="inventory-current-badge" :class="{ incomplete: !isComplete }">
        {{ isComplete ? "五号已齐" : "待补内丹碎片" }}
      </span>
    </header>

    <div class="inventory-current-list" role="list" aria-label="五账号当前库存及相对前次变化">
      <article
        v-for="row in rows"
        :key="row.accountId"
        class="inventory-current-account"
        role="listitem"
        :data-testid="`inventory-current-account-${row.accountId}`"
      >
        <header class="inventory-current-account-head">
          <strong :class="`account-pill account-${row.accountId.toLowerCase()}`">{{ row.accountId }}</strong>
          <small>{{ row.delta ? `较前次 · ${row.delta.intervalDays}天` : "首份基线" }}</small>
        </header>

        <div class="inventory-current-values">
          <span><small>专用蛋</small><strong>{{ row.balance.dedicatedEggs }}</strong></span>
          <span><small>普通蛋</small><strong>{{ row.balance.regularEggs }}</strong></span>
          <span><small>银子 / 万</small><strong>{{ row.balance.silverWan.toLocaleString() }}</strong></span>
          <span><small>内丹碎片</small><strong>{{ row.balance.innerShardCount ?? "待补" }}</strong></span>
        </div>

        <div v-if="row.delta" class="inventory-current-delta" aria-label="相对前次净变化">
          <span><small>专</small><b :class="deltaTone(row.delta.dedicatedEggs)">{{ signedValue(row.delta.dedicatedEggs) }}</b></span>
          <span><small>普</small><b :class="deltaTone(row.delta.regularEggs)">{{ signedValue(row.delta.regularEggs) }}</b></span>
          <span><small>银</small><b :class="deltaTone(row.delta.silverWan)">{{ signedValue(row.delta.silverWan, "万") }}</b></span>
          <span><small>碎</small><b :class="deltaTone(row.delta.innerShardCount)">{{ row.delta.innerShardCount === null ? "—" : signedValue(row.delta.innerShardCount) }}</b></span>
        </div>
        <p v-else class="inventory-current-baseline">等待下一份快照计算变化</p>
      </article>
    </div>

    <p class="inventory-current-note">
      相对前次变化表示{{ intervalDays ? `相隔 ${intervalDays} 天的` : "两次" }}库存差额；本周统计请切换到“周报分析”。
    </p>
  </section>
</template>

<style scoped>
.inventory-current-panel {
  overflow: hidden;
  border: 1px solid var(--radar-line);
  border-radius: 9px;
  background: var(--radar-surface);
}

.inventory-current-head {
  min-height: 84px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--radar-line);
}

.inventory-current-eyebrow {
  margin-bottom: 2px;
  color: var(--radar-cyan-strong) !important;
  font-size: 12px !important;
  font-weight: 850;
  letter-spacing: .08em;
}

.inventory-current-head h2 {
  color: var(--radar-ink);
  font-size: 21px;
  line-height: 1.25;
}

.inventory-current-head p:last-child {
  margin-top: 3px;
  color: var(--radar-muted);
  font-size: 13px !important;
  line-height: 1.45;
}

.inventory-current-badge {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border: 1px solid color-mix(in srgb, var(--radar-success) 36%, var(--radar-line));
  border-radius: 999px;
  color: var(--radar-success);
  background: color-mix(in srgb, var(--radar-success) 8%, #ffffff);
  font-size: 13px;
  font-weight: 850;
  white-space: nowrap;
}

.inventory-current-badge.incomplete {
  border-color: color-mix(in srgb, var(--radar-amber) 42%, var(--radar-line));
  color: var(--radar-amber-strong);
  background: var(--radar-amber-soft);
}

.inventory-current-list {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.inventory-current-account {
  min-width: 0;
  padding: 13px 14px 0;
  border-right: 1px solid var(--radar-line);
  background: #ffffff;
}

.inventory-current-account:last-child {
  border-right: 0;
}

.inventory-current-account-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.inventory-current-account-head small,
.inventory-current-values small,
.inventory-current-delta small {
  color: var(--radar-muted);
  font-size: 11px !important;
  font-weight: 700;
  line-height: 1.25;
}

.inventory-current-values {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px 12px;
}

.inventory-current-values span,
.inventory-current-delta span {
  min-width: 0;
  display: grid;
  gap: 1px;
}

.inventory-current-values strong {
  color: var(--radar-ink);
  font-size: 18px;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.inventory-current-delta,
.inventory-current-baseline {
  min-height: 46px;
  margin: 12px -14px 0;
  padding: 8px 14px;
  border-top: 1px solid var(--radar-line);
  background: var(--radar-surface-2);
}

.inventory-current-delta {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.inventory-current-delta b {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.inventory-current-baseline {
  color: var(--radar-muted);
  font-size: 12px !important;
}

.positive { color: var(--radar-success); }
.negative { color: var(--radar-danger); }
.neutral { color: var(--radar-muted); }

.inventory-current-note {
  margin: 0;
  padding: 9px 16px;
  border-top: 1px solid var(--radar-line);
  color: var(--radar-muted);
  background: var(--radar-surface-2);
  font-size: 12px !important;
  line-height: 1.45;
}

@media (max-width: 1100px) {
  .inventory-current-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .inventory-current-account {
    border-bottom: 1px solid var(--radar-line);
  }

  .inventory-current-account:nth-child(2n) {
    border-right: 0;
  }

  .inventory-current-account:last-child {
    grid-column: 1 / -1;
    border-bottom: 0;
  }
}

@media (max-width: 720px) {
  .inventory-current-head {
    align-items: flex-start;
    gap: 10px;
    padding: 12px;
  }

  .inventory-current-head h2 {
    font-size: 19px;
  }

  .inventory-current-head p:last-child {
    font-size: 12px !important;
  }

  .inventory-current-badge {
    font-size: 12px;
  }

  .inventory-current-list {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .inventory-current-account,
  .inventory-current-account:last-child {
    grid-column: auto;
    display: grid;
    grid-template-columns: 76px minmax(0, 1fr);
    gap: 6px 10px;
    padding: 10px 12px;
    border-right: 0;
    border-bottom: 1px solid var(--radar-line);
  }

  .inventory-current-account:last-child {
    border-bottom: 0;
  }

  .inventory-current-account-head {
    grid-column: 1;
    grid-row: 1 / span 2;
    align-items: flex-start;
    justify-content: flex-start;
    flex-direction: column;
    gap: 6px;
    margin: 0;
  }

  .inventory-current-account-head small {
    white-space: nowrap;
  }

  .inventory-current-values {
    grid-column: 2;
    grid-row: 1;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }

  .inventory-current-values strong {
    font-size: 16px;
  }

  .inventory-current-delta,
  .inventory-current-baseline {
    grid-column: 2;
    grid-row: 2;
    min-height: 0;
    margin: 0;
    padding: 6px 0 0;
    border-top: 1px solid var(--radar-line);
    background: transparent;
  }

  .inventory-current-note {
    padding-inline: 12px;
  }
}

@media (max-width: 430px) {
  .inventory-current-account,
  .inventory-current-account:last-child {
    grid-template-columns: 62px minmax(0, 1fr);
    gap-inline: 8px;
  }

  .inventory-current-values small,
  .inventory-current-delta small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 10px !important;
  }
}
</style>
