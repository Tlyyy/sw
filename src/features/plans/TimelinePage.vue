<script setup lang="ts">
import { computed } from "vue";
import StatStrip from "../../components/StatStrip.vue";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";
import { buildTaskPlans } from "../../domain/plans";
import { buildMainlineProjection } from "../../domain/mainline";
import PlansNav from "./PlansNav.vue";

const catalog = useCatalogStore();
const inventory = useInventoryStore();
const settings = useSettingsStore();
const taskPlans = computed(() => buildTaskPlans(
  catalog.data,
  catalog.pets,
  settings.snapshot(inventory.planningResources, inventory.latestSnapshot?.effectiveDate || null),
));
const projections = computed(() => buildMainlineProjection(taskPlans.value, inventory.snapshots, {
  buyWan: settings.taskSettings.eggPriceWan,
  sellWan: catalog.data.beastConfig.eggSellPriceWan,
}));
const activeCount = computed(() => projections.value.filter((item) => item.requirementKind !== "complete").length);
const dedicatedTotal = computed(() => projections.value.reduce((sum, item) => sum + item.inventory.dedicatedEggs, 0));
const regularTotal = computed(() => projections.value.reduce((sum, item) => sum + item.inventory.regularEggs, 0));
</script>
<template>
  <div class="page-wrap plan-page">
    <PlansNav />
    <section class="page-intro"><div><h2>五号主线概览</h2><p>这不是完成时间轴，而是五条主线在同一时刻的状态快照：当前任务、现有资源和下一步动作全部并排核对。</p></div><RouterLink class="button primary" to="/">返回行动推进台</RouterLink></section>
    <StatStrip :items="[{ value: inventory.latestSnapshot?.effectiveDate || '待录', label: '库存日期', note: inventory.latestSnapshot ? '按实际库存日期计算' : '请先录入统一库存' }, { value: activeCount, label: '推进中的账号', note: `共 ${projections.length} 个账号` }, { value: dedicatedTotal, label: '专用蛋总数', note: '任务优先消耗' }, { value: regularTotal, label: '普通蛋总数', note: '优先留作任务，仅紧急出售' }]" />
    <section class="timeline-section">
      <div class="timeline-ledger">
        <div class="table-head"><span>账号</span><span>状态</span><span>当前任务</span><span>专用 / 普通蛋</span><span>银子 / 万</span><span>内丹碎片</span><span>下一步</span></div>
        <RouterLink v-for="item in projections" :key="item.accountId" :to="`/accounts/${item.accountId}`">
          <b>{{ item.accountId }}</b>
          <span>{{ item.statusLabel }}</span>
          <span>{{ item.currentTask ? `${item.currentTask.typeLabel} · ${item.currentTask.actionLabel}` : '主线已完成' }}</span>
          <span>{{ item.inventory.dedicatedEggs }} / {{ item.inventory.regularEggs }}</span>
          <span>{{ item.inventory.silverWan }}</span>
          <span>{{ item.inventory.innerShardCount ?? "待补录" }}</span>
          <strong>{{ item.actionHint }}</strong>
        </RouterLink>
      </div>
    </section>
  </div>
</template>
