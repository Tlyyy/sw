<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted } from "vue";
import { provideAppDeviceMode, useViewportDeviceMode } from "../app/device";
import { useUiStore } from "../stores/ui";
import CommandSearch from "./CommandSearch.vue";
import GlobalRecordSheet from "./GlobalRecordSheet.vue";

const ui = useUiStore();
const deviceMode = useViewportDeviceMode();
provideAppDeviceMode(deviceMode);

const DesktopAppShell = defineAsyncComponent(() => import("../platforms/desktop/DesktopAppShell.vue"));
const MobileAppShell = defineAsyncComponent(() => import("../platforms/mobile/MobileAppShell.vue"));
const activeShell = computed(() => (
  deviceMode.value === "mobile"
    ? MobileAppShell
    : DesktopAppShell
));

function keydown(event: KeyboardEvent) {
  if (document.querySelector('[aria-modal="true"]')) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    ui.commandOpen = true;
  }
}

onMounted(() => {
  window.addEventListener("keydown", keydown);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", keydown);
});
</script>

<template>
  <component :is="activeShell" />
  <GlobalRecordSheet />
  <CommandSearch />
</template>
