<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import DataCenterNav from "./DataCenterNav.vue";
import DataInventorySection from "./DataInventorySection.vue";
import DataMarketSection from "./DataMarketSection.vue";
import DataSourcesSection from "./DataSourcesSection.vue";

const route = useRoute();
const section = computed(() => String(route.params.section || "inventory"));
const sectionComponents = {
  inventory: DataInventorySection,
  market: DataMarketSection,
  sources: DataSourcesSection,
} as const;
const activeSection = computed(() => sectionComponents[section.value as keyof typeof sectionComponents] || DataSourcesSection);
</script>

<template>
  <div class="page-wrap data-center-page">
    <DataCenterNav />
    <KeepAlive>
      <component :is="activeSection" />
    </KeepAlive>
  </div>
</template>
