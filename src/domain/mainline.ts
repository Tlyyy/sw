import { calculateInventoryDeltas, latestInventoryPair } from "./inventory";
import type { AccountTaskPlan, ScheduledTask } from "./plans";
import type {
  AccountId,
  InventoryAccountDelta,
  InventoryBalance,
  InventorySnapshot,
} from "./types";

export const mainlineAccountIds = ["FC", "LG1", "LG2", "PT", "MYT"] as const satisfies readonly AccountId[];

export type MainlineStatus = "ready" | "buyable" | "caution" | "blocked" | "stale";
export type MainlineRequirementKind = "eggs" | "silver" | "shards" | "estimate" | "complete";

export interface EggTradePrices {
  buyWan: number;
  sellWan: number;
}

export type MainlineInventory = InventoryBalance;

export interface MainlineAllocation {
  dedicatedUsed: number;
  regularUsed: number;
  eggShortage: number;
  purchaseCostWan: number;
  silverUsed: number;
  silverShortageWan: number;
  regularEggsToSell: number;
  repurchaseLossWan: number;
  shardsUsed: number;
  shardShortage: number;
}

export interface MainlineAccountProjection {
  accountId: AccountId;
  status: MainlineStatus;
  statusLabel: string;
  actionHint: string;
  currentTask: ScheduledTask | null;
  /** Current task plus at most the next two unfinished tasks. */
  nextTasks: ScheduledTask[];
  /** Expected completion of the whole account mainline, or a planner blocker. */
  finishDate: string | null;
  inventory: MainlineInventory;
  delta: InventoryAccountDelta | null;
  snapshot: {
    effectiveDate: string | null;
    recordedAt: string | null;
    isFallback: boolean;
  };
  /** Convenience aliases for view code. */
  effectiveDate: string | null;
  recordedAt: string | null;
  isFallback: boolean;
  requirementKind: MainlineRequirementKind;
  requiredAmount: number;
  allocation: MainlineAllocation;
}

const emptyAllocation = (): MainlineAllocation => ({
  dedicatedUsed: 0,
  regularUsed: 0,
  eggShortage: 0,
  purchaseCostWan: 0,
  silverUsed: 0,
  silverShortageWan: 0,
  regularEggsToSell: 0,
  repurchaseLossWan: 0,
  shardsUsed: 0,
  shardShortage: 0,
});

function statusCopy(status: MainlineStatus, actionHint: string, customLabel?: string) {
  const labels: Record<MainlineStatus, string> = {
    ready: "可以完成",
    buyable: "转换后可完成",
    caution: "优先攒银子",
    blocked: "资源不足",
    stale: "待录库存",
  };
  return { status, statusLabel: customLabel || labels[status], actionHint };
}

function formatAmount(value: number) {
  return Number(value.toFixed(2)).toString();
}

