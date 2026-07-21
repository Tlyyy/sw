<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from "vue";
import {
  buildInventoryWeekReport,
  canRecordInventoryDate,
  naturalWeekRange,
} from "../../domain/inventory";
import type { InventorySnapshotInput } from "../../domain/types";
import InventoryCurrentOverview from "../../components/InventoryCurrentOverview.vue";
import InventoryWeekSwitcher from "../../components/InventoryWeekSwitcher.vue";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";

const InventorySnapshotDialog = defineAsyncComponent(() => import("../../components/InventorySnapshotDialog.vue"));
const InventoryWeeklyAnalysis = defineAsyncComponent(() => import("../../components/InventoryWeeklyAnalysis.vue"));
const InventoryRecordList = defineAsyncComponent(() => import("../../components/InventoryRecordList.vue"));

type InventoryWorkspaceView = "current" | "weekly" | "records";

const inventory = useInventoryStore();
const settings = useSettingsStore();
const activeView = ref<InventoryWorkspaceView>("current");
const inventoryDialogOpen = ref(false);
const inventoryDialogDate = ref("");
const inventoryNotice = ref("");
const currentDate = computed(() => settings.planningAsOfDate);
const selectedAnchor = ref(currentDate.value);

const viewOptions: Array<{ key: InventoryWorkspaceView; label: string }> = [
  { key: "current", label: "当前库存" },
  { key: "weekly", label: "周报分析" },
  { key: "records", label: "记录管理" },
];

const report = computed(() => buildInventoryWeekReport(inventory.snapshots, selectedAnchor.value));
const currentWeek = computed(() => naturalWeekRange(currentDate.value));
const isCurrentWeek = computed(() => report.value.weekStart === currentWeek.value.weekStart);
const canViewNextWeek = computed(() => report.value.weekStart < currentWeek.value.weekStart);

watch(currentDate, (date) => {
  selectedAnchor.value = date;
});

function viewDescription(view: InventoryWorkspaceView) {
  if (view === "current") return inventory.latestSnapshot?.effectiveDate || "尚未建立基线";
  if (view === "weekly") return `${report.value.recordedDays} / 7 天有记录`;
  return `${inventory.snapshots.length} 份历史快照`;
}

function activeViewTitle() {
  return activeView.value === "weekly" ? "周报分析" : "记录管理";
}

function activeViewCopy() {
  return activeView.value === "weekly"
    ? "这里只做比较、折算与分享；记录维护统一放在“记录管理”。"
    : "补录、修改和删除都在这里；未来日期只展示，不提供操作。";
}

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

function openInventoryDialog(date = currentDate.value) {
  if (!canRecordInventoryDate(date, currentDate.value)) return;
  inventoryDialogDate.value = date;
  inventoryDialogOpen.value = true;
}

function saveInventorySnapshot(draft: InventorySnapshotInput) {
  const updating = inventory.snapshots.some((item) => item.effectiveDate === draft.effectiveDate);
  inventory.saveSnapshot(draft);
  inventoryDialogOpen.value = false;
  inventoryNotice.value = `${updating ? "已更新" : "已保存"} ${draft.effectiveDate} 的五号库存快照`;
}

function removeInventorySnapshot(effectiveDate: string) {
  if (!confirm(`确认删除 ${effectiveDate} 的五号库存快照？`)) return;
  inventory.removeSnapshot(effectiveDate);
  inventoryNotice.value = `已删除 ${effectiveDate} 的库存快照`;
}
</script>

<template>
  <section class="page-intro inventory-page-head">
    <div>
      <h2>五号库存</h2>
      <p>录入一次，当前状态、周报分析和历史记录会分别归位；先选择你现在要完成的任务。</p>
    </div>
    <button class="button primary inventory-primary-action" type="button" @click="openInventoryDialog()">录入今天库存</button>
  </section>

  <div class="inventory-workspace-nav" role="group" aria-label="库存工作区视图">
    <button
      v-for="item in viewOptions"
      :key="item.key"
      type="button"
      :class="{ active: activeView === item.key }"
      :aria-pressed="activeView === item.key"
      :aria-label="item.label"
      @click="activeView = item.key"
    >
      <strong>{{ item.label }}</strong>
      <span>{{ viewDescription(item.key) }}</span>
    </button>
  </div>

  <p v-if="inventoryNotice" class="action-notice inventory-action-notice" role="status" aria-live="polite">{{ inventoryNotice }}</p>

  <InventoryCurrentOverview
    v-if="activeView === 'current' && inventory.latestSnapshot"
    :snapshot="inventory.latestSnapshot"
    :deltas="inventory.latestDeltas"
  />

  <section v-else-if="activeView === 'current'" class="inventory-empty-state">
    <div>
      <p class="inventory-empty-eyebrow">当前库存</p>
      <h2>先记录五个号现在有多少</h2>
      <p>第一份快照只建立基线；第二次录入后才会显示相对前次和本周变化。</p>
    </div>
    <button class="button primary" type="button" @click="openInventoryDialog()">建立库存基线</button>
  </section>

  <section v-else class="inventory-task-panel" :aria-labelledby="`inventory-${activeView}-title`" data-testid="inventory-task-panel">
    <header class="inventory-task-head">
      <div>
        <p class="inventory-task-eyebrow">库存工作区</p>
        <h2 :id="`inventory-${activeView}-title`">{{ activeViewTitle() }}</h2>
        <p>{{ activeViewCopy() }}</p>
      </div>
      <span>{{ report.recordedDays }} / 7 天有记录</span>
    </header>

    <InventoryWeekSwitcher
      :week-start="report.weekStart"
      :week-end="report.weekEnd"
      :is-current-week="isCurrentWeek"
      :can-view-next-week="canViewNextWeek"
      @previous="moveWeek(-7)"
      @next="moveWeek(7)"
      @current="returnToCurrentWeek"
    />

    <InventoryWeeklyAnalysis v-if="activeView === 'weekly'" :report="report" :current-date="currentDate" />
    <InventoryRecordList
      v-else
      :report="report"
      :current-date="currentDate"
      @record="openInventoryDialog"
      @remove="removeInventorySnapshot"
    />
  </section>

  <InventorySnapshotDialog
    v-if="inventoryDialogOpen"
    :open="inventoryDialogOpen"
    :initial-date="inventoryDialogDate || currentDate"
    :max-date="currentDate"
    :snapshots="inventory.snapshots"
    @close="inventoryDialogOpen = false"
    @save="saveInventorySnapshot"
  />
