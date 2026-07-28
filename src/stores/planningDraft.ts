import { reactive, ref } from "vue";
import { defineStore } from "pinia";

export const planningNumericFields = [
  "weeklyDedicatedEggs",
  "weeklyRegularEggs",
  "weeklySilverWan",
  "thisWeekInnerShards",
  "weeklyInnerShards",
  "eggPriceWan",
] as const;

export type PlanningNumericField = (typeof planningNumericFields)[number];

export interface PlanningDraftSource {
  startDate: string;
  weeklyDedicatedEggs: number;
  weeklyRegularEggs: number;
  weeklySilverWan: number;
  thisWeekInnerShards: number;
  weeklyInnerShards: number;
  eggPriceWan: number;
}

export const usePlanningDraftStore = defineStore("planning-draft", () => {
  const initialized = ref(false);
  const startDate = ref("");
  const numeric = reactive<Record<PlanningNumericField, string>>({
    weeklyDedicatedEggs: "",
    weeklyRegularEggs: "",
    weeklySilverWan: "",
    thisWeekInnerShards: "",
    weeklyInnerShards: "",
    eggPriceWan: "",
  });
  const taskPriceDrafts = reactive<Record<string, string>>({});
  const marketPriceDrafts = reactive<Record<string, string>>({});
  const priceAccount = ref("ALL");
  const priceTaskType = ref("ALL");
  const priceQuery = ref("");
  const gemAccount = ref("");
  const beastAccount = ref("ALL");
  const beastType = ref("ALL");

  function syncSettings(source: PlanningDraftSource) {
    startDate.value = source.startDate;
    planningNumericFields.forEach((field) => {
      numeric[field] = String(source[field]);
    });
    initialized.value = true;
  }

  function initialize(source: PlanningDraftSource) {
    if (!initialized.value) syncSettings(source);
  }

  function taskPriceValue(taskId: string, currentValue: number) {
    return taskPriceDrafts[taskId] ?? String(currentValue);
  }

  function clearTaskPrice(taskId?: string) {
    if (taskId) {
      delete taskPriceDrafts[taskId];
      return;
    }
    Object.keys(taskPriceDrafts).forEach((id) => delete taskPriceDrafts[id]);
  }

  function clearMarketPrices() {
    Object.keys(marketPriceDrafts).forEach((name) => delete marketPriceDrafts[name]);
  }

  return {
    initialized,
    startDate,
    numeric,
    taskPriceDrafts,
    marketPriceDrafts,
    priceAccount,
    priceTaskType,
    priceQuery,
    gemAccount,
    beastAccount,
    beastType,
    initialize,
    syncSettings,
    taskPriceValue,
    clearTaskPrice,
    clearMarketPrices,
  };
});
