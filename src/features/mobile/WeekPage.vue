<script setup lang="ts">
import { computed, ref, watch } from "vue";
import InventoryWeeklyAnalysis from "../../components/InventoryWeeklyAnalysis.vue";
import InventoryWeekSwitcher from "../../components/InventoryWeekSwitcher.vue";
import WeeklyActivityPanel from "../../components/WeeklyActivityPanel.vue";
import { buildInventoryWeekReport, naturalWeekRange } from "../../domain/inventory";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";

const inventory = useInventoryStore();
const settings = useSettingsStore();
const selectedAnchor = ref(settings.planningAsOfDate);

inventory.hydrate();

const currentDate = computed(() => settings.planningAsOfDate);
const report = computed(() => buildInventoryWeekReport(inventory.snapshots, selectedAnchor.value));
const currentWeek = computed(() => naturalWeekRange(currentDate.value));
const isCurrentWeek = computed(() => report.value.weekStart === currentWeek.value.weekStart);
const canViewNextWeek = computed(() => report.value.weekStart < currentWeek.value.weekStart);

watch(currentDate, (date, previousDate) => {
  const previousCurrentWeek = naturalWeekRange(previousDate);
  if (report.value.weekStart === previousCurrentWeek.weekStart) selectedAnchor.value = date;
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
  selectedAnchor.value = currentDate.value;
}
</script>

<template>
  <div class="page-wrap week-page" data-testid="week-page">
    <header class="week-page-intro">
      <div>
        <p>{{ isCurrentWeek ? "本周" : "历史" }}</p>
        <h1>本周小结</h1>
      </div>
      <RouterLink class="button" to="/record">补充记录</RouterLink>
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

    <WeeklyActivityPanel :report="report" :current-date="currentDate" />

    <details class="week-inventory-details">
      <summary>
        <span><strong>按账号查看库存变化</strong><small>逐号净变化、按日矩阵与库存专用图片</small></span>
        <b>{{ report.recordedDays }} / 7 天库存记录</b>
      </summary>
      <InventoryWeeklyAnalysis :report="report" :current-date="currentDate" :show-activity="false" initial-view="matrix" />
    </details>
  </div>
</template>

<style scoped>
.week-page { width: min(100%, 1320px); padding-top: 14px; padding-bottom: 48px; }
.week-page-intro { min-height: 48px; display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 10px; padding: 0 4px 10px; border-bottom: 1px solid var(--radar-line); }
.week-page-intro > div { min-width: 0; display: flex; align-items: baseline; gap: 8px; }
.week-page-intro p { color: var(--radar-cyan-strong); font-size: 11px; font-weight: 850; letter-spacing: .1em; }
.week-page-intro h1 { font-size: 25px; line-height: 1.2; letter-spacing: -.04em; white-space: nowrap; }
.week-page-intro .button { min-height: 44px; white-space: nowrap; }

.week-page :deep(.inventory-week-switcher) { margin-bottom: 12px; }
.week-page :deep(.weekly-activity-panel) { margin: 0; border-radius: 14px; box-shadow: 0 7px 20px rgba(17, 24, 39, .06); }

.week-inventory-details { margin-top: 14px; overflow: hidden; border: 1px solid var(--radar-line); border-radius: 14px; background: #ffffff; }
.week-inventory-details > summary { min-height: 72px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 13px 16px; cursor: pointer; list-style: none; }
.week-inventory-details > summary::-webkit-details-marker { display: none; }
.week-inventory-details > summary > span { display: grid; gap: 2px; }
.week-inventory-details > summary strong { font-size: 17px; }
.week-inventory-details > summary small { color: var(--radar-muted); font-size: 12px; }
.week-inventory-details > summary > b { color: var(--radar-cyan-strong); font-size: 12px; white-space: nowrap; }
.week-inventory-details[open] > summary { border-bottom: 1px solid var(--radar-line); }
.week-inventory-details :deep(.inventory-weekly-analysis) { border: 0; border-radius: 0; }

@media (max-width: 720px) {
  .week-page { padding: 10px 10px 28px; }
  .week-page-intro h1 { font-size: 24px; }
  .week-page-intro .button { min-height: 44px; }
  .week-page :deep(.inventory-week-switcher) { margin-inline: 0; }
  .week-page :deep(.weekly-activity-panel) { border-radius: 12px; }
  .week-inventory-details > summary { align-items: flex-start; flex-direction: column; gap: 6px; }
}
</style>
