<script setup lang="ts">
import { computed, ref, watch } from "vue";
import StatStrip from "../../components/StatStrip.vue";
import CostChart from "../../components/CostChart.vue";
import { useCatalogStore } from "../../stores/catalog";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";
import { buildTaskPlans } from "../../domain/plans";
import { formatWan } from "../../domain/gems";

const catalog = useCatalogStore();
const settings = useSettingsStore();
const ui = useUiStore();
const type = ref("ALL");
const account = ref(ui.accountScope);
watch(() => ui.accountScope, (scope) => { account.value = scope; });
const taskPlans = computed(() => buildTaskPlans(catalog.data, catalog.pets, settings.snapshot()));
const tasks = computed(() => taskPlans.value.flatMap((plan) => plan.tasks).filter((task) => (type.value === "ALL" || task.typeKey === type.value) && (account.value === "ALL" || task.accountId === account.value)));
const costByAction = computed(() => catalog.data.beastConfig.taskActionOrder.map((action) => ({ label: action.label, value: tasks.value.filter((task) => task.actionKey === action.key && !task.done).reduce((sum, task) => sum + task.priceWan, 0) })).filter((item) => item.value));
const overallFinish = computed(() => [...taskPlans.value].sort((left, right) => String(right.finishDate).localeCompare(String(left.finishDate)))[0]);
</script>

<template>
  <div class="page-wrap plan-page">
    <nav class="subnav"><RouterLink to="/plans/upgrades">升级计划</RouterLink><RouterLink to="/plans/beasts">神兽计划</RouterLink><RouterLink to="/plans/timeline">联合时间轴</RouterLink></nav>
    <section class="page-intro"><div><h2>神兽任务计划</h2><p>本页只查看成本、排期和完成状态；库存、参数和任务统一在数据中心维护。</p></div><RouterLink class="button primary" to="/data/tasks">维护神兽数据</RouterLink></section>
    <StatStrip :items="[{ value: `${catalog.beastSummary.confirmedWan}万`, label: '确认差价', note: `${catalog.beastSummary.eggs} 个神兽蛋` }, { value: `${catalog.beastSummary.estimatedWan}万`, label: '不确认预估', note: '打书 + 洗护符' }, { value: `${tasks.filter((task) => !task.done).length}`, label: '未完成任务', note: `共 ${tasks.length} 项` }, { value: overallFinish?.finishDate || '-', label: '全部预计完成', note: '按数据中心库存和产出' }]" />
    <section class="settings-band readonly-settings-band"><div class="section-head"><div><h2>当前排期参数</h2><p>只读 · 来自数据中心</p></div><RouterLink to="/data/resources">前往维护 →</RouterLink></div><article><span>起算日期</span><strong>{{ settings.taskSettings.startDate }}</strong></article><article><span>本周拿蛋</span><strong>{{ settings.taskSettings.thisWeekEggs }}</strong></article><article><span>每周拿蛋</span><strong>{{ settings.taskSettings.weeklyEggs }}</strong></article><article><span>本周锁片</span><strong>{{ settings.taskSettings.thisWeekInnerShards }}</strong></article><article><span>每周锁片</span><strong>{{ settings.taskSettings.weeklyInnerShards }}</strong></article><article><span>蛋价 / 万</span><strong>{{ settings.taskSettings.eggPriceWan }}</strong></article></section>
    <section class="resource-section"><div class="section-head"><div><h2>当前资源</h2><p>只读 · 银子与神兽蛋折算为资金，锁片独立计算</p></div><RouterLink to="/data/resources">维护资源 →</RouterLink></div><div class="resource-table readonly-resource-table"><div class="table-head"><span>账号</span><span>银子 / 万</span><span>神兽蛋</span><span>内丹锁片</span><span>预计完成</span></div><div v-for="plan in taskPlans" :key="plan.accountId"><b>{{ plan.accountId }}</b><span>{{ plan.resource.silverWan }}</span><span>{{ plan.resource.eggCount }}</span><span>{{ plan.resource.innerShardCount }}</span><strong>{{ plan.finishDate }}</strong></div></div></section>
    <section class="beast-workspace"><div><div class="section-head"><div><h2>账号任务</h2><p>只读 · 完成状态和价格来自数据中心</p></div><div class="inline-filters"><select v-model="account"><option value="ALL">全部账号</option><option v-for="item in catalog.data.accounts" :key="item.id">{{ item.id }}</option></select><select v-model="type"><option value="ALL">全部类型</option><option value="snake1">1蛇</option><option value="snake2">2蛇</option><option value="horse">马</option></select></div></div><div class="task-list readonly-task-list"><article v-for="task in tasks" :key="task.id" :class="{ done: task.done }"><i :class="{ done: task.done }"></i><span><b>{{ task.accountId }} · {{ task.typeLabel }}</b><em>{{ task.actionLabel }} · {{ task.kind }}</em></span><span>{{ task.resourceType === "innerShard" ? "锁片任务" : formatWan(task.priceWan) }}</span><strong>{{ task.done ? "已完成" : task.resourceType === "innerShard" ? `${task.shardCount}片` : formatWan(task.priceWan) }}</strong><small>{{ task.dueDate }}</small></article></div></div><aside><div class="section-head"><div><h2>成本拆分</h2><p>当前筛选的未完成任务</p></div></div><CostChart :labels="costByAction.map((item) => item.label)" :values="costByAction.map((item) => item.value)" /></aside></section>
  </div>
</template>
