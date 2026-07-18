<script setup lang="ts">
import { onMounted, onUnmounted, watch, type WatchStopHandle } from "vue";
import AuthGate from "./components/AuthGate.vue";
import AppShell from "./components/AppShell.vue";
import { millisecondsUntilNextShanghaiDay } from "./domain/plans";
import { useAuthStore } from "./stores/auth";
import { useSettingsStore } from "./stores/settings";
import { usePublishStore } from "./stores/publish";
import { useSyncStore } from "./stores/sync";
import { useUiStore } from "./stores/ui";
import { useInventoryStore } from "./stores/inventory";

const settings = useSettingsStore();
const auth = useAuthStore();
const sync = useSyncStore();
let planningDayTimer: number | undefined;
let stopAuthWatch: WatchStopHandle | undefined;

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
  stopAuthWatch = watch(
    () => [auth.isUnlocked, auth.credentialKey] as const,
    ([unlocked, credentialKey]) => {
      if (unlocked && credentialKey) void sync.start(credentialKey);
      else sync.stop();
    },
    { immediate: true },
  );
  void auth.restore();
  refreshPlanningDay();
  window.addEventListener("focus", refreshPlanningDay);
  document.addEventListener("visibilitychange", refreshPlanningDayWhenVisible);
});

onUnmounted(() => {
  stopAuthWatch?.();
  sync.stop();
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
