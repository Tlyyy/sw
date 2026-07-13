<script setup lang="ts">
import { onMounted } from "vue";
import AuthGate from "./components/AuthGate.vue";
import AppShell from "./components/AppShell.vue";
import { useSettingsStore } from "./stores/settings";
import { usePublishStore } from "./stores/publish";
import { useUiStore } from "./stores/ui";
import { useInventoryStore } from "./stores/inventory";

onMounted(() => {
  useSettingsStore().hydrate();
  useInventoryStore().hydrate();
  usePublishStore().hydrate();
  useUiStore().hydrate();
});
</script>

<template>
  <AuthGate>
    <AppShell />
  </AuthGate>
</template>
