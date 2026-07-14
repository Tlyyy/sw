<script setup lang="ts">
import { computed, ref } from "vue";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";
import { buildTaskPlans, taskDisplayTypeOptions } from "../../domain/plans";
import { formatWan } from "../../domain/gems";

const catalog = useCatalogStore();
const inventory = useInventoryStore();
const settings = useSettingsStore();
const account = ref("ALL");
const taskType = ref("ALL");

inventory.hydrate();

const taskPlans = computed(() => buildTaskPlans(
  catalog.data,
  catalog.pets,
  settings.snapshot(inventory.planningResources, inventory.latestSnapshot?.effectiveDate || null),
));
const allTasks = computed(() => taskPlans.value.flatMap((plan) => plan.tasks));
const availableTaskTypes = computed(() => taskDisplayTypeOptions.filter((item) => allTasks.value.some((task) => task.displayTypeKey === item.key)));
const tasks = computed(() => allTasks.value.filter((task) =>
  (account.value === "ALL" || task.accountId === account.value)
  && (taskType.value === "ALL" || task.displayTypeKey === taskType.value),
));
const pendingTasks = computed(() => tasks.value.filter((task) => !task.done));

function confirmReset(message: string, action: () => void) {
  if (confirm(message)) action();
}
</script>

<template>
  <section class="page-intro">
    <div><h2>神兽任务维护</h2><p>半成品神兽先完成内丹前置（如需）→ 洗护符（如需）→ 打书；之后神兽青蛇和神兽龙马（小马）按饰品 → 进阶1 → 进阶2 → 皮肤推进，小马最后另做马强化。普通宠不进入此任务表，完成状态和单项价格统一在这里修改。</p></div>
    <button class="button" @click="confirmReset('确认清除全部任务完成状态和价格覆盖？', settings.resetTaskOverrides)">恢复任务状态</button>
  </section>
  <section class="task-maintenance-summary">
    <div><strong>{{ pendingTasks.length }}</strong><span>当前筛选未完成</span></div>
    <div><strong>{{ tasks.length }}</strong><span>当前筛选任务</span></div>
    <div><strong>{{ Object.keys(settings.taskOverrides).length }}</strong><span>本地任务修改</span></div>
    <div class="inline-filters"><select v-model="account"><option value="ALL">全部账号</option><option v-for="item in catalog.data.accounts" :key="item.id">{{ item.id }}</option></select><select v-model="taskType"><option value="ALL">全部用途</option><option v-for="item in availableTaskTypes" :key="item.key" :value="item.key">{{ item.label }}</option></select></div>
  </section>
  <div class="task-list data-task-list">
    <label v-for="task in tasks" :key="task.id" :class="{ done: task.done }">
      <input type="checkbox" :checked="task.done" :aria-label="`${task.accountId}${task.typeLabel}${task.actionLabel}完成状态`" @change="settings.setTaskDone(task.id, ($event.target as HTMLInputElement).checked)" />
      <span><b>{{ task.accountId }} · {{ task.typeLabel }}</b><em>{{ task.actionLabel }} · {{ task.kind }}</em></span>
      <input v-if="task.resourceType === 'wan'" type="number" :value="task.priceWan" :aria-label="`${task.accountId}${task.actionLabel}价格`" @change="settings.setTaskPrice(task.id, Number(($event.target as HTMLInputElement).value))" />
      <span v-else>内丹碎片任务</span>
      <strong>{{ task.done ? "已完成" : task.resourceType === "innerShard" ? `${task.shardCount}片` : formatWan(task.priceWan) }}</strong>
      <small>{{ task.dueDate }}</small>
    </label>
  </div>
</template>
