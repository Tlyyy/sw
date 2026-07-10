<script setup lang="ts">defineProps<{ items: Array<{ value: string | number; label: string; note?: string }> }>();</script>
<template><div class="stat-strip"><div v-for="item in items" :key="item.label"><strong>{{ item.value }}</strong><span>{{ item.label }}</span><small v-if="item.note">{{ item.note }}</small></div></div></template>
