import type { AccountId, AccountPlan, BeastResource, BeastTaskSettings, Catalog, PetView } from "./types";
import { accountGemPlan, defaultWeeklyIncome } from "./gems";

export interface TaskOverride { done?: boolean; priceWan?: number }
export interface PlanningState {
  settings: BeastTaskSettings;
  resources: Record<AccountId, BeastResource>;
  overrides: Record<string, TaskOverride>;
  gemPriceOverrides: Record<string, number>;
}

export interface ScheduledTask {
  id: string;
  accountId: AccountId;
  typeKey: "snake1" | "snake2" | "horse";
  typeLabel: string;
  actionKey: string;
  actionLabel: string;
  kind: string;
  resourceType: "wan" | "innerShard";
  priceWan: number;
  /** Explicit egg requirement; zero means this is not an egg task. */
  eggCount: number;
  shardCount: number;
  done: boolean;
  remainingWan: number;
  remainingEggCount: number;
  remainingShardCount: number;
  dueDate: string;
}

export interface AccountTaskPlan {
  accountId: AccountId;
  resource: BeastResource;
  availableWan: number;
  availableShards: number;
  tasks: ScheduledTask[];
  remainingWan: number;
  remainingShardCount: number;
  missingShardCount: number;
  finishDate: string;
}

const dateKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year || 2026, (month || 1) - 1, day || 1));
}
function weekEnd(date: Date) { const days = (7 - date.getUTCDay()) % 7; return new Date(date.getTime() + days * 86_400_000); }
function maxDate(a: string, b: string) {
  if (!a || a === "已完成") return b;
  if (!b || b === "已完成") return a;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return /^\d/.test(a) ? b : a;
  return a > b ? a : b;
}
function finishForMoney(targetWan: number, availableWan: number, settings: BeastTaskSettings) {
  const start = parseDate(settings.startDate);
  if (targetWan <= availableWan + 0.0001) return dateKey(start);
  const end = weekEnd(start);
  const current = settings.thisWeekEggs * settings.eggPriceWan;
  if (targetWan <= availableWan + current + 0.0001) return dateKey(end);
  const weekly = Math.max(0.0001, settings.weeklyEggs * settings.eggPriceWan);
  const weeks = Math.ceil((targetWan - availableWan - current - 0.0001) / weekly);
  return dateKey(new Date(end.getTime() + weeks * 7 * 86_400_000));
}
function finishForShards(target: number, available: number, settings: BeastTaskSettings) {
  const start = parseDate(settings.startDate);
  if (target <= available + 0.0001) return dateKey(start);
  const end = weekEnd(start);
  if (target <= available + settings.thisWeekInnerShards + 0.0001) return dateKey(end);
  if (!settings.weeklyInnerShards) return "待补锁片";
  const weeks = Math.ceil((target - available - settings.thisWeekInnerShards - 0.0001) / settings.weeklyInnerShards);
  return dateKey(new Date(end.getTime() + weeks * 7 * 86_400_000));
}

function isPendingBook(row: PetView) { return row.role.primary === "待打书"; }

