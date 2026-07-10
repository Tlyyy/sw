import type { Catalog, EquipmentAsset, GemMarketItem } from "./types";

export const defaultWeeklyIncome = 880_000;
export const targetLevel = "13";
export const formatNumber = (value: number) => Number(value || 0).toLocaleString("zh-CN");
export const formatWan = (value: number) => `${Number.isInteger(value) ? value : value.toFixed(1)}万`;
export function formatCurrency(value: number) {
  if (value >= 100_000_000) return `${Number((value / 100_000_000).toFixed(2))}亿`;
  if (value >= 10_000) return `${Number((value / 10_000).toFixed(1))}万`;
  return formatNumber(value);
}

export function marketItems(catalog: Catalog, overrides: Record<string, number>): Array<GemMarketItem & { basePrice: number; edited: boolean }> {
  const raw = catalog.gemMarketSnapshots.at(-1)?.items || [];
  return raw.map((item) => ({ ...item, basePrice: item.price, price: Number.isFinite(overrides[item.name]) ? overrides[item.name] : item.price, edited: Number.isFinite(overrides[item.name]) && overrides[item.name] !== item.price }));
}

export function baseTotal(catalog: Catalog, level: string) {
  if (!level || level === "0") return 0;
  return catalog.gemUpgradeSteps.find((step) => step.to === level)?.total || 0;
}

export function itemTotal(catalog: Catalog, item: EquipmentAsset) {
  return baseTotal(catalog, item.gem.level) + Number(item.gem.progress?.current || 0);
}
export function itemTargetGap(catalog: Catalog, item: EquipmentAsset) { return Math.max(0, baseTotal(catalog, targetLevel) - itemTotal(catalog, item)); }
export function itemTargetCost(catalog: Catalog, item: EquipmentAsset, overrides: Record<string, number>) {
  const market = marketItems(catalog, overrides).find((entry) => entry.name === item.gem.name);
  return itemTargetGap(catalog, item) * Number(market?.price || 0);
}
export function accountGemPlan(catalog: Catalog, accountId: string, overrides: Record<string, number>) {
  const items = catalog.equipment.filter((item) => item.accountId === accountId);
  return {
    items,
    gap: items.reduce((sum, item) => sum + itemTargetGap(catalog, item), 0),
    cost: items.reduce((sum, item) => sum + itemTargetCost(catalog, item, overrides), 0),
  };
}
