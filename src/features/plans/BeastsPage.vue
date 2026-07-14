<script setup lang="ts">
import { computed, ref } from "vue";
import StatStrip from "../../components/StatStrip.vue";
import CostChart from "../../components/CostChart.vue";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";
import { buildTaskPlans, taskDisplayTypeOptions } from "../../domain/plans";
import { buildMainlineProjection } from "../../domain/mainline";
import { formatWan } from "../../domain/gems";

const catalog = useCatalogStore();
const inventory = useInventoryStore();
const settings = useSettingsStore();
const type = ref("ALL");
const account = ref("ALL");
const taskPlans = computed(() => buildTaskPlans(
  catalog.data,
  catalog.pets,
  settings.snapshot(inventory.planningResources, inventory.latestSnapshot?.effectiveDate || null),
));
const projections = computed(() => buildMainlineProjection(taskPlans.value, inventory.snapshots, {
  buyWan: settings.taskSettings.eggPriceWan,
  sellWan: catalog.data.beastConfig.eggSellPriceWan,
}));
const allTasks = computed(() => taskPlans.value.flatMap((plan) => plan.tasks));
const availableTaskTypes = computed(() => taskDisplayTypeOptions.filter((item) => allTasks.value.some((task) => task.displayTypeKey === item.key)));
const tasks = computed(() => allTasks.value.filter((task) => (type.value === "ALL" || task.displayTypeKey === type.value) && (account.value === "ALL" || task.accountId === account.value)));
const costByAction = computed(() => catalog.data.beastConfig.taskActionOrder.map((action) => ({ label: action.label, value: tasks.value.filter((task) => task.actionKey === action.key && !task.done).reduce((sum, task) => sum + task.priceWan, 0) })).filter((item) => item.value));
const dedicatedTotal = computed(() => projections.value.reduce((sum, item) => sum + item.inventory.dedicatedEggs, 0));
const regularTotal = computed(() => projections.value.reduce((sum, item) => sum + item.inventory.regularEggs, 0));
const blockedCount = computed(() => projections.value.filter((item) => item.status === "blocked" || item.status === "caution" || item.status === "stale").length);
const pendingTaskCount = computed(() => allTasks.value.filter((task) => !task.done).length);
</script>

<template>
  <div class="page-wrap plan-page">
    <nav class="subnav"><RouterLink to="/plans/beasts">神兽主线</RouterLink><RouterLink to="/plans/timeline">五号概览</RouterLink><RouterLink to="/plans/upgrades">宝石参考</RouterLink></nav>
    <section class="page-intro"><div><h2>神兽主线任务</h2><p>神兽青蛇和神兽龙马（小马）先完成内丹前置（如需）→ 洗护符（如需）→ 打书，再按饰品 → 进阶1 → 进阶2 → 皮肤推进；小马最后另做马强化，普通宠不进入此任务表。</p></div><RouterLink class="button primary" to="/data/tasks">维护任务状态</RouterLink></section>
    <StatStrip :items="[{ value: inventory.latestSnapshot?.effectiveDate || '待录', label: '库存日期', note: inventory.latestSnapshot ? '五号同批快照' : '请先录入统一库存' }, { value: dedicatedTotal, label: '专用蛋', note: '完成任务时优先消耗' }, { value: regularTotal, label: '普通蛋', note: '优先留作任务，仅紧急出售' }, { value: pendingTaskCount, label: '未完成任务', note: blockedCount ? `${blockedCount} 个账号需补资源或库存` : '五号均有可推进动作' }]" />
    <section class="resource-section"><div class="section-head"><div><h2>五号当前资源与动作</h2><p>{{ inventory.latestSnapshot ? `库存属于 ${inventory.latestSnapshot.effectiveDate}` : '尚无库存快照，请先录入统一库存' }}</p></div><RouterLink to="/data/inventory">录入五号库存 →</RouterLink></div><div class="resource-table readonly-resource-table"><div class="table-head"><span>账号</span><span>专用蛋</span><span>普通蛋</span><span>银子 / 万</span><span>内丹碎片</span><span>当前状态</span></div><div v-for="item in projections" :key="item.accountId"><b><RouterLink :to="`/accounts/${item.accountId}`">{{ item.accountId }}</RouterLink></b><span>{{ item.inventory.dedicatedEggs }}</span><span>{{ item.inventory.regularEggs }}</span><span>{{ item.inventory.silverWan }}</span><span>{{ item.inventory.innerShardCount ?? "待补录" }}</span><strong>{{ item.statusLabel }}</strong></div></div></section>
    <section class="beast-workspace"><div><div class="section-head"><div><h2>任务明细</h2><p>默认展示五号全部任务，可按账号或神兽用途缩小范围</p></div><div class="inline-filters"><select v-model="account"><option value="ALL">全部账号</option><option v-for="item in catalog.data.accounts" :key="item.id">{{ item.id }}</option></select><select v-model="type"><option value="ALL">全部用途</option><option v-for="item in availableTaskTypes" :key="item.key" :value="item.key">{{ item.label }}</option></select></div></div><div class="task-list readonly-task-list"><article v-for="task in tasks" :key="task.id" :class="{ done: task.done }"><i :class="{ done: task.done }"></i><span><b>{{ task.accountId }} · {{ task.typeLabel }}</b><em>{{ task.actionLabel }} · {{ task.kind }}</em></span><span>{{ task.eggCount ? `${task.eggCount} 蛋` : task.resourceType === "innerShard" ? "内丹碎片任务" : formatWan(task.priceWan) }}</span><strong>{{ task.done ? "已完成" : task.shardCount ? `${task.shardCount}片` : task.eggCount ? `${task.eggCount}蛋` : formatWan(task.priceWan) }}</strong><small>{{ task.done ? '已处理' : '待处理' }}</small></article></div></div><aside><div class="section-head"><div><h2>成本拆分</h2><p>当前筛选的未完成任务</p></div></div><CostChart :labels="costByAction.map((item) => item.label)" :values="costByAction.map((item) => item.value)" /></aside></section>
  </div>
</template>