export function buildTaskPlans(catalog: Catalog, rows: PetView[], state: PlanningState): AccountTaskPlan[] {
  const config = catalog.beastConfig;
  const tasks = rows.filter((row) => row.beastType && row.beastCost).flatMap((row) => config.taskActionOrder.map((action) => {
    const typeKey = row.beastType!;
    const taskId = `${row.accountId}:${typeKey}:${action.key}`;
    const override = state.overrides[taskId] || {};
    let basePriceWan = 0;
    let eggCount = 0;
    let shardCount = 0;
    if (action.key === "talisman" && config.talismanMissingByFolder[row.accountId]?.includes(typeKey)) basePriceWan = config.estimateRules.find((item) => item.key === "talisman")?.priceWan || 0;
    else if (action.key === "book" && isPendingBook(row)) basePriceWan = config.estimateRules.find((item) => item.key === "book")?.priceWan || 0;
    else if (action.key === "strengthen" && typeKey === "horse") {
      eggCount = 80;
      basePriceWan = eggCount * state.settings.eggPriceWan;
    }
    else if (action.key === "innerDan" && typeKey === "horse" && isPendingBook(row) && row.skillCount <= 4) shardCount = config.innerShardRequirement;
    else {
      const missing = row.beastCost?.missing.find((item) => item.key === action.sourceKey);
      if (missing) {
        eggCount = missing.eggCount;
        basePriceWan = eggCount ? eggCount * state.settings.eggPriceWan : missing.priceWan;
      }
    }
    if (!basePriceWan && !eggCount && !shardCount) return null;
    const done = Boolean(override.done);
    const resourceType: "innerShard" | "wan" = action.resourceType === "innerShard" ? "innerShard" : "wan";
    const priceWan = resourceType === "wan" ? Math.max(0, Number(override.priceWan ?? basePriceWan)) : 0;
    return {
      taskId, row, typeKey, action, done, resourceType, priceWan, eggCount, shardCount,
      remainingWan: done ? 0 : priceWan,
      remainingEggCount: done ? 0 : eggCount,
      remainingShardCount: done ? 0 : shardCount,
    };
  }).filter(Boolean));

  return catalog.accounts.map((account) => {
    const resource = state.resources[account.id];
    const availableWan = resource.silverWan + resource.eggCount * state.settings.eggPriceWan;
    const availableShards = resource.innerShardCount;
    let cumulativeWan = 0;
    let cumulativeShards = 0;
    let finishDate = state.settings.startDate;
    let dependencyDate = finishDate;
    const scheduled = tasks.filter((task) => task!.row.accountId === account.id).map((task) => {
      const current = task!;
      let resourceDue = finishDate;
      if (current.resourceType === "innerShard") {
        cumulativeShards += current.remainingShardCount;
        resourceDue = finishForShards(cumulativeShards, availableShards, state.settings);
      } else {
        cumulativeWan += current.remainingWan;
        resourceDue = finishForMoney(cumulativeWan, availableWan, state.settings);
      }
      const dueDate = current.done ? "已完成" : maxDate(resourceDue, dependencyDate);
      if (!current.done) { dependencyDate = maxDate(dependencyDate, dueDate); finishDate = maxDate(finishDate, dueDate); }
      return {
        id: current.taskId, accountId: account.id, typeKey: current.typeKey, typeLabel: config.typeDefs.find((item) => item.key === current.typeKey)?.label || current.typeKey,
        actionKey: current.action.key, actionLabel: current.action.label, kind: current.action.kind, resourceType: current.resourceType,
        priceWan: current.priceWan, eggCount: current.eggCount, shardCount: current.shardCount, done: current.done,
        remainingWan: current.remainingWan, remainingEggCount: current.remainingEggCount,
        remainingShardCount: current.remainingShardCount, dueDate,
      } satisfies ScheduledTask;
    });
    const remainingWan = scheduled.reduce((sum, task) => sum + task.remainingWan, 0);
    const remainingShardCount = scheduled.reduce((sum, task) => sum + task.remainingShardCount, 0);
    return { accountId: account.id, resource, availableWan, availableShards, tasks: scheduled, remainingWan, remainingShardCount, missingShardCount: Math.max(0, remainingShardCount - availableShards), finishDate };
  });
}

export function buildAccountPlans(catalog: Catalog, rows: PetView[], state: PlanningState): AccountPlan[] {
  const beastPlans = buildTaskPlans(catalog, rows, state);
  return catalog.accounts.map((account) => {
    const gem = accountGemPlan(catalog, account.id, state.gemPriceOverrides);
    const beast = beastPlans.find((item) => item.accountId === account.id)!;
    const beastRequiredWan = Math.max(0, beast.remainingWan - beast.availableWan);
    const beastRequiredSilver = Math.round(beastRequiredWan * 10_000);
    const beastTaskSilver = Math.round(beast.remainingWan * 10_000);
    const beastAvailableSilver = Math.round(beast.availableWan * 10_000);
    const totalSilver = gem.cost + beastRequiredSilver;
    return {
      accountId: account.id,
      gemRequiredSilver: gem.cost,
      beastRequiredSilver,
      beastTaskSilver,
      beastAvailableSilver,
      missingShardCount: beast.missingShardCount,
      taskCount: beast.tasks.length,
      totalSilver,
      finishWeek: Math.ceil(totalSilver / defaultWeeklyIncome),
      finishDate: beast.finishDate,
    };
  }).sort((a, b) => b.finishWeek - a.finishWeek || b.totalSilver - a.totalSilver);
}
