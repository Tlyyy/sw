import { computed } from "vue";
import { storeToRefs } from "pinia";
import { formatWan } from "../../domain/gems";
import { buildMainlineProjection } from "../../domain/mainline";
import { buildTaskPlans, taskDisplayTypeOptions } from "../../domain/plans";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { usePlanningDraftStore } from "../../stores/planningDraft";
import { useSettingsStore } from "../../stores/settings";

export function useBeastsPage() {
  const catalog = useCatalogStore();
  const inventory = useInventoryStore();
  const settings = useSettingsStore();
  const draft = usePlanningDraftStore();
  inventory.hydrate();
  const { beastType: type, beastAccount: account } = storeToRefs(draft);
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
  const availableTaskTypes = computed(() => taskDisplayTypeOptions
    .filter((item) => allTasks.value.some((task) => task.displayTypeKey === item.key)));
  const tasks = computed(() => allTasks.value.filter((task) => (
    (type.value === "ALL" || task.displayTypeKey === type.value)
    && (account.value === "ALL" || task.accountId === account.value)
  )));
  const costByAction = computed(() => catalog.data.beastConfig.taskActionOrder
    .map((action) => ({
      label: action.label,
      value: tasks.value
        .filter((task) => task.actionKey === action.key && !task.done)
        .reduce((sum, task) => sum + task.priceWan, 0),
    }))
    .filter((item) => item.value));

  return {
    catalog,
    inventory,
    account,
    type,
    projections,
    tasks,
    availableTaskTypes,
    costByAction,
    formatWan,
  };
}
