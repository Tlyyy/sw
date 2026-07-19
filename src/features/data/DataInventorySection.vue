<script setup lang="ts">
import { computed, ref } from "vue";
import InventorySnapshotDialog from "../../components/InventorySnapshotDialog.vue";
import InventoryWeeklyReport from "../../components/InventoryWeeklyReport.vue";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";
import type { AccountId, InventoryBalance, InventorySnapshotInput } from "../../domain/types";

const inventory = useInventoryStore();
const settings = useSettingsStore();
const inventoryDialogOpen = ref(false);
const inventoryDialogDate = ref("");
const inventoryNotice = ref("");
const inventoryAccountOrder: AccountId[] = ["FC", "LG1", "LG2", "PT", "MYT"];

inventory.hydrate();

const latestInventoryRows = computed(() => inventoryAccountOrder.map((accountId) => {
  const balance = inventory.latestSnapshot?.accounts[accountId] || emptyBalance();
  return {
    accountId,
    balance,
    delta: inventory.latestDeltas?.[accountId] || null,
  };
}));
const latestInventoryIntervalDays = computed(() => inventory.latestDeltas?.FC.intervalDays || 0);
const latestInventoryComplete = computed(() => inventory.latestSnapshot
  ? inventoryAccountOrder.every((accountId) => inventory.latestSnapshot!.accounts[accountId].innerShardCount !== null)
  : false);

function emptyBalance(): InventoryBalance {
  return { dedicatedEggs: 0, regularEggs: 0, silverWan: 0, innerShardCount: null };
}

function todayDate() {
  return settings.planningAsOfDate;
}

function openInventoryDialog(date = todayDate()) {
  inventoryDialogDate.value = date;
  inventoryDialogOpen.value = true;
}

function signedValue(value: number, unit = "") {
  if (value === 0) return `0${unit}`;
  return `${value > 0 ? "+" : ""}${Number.isInteger(value) ? value : value.toFixed(2)}${unit}`;
}

function deltaTone(value: number) {
  return value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
}

function saveInventorySnapshot(draft: InventorySnapshotInput) {
  const updating = inventory.snapshots.some((item) => item.effectiveDate === draft.effectiveDate);
  inventory.saveSnapshot(draft);
  inventoryDialogOpen.value = false;
  inventoryNotice.value = `${updating ? "已更新" : "已保存"} ${draft.effectiveDate} 的五号库存快照`;
}

function removeInventorySnapshot(effectiveDate: string) {
  confirmReset(`确认删除 ${effectiveDate} 的五号库存快照？`, () => {
    inventory.removeSnapshot(effectiveDate);
    inventoryNotice.value = `已删除 ${effectiveDate} 的库存快照`;
  });
}

function formatHistoryTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }).format(new Date(value));
}

function confirmReset(message: string, action: () => void) {
  if (confirm(message)) action();
}
</script>

<template>
  <InventorySnapshotDialog
    :open="inventoryDialogOpen"
    :initial-date="inventoryDialogDate || todayDate()"
    :snapshots="inventory.snapshots"
    @close="inventoryDialogOpen = false"
    @save="saveInventorySnapshot"
  />

  <section class="page-intro ledger-page-head">
    <div>
      <h2>五号库存台账</h2>
      <p>一次录入五个号的实际库存；系统按周一到周日生成周报，有记录的日期显示日报，没记录的日期保持空白。</p>
    </div>
    <button class="button primary" type="button" @click="openInventoryDialog()">录入五号快照</button>
  </section>
  <p v-if="inventoryNotice" class="action-notice" role="status" aria-live="polite">{{ inventoryNotice }}</p>

  <section v-if="inventory.latestSnapshot" class="settings-section latest-inventory-ledger">
    <div class="section-head">
      <div>
        <h2>最近快照 · {{ inventory.latestSnapshot.effectiveDate }}</h2>
        <p>实际录入于 {{ formatHistoryTime(inventory.latestSnapshot.recordedAt) }} · {{ latestInventoryComplete ? "五号库存已齐" : "内丹碎片仍有待补录" }}</p>
      </div>
      <span>{{ latestInventoryComplete ? "五号已齐" : "待补内丹碎片" }}</span>
    </div>
    <div class="inventory-overview-grid" role="list" aria-label="五账号最新库存及净变化">
      <article v-for="row in latestInventoryRows" :key="row.accountId" class="inventory-account-cell" role="listitem">
        <header>
          <strong :class="`account-pill account-${row.accountId.toLowerCase()}`">{{ row.accountId }}</strong>
          <small>{{ row.delta ? `较前次 · ${row.delta.intervalDays}天` : "首份基线" }}</small>
        </header>
        <div class="inventory-values">
          <span><small>专用蛋</small><strong>{{ row.balance.dedicatedEggs }}</strong></span>
          <span><small>普通蛋</small><strong>{{ row.balance.regularEggs }}</strong></span>
          <span><small>银子 / 万</small><strong>{{ row.balance.silverWan.toLocaleString() }}</strong></span>
          <span><small>内丹碎片</small><strong>{{ row.balance.innerShardCount ?? "待补录" }}</strong></span>
        </div>
        <div v-if="row.delta" class="inventory-delta delta-trio" aria-label="相对前次净变化">
          <span><small>专</small><b :class="deltaTone(row.delta.dedicatedEggs)">{{ signedValue(row.delta.dedicatedEggs) }}</b></span>
          <span><small>普</small><b :class="deltaTone(row.delta.regularEggs)">{{ signedValue(row.delta.regularEggs) }}</b></span>
          <span><small>银</small><b :class="deltaTone(row.delta.silverWan)">{{ signedValue(row.delta.silverWan, "万") }}</b></span>
          <span><small>碎</small><b :class="row.delta.innerShardCount === null ? 'neutral' : deltaTone(row.delta.innerShardCount)">{{ row.delta.innerShardCount === null ? "—" : signedValue(row.delta.innerShardCount) }}</b></span>
        </div>
        <div v-else class="inventory-delta">等待下一份快照计算变化</div>
      </article>
    </div>
    <p class="trend-empty-note">净变化表示{{ latestInventoryIntervalDays ? `相隔 ${latestInventoryIntervalDays} 天的` : "两次" }}库存差额，包含期间获得、消耗和买卖后的最终结果。</p>
  </section>

  <section v-else class="empty-state inventory-empty-state">
    <div>
      <h2>先记录五个号现在有多少</h2>
      <p>第一份快照只建立基线，不计算进账。第二次录入后才会显示与前次相比的变化。</p>
    </div>
    <button class="button primary" type="button" @click="openInventoryDialog()">建立库存基线</button>
  </section>

  <InventoryWeeklyReport
    :snapshots="inventory.snapshots"
    :current-date="todayDate()"
    @record="openInventoryDialog"
    @remove="removeInventorySnapshot"
  />

</template>
