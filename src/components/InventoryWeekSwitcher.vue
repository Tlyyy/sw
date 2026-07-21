<script setup lang="ts">
import AppIcon from "./AppIcon.vue";

defineProps<{
  weekStart: string;
  weekEnd: string;
  isCurrentWeek: boolean;
  canViewNextWeek: boolean;
}>();

defineEmits<{
  previous: [];
  next: [];
  current: [];
}>();
</script>

<template>
  <div class="inventory-week-switcher" aria-label="周报日期切换">
    <button class="inventory-week-button previous" type="button" aria-label="查看上一周" @click="$emit('previous')">
      <AppIcon name="chevron-right" />
    </button>
    <div class="inventory-week-range" aria-live="polite">
      <strong>{{ weekStart }} 至 {{ weekEnd }}</strong>
      <small>{{ isCurrentWeek ? "本周" : "历史周" }}</small>
    </div>
    <button class="inventory-week-button" type="button" aria-label="查看下一周" :disabled="!canViewNextWeek" @click="$emit('next')">
      <AppIcon name="chevron-right" />
    </button>
    <button v-if="!isCurrentWeek" class="inventory-week-current" type="button" @click="$emit('current')">回到本周</button>
  </div>
</template>

<style scoped>
.inventory-week-switcher {
  min-height: 64px;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px auto;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--radar-line);
  background: var(--radar-surface);
}

.inventory-week-button {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border: 1px solid var(--radar-line-strong);
  border-radius: 7px;
  color: var(--radar-cyan-strong);
  background: #ffffff;
}

.inventory-week-button:hover,
.inventory-week-button:focus-visible {
  border-color: var(--radar-cyan);
  background: var(--radar-cyan-soft);
}

.inventory-week-button:disabled {
  color: var(--radar-muted);
  opacity: .38;
  cursor: not-allowed;
}

.inventory-week-button.previous :deep(svg) {
  transform: rotate(180deg);
}

.inventory-week-range {
  min-width: 0;
  display: grid;
  justify-items: center;
  gap: 1px;
  text-align: center;
}

.inventory-week-range strong {
  overflow: hidden;
  max-width: 100%;
  color: var(--radar-ink);
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inventory-week-range small {
  color: var(--radar-muted);
  font-size: 12px;
  font-weight: 700;
}

.inventory-week-current {
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid var(--radar-line-strong);
  border-radius: 7px;
  color: var(--radar-cyan-strong);
  background: var(--radar-cyan-soft);
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
}

@media (max-width: 560px) {
  .inventory-week-switcher {
    grid-template-columns: 40px minmax(0, 1fr) 40px;
    padding-inline: 10px;
  }

  .inventory-week-current {
    grid-column: 1 / -1;
    width: 100%;
    min-height: 42px;
  }

  .inventory-week-range strong {
    font-size: 14px;
  }
}
</style>
