<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import InventoryCurrentOverview from "../../../components/InventoryCurrentOverview.vue";
import InventoryWeekSwitcher from "../../../components/InventoryWeekSwitcher.vue";
import DataCenterNav from "../../../features/data/DataCenterNav.vue";
import { useDataInventoryPage } from "../../../features/data/useDataInventoryPage";

const InventorySnapshotDialog = defineAsyncComponent(() => import("../components/MobileInventorySnapshotDialog.vue"));
const InventoryWeeklyAnalysis = defineAsyncComponent(() => import("../../../components/InventoryWeeklyAnalysis.vue"));
const InventoryRecordList = defineAsyncComponent(() => import("../../../components/InventoryRecordList.vue"));
const page = useDataInventoryPage();
</script>

<template>
  <div class="page-wrap mobile-data-inventory-page" data-platform-page="mobile">
    <DataCenterNav />
    <header class="mobile-inventory-hero"><div><small>五号库存</small><h1>{{ page.activeView.value === "current" ? "现在有多少" : page.activeViewTitle() }}</h1><p>{{ page.viewDescription(page.activeView.value) }}</p></div><button type="button" @click="page.openInventoryDialog()">录入</button></header>
    <nav class="mobile-inventory-tabs" aria-label="库存工作区视图"><button v-for="item in page.viewOptions" :key="item.key" type="button" :class="{ active: page.activeView.value === item.key }" :aria-pressed="page.activeView.value === item.key" :aria-label="item.label" @click="page.activeView.value = item.key">{{ item.label }}</button></nav>
    <p v-if="page.inventoryNotice.value" class="mobile-inventory-notice" role="status">{{ page.inventoryNotice.value }}</p>
    <InventoryCurrentOverview v-if="page.activeView.value === 'current' && page.inventory.latestSnapshot" :snapshot="page.inventory.latestSnapshot" :deltas="page.inventory.latestDeltas" />
    <section v-else-if="page.activeView.value === 'current'" class="mobile-inventory-empty"><strong>先建立库存基线</strong><p>记录五个账号现在的专用蛋、普通蛋、银子和内丹碎片。</p><button type="button" @click="page.openInventoryDialog()">开始录入</button></section>
    <section v-else class="mobile-inventory-workspace" data-testid="inventory-task-panel"><header><div><small>{{ page.report.value.recordedDays }} / 7 天有记录</small><h2>{{ page.activeViewTitle() }}</h2></div></header><InventoryWeekSwitcher :week-start="page.report.value.weekStart" :week-end="page.report.value.weekEnd" :is-current-week="page.isCurrentWeek.value" :can-view-next-week="page.canViewNextWeek.value" @previous="page.moveWeek(-7)" @next="page.moveWeek(7)" @current="page.returnToCurrentWeek" /><InventoryWeeklyAnalysis v-if="page.activeView.value === 'weekly'" :report="page.report.value" :current-date="page.currentDate.value" /><InventoryRecordList v-else :report="page.report.value" :current-date="page.currentDate.value" @record="page.openInventoryDialog" @remove="page.removeInventorySnapshot" /></section>
    <InventorySnapshotDialog v-if="page.inventoryDialogOpen.value" :open="page.inventoryDialogOpen.value" :initial-date="page.inventoryDialogDate.value || page.currentDate.value" :max-date="page.currentDate.value" :snapshots="page.inventory.snapshots" @close="page.closeInventoryDialog" @save="page.saveInventorySnapshot" />
  </div>
</template>

<style scoped>
.mobile-data-inventory-page{width:100%;padding:6px 12px 112px}.mobile-inventory-hero{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 2px}.mobile-inventory-hero small{color:#c44d00;font-size:11px;font-weight:850}.mobile-inventory-hero h1{font-size:24px}.mobile-inventory-hero p{color:#697386;font-size:11px}.mobile-inventory-hero button,.mobile-inventory-empty button{min-width:72px;min-height:44px;border:0;border-radius:10px;color:#fff;background:#b54b12;font-weight:850}.mobile-inventory-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:10px;padding:4px;border:1px solid rgba(60,60,67,.14);border-radius:11px;background:#f6f3ef}.mobile-inventory-tabs button{min-height:42px;border:0;border-radius:8px;color:#697386;background:transparent;font-size:12px;font-weight:800}.mobile-inventory-tabs button.active{color:#9f3b08;background:#fff;box-shadow:0 1px 5px rgba(20,20,20,.09)}.mobile-inventory-notice{margin:0 0 9px;color:#18634b;font-size:12px}.mobile-inventory-empty{display:grid;place-items:center;gap:10px;min-height:250px;padding:24px;border:1px solid rgba(60,60,67,.15);border-radius:13px;background:#fff;text-align:center}.mobile-inventory-empty p{max-width:290px;color:#697386;font-size:12px}.mobile-inventory-workspace{overflow:hidden;border:1px solid rgba(60,60,67,.15);border-radius:13px;background:#fff}.mobile-inventory-workspace>header{padding:11px 12px;border-bottom:1px solid rgba(60,60,67,.1)}.mobile-inventory-workspace>header small{color:#a9430c;font-size:10px}.mobile-inventory-workspace h2{font-size:17px}
</style>
