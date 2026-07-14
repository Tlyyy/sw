import type { AccountId, AccountPlan, BeastResource, BeastTaskSettings, Catalog, PetView } from "./types";
import { accountGemPlan, defaultWeeklyIncome } from "./gems";

export interface TaskOverride { done?: boolean; priceWan?: number }
export interface PlanningState {
  settings: BeastTaskSettings;
  /** Calendar day used as "today" by the planner; supplied by the app for deterministic scheduling. */
  asOfDate: string;
  /** Date represented by the inventory balances, when a snapshot exists. */
  inventoryEffectiveDate: string | null;
  resources: Record<AccountId, BeastResource>;
  overrides: Record<string, TaskOverride>;
  gemPriceOverrides: Record<string, number>;
}

const taskDisplayTypeMap = {
  swordSnake: { key: "swordSnake", label: "剑气蛇" },
  magicSnake: { key: "magicSnake", label: "法蛇" },
  stealthSnake: { key: "stealthSnake", label: "隐攻蛇" },
  pendingSnake: { key: "pendingSnake", label: "待打书蛇" },
  otherSnake: { key: "otherSnake", label: "神兽青蛇" },
  horse: { key: "horse", label: "小马" },
} as const;

export type TaskDisplayTypeKey = keyof typeof taskDisplayTypeMap;
export const taskDisplayTypeOptions = Object.values(taskDisplayTypeMap);

export function taskDisplayType(row: PetView) {
  if (row.beastType === "horse") return taskDisplayTypeMap.horse;
  if (row.role.primary === "隐攻") return taskDisplayTypeMap.stealthSnake;
  if (row.role.primary === "普通法") return taskDisplayTypeMap.magicSnake;
  if (row.role.primary === "剑气" || row.role.tags.includes("剑气")) return taskDisplayTypeMap.swordSnake;
  if (row.role.primary === "待打书") return taskDisplayTypeMap.pendingSnake;
  return taskDisplayTypeMap.otherSnake;
}

export interface ScheduledTask {
  id: string;
  accountId: AccountId;
  typeKey: "snake1" | "snake2" | "horse";
  displayTypeKey: TaskDisplayTypeKey;
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
  /** Spendable silver only; eggs are kept on their own resource track. */
  availableWan: number;
  availableShards: number | null;
  tasks: ScheduledTask[];
  /** Silver needed after assigning held eggs to egg tasks, before held silver. */
  requiredWan: number;
  remainingWan: number;
  remainingShardCount: number;
  missingShardCount: number | null;
  finishDate: string;
}

const scheduleDatePattern = /^\d{4}-\d{2}-\d{2}$/;
function dateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/** Return the current game calendar date in Asia/Shanghai without depending on the host timezone. */
export function shanghaiDateKey(now: Date | number = Date.now()) {
  const epochMs = typeof now === "number" ? now : now.getTime();
  return dateKey(new Date(epochMs + 8 * 60 * 60 * 1_000));
}

/** Milliseconds until the next Asia/Shanghai calendar day begins. */
export function millisecondsUntilNextShanghaiDay(now: Date | number = Date.now()) {
  const epochMs = typeof now === "number" ? now : now.getTime();
  const shanghaiNow = new Date(epochMs + 8 * 60 * 60 * 1_000);
  const nextDay = Date.UTC(
    shanghaiNow.getUTCFullYear(),
    shanghaiNow.getUTCMonth(),
    shanghaiNow.getUTCDate() + 1,
  );
  return Math.max(1, nextDay - shanghaiNow.getTime());
}

/** Pick the earliest honest scheduling boundary from configured, inventory and current dates. */
export function resolvePlanningStartDate(configuredStartDate: string, ...lowerBounds: Array<string | null | undefined>) {
  const validDates = [configuredStartDate, ...lowerBounds].filter((value): value is string => Boolean(value && scheduleDatePattern.test(value)));
  return validDates.sort().at(-1) || configuredStartDate;
}

/**
 * Present a scheduled date without constructing a local-time Date object.
 * Non-date values are scheduling blockers emitted by the planner and must stay visible.
 */
