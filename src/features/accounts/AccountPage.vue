<script setup lang="ts">
import { computed, watchEffect } from "vue";
import { useRoute } from "vue-router";
import StatStrip from "../../components/StatStrip.vue";
import PetRow from "../../components/PetRow.vue";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";
import { buildTaskPlans, formatScheduleDueDate, resolvePlanningStartDate, type ScheduledTask } from "../../domain/plans";
import { buildMainlineProjection } from "../../domain/mainline";
import { accountGemPlan, formatCurrency } from "../../domain/gems";
import type { AccountId } from "../../domain/types";

const route = useRoute(); const catalog = useCatalogStore(); const inventory = useInventoryStore(); const settings = useSettingsStore(); const ui = useUiStore();
const accountId = computed(() => String(route.params.accountId || "LG2") as AccountId);
watchEffect(() => { ui.recentAccount = accountId.value; });
const pets = computed(() => catalog.pets.filter((item) => item.accountId === accountId.value));
const equipment = computed(() => catalog.data.equipment.filter((item) => item.accountId === accountId.value));
const inventoryEffectiveDate = computed(() => inventory.latestSnapshot?.effectiveDate || null);
const planningStartDate = computed(() => resolvePlanningStartDate(
  settings.taskSettings.startDate,
  inventoryEffectiveDate.value,
  settings.planningAsOfDate,
));
const taskPlans = computed(() => buildTaskPlans(
  catalog.data,
  catalog.pets,
  settings.snapshot(inventory.planningResources, inventoryEffectiveDate.value),
));
const beastPlan = computed(() => taskPlans.value.find((item) => item.accountId === accountId.value)!);
const projections = computed(() => buildMainlineProjection(taskPlans.value, inventory.snapshots, {
  buyWan: settings.taskSettings.eggPriceWan,
  sellWan: catalog.data.beastConfig.eggSellPriceWan,
}));
const projection = computed(() => projections.value.find((item) => item.accountId === accountId.value)!);
const gemPlan = computed(() => accountGemPlan(catalog.data, accountId.value, settings.gemPriceOverrides));
const topPets = computed(() => [...pets.value].sort((a,b) => (b.talent || 0) - (a.talent || 0) || b.attack - a.attack).slice(0,4));
const visibleTasks = computed(() => [...beastPlan.value.tasks].sort((left, right) => Number(left.done) - Number(right.done)).slice(0, 6));

function taskAmount(task: ScheduledTask) {
  if (task.eggCount) return `${task.eggCount} 蛋`;
  if (task.shardCount) return `${task.shardCount} 内丹碎片`;
  return formatCurrency(task.priceWan * 10_000);
}
function taskState(task: ScheduledTask) {
  if (task.done) return "已完成";
  return task.id === projection.value.currentTask?.id ? "当前" : "后续";
}
function taskDueLabel(task: ScheduledTask) {
  return formatScheduleDueDate(task.dueDate, planningStartDate.value);
}
function mainlineFinishLabel() {
  if (!projection.value.currentTask) return "整条主线已完成";
  const finish = formatScheduleDueDate(projection.value.finishDate, planningStartDate.value);
  return finish.startsWith("预计 ") ? `整条主线${finish}` : `整条主线：${finish}`;
}
</script>

<template>
  <div class="page-wrap account-page">
    <section class="page-intro"><div><h2>{{ accountId }} 账号详情</h2><p>查看这个账号的当前神兽任务、库存和后续资料；排期不会早于今天或库存日期，当前基准为 {{ planningStartDate }}。</p></div><div class="account-switch"><RouterLink v-for="account in catalog.data.accounts" :key="account.id" :to="`/accounts/${account.id}`" :class="{ active: account.id === accountId }">{{ account.id }}</RouterLink></div></section>
    <StatStrip :items="[{value:projection.inventory.dedicatedEggs,label:'专用蛋',note:'任务时优先消耗'},{value:projection.inventory.regularEggs,label:'普通蛋',note:'优先留作任务，仅紧急出售'},{value:`${projection.inventory.silverWan}万`,label:'银子',note:projection.effectiveDate ? `${projection.effectiveDate} 库存` : '待录库存快照'},{value:projection.statusLabel,label:'当前状态',note:projection.actionHint}]" />
    <section class="split-workspace">
      <div><div class="section-head"><div><h2>优先宠物</h2><p>按天资和输出面板优先展示</p></div><RouterLink :to="`/assets/pets?account=${accountId}`">全部宠物 →</RouterLink></div><div class="pet-list"><PetRow v-for="pet in topPets" :key="pet.id" :pet="pet" /></div></div>
      <div><div class="section-head"><div><h2>主线任务与资源</h2><p>{{ projection.actionHint }}</p><small class="account-mainline-finish">{{ mainlineFinishLabel() }}</small></div><RouterLink to="/data/inventory">更新库存 →</RouterLink></div><div class="resource-line"><span>专用蛋 <b>{{ projection.inventory.dedicatedEggs }}</b></span><span>普通蛋 <b>{{ projection.inventory.regularEggs }}</b></span><span>内丹碎片 <b>{{ projection.inventory.innerShardCount ?? "待补录" }}</b></span></div><div class="task-mini-list"><div v-for="task in visibleTasks" :key="task.id"><i :class="{done:task.done}"></i><span class="task-mini-copy"><span>{{ task.typeLabel }} · {{ task.actionLabel }} · {{ taskAmount(task) }}</span><small>{{ taskDueLabel(task) }}</small></span><b>{{ taskState(task) }}</b></div></div></div>
    </section>
    <section><div class="section-head"><div><h2>六件装备 · 次级参考</h2><p>神兽主线后再处理；当前到 13 段测算约 {{ formatCurrency(gemPlan.cost) }} 银币</p></div><RouterLink :to="`/assets/equipment?account=${accountId}`">查看截图与属性 →</RouterLink></div><div class="equipment-strip"><article v-for="item in equipment" :key="item.id"><span>{{ item.slot }}</span><strong>{{ item.name }}</strong><em>{{ item.gem.name }} {{ item.gem.level }}</em></article></div></section>
  </div>
</template>
