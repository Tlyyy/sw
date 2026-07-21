import type { AccountId, Catalog, EquipmentAsset, GemMarketItem, GemPlanSettings } from "./types";

export const defaultWeeklyIncome = 880_000;
export const targetLevel = "13";
export const defaultGemPlanSettings = { targetLevel, weeklyIncomeWan: defaultWeeklyIncome / 10_000 } satisfies GemPlanSettings;
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
export function itemTargetGap(catalog: Catalog, item: EquipmentAsset, target = targetLevel) {
  return Math.max(0, baseTotal(catalog, target) - itemTotal(catalog, item));
}
export function itemTargetCost(catalog: Catalog, item: EquipmentAsset, overrides: Record<string, number>, target = targetLevel) {
  const market = marketItems(catalog, overrides).find((entry) => entry.name === item.gem.name);
  return itemTargetGap(catalog, item, target) * Number(market?.price || 0);
}
export function accountGemPlan(catalog: Catalog, accountId: string, overrides: Record<string, number>, target = targetLevel) {
  const items = catalog.equipment.filter((item) => item.accountId === accountId);
  return {
    items,
    gap: items.reduce((sum, item) => sum + itemTargetGap(catalog, item, target), 0),
    cost: items.reduce((sum, item) => sum + itemTargetCost(catalog, item, overrides, target), 0),
  };
}

export function formatGemLevel(level: string) {
  const match = /^(\d+)(.*)$/.exec(level);
  return match ? `${match[1]} 段${match[2]}` : level;
}

export function gemPlanTargetLevels(catalog: Catalog) {
  return catalog.gemUpgradeSteps
    .map((step) => step.to)
    .filter((level) => Number.parseInt(level, 10) >= 9);
}

export interface GemEquipmentProjection {
  item: EquipmentAsset;
  currentTotal: number;
  targetTotal: number;
  gap: number;
  cost: number;
  completion: number;
}

export interface GemAccountProjection {
  accountId: AccountId;
  items: GemEquipmentProjection[];
  gap: number;
  cost: number;
  completion: number;
  weeks: number | null;
  finishDate: string | null;
}

export interface GemPlanProjection {
  targetLevel: string;
  weeklyIncomeWan: number;
  startDate: string;
  accounts: GemAccountProjection[];
  totalGap: number;
  totalCost: number;
  longestWeeks: number | null;
  finishDate: string | null;
}

function addWeeks(dateKey: string, weeks: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return dateKey;
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

export function buildGemPlanProjection(
  catalog: Catalog,
  overrides: Record<string, number>,
  requestedTarget: string,
  requestedWeeklyIncomeWan: number,
  startDate: string,
): GemPlanProjection {
  const target = gemPlanTargetLevels(catalog).includes(requestedTarget) ? requestedTarget : targetLevel;
  const requestedIncome = Number(requestedWeeklyIncomeWan);
  const weeklyIncomeWan = Number.isFinite(requestedIncome) ? Math.max(0, requestedIncome) : 0;
  const weeklyIncomeSilver = weeklyIncomeWan * 10_000;
  const targetTotal = baseTotal(catalog, target);
  const accounts = catalog.accounts.map((account) => {
    const items = catalog.equipment
      .filter((item) => item.accountId === account.id)
      .map((item) => {
        const currentTotal = itemTotal(catalog, item);
        const gap = itemTargetGap(catalog, item, target);
        return {
          item,
          currentTotal,
          targetTotal,
          gap,
          cost: itemTargetCost(catalog, item, overrides, target),
          completion: targetTotal ? Math.min(100, currentTotal / targetTotal * 100) : 100,
        };
      });
    const gap = items.reduce((sum, item) => sum + item.gap, 0);
    const cost = items.reduce((sum, item) => sum + item.cost, 0);
    const achieved = items.reduce((sum, item) => sum + Math.min(item.currentTotal, targetTotal), 0);
    const total = targetTotal * items.length;
    const weeks = cost === 0 ? 0 : weeklyIncomeSilver > 0 ? Math.ceil(cost / weeklyIncomeSilver) : null;
    return {
      accountId: account.id,
      items,
      gap,
      cost,
      completion: total ? achieved / total * 100 : 100,
      weeks,
      finishDate: weeks === null ? null : addWeeks(startDate, weeks),
    } satisfies GemAccountProjection;
  });
  const hasUnscheduledAccount = accounts.some((account) => account.weeks === null);
  const longestWeeks = hasUnscheduledAccount ? null : Math.max(0, ...accounts.map((account) => account.weeks || 0));
  return {
    targetLevel: target,
    weeklyIncomeWan,
    startDate,
    accounts,
    totalGap: accounts.reduce((sum, account) => sum + account.gap, 0),
    totalCost: accounts.reduce((sum, account) => sum + account.cost, 0),
    longestWeeks,
    finishDate: longestWeeks === null ? null : addWeeks(startDate, longestWeeks),
  };
}
