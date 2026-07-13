import { describe, expect, it } from "vitest";
import { buildMainlineProjection } from "./mainline";
import { buildTaskPlans, type AccountTaskPlan, type ScheduledTask } from "./plans";
import { buildPetViews } from "./pets";
import { catalog } from "../data/catalog";
import type { AccountId, BeastResource, InventoryBalance, InventorySnapshot } from "./types";

const ids: AccountId[] = ["FC", "LG1", "PT", "LG2", "MYT"];

const fallback = Object.fromEntries(ids.map((id) => [id, {
  silverWan: 5,
  eggCount: 9,
  innerShardCount: id === "LG2" ? 3 : 10,
}])) as Record<AccountId, BeastResource>;

function scheduled(overrides: Partial<ScheduledTask> = {}): ScheduledTask {
  return {
    id: "FC:snake1:advance1",
    accountId: "FC",
    typeKey: "snake1",
    typeLabel: "1蛇",
    actionKey: "advance1",
    actionLabel: "进阶1",
    kind: "进阶",
    resourceType: "wan",
    priceWan: 50,
    eggCount: 10,
    shardCount: 0,
    done: false,
    remainingWan: 50,
    remainingEggCount: 10,
    remainingShardCount: 0,
    dueDate: "2026-07-12",
    ...overrides,
  };
}

function plan(accountId: AccountId, tasks: ScheduledTask[]): AccountTaskPlan {
  return {
    accountId,
    resource: fallback[accountId],
    availableWan: 0,
    availableShards: fallback[accountId].innerShardCount,
    tasks,
    remainingWan: tasks.reduce((sum, task) => sum + task.remainingWan, 0),
    remainingShardCount: tasks.reduce((sum, task) => sum + task.remainingShardCount, 0),
    missingShardCount: 0,
    finishDate: "2026-07-12",
  };
}

function accounts(): Record<AccountId, InventoryBalance> {
  return {
    FC: { dedicatedEggs: 6, regularEggs: 2, silverWan: 20 },
    LG1: { dedicatedEggs: 0, regularEggs: 1, silverWan: 10 },
    LG2: { dedicatedEggs: 0, regularEggs: 0, silverWan: 0 },
    PT: { dedicatedEggs: 0, regularEggs: 0, silverWan: 0 },
    MYT: { dedicatedEggs: 0, regularEggs: 0, silverWan: 0 },
  };
}

const current: InventorySnapshot = {
  effectiveDate: "2026-07-11",
  recordedAt: "2026-07-12T08:00:00.000Z",
  accounts: accounts(),
};

describe("five-account mainline projection", () => {
  it("adds explicit egg requirements without changing the default task baseline", () => {
    const taskPlans = buildTaskPlans(catalog, buildPetViews(catalog), {
      settings: structuredClone(catalog.beastConfig.taskDefaultSettings),
      resources: structuredClone(catalog.beastConfig.taskDefaultResources),
      overrides: {},
      gemPriceOverrides: {},
    });
    const tasks = taskPlans.flatMap((item) => item.tasks);
    expect(tasks.reduce((sum, task) => sum + task.remainingEggCount, 0)).toBe(1690);
    expect(tasks.filter((task) => task.eggCount > 0).every((task) => task.priceWan === task.eggCount * 5.5)).toBe(true);
  });

  it("uses dedicated eggs first and recommends buying only the shortage", () => {
    const projections = buildMainlineProjection([plan("FC", [scheduled()])], [current], fallback, 5);
    expect(projections.map((item) => item.accountId)).toEqual(["FC", "LG1", "LG2", "PT", "MYT"]);
    expect(projections[0]).toMatchObject({
      status: "buyable",
      requirementKind: "eggs",
      requiredAmount: 10,
      allocation: {
        dedicatedUsed: 6,
        regularUsed: 2,
        eggShortage: 2,
        purchaseCostWan: 10,
      },
    });
  });

  it("supports silver and shard tasks and exposes at most three unfinished tasks", () => {
    const done = scheduled({ id: "LG1:done", accountId: "LG1", done: true, remainingWan: 0, remainingEggCount: 0 });
    const silver = scheduled({ id: "LG1:silver", accountId: "LG1", eggCount: 0, remainingEggCount: 0, priceWan: 14, remainingWan: 14 });
    const shard = scheduled({
      id: "LG2:shard",
      accountId: "LG2",
      resourceType: "innerShard",
      eggCount: 0,
      remainingEggCount: 0,
      priceWan: 0,
      remainingWan: 0,
      shardCount: 4,
      remainingShardCount: 4,
    });
    const taskPlans = [
      plan("LG1", [done, silver, scheduled({ id: "LG1:2", accountId: "LG1" }), scheduled({ id: "LG1:3", accountId: "LG1" }), scheduled({ id: "LG1:4", accountId: "LG1" })]),
      plan("LG2", [shard]),
    ];
    const projections = buildMainlineProjection(taskPlans, [current], fallback, 5);
    const lg1 = projections.find((item) => item.accountId === "LG1")!;
    const lg2 = projections.find((item) => item.accountId === "LG2")!;
    expect(lg1.currentTask?.id).toBe("LG1:silver");
    expect(lg1.nextTasks).toHaveLength(3);
    expect(lg1).toMatchObject({ status: "buyable", requirementKind: "silver", allocation: { regularEggsToSell: 1 } });
    expect(lg2).toMatchObject({ status: "blocked", requirementKind: "shards", allocation: { shardShortage: 1 } });
  });

  it("falls back to legacy resources but marks every account stale without a snapshot", () => {
    const projections = buildMainlineProjection([plan("FC", [scheduled()])], [], fallback, 5);
    expect(projections.every((item) => item.status === "stale" && item.isFallback)).toBe(true);
    expect(projections[0].inventory).toMatchObject({ dedicatedEggs: 0, regularEggs: 9, silverWan: 5 });
  });
});