export function formatScheduleDueDate(value: string | null | undefined, referenceDate?: string) {
  if (!value) return "待生成排期";
  if (value === "已完成") return value;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value.endsWith("后排期") ? value : `${value}后排期`;

  const [, year, month, day] = match;
  const referenceYear = /^(\d{4})-/.exec(referenceDate || "")?.[1];
  const yearLabel = referenceYear === year ? "" : `${Number(year)}年`;
  return `预计 ${yearLabel}${Number(month)}月${Number(day)}日完成`;
}

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
function mergeDue(a: string, b: string) {
  if (a === "待录库存" || b === "待录库存") return "待录库存";
  if (a === "待补内丹碎片" || b === "待补内丹碎片") return "待补内丹碎片";
  if (a === "待洗护符" || b === "待洗护符") return "待洗护符";
  return maxDate(a, b);
}
function finishForEggs(targetEggs: number, availableEggs: number, settings: BeastTaskSettings) {
  const start = parseDate(settings.startDate);
  if (targetEggs <= availableEggs + 0.0001) return dateKey(start);
  const end = weekEnd(start);
  if (targetEggs <= availableEggs + settings.thisWeekEggs + 0.0001) return dateKey(end);
  if (!settings.weeklyEggs) return "待补普通蛋";
  const weeks = Math.ceil((targetEggs - availableEggs - settings.thisWeekEggs - 0.0001) / settings.weeklyEggs);
  return dateKey(new Date(end.getTime() + weeks * 7 * 86_400_000));
}
function finishForSilver(targetWan: number, availableWan: number, settings: BeastTaskSettings) {
  return targetWan <= availableWan + 0.0001 ? dateKey(parseDate(settings.startDate)) : "待补银子";
}
function finishForShards(target: number, available: number, settings: BeastTaskSettings) {
  const start = parseDate(settings.startDate);
  if (target <= available + 0.0001) return dateKey(start);
  const end = weekEnd(start);
  if (target <= available + settings.thisWeekInnerShards + 0.0001) return dateKey(end);
  if (!settings.weeklyInnerShards) return "待补内丹碎片";
  const weeks = Math.ceil((target - available - settings.thisWeekInnerShards - 0.0001) / settings.weeklyInnerShards);
  return dateKey(new Date(end.getTime() + weeks * 7 * 86_400_000));
}

function isPendingBook(row: PetView) { return row.role.primary === "待打书"; }

function needsTalisman(row: PetView, config: Catalog["beastConfig"]) {
  return Boolean(row.beastType && config.talismanMissingByFolder[row.accountId]?.includes(row.beastType));
}

function taskSchedulePhase(row: PetView, actionKey: string, config: Catalog["beastConfig"]) {
  const pendingBook = isPendingBook(row);
  if (!pendingBook) return actionKey === "talisman" ? 3 : 0;
  if (!needsTalisman(row, config)) return pendingBook ? 1 : 0;
  return actionKey === "innerDan" ? 2 : 3;
}

