<script setup lang="ts">
import { computed } from "vue";
import type { AccountId, AccountPlan } from "../domain/types";
import { formatCurrency } from "../domain/gems";

const props = withDefaults(defineProps<{ plans: AccountPlan[]; selected?: string; currentWeek?: number }>(), { currentWeek: 62 });
const tones: Record<AccountId, string> = {
  FC: "#2b70ba",
  LG1: "#7d53b5",
  LG2: "#ed7410",
  PT: "#dc4337",
  MYT: "#2f8b59",
};
const maxWeek = computed(() => Math.max(...props.plans.map((item) => item.finishWeek), 1));
const minWeek = 50;
function weekPosition(week: number) {
  const span = Math.max(1, maxWeek.value - minWeek);
  return Math.min(100, Math.max(0, 38 + ((week - minWeek) / span) * 62));
}
const currentPosition = computed(() => `${weekPosition(props.currentWeek)}%`);
const guideWeeks = computed(() => [...new Set([50, props.currentWeek, 68, maxWeek.value])].filter((item) => item <= maxWeek.value).sort((a, b) => a - b));

function rowStyle(plan: AccountPlan) {
  return {
    "--rail-end": `${weekPosition(plan.finishWeek)}%`,
    "--account-tone": tones[plan.accountId],
  };
}
</script>

<template>
  <div class="orbit-timeline">
    <div class="orbit-axis" aria-hidden="true">
      <span v-for="week in guideWeeks" :key="week" :style="{ left: `${weekPosition(week)}%` }">第 {{ week }} 周</span>
    </div>
    <div class="orbit-current-track" aria-hidden="true"><div class="orbit-current" :style="{ left: currentPosition }"><span>本周</span><b>第 {{ currentWeek }} 周</b></div></div>
    <RouterLink
      v-for="plan in plans"
      :key="plan.accountId"
      :to="`/accounts/${plan.accountId}`"
      class="orbit-rail-row"
      :class="{ selected: selected === plan.accountId }"
      :style="rowStyle(plan)"
    >
      <span class="orbit-rail-label"><b>{{ plan.accountId }}</b><em>{{ formatCurrency(plan.totalSilver) }}</em></span>
      <span class="orbit-rail-track">
        <i class="orbit-rail-fill"></i>
        <i class="orbit-rail-node node-a"></i>
        <i class="orbit-rail-node node-b"></i>
        <i class="orbit-rail-node node-c"></i>
      </span>
      <strong class="orbit-rail-end">第 {{ plan.finishWeek }} 周</strong>
    </RouterLink>
  </div>
</template>
