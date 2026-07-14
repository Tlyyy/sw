<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import AuthGate from "./components/AuthGate.vue";
import AppShell from "./components/AppShell.vue";
import { millisecondsUntilNextShanghaiDay } from "./domain/plans";
import { useSettingsStore } from "./stores/settings";
import { usePublishStore } from "./stores/publish";
import { useUiStore } from "./stores/ui";
import { useInventoryStore } from "./stores/inventory";

const settings = useSettingsStore();
let planningDayTimer: number | undefined;

function refreshPlanningDay() {
  settings.refreshPlanningAsOfDate();
  if (planningDayTimer !== undefined) window.clearTimeout(planningDayTimer);
  planningDayTimer = window.setTimeout(refreshPlanningDay, millisecondsUntilNextShanghaiDay() + 50);
}

function refreshPlanningDayWhenVisible() {
  if (!document.hidden) refreshPlanningDay();
}

onMounted(() => {
  settings.hydrate();
  useInventoryStore().hydrate();
  usePublishStore().hydrate();
  useUiStore().hydrate();
  refreshPlanningDay();
  window.addEventListener("focus", refreshPlanningDay);
  document.addEventListener("visibilitychange", refreshPlanningDayWhenVisible);
});

onUnmounted(() => {
  if (planningDayTimer !== undefined) window.clearTimeout(planningDayTimer);
  window.removeEventListener("focus", refreshPlanningDay);
  document.removeEventListener("visibilitychange", refreshPlanningDayWhenVisible);
});
</script>

<template>
  <AuthGate>
    <AppShell />
  </AuthGate>
</template>
