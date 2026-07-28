import { computed, watchEffect } from "vue";
import { useRoute } from "vue-router";
import { buildMainlineProjection } from "../../domain/mainline";
import { accountGemPlan, formatCurrency } from "../../domain/gems";
import {
  buildTaskPlans,
  formatScheduleDueDate,
  resolvePlanningStartDate,
  type ScheduledTask,
} from "../../domain/plans";
import type { AccountId } from "../../domain/types";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";

export function useAccountPage() {
  const route = useRoute();
  const catalog = useCatalogStore();
  const inventory = useInventoryStore();
  const settings = useSettingsStore();
  const ui = useUiStore();
  const accountId = computed(() => String(route.params.accountId || "LG2") as AccountId);

  watchEffect(() => {
    ui.recentAccount = accountId.value;
  });

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
  const topPets = computed(() => [...pets.value]
    .sort((left, right) => (right.talent || 0) - (left.talent || 0) || right.attack - left.attack)
    .slice(0, 4));
  const visibleTasks = computed(() => [...beastPlan.value.tasks]
    .sort((left, right) => Number(left.done) - Number(right.done))
    .slice(0, 6));

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

  return {
    catalog,
    accountId,
    planningStartDate,
    projection,
    gemPlan,
    topPets,
    equipment,
    visibleTasks,
    taskAmount,
    taskState,
    taskDueLabel,
    mainlineFinishLabel,
    formatCurrency,
  };
}
