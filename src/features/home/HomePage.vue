<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import DesktopHomePage from "./DesktopHomePage.vue";
import MobileHomePage from "../mobile/MobileHomePage.vue";
import { preloadRecordPage } from "./useRecordEntry";

const mobileQuery = window.matchMedia("(max-width: 980px)");
const isMobileHome = ref(mobileQuery.matches);
let recordPreloadFrame = 0;

function syncViewport(event: MediaQueryListEvent) {
  isMobileHome.value = event.matches;
}

onMounted(() => {
  mobileQuery.addEventListener("change", syncViewport);
  recordPreloadFrame = window.requestAnimationFrame(() => {
    recordPreloadFrame = 0;
    void preloadRecordPage().catch(() => undefined);
  });
});

onBeforeUnmount(() => {
  mobileQuery.removeEventListener("change", syncViewport);
  if (recordPreloadFrame) window.cancelAnimationFrame(recordPreloadFrame);
});
</script>

<template>
  <MobileHomePage v-if="isMobileHome" />
  <DesktopHomePage v-else />
</template>
