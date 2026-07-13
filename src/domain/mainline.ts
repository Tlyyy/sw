import { calculateInventoryDeltas, latestInventoryPair } from "./inventory";
import type { AccountTaskPlan, ScheduledTask } from "./plans";
import type {
  AccountId,
  BeastResource,
  InventoryAccountDelta,
  InventoryBalance,
  InventorySnapshot,
} from "./types";

export const mainlineAccountIds = ["FC", "LG1", "LG2", "PT", "MYT"] as const satisfies readonly AccountId[];

export type MainlineStatus = "ready" | "buyable" | "blocked" | "stale";
export type MainlineRequirementKind = "eggs" | "silver" | "shards" | "complete";

export interface MainlineInventory extends InventoryBalance {
  innerShardCount: number;
}

export interface MainlineAllocation {
  dedicatedUsed: number;
  regularUsed: number;
  eggShortage: number;
  purchaseCostWan: number;
  silverUsed: number;
  silverShortageWan: number;
  regularEggsToSell: number;
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
  shardsUsed: 0,
  shardShortage: 0,
});

function statusCopy(status: MainlineStatus, actionHint: string) {
  const labels: Record<MainlineStatus, string> = {
    ready: "可以完成",
    buyable: "转换后可完成",
    blocked: "资源不足",
    stale: "待录库存",
  };
  return { status, statusLabel: labels[status], actionHint };
}

function projectRequirement(task: ScheduledTask | null, inventory: MainlineInventory, eggPriceWan: number) {
  const allocation = emptyAllocation();
  if (!task) {
    return {
      ...statusCopy("ready", "当前神兽主线已完成"),
      requirementKind: "complete" as const,
      requiredAmount: 0,
      allocation,
    };
  }

  if (task.remainingEggCount > 0) {
    const requiredAmount = task.remainingEggCount;
    allocation.dedicatedUsed = Math.min(requiredAmount, inventory.dedicatedEggs);
    const afterDedicated = requiredAmount - allocation.dedicatedUsed;
    allocation.regularUsed = Math.min(afterDedicated, inventory.regularEggs);
    allocation.eggShortage = afterDedicated - allocation.regularUsed;
    allocation.purchaseCostWan = allocation.eggShortage * eggPriceWan;
    if (!allocation.eggShortage) {
      return {
        ...statusCopy("ready", `优先使用 ${allocation.dedicatedUsed} 个专用蛋，可直接完成`),
        requirementKind: "eggs" as const,
        requiredAmount,
        allocation,
      };
    }
    if (eggPriceWan <= 0) {
      return {
        ...statusCopy("blocked", `还差 ${allocation.eggShortage} 个蛋，请先维护普通蛋价格`),
        requirementKind: "eggs" as const,
        requiredAmount,
        allocation,
      };
    }
    if (allocation.purchaseCostWan <= inventory.silverWan + 0.0001) {
      return {
        ...statusCopy("buyable", `还差 ${allocation.eggShortage} 个蛋，可花 ${allocation.purchaseCostWan} 万银子购买`),
        requirementKind: "eggs" as const,
        requiredAmount,
        allocation,
      };
    }
    return {
      ...statusCopy("blocked", `还差 ${allocation.eggShortage} 个蛋，购买还缺 ${Math.max(0, allocation.purchaseCostWan - inventory.silverWan)} 万银子`),
      requirementKind: "eggs" as const,
      requiredAmount,
      allocation,
    };
  }

  if (task.remainingShardCount > 0 || task.resourceType === "innerShard") {
    const requiredAmount = task.remainingShardCount;
    allocation.shardsUsed = Math.min(requiredAmount, inventory.innerShardCount);
    allocation.shardShortage = requiredAmount - allocation.shardsUsed;
    const result = allocation.shardShortage
      ? statusCopy("blocked", `还差 ${allocation.shardShortage} 个内丹锁片`)
      : statusCopy("ready", "锁片库存充足，可以完成");
    return { ...result, requirementKind: "shards" as const, requiredAmount, allocation };
  }

  const requiredAmount = task.remainingWan;
  allocation.silverUsed = Math.min(requiredAmount, inventory.silverWan);
  allocation.silverShortageWan = Math.max(0, requiredAmount - allocation.silverUsed);
  if (!allocation.silverShortageWan) {
    return {
      ...statusCopy("ready", "银子库存充足，可以完成"),
      requirementKind: "silver" as const,
      requiredAmount,
      allocation,
    };
  }
  allocation.regularEggsToSell = eggPriceWan > 0 ? Math.ceil((allocation.silverShortageWan - 0.0001) / eggPriceWan) : 0;
  if (allocation.regularEggsToSell > 0 && allocation.regularEggsToSell <= inventory.regularEggs) {
    return {
      ...statusCopy("buyable", `可出售 ${allocation.regularEggsToSell} 个普通蛋补足银子`),
      requirementKind: "silver" as const,
      requiredAmount,
      allocation,
    };
  }
  return {
    ...statusCopy("blocked", `还差 ${allocation.silverShortageWan} 万银子`),
    requirementKind: "silver" as const,
    requiredAmount,
    allocation,
  };
}

/**
 * Build the five-account mainline workbench in its stable UI order.
 * Inventory snapshots are authoritative when present. Legacy settings are a
 * read-only fallback and are deliberately marked stale.
 */
export function buildMainlineProjection(
  taskPlans: AccountTaskPlan[],
  snapshots: InventorySnapshot[],
  fallbackResources: Record<AccountId, BeastResource>,
  eggPriceWan: number,
): MainlineAccountProjection[] {
  const { latest, previous } = latestInventoryPair(snapshots);
  const deltas = calculateInventoryDeltas(latest, previous);
  const normalizedEggPrice = Number.isFinite(eggPriceWan) ? Math.max(0, eggPriceWan) : 0;

  return mainlineAccountIds.map((accountId) => {
    const fallback = fallbackResources[accountId];
    const balance = latest?.accounts[accountId] || {
      dedicatedEggs: 0,
      regularEggs: fallback.eggCount,
      silverWan: fallback.silverWan,
    };
    const inventory: MainlineInventory = { ...balance, innerShardCount: fallback.innerShardCount };
    const tasks = taskPlans.find((plan) => plan.accountId === accountId)?.tasks || [];
    const nextTasks = tasks.filter((task) => !task.done).slice(0, 3);
    const currentTask = nextTasks[0] || null;
    const requirement = projectRequirement(currentTask, inventory, normalizedEggPrice);
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
      inventory,
      delta: deltas?.[accountId] || null,
      snapshot: { effectiveDate, recordedAt, isFallback },
      effectiveDate,
      recordedAt,
      isFallback,
    };
  });
}
