<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import InventoryCurrentOverview from "../../../components/InventoryCurrentOverview.vue";
import InventoryWeekSwitcher from "../../../components/InventoryWeekSwitcher.vue";
import DataCenterNav from "../../../features/data/DataCenterNav.vue";
import { useDataInventoryPage } from "../../../features/data/useDataInventoryPage";

const InventorySnapshotDialog = defineAsyncComponent(() => import("../components/DesktopInventorySnapshotDialog.vue"));
const InventoryWeeklyAnalysis = defineAsyncComponent(() => import("../../../components/InventoryWeeklyAnalysis.vue"));
const InventoryRecordList = defineAsyncComponent(() => import("../../../components/InventoryRecordList.vue"));
const page = useDataInventoryPage();
</script>

<template>
  <div class="page-wrap data-center-page desktop-data-inventory-page" data-platform-page="desktop">
    <DataCenterNav />
    <section class="page-intro inventory-page-head"><div><h2>五号库存</h2><p>录入一次，当前状态、周报分析和历史记录会分别归位；先选择你现在要完成的任务。</p></div><button class="button primary inventory-primary-action" type="button" @click="page.openInventoryDialog()">录入今天库存</button></section>
    <div class="inventory-workspace-nav" role="group" aria-label="库存工作区视图"><button v-for="item in page.viewOptions" :key="item.key" type="button" :class="{ active: page.activeView.value === item.key }" :aria-pressed="page.activeView.value === item.key" :aria-label="item.label" @click="page.activeView.value = item.key"><strong>{{ item.label }}</strong><span>{{ page.viewDescription(item.key) }}</span></button></div>
    <p v-if="page.inventoryNotice.value" class="action-notice inventory-action-notice" role="status" aria-live="polite">{{ page.inventoryNotice.value }}</p>
    <InventoryCurrentOverview v-if="page.activeView.value === 'current' && page.inventory.latestSnapshot" :snapshot="page.inventory.latestSnapshot" :deltas="page.inventory.latestDeltas" />
    <section v-else-if="page.activeView.value === 'current'" class="inventory-empty-state"><div><p class="inventory-empty-eyebrow">当前库存</p><h2>先记录五个号现在有多少</h2><p>第一份快照只建立基线；第二次录入后才会显示相对前次和本周变化。</p></div><button class="button primary" type="button" @click="page.openInventoryDialog()">建立库存基线</button></section>
    <section v-else class="inventory-task-panel" :aria-labelledby="`inventory-${page.activeView.value}-title`" data-testid="inventory-task-panel"><header class="inventory-task-head"><div><p class="inventory-task-eyebrow">库存工作区</p><h2 :id="`inventory-${page.activeView.value}-title`">{{ page.activeViewTitle() }}</h2><p>{{ page.activeViewCopy() }}</p></div><span>{{ page.report.value.recordedDays }} / 7 天有记录</span></header><InventoryWeekSwitcher :week-start="page.report.value.weekStart" :week-end="page.report.value.weekEnd" :is-current-week="page.isCurrentWeek.value" :can-view-next-week="page.canViewNextWeek.value" @previous="page.moveWeek(-7)" @next="page.moveWeek(7)" @current="page.returnToCurrentWeek" /><InventoryWeeklyAnalysis v-if="page.activeView.value === 'weekly'" :report="page.report.value" :current-date="page.currentDate.value" /><InventoryRecordList v-else :report="page.report.value" :current-date="page.currentDate.value" @record="page.openInventoryDialog" @remove="page.removeInventorySnapshot" /></section>
    <InventorySnapshotDialog v-if="page.inventoryDialogOpen.value" :open="page.inventoryDialogOpen.value" :initial-date="page.inventoryDialogDate.value || page.currentDate.value" :max-date="page.currentDate.value" :snapshots="page.inventory.snapshots" @close="page.closeInventoryDialog" @save="page.saveInventorySnapshot" />
  </div>
</template>

<style scoped>
.desktop-data-inventory-page{padding-top:16px;padding-bottom:48px}.inventory-page-head{align-items:center;padding:2px 0 14px}.inventory-page-head h2{font-size:26px}.inventory-page-head p{max-width:860px;margin-top:4px}.inventory-workspace-nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:14px 0;padding:5px;border:1px solid var(--color-border);border-radius:9px;background:var(--color-surface-subtle)}.inventory-workspace-nav button{min-height:58px;display:grid;align-content:center;gap:2px;padding:7px 12px;border:1px solid transparent;border-radius:7px;color:var(--color-text-muted);background:transparent;text-align:left}.inventory-workspace-nav button.active{border-color:var(--color-border-strong);color:var(--color-accent-strong);background:var(--color-surface);box-shadow:0 2px 8px rgba(17,24,39,.08)}.inventory-workspace-nav span{font-size:11px}.inventory-task-panel,.inventory-empty-state{overflow:hidden;border:1px solid var(--color-border);border-radius:9px;background:var(--color-surface)}.inventory-task-head{min-height:82px;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:13px 16px;border-bottom:1px solid var(--color-border)}.inventory-task-head>span{padding:6px 10px;border-radius:99px;color:var(--color-accent-strong);background:var(--color-accent-soft);font-size:12px;font-weight:850}.inventory-empty-state{min-height:250px;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:36px}
</style>
