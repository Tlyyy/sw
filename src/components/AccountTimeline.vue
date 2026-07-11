<script setup lang="ts">
import { computed } from "vue";
import type { AccountId, AccountPlan } from "../domain/types";
import { formatCurrency } from "../domain/gems";

const props = defineProps<{ plans: AccountPlan[]; selected?: string; startDate: string }>();
const tones: Record<AccountId, string> = {
  FC: "#2b70ba",
  LG1: "#7d53b5",
  LG2: "#ed7410",
  PT: "#dc4337",
  MYT: "#2f8b59",
};
const maxWeek = computed(() => Math.max(...props.plans.map((item) => item.finishWeek), 1));
function weekPosition(week: number) {
  return Math.min(100, Math.max(0, (week / maxWeek.value) * 100));
}
const guideWeeks = computed(() => [...new Set([
  0,
  Math.round(maxWeek.value / 4),
  Math.round(maxWeek.value / 2),
  Math.round((maxWeek.value * 3) / 4),
  maxWeek.value,
])].sort((a, b) => a - b));

function dateAfterWeeks(weeks: number) {
  const [year, month, day] = props.startDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date;
}

function fullDate(weeks: number) {
  const date = dateAfterWeeks(weeks);
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}

function axisDate(weeks: number) {
  const date = dateAfterWeeks(weeks);
  const startYear = dateAfterWeeks(0).getUTCFullYear();
  const dateText = date.getUTCFullYear() === startYear
    ? `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`
    : `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
  return weeks === 0 ? `${dateText}起` : `约 ${dateText}`;
}

function milestones(plan: AccountPlan) {
  return guideWeeks.value.filter((week) => week > 0 && week < plan.finishWeek);
}

function rowStyle(plan: AccountPlan) {
  return {
    "--rail-end": `${weekPosition(plan.finishWeek)}%`,
    "--account-tone": tones[plan.accountId],
  };
}
</script>

<template>
  <div class="orbit-timeline-explainer">
    <span><b>起算日</b>{{ fullDate(0) }}</span>
    <span>横轴直接显示<strong>预计日期</strong>，周数仅作耗时参考</span>
  </div>
  <div class="orbit-timeline" aria-label="五账号预计剩余完成时间">
    <div class="orbit-axis" aria-hidden="true">
      <span v-for="week in guideWeeks" :key="week" :style="{ left: `${weekPosition(week)}%` }">
        <b>{{ axisDate(week) }}</b><small>{{ week === 0 ? "起算" : `${week} 周后` }}</small>
      </span>
    </div>
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
        <i v-for="week in milestones(plan)" :key="week" class="orbit-rail-node" :style="{ left: `${weekPosition(week)}%` }"></i>
      </span>
      <strong class="orbit-rail-end"><b>约 {{ fullDate(plan.finishWeek) }}</b><small>还需 {{ plan.finishWeek }} 周</small></strong>
    </RouterLink>
  </div>
</template>
