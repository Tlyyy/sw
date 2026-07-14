<script setup lang="ts">
import { computed, ref } from "vue";
import InventorySnapshotDialog from "../../components/InventorySnapshotDialog.vue";
import { catalog } from "../../data/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";
import type { AccountId, InventoryBalance, InventorySnapshotInput } from "../../domain/types";

const inventory = useInventoryStore();
const settings = useSettingsStore();
const inventoryDialogOpen = ref(false);
const inventoryNotice = ref("");
const inventoryAccountOrder: AccountId[] = ["FC", "LG1", "LG2", "PT", "MYT"];
const eggSellPriceWan = catalog.beastConfig.eggSellPriceWan;
const eggRoundTripLossWan = computed(() => Math.max(0, settings.taskSettings.eggPriceWan - eggSellPriceWan));

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
const inventoryHistory = computed(() => [...inventory.snapshots].reverse());
const latestInventoryComplete = computed(() => inventory.latestSnapshot
  ? inventoryAccountOrder.every((accountId) => inventory.latestSnapshot!.accounts[accountId].innerShardCount !== null)
  : false);

function emptyBalance(): InventoryBalance {
  return { dedicatedEggs: 0, regularEggs: 0, silverWan: 0, innerShardCount: null };
}

function todayDate() {
  return settings.planningAsOfDate;
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
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function confirmReset(message: string, action: () => void) {
  if (confirm(message)) action();
}
</script>

<template>
  <InventorySnapshotDialog
    :open="inventoryDialogOpen"
    :initial-date="todayDate()"
    :snapshots="inventory.snapshots"
    @close="inventoryDialogOpen = false"
    @save="saveInventorySnapshot"
  />

  <section class="page-intro ledger-page-head">
    <div>
      <h2>五号库存台账</h2>
      <p>不用先选账号。每次在同一张表录入五个号的实际库存，系统按库存所属日期计算净变化。</p>
    </div>
    <button class="button primary" type="button" @click="inventoryDialogOpen = true">录入五号快照</button>
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
    <button class="button primary" type="button" @click="inventoryDialogOpen = true">建立库存基线</button>
  </section>

  <section class="settings-section inventory-history-section">
    <div class="section-head">
      <div><h2>历史批次</h2><p>按库存所属日期倒序排列；补录过去日期后会自动插入正确位置。</p></div>
      <span>{{ inventory.snapshots.length }} 批</span>
    </div>
    <div v-if="inventoryHistory.length" class="snapshot-history-table" role="table" aria-label="库存快照历史批次">
      <div class="snapshot-history-head" role="row">
        <span role="columnheader">库存日期</span>
        <span role="columnheader">实际录入</span>
        <span v-for="accountId in inventoryAccountOrder" :key="accountId" role="columnheader">{{ accountId }}</span>
        <span role="columnheader">操作</span>
      </div>
      <div v-for="snapshot in inventoryHistory" :key="snapshot.effectiveDate" class="snapshot-history-row" role="row">
        <strong role="cell">{{ snapshot.effectiveDate }}</strong>
        <span role="cell">{{ formatHistoryTime(snapshot.recordedAt) }}</span>
        <span v-for="accountId in inventoryAccountOrder" :key="accountId" role="cell">
          专{{ snapshot.accounts[accountId].dedicatedEggs }} · 普{{ snapshot.accounts[accountId].regularEggs }} · 银{{ snapshot.accounts[accountId].silverWan.toLocaleString() }}万 · 碎{{ snapshot.accounts[accountId].innerShardCount ?? "待补" }}
        </span>
        <span role="cell"><button class="text-button danger-text" type="button" :aria-label="`删除${snapshot.effectiveDate}库存快照`" @click="removeInventorySnapshot(snapshot.effectiveDate)">删除</button></span>
      </div>
    </div>
    <p v-else class="empty-state">尚无历史快照。</p>
  </section>

  <section class="settings-section secondary-settings-panel">
    <div class="section-head">
      <div><h2>神兽计划辅助参数</h2><p>普通蛋买入 {{ settings.taskSettings.eggPriceWan }} 万、紧急回收 {{ eggSellPriceWan }} 万；卖后再买每个损失 {{ Number(eggRoundTripLossWan.toFixed(2)) }} 万。实际排期会从最早起算日、今天和库存日期中的较晚日期继续。</p></div>
      <span>次要设置</span>
    </div>
    <div class="settings-band data-edit-band compact-settings-band">
      <label><span>最早起算日期</span><input type="date" :value="settings.taskSettings.startDate" @input="settings.setTaskSetting('startDate', ($event.target as HTMLInputElement).value)" /></label>
      <label><span>本周内丹碎片</span><input type="number" min="0" :value="settings.taskSettings.thisWeekInnerShards" @input="settings.setTaskSetting('thisWeekInnerShards', Number(($event.target as HTMLInputElement).value))" /></label>
      <label><span>每周内丹碎片</span><input type="number" min="0" :value="settings.taskSettings.weeklyInnerShards" @input="settings.setTaskSetting('weeklyInnerShards', Number(($event.target as HTMLInputElement).value))" /></label>
      <label><span>普通蛋买入价 / 万</span><input type="number" min="0" step="0.1" :value="settings.taskSettings.eggPriceWan" @input="settings.setTaskSetting('eggPriceWan', Number(($event.target as HTMLInputElement).value))" /></label>
      <label><span>普通蛋紧急回收价 / 万</span><input type="number" :value="eggSellPriceWan" readonly /></label>
      <button class="button secondary" type="button" @click="confirmReset('确认恢复默认神兽计划辅助参数？', settings.resetTaskSettings)">恢复默认参数</button>
    </div>
  </section>
</template>