</template>

<style scoped>
.inventory-page-head {
  align-items: center;
  min-height: 0;
  padding: 2px 0 14px;
  border-bottom-color: var(--radar-line-strong);
}

.inventory-page-head h2 {
  font-size: 26px;
  line-height: 1.2;
  letter-spacing: -.03em;
}

.inventory-page-head p {
  max-width: 860px;
  margin-top: 4px;
  font-size: 14px !important;
  line-height: 1.5;
}

.inventory-primary-action {
  min-height: 42px;
  padding-inline: 16px;
  white-space: nowrap;
}

.inventory-workspace-nav {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 14px 0;
  padding: 5px;
  border: 1px solid var(--radar-line);
  border-radius: 9px;
  background: var(--radar-surface-2);
}

.inventory-workspace-nav button {
  min-width: 0;
  min-height: 58px;
  display: grid;
  align-content: center;
  gap: 2px;
  padding: 7px 12px;
  border: 1px solid transparent;
  border-radius: 7px;
  color: var(--radar-muted);
  background: transparent;
  text-align: left;
}

.inventory-workspace-nav button:hover,
.inventory-workspace-nav button:focus-visible {
  color: var(--radar-cyan-strong);
  background: color-mix(in srgb, var(--radar-cyan) 7%, #ffffff);
}

.inventory-workspace-nav button.active {
  border-color: color-mix(in srgb, var(--radar-cyan) 38%, var(--radar-line));
  color: var(--radar-cyan-strong);
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(17, 24, 39, .08);
}

.inventory-workspace-nav strong {
  font-size: 15px;
  line-height: 1.25;
}

.inventory-workspace-nav span {
  overflow: hidden;
  font-size: 11px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inventory-action-notice {
  margin: -4px 0 12px;
}

.inventory-task-panel,
.inventory-empty-state {
  overflow: hidden;
  border: 1px solid var(--radar-line);
  border-radius: 9px;
  background: var(--radar-surface);
}

.inventory-task-head {
  min-height: 82px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--radar-line);
}

.inventory-task-eyebrow,
.inventory-empty-eyebrow {
  margin-bottom: 2px;
  color: var(--radar-cyan-strong) !important;
  font-size: 12px !important;
  font-weight: 850;
  letter-spacing: .08em;
}

.inventory-task-head h2,
.inventory-empty-state h2 {
  color: var(--radar-ink);
  font-size: 21px;
  line-height: 1.25;
}

.inventory-task-head div > p:last-child,
.inventory-empty-state div > p:last-child {
  margin-top: 3px;
  color: var(--radar-muted);
  font-size: 13px !important;
  line-height: 1.45;
}

.inventory-task-head > span {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border: 1px solid color-mix(in srgb, var(--radar-cyan) 34%, var(--radar-line));
  border-radius: 999px;
  color: var(--radar-cyan-strong);
  background: var(--radar-cyan-soft);
  font-size: 12px;
  font-weight: 850;
  white-space: nowrap;
}

.inventory-empty-state {
  min-height: 250px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 36px;
}

@media (max-width: 720px) {
  .inventory-page-head {
    align-items: stretch;
    gap: 12px;
  }

  .inventory-page-head h2 {
    font-size: 23px;
  }

  .inventory-primary-action {
    width: 100%;
    min-height: 44px;
  }

  .inventory-workspace-nav {
    gap: 5px;
    margin: 12px 0;
    padding: 4px;
  }

  .inventory-workspace-nav button {
    min-height: 52px;
    padding-inline: 8px;
    text-align: center;
  }

  .inventory-workspace-nav strong {
    font-size: 14px;
  }

  .inventory-task-head {
    align-items: flex-start;
    gap: 10px;
    min-height: 0;
    padding: 12px;
  }

  .inventory-task-head h2 {
    font-size: 19px;
  }

  .inventory-task-head div > p:last-child {
    font-size: 12px !important;
  }

  .inventory-empty-state {
    align-items: stretch;
    flex-direction: column;
    justify-content: center;
    padding: 24px 18px;
  }

  .inventory-empty-state .button {
    width: 100%;
  }
}

@media (max-width: 430px) {
  .inventory-workspace-nav span {
    display: none;
  }

  .inventory-workspace-nav button {
    min-height: 44px;
  }
}
</style>
