import { describe, expect, it } from "vitest";
import { buildMainlineProjection } from "./mainline";
import {
  buildTaskPlans,
  formatScheduleDueDate,
  millisecondsUntilNextShanghaiDay,
  resolvePlanningStartDate,
  shanghaiDateKey,
  taskDisplayType,
  type AccountTaskPlan,
  type ScheduledTask,
} from "./plans";
import { buildPetViews } from "./pets";
import { catalog } from "../data/catalog";
import type { AccountId, BeastResource, InventoryBalance, InventorySnapshot } from "./types";

const ids: AccountId[] = ["FC", "LG1", "PT", "LG2", "MYT"];
const eggTradePrices = { buyWan: 5.5, sellWan: 5.2 };
const defaultPlanningDates = {
  asOfDate: catalog.beastConfig.taskDefaultSettings.startDate,
  inventoryEffectiveDate: catalog.beastConfig.taskDefaultSettings.startDate,
};
const scheduleDatePattern = /^\d{4}-\d{2}-\d{2}$/;

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
    displayTypeKey: "stealthSnake",
    typeLabel: "隐攻蛇",
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
    requiredWan: tasks.reduce((sum, task) => sum + task.remainingWan, 0),
    remainingWan: tasks.reduce((sum, task) => sum + task.remainingWan, 0),
    remainingShardCount: tasks.reduce((sum, task) => sum + task.remainingShardCount, 0),
    missingShardCount: 0,
    finishDate: "2026-07-12",
  };
}

function accounts(): Record<AccountId, InventoryBalance> {
  return {
    FC: { dedicatedEggs: 6, regularEggs: 2, silverWan: 20, innerShardCount: 10 },
    LG1: { dedicatedEggs: 0, regularEggs: 1, silverWan: 10, innerShardCount: 10 },
    LG2: { dedicatedEggs: 0, regularEggs: 0, silverWan: 0, innerShardCount: 3 },
    PT: { dedicatedEggs: 0, regularEggs: 0, silverWan: 0, innerShardCount: 10 },
    MYT: { dedicatedEggs: 0, regularEggs: 0, silverWan: 0, innerShardCount: 10 },
  };
}

const current: InventorySnapshot = {
  effectiveDate: "2026-07-11",
  recordedAt: "2026-07-12T08:00:00.000Z",
  accounts: accounts(),
};

