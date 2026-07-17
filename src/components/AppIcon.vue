<script setup lang="ts">defineProps<{ name: string }>();</script>
<template>
  <svg v-if="name === 'menu'" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
  <svg v-else-if="name === 'close'" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>
  <svg v-else-if="name === 'chevron-right'" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>
  <svg v-else-if="name === 'refresh'" viewBox="0 0 24 24"><path d="M20 7v5h-5"/><path d="M18.2 16a8 8 0 1 1 .7-7.1L20 12"/></svg>
  <svg v-else-if="name === 'home'" viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5V21H3Z"/><path d="M9 21v-6h6v6"/></svg>
  <svg v-else-if="name === 'account'" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.2"/><path d="M5 21c.8-4.5 3.2-6.8 7-6.8s6.2 2.3 7 6.8"/></svg>
  <svg v-else-if="name === 'assets'" viewBox="0 0 24 24"><path d="M4 5h16v15H4Z"/><path d="M4 10h16M9 5v15"/></svg>
  <svg v-else-if="name === 'plan'" viewBox="0 0 24 24"><path d="M5 3v18M19 3v18M5 7h14M5 17h14"/><circle cx="10" cy="12" r="2"/></svg>
  <svg v-else-if="name === 'analysis'" viewBox="0 0 24 24"><path d="M4 20V9M10 20V4M16 20v-7M22 20H2"/></svg>
  <svg v-else-if="name === 'publish'" viewBox="0 0 24 24"><path d="M4 4h16v16H4Z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>
  <svg v-else-if="name === 'settings'" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></svg>
  <svg v-else viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
</template>

<style scoped>svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}</style>
