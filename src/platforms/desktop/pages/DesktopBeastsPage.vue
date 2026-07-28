<script setup lang="ts">
import CostChart from "../../../components/CostChart.vue";
import PlansNav from "../../../features/plans/PlansNav.vue";
import { useBeastsPage } from "../../../features/plans/useBeastsPage";

const page = useBeastsPage();
</script>

<template>
  <div class="page-wrap plan-page desktop-beasts-page" data-platform-page="desktop">
    <PlansNav />
    <section class="page-intro"><div><h2>神兽主线任务</h2><p>神兽青蛇和神兽龙马（小马）先完成内丹前置（如需）→ 洗护符（如需）→ 打书，再按饰品 → 进阶1 → 进阶2 → 皮肤推进；小马最后另做马强化，普通宠不进入此任务表。</p></div><RouterLink class="button primary" to="/plans/tasks">维护任务状态</RouterLink></section>
    <section class="resource-section"><div class="section-head"><div><h2>五号当前资源与动作</h2><p>{{ page.inventory.latestSnapshot ? `库存属于 ${page.inventory.latestSnapshot.effectiveDate}` : "尚无库存快照，请先录入统一库存" }} · <span>优先留作任务，仅紧急出售</span></p></div><RouterLink to="/data/inventory">录入五号库存 →</RouterLink></div><div class="resource-table readonly-resource-table"><div class="table-head"><span>账号</span><span>专用蛋</span><span>普通蛋</span><span>银子 / 万</span><span>内丹碎片</span><span>当前状态</span></div><div v-for="item in page.projections.value" :key="item.accountId"><b><RouterLink :to="`/accounts/${item.accountId}`">{{ item.accountId }}</RouterLink></b><span>{{ item.inventory.dedicatedEggs }}</span><span>{{ item.inventory.regularEggs }}</span><span>{{ item.inventory.silverWan }}</span><span>{{ item.inventory.innerShardCount ?? "待补录" }}</span><strong>{{ item.statusLabel }}</strong></div></div></section>
    <section class="beast-workspace"><div><div class="section-head"><div><h2>任务明细</h2><p>默认展示五号全部任务，可按账号或神兽用途缩小范围</p></div><div class="inline-filters"><select v-model="page.account.value" aria-label="神兽任务账号筛选"><option value="ALL">全部账号</option><option v-for="item in page.catalog.data.accounts" :key="item.id" :value="item.id">{{ item.id }}</option></select><select v-model="page.type.value" aria-label="神兽任务用途筛选"><option value="ALL">全部用途</option><option v-for="item in page.availableTaskTypes.value" :key="item.key" :value="item.key">{{ item.label }}</option></select></div></div><div class="task-list readonly-task-list"><article v-for="task in page.tasks.value" :key="task.id" :class="{ done: task.done }"><i :class="{ done: task.done }"></i><span><b>{{ task.accountId }} · {{ task.typeLabel }}</b><em>{{ task.actionLabel }} · {{ task.kind }}</em></span><span>{{ task.eggCount ? `${task.eggCount} 蛋` : task.resourceType === "innerShard" ? "内丹碎片任务" : page.formatWan(task.priceWan) }}</span><strong>{{ task.done ? "已完成" : task.shardCount ? `${task.shardCount}片` : task.eggCount ? `${task.eggCount}蛋` : page.formatWan(task.priceWan) }}</strong><small>{{ task.done ? "已处理" : "待处理" }}</small></article></div></div><aside><div class="section-head"><div><h2>成本拆分</h2><p>当前筛选的未完成任务</p></div></div><CostChart :labels="page.costByAction.value.map((item) => item.label)" :values="page.costByAction.value.map((item) => item.value)" /></aside></section>
  </div>
</template>
