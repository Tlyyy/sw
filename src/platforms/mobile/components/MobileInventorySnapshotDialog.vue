<script setup lang="ts">
import InventorySnapshotDialog from "../../../components/InventorySnapshotDialog.vue";

defineOptions({ inheritAttrs: false });
</script>

<template>
  <!-- @vue-ignore -->
  <InventorySnapshotDialog v-bind="$attrs" presentation="mobile" />
</template>