export function buildTaskPlans(catalog: Catalog, rows: PetView[], state: PlanningState): AccountTaskPlan[] {
  const config = catalog.beastConfig;
  const scheduleSettings: BeastTaskSettings = {
    ...state.settings,
    startDate: resolvePlanningStartDate(state.settings.startDate, state.inventoryEffectiveDate, state.asOfDate),
  };
  const tasks = rows.filter((row) => row.beastType && row.beastCost).flatMap((row, rowIndex) => config.taskActionOrder.map((action, actionIndex) => {
    const typeKey = row.beastType!;
    const taskId = `${row.accountId}:${typeKey}:${action.key}`;
    const override = state.overrides[taskId] || {};
    let basePriceWan = 0;
    let eggCount = 0;
    let shardCount = 0;
    if (action.key === "talisman" && config.talismanMissingByFolder[row.accountId]?.includes(typeKey)) basePriceWan = config.estimateRules.find((item) => item.key === "talisman")?.priceWan || 0;
    else if (action.key === "book" && isPendingBook(row)) basePriceWan = config.estimateRules.find((item) => item.key === "book")?.priceWan || 0;
    else if (action.key === "innerDan" && typeKey === "horse" && isPendingBook(row) && row.skillCount <= 4) shardCount = config.innerShardRequirement;
    else {
      const missing = row.beastCost?.missing.find((item) => item.key === action.sourceKey);
      if (missing) {
        eggCount = missing.eggCount;
        basePriceWan = eggCount ? eggCount * scheduleSettings.eggPriceWan : missing.priceWan;
      }
    }
    if (!basePriceWan && !eggCount && !shardCount) return null;
    const done = Boolean(override.done);
    const resourceType: "innerShard" | "wan" = action.resourceType === "innerShard" ? "innerShard" : "wan";
    const priceWan = resourceType === "wan" ? Math.max(0, Number(override.priceWan ?? basePriceWan)) : 0;
    return {
      taskId, row, rowIndex, typeKey, action, actionIndex, done, resourceType, priceWan, eggCount, shardCount,
      remainingWan: done ? 0 : priceWan,
      remainingEggCount: done ? 0 : eggCount,
      remainingShardCount: done ? 0 : shardCount,
    };
  }).filter(Boolean)).sort((left, right) => {
    const leftTask = left!;
    const rightTask = right!;
    return taskSchedulePhase(leftTask.row, leftTask.action.key, config) - taskSchedulePhase(rightTask.row, rightTask.action.key, config)
      || leftTask.rowIndex - rightTask.rowIndex
      || leftTask.actionIndex - rightTask.actionIndex;
  });

  return catalog.accounts.map((account) => {
    const resource = state.resources[account.id];
    const inventoryRecorded = resource.inventoryRecorded !== false;
    const availableWan = inventoryRecorded ? resource.silverWan : 0;
    const availableEggs = inventoryRecorded ? resource.eggCount : 0;
    const availableShards = resource.innerShardCount;
    let scheduledSilverWan = 0;
    let futureEggsNeeded = 0;
    let cumulativeShards = 0;
    let unassignedHeldEggs = availableEggs;
    let requiredWan = 0;
    let finishDate = scheduleSettings.startDate;
    let dependencyDate = finishDate;
    const scheduled = tasks.filter((task) => task!.row.accountId === account.id).map((task) => {
      const current = task!;
      let resourceDue = finishDate;
      if (current.action.key === "talisman") {
        scheduledSilverWan += current.remainingWan;
        requiredWan += current.remainingWan;
        resourceDue = current.done ? finishDate : !inventoryRecorded ? "待录库存" : "待洗护符";
      } else if (current.resourceType === "innerShard") {
        cumulativeShards += current.remainingShardCount;
        resourceDue = !inventoryRecorded ? "待录库存" : availableShards === null ? "待补内丹碎片" : finishForShards(cumulativeShards, availableShards, scheduleSettings);
      } else if (current.remainingEggCount > 0) {
        const heldEggsUsed = Math.min(unassignedHeldEggs, current.remainingEggCount);
        unassignedHeldEggs -= heldEggsUsed;
        const missingEggs = current.remainingEggCount - heldEggsUsed;
        const unitPriceWan = current.eggCount > 0 ? current.priceWan / current.eggCount : scheduleSettings.eggPriceWan;
        const purchaseCostWan = missingEggs * unitPriceWan;
        requiredWan += purchaseCostWan;
        if (!inventoryRecorded) resourceDue = "待录库存";
        else if (!missingEggs) resourceDue = dateKey(parseDate(scheduleSettings.startDate));
        else if (unitPriceWan > 0 && scheduledSilverWan + purchaseCostWan <= availableWan + 0.0001) {
          scheduledSilverWan += purchaseCostWan;
          resourceDue = dateKey(parseDate(scheduleSettings.startDate));
        } else {
          futureEggsNeeded += missingEggs;
          resourceDue = finishForEggs(futureEggsNeeded, 0, scheduleSettings);
        }
      } else {
        scheduledSilverWan += current.remainingWan;
        requiredWan += current.remainingWan;
        resourceDue = inventoryRecorded ? finishForSilver(scheduledSilverWan, availableWan, scheduleSettings) : "待录库存";
      }
      const dueDate = current.done ? "已完成" : mergeDue(resourceDue, dependencyDate);
      if (!current.done) { dependencyDate = mergeDue(dependencyDate, dueDate); finishDate = mergeDue(finishDate, dueDate); }
      const displayType = taskDisplayType(current.row);
      return {
        id: current.taskId, accountId: account.id, typeKey: current.typeKey, displayTypeKey: displayType.key, typeLabel: displayType.label,
        actionKey: current.action.key, actionLabel: current.action.label, kind: current.action.kind, resourceType: current.resourceType,
        priceWan: current.priceWan, eggCount: current.eggCount, shardCount: current.shardCount, done: current.done,
        remainingWan: current.remainingWan, remainingEggCount: current.remainingEggCount,
        remainingShardCount: current.remainingShardCount, dueDate,
      } satisfies ScheduledTask;
    });
    const remainingWan = scheduled.reduce((sum, task) => sum + task.remainingWan, 0);
    const remainingShardCount = scheduled.reduce((sum, task) => sum + task.remainingShardCount, 0);
    return { accountId: account.id, resource, availableWan, availableShards, tasks: scheduled, requiredWan, remainingWan, remainingShardCount, missingShardCount: availableShards === null ? null : Math.max(0, remainingShardCount - availableShards), finishDate };
  });
}

export function buildAccountPlans(catalog: Catalog, rows: PetView[], state: PlanningState): AccountPlan[] {
  const beastPlans = buildTaskPlans(catalog, rows, state);
  return catalog.accounts.map((account) => {
    const gem = accountGemPlan(catalog, account.id, state.gemPriceOverrides);
    const beast = beastPlans.find((item) => item.accountId === account.id)!;
    const beastRequiredWan = Math.max(0, beast.requiredWan - beast.availableWan);
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
