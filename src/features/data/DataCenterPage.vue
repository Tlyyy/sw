<script setup lang="ts">
import { computed, defineAsyncComponent } from "vue";
import { useRoute } from "vue-router";
import DataCenterNav from "./DataCenterNav.vue";
import DataInventorySection from "./DataInventorySection.vue";

const DataMarketSection = defineAsyncComponent(() => import("./DataMarketSection.vue"));
const DataSourcesSection = defineAsyncComponent(() => import("./DataSourcesSection.vue"));

const route = useRoute();
const section = computed(() => String(route.params.section || route.path.split("/").filter(Boolean).at(-1) || "inventory"));
const sectionComponents = {
  inventory: DataInventorySection,
  market: DataMarketSection,
  sources: DataSourcesSection,
} as const;
const activeSection = computed(() => sectionComponents[section.value as keyof typeof sectionComponents] || DataInventorySection);
</script>

<template>
  <div class="page-wrap data-center-page">
    <DataCenterNav />
    <KeepAlive>
      <component :is="activeSection" />
    </KeepAlive>
  </div>
</template>

<style scoped>
.data-center-page {
  padding-top: 16px;
  padding-bottom: 48px;
}

.data-center-nav {
  margin: 0 0 14px;
  padding-bottom: 6px;
}

.data-center-nav :deep(a) {
  min-height: 38px;
  padding: 7px 12px;
}

:global(body:has(.data-center-page) .orbit-route-context) {
  padding-top: 14px;
}

:global(body:has(.data-center-page) .orbit-route-context > div) {
  padding-bottom: 10px;
}

:global(body:has(.data-center-page) .orbit-route-context h1) {
  font-size: 30px;
}

:global(body:has(.data-center-page) .orbit-route-context p) {
  margin-top: 2px;
}

@media (max-width: 720px) {
  .data-center-page {
    padding-top: 12px;
    padding-bottom: 36px;
  }

  .data-center-nav {
    margin-bottom: 12px;
  }
}
</style>