describe("five-account mainline projection", () => {
  it("formats exact completion dates and keeps blocked schedules honest", () => {
    expect(formatScheduleDueDate("2026-07-13", "2026-07-02")).toBe("预计 7月13日完成");
    expect(formatScheduleDueDate("2027-01-05", "2026-07-02")).toBe("预计 2027年1月5日完成");
    expect(formatScheduleDueDate("待洗护符", "2026-07-02")).toBe("待洗护符后排期");
    expect(formatScheduleDueDate("待补银子", "2026-07-02")).toBe("待补银子后排期");
    expect(formatScheduleDueDate("已完成", "2026-07-02")).toBe("已完成");
    expect(formatScheduleDueDate(null, "2026-07-02")).toBe("待生成排期");
  });

  it("uses the Asia/Shanghai calendar boundary for the planning day", () => {
    expect(shanghaiDateKey(new Date("2026-07-12T15:59:59.999Z"))).toBe("2026-07-12");
    expect(shanghaiDateKey(new Date("2026-07-12T16:00:00.000Z"))).toBe("2026-07-13");
    expect(millisecondsUntilNextShanghaiDay(new Date("2026-07-12T15:59:59.999Z"))).toBe(1);
    expect(millisecondsUntilNextShanghaiDay(new Date("2026-07-12T16:00:00.000Z"))).toBe(86_400_000);
  });

  it("resolves the planning start from configured, inventory and current dates", () => {
    expect(resolvePlanningStartDate("2026-07-02", "2026-07-12", "2026-07-13")).toBe("2026-07-13");
    expect(resolvePlanningStartDate("2026-07-20", "2026-07-12", "2026-07-13")).toBe("2026-07-20");
    expect(resolvePlanningStartDate("2026-07-02", null, "invalid-date")).toBe("2026-07-02");
  });

  it("never schedules a concrete unfinished task before today or the inventory date", () => {
    const resources = structuredClone(catalog.beastConfig.taskDefaultResources);
    Object.values(resources).forEach((resource) => {
      resource.silverWan = 10_000;
      resource.eggCount = 10_000;
      resource.innerShardCount = 1_000;
    });
    const settings = { ...structuredClone(catalog.beastConfig.taskDefaultSettings), startDate: "2026-07-02" };

    for (const dateContext of [
      { asOfDate: "2026-07-13", inventoryEffectiveDate: "2026-07-11" },
      { asOfDate: "2026-07-12", inventoryEffectiveDate: "2026-07-13" },
    ]) {
      const plans = buildTaskPlans(catalog, buildPetViews(catalog), {
        settings,
        ...dateContext,
        resources,
        overrides: {},
        gemPriceOverrides: {},
      });
      const concreteDates = plans.flatMap((plan) => plan.tasks)
        .filter((task) => !task.done && scheduleDatePattern.test(task.dueDate))
        .map((task) => task.dueDate);

      expect(concreteDates.length).toBeGreaterThan(0);
      expect(concreteDates.every((date) => date >= "2026-07-13")).toBe(true);
      expect(concreteDates).toContain("2026-07-13");
    }
  });

  it("keeps a configured future planning start instead of pulling it forward", () => {
    const resources = structuredClone(catalog.beastConfig.taskDefaultResources);
    Object.values(resources).forEach((resource) => {
      resource.silverWan = 10_000;
      resource.eggCount = 10_000;
      resource.innerShardCount = 1_000;
    });
    const settings = { ...structuredClone(catalog.beastConfig.taskDefaultSettings), startDate: "2026-07-20" };
    const plans = buildTaskPlans(catalog, buildPetViews(catalog), {
      settings,
      asOfDate: "2026-07-13",
      inventoryEffectiveDate: "2026-07-12",
      resources,
      overrides: {},
      gemPriceOverrides: {},
    });
    const concreteDates = plans.flatMap((plan) => plan.tasks)
      .filter((task) => !task.done && scheduleDatePattern.test(task.dueDate))
      .map((task) => task.dueDate);

    expect(concreteDates.length).toBeGreaterThan(0);
    expect(concreteDates.every((date) => date >= "2026-07-20")).toBe(true);
    expect(concreteDates).toContain("2026-07-20");
  });

  it("adds explicit egg requirements without changing the default task baseline", () => {
    const taskPlans = buildTaskPlans(catalog, buildPetViews(catalog), {
      settings: structuredClone(catalog.beastConfig.taskDefaultSettings),
      ...defaultPlanningDates,
      resources: structuredClone(catalog.beastConfig.taskDefaultResources),
      overrides: {},
      gemPriceOverrides: {},
    });
    const tasks = taskPlans.flatMap((item) => item.tasks);
    expect(tasks.reduce((sum, task) => sum + task.remainingEggCount, 0)).toBe(1560);
    expect(tasks.filter((task) => task.eggCount > 0).every((task) => task.priceWan === task.eggCount * 5.5)).toBe(true);
    expect(tasks.every((task) => task.id.startsWith(`${task.accountId}:${task.typeKey}:`))).toBe(true);
    expect(catalog.beastConfig.eggSellPriceWan).toBe(5.2);
    expect(catalog.beastConfig.eggSellPriceWan).toBeLessThan(catalog.beastConfig.taskDefaultSettings.eggPriceWan);
  });

  it("uses readable snake roles without changing the stable task slots", () => {
    const snakeLabels = Object.fromEntries(buildPetViews(catalog)
      .filter((row) => row.beastType === "snake1" || row.beastType === "snake2")
      .map((row) => [`${row.accountId}:${row.beastType}`, taskDisplayType(row).label]));
    expect(snakeLabels).toEqual({
      "FC:snake1": "隐攻蛇",
      "FC:snake2": "法蛇",
      "LG1:snake1": "剑气蛇",
      "LG1:snake2": "隐攻蛇",
      "LG2:snake1": "法蛇",
      "LG2:snake2": "隐攻蛇",
      "PT:snake1": "待打书蛇",
      "PT:snake2": "剑气蛇",
      "MYT:snake1": "剑气蛇",
      "MYT:snake2": "待打书蛇",
    });
    expect(buildPetViews(catalog)
      .filter((row) => row.beastType === "horse")
      .every((row) => taskDisplayType(row).label === "小马")).toBe(true);
  });

  it("does not regenerate completed small-horse progression", () => {
    const completedHorseCatalog = structuredClone(catalog);
    const horse = completedHorseCatalog.pets.find((row) => row.accountId === "FC" && row.beastType === "horse")!;
    horse.beastProgress = { ornament: true, advance1: true, advance2: true, skin: true, strengthen: true };
    const fc = buildTaskPlans(completedHorseCatalog, buildPetViews(completedHorseCatalog), {
      settings: structuredClone(completedHorseCatalog.beastConfig.taskDefaultSettings),
      ...defaultPlanningDates,
      resources: structuredClone(completedHorseCatalog.beastConfig.taskDefaultResources),
      overrides: {},
      gemPriceOverrides: {},
    }).find((plan) => plan.accountId === "FC")!;
    const completedActions = new Set(["ornament", "advance1", "advance2", "skin", "strengthen"]);

    expect(fc.tasks.filter((task) => task.typeKey === "horse" && completedActions.has(task.actionKey))).toHaveLength(0);
  });

  it("defers bottomless talisman lanes and keeps progression behind book completion", () => {
    const taskPlans = buildTaskPlans(catalog, buildPetViews(catalog), {
      settings: structuredClone(catalog.beastConfig.taskDefaultSettings),
      ...defaultPlanningDates,
      resources: structuredClone(catalog.beastConfig.taskDefaultResources),
      overrides: {},
      gemPriceOverrides: {},
    });
    const progressionKeys = new Set(["ornament", "advance1", "advance2", "skin", "strengthen"]);

    expect(catalog.beastConfig.taskActionOrder.map((action) => action.key)).toEqual([
      "innerDan", "talisman", "book", "ornament", "advance1", "advance2", "skin", "strengthen",
    ]);

    for (const accountPlan of taskPlans) {
      for (const typeKey of ["snake1", "snake2", "horse"] as const) {
        const beastTasks = accountPlan.tasks.filter((task) => task.typeKey === typeKey);
        const bookIndex = beastTasks.findIndex((task) => task.actionKey === "book");
        if (bookIndex < 0) continue;
        const talismanIndex = beastTasks.findIndex((task) => task.actionKey === "talisman");
        const innerDanIndex = beastTasks.findIndex((task) => task.actionKey === "innerDan");
        if (talismanIndex >= 0) expect(talismanIndex).toBeLessThan(bookIndex);
        if (innerDanIndex >= 0) expect(innerDanIndex).toBeLessThan(bookIndex);
        expect(beastTasks.filter((task) => progressionKeys.has(task.actionKey)).every((task) => beastTasks.indexOf(task) > bookIndex)).toBe(true);
      }
    }

    const pt = taskPlans.find((plan) => plan.accountId === "PT")!;
    expect(pt.tasks.slice(0, 2).map((task) => `${task.typeKey}:${task.actionKey}`)).toEqual([
      "snake2:advance2", "snake2:skin",
    ]);
    expect(pt.tasks.findIndex((task) => task.id === "PT:snake1:talisman"))
      .toBeGreaterThan(pt.tasks.findIndex((task) => task.id === "PT:horse:strengthen"));

    const myt = taskPlans.find((plan) => plan.accountId === "MYT")!;
    expect(myt.tasks.slice(0, 2).map((task) => `${task.typeKey}:${task.actionKey}`)).toEqual([
      "snake1:advance2", "snake1:skin",
    ]);
    expect(myt.tasks.findIndex((task) => task.id === "MYT:horse:innerDan"))
      .toBeLessThan(myt.tasks.findIndex((task) => task.id === "MYT:snake2:talisman"));

    const futureCatalog = structuredClone(catalog);
    futureCatalog.beastConfig.talismanMissingByFolder.FC = ["snake1"];
    const futureFc = buildTaskPlans(futureCatalog, buildPetViews(futureCatalog), {
      settings: structuredClone(futureCatalog.beastConfig.taskDefaultSettings),
      ...defaultPlanningDates,
      resources: structuredClone(futureCatalog.beastConfig.taskDefaultResources),
      overrides: {},
      gemPriceOverrides: {},
    }).find((plan) => plan.accountId === "FC")!;
    expect(futureFc.tasks.findIndex((task) => task.id === "FC:snake1:skin"))
      .toBeLessThan(futureFc.tasks.findIndex((task) => task.id === "FC:horse:innerDan"));
    expect(futureFc.tasks.findIndex((task) => task.id === "FC:snake1:talisman"))
      .toBeGreaterThan(futureFc.tasks.findIndex((task) => task.id === "FC:horse:strengthen"));
  });

  it("uses dedicated eggs first and recommends buying only the shortage", () => {
    const projections = buildMainlineProjection([plan("FC", [scheduled()])], [current], eggTradePrices);
    expect(projections.map((item) => item.accountId)).toEqual(["FC", "LG1", "PT", "LG2", "MYT"]);
    expect(projections[0]).toMatchObject({
      status: "buyable",
      finishDate: "2026-07-12",
      requirementKind: "eggs",
      requiredAmount: 10,
      allocation: {
        dedicatedUsed: 6,
        regularUsed: 2,
        eggShortage: 2,
        purchaseCostWan: 11,
      },
    });
    expect(projections[0].actionHint).toBe("完成当前任务还缺 2 个蛋。按当前价格购买需 11 万银子，现有 20 万，可直接购买。");
  });

  it("explains an egg purchase shortage as need, available silver and remaining gap", () => {
    const lowSilverSnapshot = structuredClone(current);
    lowSilverSnapshot.accounts.FC.silverWan = 5;
    const projection = buildMainlineProjection([plan("FC", [scheduled()])], [lowSilverSnapshot], eggTradePrices)[0];

    expect(projection.status).toBe("blocked");
    expect(projection.allocation.silverShortageWan).toBe(6);
    expect(projection.actionHint).toBe("完成当前任务还缺 2 个蛋。按当前价格买齐需 11 万银子，现有 5 万，还差 6 万。");
  });

  it("treats talisman washing as an unbounded estimate instead of a completable silver task", () => {
    const talisman = scheduled({
      actionKey: "talisman",
      actionLabel: "洗护符",
      eggCount: 0,
      remainingEggCount: 0,
      priceWan: 15,
      remainingWan: 15,
    });
    const fc = buildMainlineProjection([plan("FC", [talisman])], [current], eggTradePrices)[0];

    expect(fc).toMatchObject({
      status: "caution",
      statusLabel: "成本待定",
      requirementKind: "estimate",
      requiredAmount: 15,
      allocation: { regularEggsToSell: 0, silverShortageWan: 0 },
    });
    expect(fc.actionHint).toContain("15 万仅作预算");
    expect(fc.actionHint).toContain("再进入打书和后续养成");
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
    const projections = buildMainlineProjection(taskPlans, [current], eggTradePrices);
    const lg1 = projections.find((item) => item.accountId === "LG1")!;
    const lg2 = projections.find((item) => item.accountId === "LG2")!;
    expect(lg1.currentTask?.id).toBe("LG1:silver");
    expect(lg1.nextTasks).toHaveLength(3);
    expect(lg1).toMatchObject({
      status: "caution",
      statusLabel: "优先攒银子",
      requirementKind: "silver",
      allocation: { regularEggsToSell: 1, repurchaseLossWan: 0.3 },
    });
    expect(lg1.actionHint).toContain("仅万不得已");
    expect(lg2).toMatchObject({ status: "blocked", requirementKind: "shards", allocation: { shardShortage: 1 } });
  });

  it("uses the 5.2 emergency sale price without recommending ordinary-egg sales", () => {
    const emergencySnapshot = structuredClone(current);
    emergencySnapshot.accounts.LG1.regularEggs = 8;
    const silver = scheduled({
      id: "LG1:silver",
      accountId: "LG1",
      eggCount: 0,
      remainingEggCount: 0,
      priceWan: 46.5,
      remainingWan: 46.5,
    });
    const lg1 = buildMainlineProjection([plan("LG1", [silver])], [emergencySnapshot], eggTradePrices)
      .find((item) => item.accountId === "LG1")!;

    expect(lg1).toMatchObject({
      status: "caution",
      statusLabel: "优先攒银子",
      allocation: { silverShortageWan: 36.5, regularEggsToSell: 8, repurchaseLossWan: 2.4 },
    });
    expect(lg1.actionHint).toBe("还差 36.5 万银子，优先积攒；仅万不得已按 5.2 万/个出售 8 个普通蛋，后续按 5.5 万/个买回将多花 2.4 万");
  });

  it("never treats dedicated eggs as sellable silver and blocks an insufficient emergency sale", () => {
    const insufficientSnapshot = structuredClone(current);
    insufficientSnapshot.accounts.LG1.dedicatedEggs = 99;
    insufficientSnapshot.accounts.LG1.regularEggs = 1;
    const silver = scheduled({
      id: "LG1:silver",
      accountId: "LG1",
      eggCount: 0,
      remainingEggCount: 0,
      priceWan: 15.3,
      remainingWan: 15.3,
    });
    const lg1 = buildMainlineProjection([plan("LG1", [silver])], [insufficientSnapshot], eggTradePrices)
      .find((item) => item.accountId === "LG1")!;

    expect(lg1).toMatchObject({ status: "blocked", allocation: { silverShortageWan: 5.3, regularEggsToSell: 0 } });
    expect(lg1.actionHint).toContain("即使全部按 5.2 万/个紧急出售也不足");
  });

  it("uses no second resource source and marks every account stale without a snapshot", () => {
    const projections = buildMainlineProjection([plan("FC", [scheduled()])], [], eggTradePrices);
    expect(projections.every((item) => item.status === "stale" && item.isFallback)).toBe(true);
    expect(projections[0].inventory).toMatchObject({ dedicatedEggs: 0, regularEggs: 0, silverWan: 0, innerShardCount: null });
  });

  it("does not claim a shard result when a migrated snapshot needs completion", () => {
    const migrated = structuredClone(current);
    migrated.accounts.LG2.innerShardCount = null;
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
    const lg2 = buildMainlineProjection([plan("LG2", [shard])], [migrated], eggTradePrices)
      .find((item) => item.accountId === "LG2")!;
    expect(lg2).toMatchObject({ status: "stale", requirementKind: "shards", actionHint: "请补录该库存日期的内丹碎片" });
  });

  it("does not calculate task dates from missing or incomplete inventory", () => {
    const noInventory = structuredClone(catalog.beastConfig.taskDefaultResources);
    noInventory.FC = { silverWan: 0, eggCount: 0, innerShardCount: null, inventoryRecorded: false };
    const missingPlan = buildTaskPlans(catalog, buildPetViews(catalog), {
      settings: structuredClone(catalog.beastConfig.taskDefaultSettings),
      asOfDate: "2026-07-13",
      inventoryEffectiveDate: "2026-07-13",
      resources: noInventory,
      overrides: {},
      gemPriceOverrides: {},
    }).find((item) => item.accountId === "FC")!;
    expect(missingPlan.tasks.filter((task) => !task.done).every((task) => task.dueDate === "待录库存")).toBe(true);
    expect(missingPlan.finishDate).toBe("待录库存");

    const incomplete = structuredClone(catalog.beastConfig.taskDefaultResources);
    Object.values(incomplete).forEach((resource) => { resource.innerShardCount = null; });
    const incompletePlans = buildTaskPlans(catalog, buildPetViews(catalog), {
      settings: structuredClone(catalog.beastConfig.taskDefaultSettings),
      asOfDate: "2026-07-13",
      inventoryEffectiveDate: "2026-07-13",
      resources: incomplete,
      overrides: {},
      gemPriceOverrides: {},
    });
    const shardTasks = incompletePlans.flatMap((plan) => plan.tasks).filter((task) => task.resourceType === "innerShard");
    expect(shardTasks.length).toBeGreaterThan(0);
    expect(shardTasks.every((task) => task.dueDate === "待补内丹碎片")).toBe(true);
  });

  it("does not promise a date for talisman washing or its downstream tasks", () => {
    const resources = structuredClone(catalog.beastConfig.taskDefaultResources);
    Object.values(resources).forEach((resource) => {
      resource.silverWan = 10_000;
      resource.eggCount = 10_000;
      resource.innerShardCount = 1_000;
    });
    const rows = buildPetViews(catalog);
    const blockedMyt = buildTaskPlans(catalog, rows, {
      settings: structuredClone(catalog.beastConfig.taskDefaultSettings),
      asOfDate: "2026-07-13",
      inventoryEffectiveDate: "2026-07-13",
      resources,
      overrides: {},
      gemPriceOverrides: {},
    }).find((plan) => plan.accountId === "MYT")!;
    expect(blockedMyt.tasks.find((task) => task.id === "MYT:snake2:talisman")?.dueDate).toBe("待洗护符");
    expect(blockedMyt.tasks.find((task) => task.id === "MYT:snake2:book")?.dueDate).toBe("待洗护符");
    expect(blockedMyt.tasks.find((task) => task.id === "MYT:snake2:advance1")?.dueDate).toBe("待洗护符");

    const unlockedMyt = buildTaskPlans(catalog, rows, {
      settings: structuredClone(catalog.beastConfig.taskDefaultSettings),
      asOfDate: "2026-07-13",
      inventoryEffectiveDate: "2026-07-13",
      resources,
      overrides: { "MYT:snake2:talisman": { done: true } },
      gemPriceOverrides: {},
    }).find((plan) => plan.accountId === "MYT")!;
    expect(unlockedMyt.tasks.find((task) => task.id === "MYT:snake2:book")?.dueDate)
      .toBe("2026-07-13");
  });

  it("keeps eggs on the egg track and schedules silver tasks from weekly silver income", () => {
    const resources = structuredClone(catalog.beastConfig.taskDefaultResources);
    resources.FC = { silverWan: 0, eggCount: 10_000, innerShardCount: 50 };
    const fc = buildTaskPlans(catalog, buildPetViews(catalog), {
      settings: structuredClone(catalog.beastConfig.taskDefaultSettings),
      ...defaultPlanningDates,
      resources,
      overrides: {},
      gemPriceOverrides: {},
    }).find((item) => item.accountId === "FC")!;
    const moneyTask = fc.tasks.find((task) => !task.done && task.resourceType === "wan" && task.remainingEggCount === 0);

    expect(fc.availableWan).toBe(0);
    expect(fc.requiredWan).toBeGreaterThan(0);
    expect(moneyTask?.dueDate).toBe("2026-07-26");
  });

  it("buys an egg-task shortage with held silver and reserves that silver from later tasks", () => {
    const rows = buildPetViews(catalog);
    const seedPlans = buildTaskPlans(catalog, rows, {
      settings: structuredClone(catalog.beastConfig.taskDefaultSettings),
      ...defaultPlanningDates,
      resources: structuredClone(catalog.beastConfig.taskDefaultResources),
      overrides: {},
      gemPriceOverrides: {},
    });
    const pair = seedPlans.flatMap((seedPlan) => seedPlan.tasks.flatMap((eggTask, index) => {
      if (!eggTask.remainingEggCount) return [];
      const laterMoneyTask = seedPlan.tasks.slice(index + 1)
        .find((task) => task.resourceType === "wan" && !task.remainingEggCount && task.remainingWan > 0);
      return laterMoneyTask ? [{ accountId: seedPlan.accountId, eggTask, laterMoneyTask, seedPlan }] : [];
    }))[0];
    expect(pair).toBeDefined();
    if (!pair) throw new Error("测试基线缺少先蛋后银子的任务组合");

    const resources = structuredClone(catalog.beastConfig.taskDefaultResources);
    resources[pair.accountId] = { silverWan: pair.eggTask.priceWan, eggCount: 0, innerShardCount: 50 };
    const overrides = Object.fromEntries(pair.seedPlan.tasks
      .filter((task) => task.id !== pair.eggTask.id && task.id !== pair.laterMoneyTask.id)
      .map((task) => [task.id, { done: true }]));
    const planWithPurchase = buildTaskPlans(catalog, rows, {
      settings: structuredClone(catalog.beastConfig.taskDefaultSettings),
      ...defaultPlanningDates,
      resources,
      overrides,
      gemPriceOverrides: {},
    }).find((item) => item.accountId === pair.accountId)!;
    const purchasedEggTask = planWithPurchase.tasks.find((task) => task.id === pair.eggTask.id)!;
    const laterMoneyTask = planWithPurchase.tasks.find((task) => task.id === pair.laterMoneyTask.id)!;

    expect(purchasedEggTask.dueDate).toBe(catalog.beastConfig.taskDefaultSettings.startDate);
    expect(laterMoneyTask.dueDate).toBe("2026-07-26");
  });
});
