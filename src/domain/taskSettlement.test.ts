import { describe, expect, it } from "vitest";
import type { ScheduledTask } from "./plans";
import type { InventoryBalance } from "./types";
import {
  createTaskSettlementDraft,
  suggestTaskEggSplit,
  summarizeTaskSettlementDraft,
  taskSettlementModeFor,
  validateTaskSettlementDraft,
} from "./taskSettlement";

function scheduledTask(overrides: Partial<ScheduledTask> = {}): ScheduledTask {
  return {
    id: "FC:snake1:ornament",
    accountId: "FC",
    typeKey: "snake1",
    displayTypeKey: "swordSnake",
    typeLabel: "剑气蛇",
    actionKey: "ornament",
    actionLabel: "饰品",
    kind: "确认",
    resourceType: "wan",
    priceWan: 20,
    eggCount: 0,
    shardCount: 0,
    done: false,
    remainingWan: 20,
    remainingEggCount: 0,
    remainingShardCount: 0,
    dueDate: "2026-07-23",
    ...overrides,
  };
}

const inventory: InventoryBalance = {
  dedicatedEggs: 12,
  regularEggs: 40,
  silverWan: 182,
  innerShardCount: 33,
};

describe("task settlement drafts", () => {
  it("classifies talisman as progress, book as variable, and all other actions as fixed", () => {
    expect(taskSettlementModeFor(scheduledTask({ actionKey: "talisman" }))).toBe("progress");
    expect(taskSettlementModeFor(scheduledTask({ actionKey: "book" }))).toBe("variable");
    expect(taskSettlementModeFor(scheduledTask({ actionKey: "skin" }))).toBe("fixed");
  });

  it("prefills a fixed silver task from its planned fixed price", () => {
    const task = scheduledTask();
    const draft = createTaskSettlementDraft(task, inventory);

    expect(draft).toMatchObject({
      mode: "fixed",
      silverWan: 20,
      dedicatedEggs: 0,
      regularEggs: 0,
      innerShardCount: 0,
      zeroConfirmed: false,
    });
    expect(validateTaskSettlementDraft(task, draft)).toEqual({ valid: true, issues: [] });
    expect(summarizeTaskSettlementDraft(draft)).toBe("银子 20 万");
  });

  it("splits a fixed egg requirement against the latest inventory and does not reuse egg valuation as silver", () => {
    const task = scheduledTask({
      id: "FC:snake1:advance1",
      actionKey: "advance1",
      actionLabel: "进阶1",
      priceWan: 165,
      eggCount: 30,
      remainingWan: 165,
      remainingEggCount: 30,
    });
    const draft = createTaskSettlementDraft(task, inventory);

    expect(draft).toMatchObject({
      mode: "fixed",
      dedicatedEggs: 12,
      regularEggs: 18,
      silverWan: 0,
    });
    expect(draft.dedicatedEggs + draft.regularEggs).toBe(task.eggCount);
    expect(validateTaskSettlementDraft(task, draft).valid).toBe(true);
    expect(summarizeTaskSettlementDraft(draft)).toBe("专用蛋 12 个、普通蛋 18 个、额外银子 0 万");
  });

  it("leaves an inventory shortage visible instead of inventing an egg type", () => {
    const task = scheduledTask({
      actionKey: "skin",
      actionLabel: "皮肤",
      priceWan: 165,
      eggCount: 30,
    });
    const split = suggestTaskEggSplit(30, {
      dedicatedEggs: 10,
      regularEggs: 5,
    });
    expect(split).toEqual({
      dedicatedEggs: 10,
      regularEggs: 5,
    });
    expect(validateTaskSettlementDraft(task, {
      ...createTaskSettlementDraft(task, {
        ...inventory,
        dedicatedEggs: 10,
        regularEggs: 5,
      }),
      ...split,
    })).toMatchObject({
      valid: false,
      issues: [expect.objectContaining({ code: "egg-total-mismatch" })],
    });
  });

  it("prefills and validates a fixed inner-shard task", () => {
    const task = scheduledTask({
      id: "FC:horse:innerDan",
      typeKey: "horse",
      displayTypeKey: "horse",
      actionKey: "innerDan",
      actionLabel: "换神兽内丹",
      resourceType: "innerShard",
      priceWan: 0,
      shardCount: 50,
      remainingWan: 0,
      remainingShardCount: 50,
    });
    const draft = createTaskSettlementDraft(task, inventory);

    expect(draft).toMatchObject({ mode: "fixed", silverWan: 0, innerShardCount: 50 });
    expect(validateTaskSettlementDraft(task, draft).valid).toBe(true);
    expect(summarizeTaskSettlementDraft(draft)).toBe("内丹碎片 50 片");
  });

  it.each([
    ["book", "variable", "实际银子待填写"],
    ["talisman", "progress", "本次银子待填写"],
  ] as const)("requires an explicit actual silver amount for %s settlements", (actionKey, mode, summary) => {
    const task = scheduledTask({ actionKey, actionLabel: actionKey === "book" ? "打书" : "洗护符" });
    const draft = createTaskSettlementDraft(task, inventory);

    expect(draft).toMatchObject({ mode, silverWan: null, zeroConfirmed: false });
    expect(validateTaskSettlementDraft(task, draft)).toMatchObject({
      valid: false,
      issues: [expect.objectContaining({ field: "silverWan", code: "required" })],
    });
    expect(summarizeTaskSettlementDraft(draft)).toBe(summary);
  });

  it("allows a variable or progress settlement to record zero only after explicit confirmation", () => {
    const task = scheduledTask({ actionKey: "talisman", actionLabel: "洗护符" });
    const draft = { ...createTaskSettlementDraft(task, inventory), silverWan: 0 };

    expect(validateTaskSettlementDraft(task, draft)).toMatchObject({
      valid: false,
      issues: [expect.objectContaining({ code: "zero-unconfirmed" })],
    });
    expect(summarizeTaskSettlementDraft(draft)).toBe("本次银子 0 万（请确认零支出）");

    draft.zeroConfirmed = true;
    expect(validateTaskSettlementDraft(task, draft)).toEqual({ valid: true, issues: [] });
    expect(summarizeTaskSettlementDraft(draft)).toBe("本次银子 0 万（已确认）");
  });

  it("rejects a fixed egg draft whose dedicated and regular eggs do not match the requirement", () => {
    const task = scheduledTask({
      actionKey: "skin",
      actionLabel: "皮肤",
      priceWan: 220,
      eggCount: 40,
    });
    const draft = createTaskSettlementDraft(task, inventory);
    draft.regularEggs -= 1;

    expect(validateTaskSettlementDraft(task, draft)).toMatchObject({
      valid: false,
      issues: [expect.objectContaining({ code: "egg-total-mismatch" })],
    });
  });
});
