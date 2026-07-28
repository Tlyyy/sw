<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted } from "vue";
import { useAppDeviceMode } from "../../app/device";
import { preloadRecordPage } from "./useRecordEntry";

const DesktopHomePage = defineAsyncComponent(() => import("../../platforms/desktop/pages/DesktopHomePage.vue"));
const MobileHomePage = defineAsyncComponent(() => import("../../platforms/mobile/pages/MobileHomePage.vue"));
const deviceMode = useAppDeviceMode();
const isMobileHome = computed(() => deviceMode.value === "mobile");
let recordPreloadFrame = 0;

onMounted(() => {
  recordPreloadFrame = window.requestAnimationFrame(() => {
    recordPreloadFrame = 0;
    void preloadRecordPage(deviceMode.value).catch(() => undefined);
  });
});

onBeforeUnmount(() => {
  if (recordPreloadFrame) window.cancelAnimationFrame(recordPreloadFrame);
});
</script>

<template>
  <MobileHomePage v-if="isMobileHome" />
  <DesktopHomePage v-else />
</template>
