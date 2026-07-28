import { computed } from "vue";
import { storeToRefs } from "pinia";
import { formatWan } from "../../domain/gems";
import { buildTaskPlans, taskDisplayTypeOptions } from "../../domain/plans";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import {
  usePlanningDraftStore,
  type PlanningNumericField,
} from "../../stores/planningDraft";
import { useSettingsStore } from "../../stores/settings";

export function usePlanParametersPage() {
  const catalog = useCatalogStore();
  const inventory = useInventoryStore();
  const settings = useSettingsStore();
  const draft = usePlanningDraftStore();
  const eggSellPriceWan = catalog.data.beastConfig.eggSellPriceWan;
  inventory.hydrate();
  draft.initialize(settings.taskSettings);
  const {
    startDate,
    priceAccount: account,
    priceTaskType: taskType,
    priceQuery: query,
  } = storeToRefs(draft);
  const taskPlans = computed(() => buildTaskPlans(
    catalog.data,
    catalog.pets,
    settings.snapshot(inventory.planningResources, inventory.latestSnapshot?.effectiveDate || null),
  ));
  const allTasks = computed(() => taskPlans.value.flatMap((plan) => plan.tasks));
  const priceTasks = computed(() => allTasks.value.filter((task) => task.resourceType === "wan"));
  const availableTaskTypes = computed(() => taskDisplayTypeOptions
    .filter((item) => priceTasks.value.some((task) => task.displayTypeKey === item.key)));
  const visiblePriceTasks = computed(() => {
    const keyword = query.value.trim().toLowerCase();
    return priceTasks.value.filter((task) => (
      (account.value === "ALL" || task.accountId === account.value)
      && (taskType.value === "ALL" || task.displayTypeKey === taskType.value)
      && (!keyword || [task.accountId, task.typeLabel, task.actionLabel, task.kind]
        .join(" ").toLowerCase().includes(keyword))
    ));
  });
  const priceOverrideCount = computed(() => Object.values(settings.taskOverrides)
    .filter((item) => item.priceWan !== undefined).length);
  const eggRoundTripLossWan = computed(() => Math.max(0, settings.taskSettings.eggPriceWan - eggSellPriceWan));

  function setNumericDraft(field: PlanningNumericField, event: Event) {
    draft.numeric[field] = (event.target as HTMLInputElement).value;
  }
  function saveNumericSetting(field: PlanningNumericField) {
    settings.setTaskSetting(field, Number(draft.numeric[field]));
    draft.numeric[field] = String(settings.taskSettings[field]);
  }
  function saveStartDate() {
    settings.setTaskSetting("startDate", startDate.value);
    startDate.value = settings.taskSettings.startDate;
  }
  function taskPriceValue(taskId: string, currentValue: number) {
    return draft.taskPriceValue(taskId, currentValue);
  }
  function setTaskPriceDraft(taskId: string, event: Event) {
    draft.taskPriceDrafts[taskId] = (event.target as HTMLInputElement).value;
  }
  function saveTaskPrice(taskId: string, currentValue: number) {
    settings.setTaskPrice(taskId, Number(draft.taskPriceValue(taskId, currentValue)));
    draft.clearTaskPrice(taskId);
  }
  function clearPriceFilters() {
    account.value = "ALL";
    taskType.value = "ALL";
    query.value = "";
  }
  function resetPlanningSettings() {
    if (!confirm("确认恢复默认排期与资源参数？任务完成状态和单项价格不会改变。")) return;
    settings.resetTaskSettings();
    draft.syncSettings(settings.taskSettings);
  }
  function resetTaskPrices() {
    if (!confirm("确认清除全部单项价格覆盖？任务完成状态和排期参数不会改变。")) return;
    settings.resetTaskPriceOverrides();
    draft.clearTaskPrice();
  }
  function resetTaskPrice(taskId: string) {
    settings.resetTaskPrice(taskId);
    draft.clearTaskPrice(taskId);
  }

  return {
    catalog,
    settings,
    draft,
    startDate,
    account,
    taskType,
    query,
    eggSellPriceWan,
    visiblePriceTasks,
    availableTaskTypes,
    priceOverrideCount,
    eggRoundTripLossWan,
    setNumericDraft,
    saveNumericSetting,
    saveStartDate,
    taskPriceValue,
    setTaskPriceDraft,
    saveTaskPrice,
    clearPriceFilters,
    resetPlanningSettings,
    resetTaskPrices,
    resetTaskPrice,
    formatWan,
  };
}
