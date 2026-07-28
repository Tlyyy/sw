<script setup lang="ts">
import TaskSettlementDialog from "../../../components/TaskSettlementDialog.vue";

defineOptions({ inheritAttrs: false });
</script>

<template>
  <!-- @vue-ignore -->
  <TaskSettlementDialog v-bind="$attrs" presentation="mobile" />
</template>
