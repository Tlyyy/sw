<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import DashboardPage from "../dashboard/DashboardPage.vue";
import MobileHomePage from "../mobile/MobileHomePage.vue";

const mobileQuery = window.matchMedia("(max-width: 720px)");
const isMobileHome = ref(mobileQuery.matches);

function syncViewport(event: MediaQueryListEvent) {
  isMobileHome.value = event.matches;
}

onMounted(() => mobileQuery.addEventListener("change", syncViewport));
onBeforeUnmount(() => mobileQuery.removeEventListener("change", syncViewport));
</script>

<template>
  <MobileHomePage v-if="isMobileHome" />
  <DashboardPage v-else />
</template>
