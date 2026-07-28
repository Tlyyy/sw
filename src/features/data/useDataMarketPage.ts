import { computed, ref } from "vue";
import { buildGemPriceTrend } from "../../domain/gemPriceHistory";
import { marketItems } from "../../domain/gems";
import { useCatalogStore } from "../../stores/catalog";
import { usePlanningDraftStore } from "../../stores/planningDraft";
import { useSettingsStore } from "../../stores/settings";

export function useDataMarketPage() {
  const catalog = useCatalogStore();
  const settings = useSettingsStore();
  const draft = usePlanningDraftStore();
  const recordNotice = ref("");
  const market = computed(() => marketItems(catalog.data, settings.gemPriceOverrides));
  const baseMarketSnapshot = computed(() => catalog.data.gemMarketSnapshots.at(-1)!);
  const marketNames = computed(() => baseMarketSnapshot.value.items.map((item) => item.name));
  const priceTrend = computed(() => buildGemPriceTrend(baseMarketSnapshot.value, settings.gemPriceHistory));

  function applyRecognizedPrices(prices: Array<{ name: string; price: number }>) {
    const recorded = settings.recordGemPrices("screenshot", prices);
    if (recorded) {
      prices.forEach((item) => settings.setGemPrice(item.name, item.price));
      draft.clearMarketPrices();
    }
    recordNotice.value = recorded
      ? "截图价格已应用并记入行情历史"
      : "应用失败：请确认六项价格均为大于 0 的有效数字";
  }
  function recordCurrentPrices() {
    const candidate = market.value.map(({ name, price }) => ({
      name,
      price: draft.marketPriceDrafts[name] === undefined
        ? price
        : Number(draft.marketPriceDrafts[name]),
    }));
    const recorded = settings.recordGemPrices("manual", candidate);
    if (recorded) {
      candidate.forEach((item) => settings.setGemPrice(item.name, item.price));
      draft.clearMarketPrices();
    }
    recordNotice.value = recorded
      ? "当前六项价格已记录"
      : "记录失败：六项价格必须都是大于 0 的有效数字";
  }
  function resetGemPrices() {
    settings.resetGemPrices();
    draft.clearMarketPrices();
    recordNotice.value = "已恢复六项截图基准价";
  }
  function formatHistoryTime(value: string) {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
  }
  function confirmReset() {
    if (confirm("确认恢复六项宝石的截图基准价？")) resetGemPrices();
  }

  return {
    catalog,
    settings,
    draft,
    recordNotice,
    market,
    baseMarketSnapshot,
    marketNames,
    priceTrend,
    applyRecognizedPrices,
    recordCurrentPrices,
    resetGemPrices,
    formatHistoryTime,
    confirmReset,
  };
}