function projectRequirement(task: ScheduledTask | null, inventory: MainlineInventory, eggPrices: EggTradePrices) {
  const allocation = emptyAllocation();
  if (!task) {
    return {
      ...statusCopy("ready", "当前神兽主线已完成"),
      requirementKind: "complete" as const,
      requiredAmount: 0,
      allocation,
    };
  }

  if (task.actionKey === "talisman") {
    const requiredAmount = task.remainingWan;
    return {
      ...statusCopy("caution", `洗护符成本不可控，${formatAmount(requiredAmount)} 万仅作预算；洗成后请在任务维护中勾选完成，再进入打书和后续养成`, "成本待定"),
      requirementKind: "estimate" as const,
      requiredAmount,
      allocation,
    };
  }

  if (task.remainingEggCount > 0) {
    const requiredAmount = task.remainingEggCount;
    allocation.dedicatedUsed = Math.min(requiredAmount, inventory.dedicatedEggs);
    const afterDedicated = requiredAmount - allocation.dedicatedUsed;
    allocation.regularUsed = Math.min(afterDedicated, inventory.regularEggs);
    allocation.eggShortage = afterDedicated - allocation.regularUsed;
    allocation.purchaseCostWan = allocation.eggShortage * eggPrices.buyWan;
    if (!allocation.eggShortage) {
      return {
        ...statusCopy("ready", `优先使用 ${allocation.dedicatedUsed} 个专用蛋，可直接完成`),
        requirementKind: "eggs" as const,
        requiredAmount,
        allocation,
      };
    }
    if (eggPrices.buyWan <= 0) {
      return {
        ...statusCopy("blocked", `完成当前任务还缺 ${allocation.eggShortage} 个蛋。请先维护普通蛋价格，才能计算购买成本。`),
        requirementKind: "eggs" as const,
        requiredAmount,
        allocation,
      };
    }
    if (allocation.purchaseCostWan <= inventory.silverWan + 0.0001) {
      return {
        ...statusCopy("buyable", `完成当前任务还缺 ${allocation.eggShortage} 个蛋。按当前价格购买需 ${formatAmount(allocation.purchaseCostWan)} 万银子，现有 ${formatAmount(inventory.silverWan)} 万，可直接购买。`),
        requirementKind: "eggs" as const,
        requiredAmount,
        allocation,
      };
    }
    const silverGapWan = Math.max(0, allocation.purchaseCostWan - inventory.silverWan);
    return {
      ...statusCopy("blocked", `完成当前任务还缺 ${allocation.eggShortage} 个蛋。按当前价格买齐需 ${formatAmount(allocation.purchaseCostWan)} 万银子，现有 ${formatAmount(inventory.silverWan)} 万，还差 ${formatAmount(silverGapWan)} 万。`),
      requirementKind: "eggs" as const,
      requiredAmount,
      allocation,
    };
  }

  if (task.remainingShardCount > 0 || task.resourceType === "innerShard") {
    const requiredAmount = task.remainingShardCount;
    if (inventory.innerShardCount === null) {
      return {
        ...statusCopy("stale", "请补录该库存日期的内丹碎片"),
        requirementKind: "shards" as const,
        requiredAmount,
        allocation,
      };
    }
    allocation.shardsUsed = Math.min(requiredAmount, inventory.innerShardCount);
    allocation.shardShortage = requiredAmount - allocation.shardsUsed;
    const result = allocation.shardShortage
      ? statusCopy("blocked", `还差 ${allocation.shardShortage} 个内丹碎片`)
      : statusCopy("ready", "内丹碎片库存充足，可以完成");
    return { ...result, requirementKind: "shards" as const, requiredAmount, allocation };
  }

  const requiredAmount = task.remainingWan;
  allocation.silverUsed = Math.min(requiredAmount, inventory.silverWan);
  allocation.silverShortageWan = Math.round(Math.max(0, requiredAmount - allocation.silverUsed) * 100) / 100;
  if (!allocation.silverShortageWan) {
    return {
      ...statusCopy("ready", "银子库存充足，可以完成"),
      requirementKind: "silver" as const,
      requiredAmount,
      allocation,
    };
  }
  const emergencyEggCount = eggPrices.sellWan > 0
    ? Math.ceil(Math.max(0, allocation.silverShortageWan - 0.0001) / eggPrices.sellWan)
    : 0;
  if (emergencyEggCount > 0 && emergencyEggCount <= inventory.regularEggs) {
    allocation.regularEggsToSell = emergencyEggCount;
    allocation.repurchaseLossWan = Math.round(Math.max(0, eggPrices.buyWan - eggPrices.sellWan) * emergencyEggCount * 100) / 100;
    const repurchaseWarning = allocation.repurchaseLossWan > 0
      ? `，后续按 ${formatAmount(eggPrices.buyWan)} 万/个买回将多花 ${formatAmount(allocation.repurchaseLossWan)} 万`
      : "";
    return {
      ...statusCopy("caution", `还差 ${formatAmount(allocation.silverShortageWan)} 万银子，优先积攒；仅万不得已按 ${formatAmount(eggPrices.sellWan)} 万/个出售 ${emergencyEggCount} 个普通蛋${repurchaseWarning}`),
      requirementKind: "silver" as const,
      requiredAmount,
      allocation,
    };
  }
  const ordinaryEggNote = inventory.regularEggs && eggPrices.sellWan > 0
    ? `；现有普通蛋即使全部按 ${formatAmount(eggPrices.sellWan)} 万/个紧急出售也不足，请优先留作任务`
    : "；普通蛋请优先留作任务";
  return {
    ...statusCopy("blocked", `还差 ${formatAmount(allocation.silverShortageWan)} 万银子，优先积攒${ordinaryEggNote}`),
    requirementKind: "silver" as const,
    requiredAmount,
    allocation,
  };
}

/**
 * Build the five-account mainline workbench in its stable UI order.
 * Inventory snapshots are the only mutable source for current resources.
 */
export function buildMainlineProjection(
  taskPlans: AccountTaskPlan[],
  snapshots: InventorySnapshot[],
  eggPrices: EggTradePrices,
): MainlineAccountProjection[] {
  const { latest, previous } = latestInventoryPair(snapshots);
  const deltas = calculateInventoryDeltas(latest, previous);
  const normalizedEggPrices = {
    buyWan: Number.isFinite(eggPrices.buyWan) ? Math.max(0, eggPrices.buyWan) : 0,
    sellWan: Number.isFinite(eggPrices.sellWan) ? Math.max(0, eggPrices.sellWan) : 0,
  };

  return mainlineAccountIds.map((accountId) => {
    const balance = latest?.accounts[accountId] || {
      dedicatedEggs: 0,
      regularEggs: 0,
      silverWan: 0,
      innerShardCount: null,
    };
    const inventory: MainlineInventory = { ...balance };
    const taskPlan = taskPlans.find((plan) => plan.accountId === accountId);
    const tasks = taskPlan?.tasks || [];
    const nextTasks = tasks.filter((task) => !task.done).slice(0, 3);
    const currentTask = nextTasks[0] || null;
    const requirement = projectRequirement(currentTask, inventory, normalizedEggPrices);
    const isFallback = !latest;
    const stale = isFallback
      ? statusCopy("stale", currentTask ? "请先录入一份五账号库存快照" : "请录入库存快照以建立主线基线")
      : null;
    const effectiveDate = latest?.effectiveDate || null;
    const recordedAt = latest?.recordedAt || null;

    return {
      accountId,
      ...requirement,
      ...(stale || {}),
      currentTask,
      nextTasks,
      finishDate: taskPlan?.finishDate || null,
      inventory,
      delta: deltas?.[accountId] || null,
      snapshot: { effectiveDate, recordedAt, isFallback },
      effectiveDate,
      recordedAt,
      isFallback,
    };
  });
}
