import type { ScheduledTask } from "./plans";
import type { AccountId, InventoryBalance } from "./types";

export type TaskSettlementMode = "fixed" | "variable" | "progress";

export interface TaskSettlementDraft {
  taskId: string;
  accountId: AccountId;
  actionKey: string;
  mode: TaskSettlementMode;
  /** Null means an actual amount is still required from the user. */
  silverWan: number | null;
  dedicatedEggs: number;
  regularEggs: number;
  innerShardCount: number;
  /**
   * Variable and progress settlements may legitimately cost no silver, but
   * zero must be an explicit user confirmation rather than an empty field.
   */
  zeroConfirmed: boolean;
}

export type TaskSettlementValidationField =
  | "taskId"
  | "accountId"
  | "actionKey"
  | "mode"
  | "silverWan"
  | "dedicatedEggs"
  | "regularEggs"
  | "innerShardCount";

export type TaskSettlementValidationCode =
  | "task-mismatch"
  | "mode-mismatch"
  | "required"
  | "invalid-amount"
  | "fixed-amount-mismatch"
  | "egg-total-mismatch"
  | "unexpected-resource"
  | "zero-unconfirmed";

export interface TaskSettlementValidationIssue {
  field: TaskSettlementValidationField;
  code: TaskSettlementValidationCode;
  message: string;
}

export interface TaskSettlementValidationResult {
  valid: boolean;
  issues: TaskSettlementValidationIssue[];
}

export interface TaskEggSplit {
  dedicatedEggs: number;
  regularEggs: number;
}

export interface TaskEggPurchase {
  usedEggs: number;
  shortageEggs: number;
  unitPriceWan: number;
  silverWan: number;
}

/** Talisman washing is accumulated across days; book writing is one actual-cost settlement. */
export function taskSettlementModeFor(
  task: Pick<ScheduledTask, "actionKey">,
): TaskSettlementMode {
  if (task.actionKey === "talisman") return "progress";
  if (task.actionKey === "book") return "variable";
  return "fixed";
}

/**
 * Prefer held dedicated eggs, then held regular eggs. If the latest inventory
 * cannot cover the requirement, leave the shortage unresolved so the dialog
 * must ask the user for the real source instead of inventing an egg type.
 */
export function suggestTaskEggSplit(
  eggCount: number,
  inventory: Pick<InventoryBalance, "dedicatedEggs" | "regularEggs"> | null | undefined,
): TaskEggSplit {
  const required = Number.isFinite(eggCount) ? Math.max(0, Math.round(eggCount)) : 0;
  const availableDedicated = inventory && Number.isFinite(inventory.dedicatedEggs)
    ? Math.max(0, Math.floor(inventory.dedicatedEggs))
    : 0;
  const availableRegular = inventory && Number.isFinite(inventory.regularEggs)
    ? Math.max(0, Math.floor(inventory.regularEggs))
    : 0;
  const dedicatedEggs = Math.min(required, availableDedicated);
  const regularEggs = Math.min(required - dedicatedEggs, availableRegular);
  return { dedicatedEggs, regularEggs };
}

/**
 * Fixed egg tasks record the eggs actually used, while the latest inventory is
 * only an initial suggestion. Any shortage is bought at the configured
 * regular-egg price and recorded as silver spending; purchased eggs are never
 * invented as inventory consumption.
 */
export function calculateTaskEggPurchase(
  task: Pick<ScheduledTask, "eggCount" | "priceWan">,
  split: TaskEggSplit,
  eggUnitPriceWan?: number,
): TaskEggPurchase {
  const required = Number.isFinite(task.eggCount) ? Math.max(0, Math.round(task.eggCount)) : 0;
  const dedicatedEggs = Number.isFinite(split.dedicatedEggs) ? Math.max(0, split.dedicatedEggs) : 0;
  const regularEggs = Number.isFinite(split.regularEggs) ? Math.max(0, split.regularEggs) : 0;
  const usedEggs = Math.min(required, dedicatedEggs + regularEggs);
  const shortageEggs = Math.max(0, required - usedEggs);
  const fallbackUnitPrice = required > 0 && Number.isFinite(task.priceWan)
    ? Math.max(0, task.priceWan) / required
    : 0;
  const unitPriceWan = eggUnitPriceWan !== undefined && Number.isFinite(eggUnitPriceWan)
    ? Math.max(0, eggUnitPriceWan)
    : fallbackUnitPrice;
  const silverWan = Number((shortageEggs * unitPriceWan).toFixed(2));
  return { usedEggs, shortageEggs, unitPriceWan, silverWan };
}

export function createTaskSettlementDraft(
  task: ScheduledTask,
  inventory?: InventoryBalance | null,
  eggUnitPriceWan?: number,
): TaskSettlementDraft {
  const mode = taskSettlementModeFor(task);
  const base: TaskSettlementDraft = {
    taskId: task.id,
    accountId: task.accountId,
    actionKey: task.actionKey,
    mode,
    silverWan: mode === "fixed" ? 0 : null,
    dedicatedEggs: 0,
    regularEggs: 0,
    innerShardCount: 0,
    zeroConfirmed: false,
  };

  if (mode !== "fixed") return base;

  if (task.resourceType === "innerShard") {
    base.innerShardCount = task.shardCount;
    return base;
  }

  if (task.eggCount > 0) {
    const split = suggestTaskEggSplit(task.eggCount, inventory);
    base.dedicatedEggs = split.dedicatedEggs;
    base.regularEggs = split.regularEggs;
    base.silverWan = calculateTaskEggPurchase(task, split, eggUnitPriceWan).silverWan;
    return base;
  }

  base.silverWan = task.priceWan;
  return base;
}

function isNonNegativeAmount(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value: number) {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function amountsEqual(left: number, right: number) {
  return Math.abs(left - right) < 0.000001;
}

export function validateTaskSettlementDraft(
  task: ScheduledTask,
  draft: TaskSettlementDraft,
  eggUnitPriceWan?: number,
): TaskSettlementValidationResult {
  const issues: TaskSettlementValidationIssue[] = [];
  const add = (
    field: TaskSettlementValidationField,
    code: TaskSettlementValidationCode,
    message: string,
  ) => issues.push({ field, code, message });

  if (draft.taskId !== task.id) add("taskId", "task-mismatch", "结算记录与当前任务不一致");
  if (draft.accountId !== task.accountId) add("accountId", "task-mismatch", "结算账号与当前任务不一致");
  if (draft.actionKey !== task.actionKey) add("actionKey", "task-mismatch", "结算阶段与当前任务不一致");

  const expectedMode = taskSettlementModeFor(task);
  if (draft.mode !== expectedMode) add("mode", "mode-mismatch", "结算方式与任务类型不一致");

  if (draft.silverWan !== null && !isNonNegativeAmount(draft.silverWan)) {
    add("silverWan", "invalid-amount", "银子花费必须是大于或等于 0 的数字");
  }
  if (!isNonNegativeInteger(draft.dedicatedEggs)) {
    add("dedicatedEggs", "invalid-amount", "专用蛋数量必须是非负整数");
  }
  if (!isNonNegativeInteger(draft.regularEggs)) {
    add("regularEggs", "invalid-amount", "普通蛋数量必须是非负整数");
  }
  if (!isNonNegativeInteger(draft.innerShardCount)) {
    add("innerShardCount", "invalid-amount", "内丹碎片数量必须是非负整数");
  }

  if (expectedMode === "variable" || expectedMode === "progress") {
    if (draft.silverWan === null) {
      add("silverWan", "required", expectedMode === "progress" ? "请填写本次实际银子花费" : "请填写实际银子花费");
    } else if (isNonNegativeAmount(draft.silverWan) && draft.silverWan === 0 && !draft.zeroConfirmed) {
      add("silverWan", "zero-unconfirmed", "零支出需要再次确认");
    }
    if (draft.dedicatedEggs !== 0) add("dedicatedEggs", "unexpected-resource", "该任务不应记录专用蛋消耗");
    if (draft.regularEggs !== 0) add("regularEggs", "unexpected-resource", "该任务不应记录普通蛋消耗");
    if (draft.innerShardCount !== 0) add("innerShardCount", "unexpected-resource", "该任务不应记录内丹碎片消耗");
    return { valid: issues.length === 0, issues };
  }

  if (task.resourceType === "innerShard") {
    if (draft.innerShardCount !== task.shardCount) {
      add("innerShardCount", "fixed-amount-mismatch", `固定消耗应为 ${task.shardCount} 片内丹碎片`);
    }
    if (draft.dedicatedEggs !== 0) add("dedicatedEggs", "unexpected-resource", "内丹任务不应记录专用蛋消耗");
    if (draft.regularEggs !== 0) add("regularEggs", "unexpected-resource", "内丹任务不应记录普通蛋消耗");
    if (draft.silverWan !== 0) add("silverWan", "unexpected-resource", "内丹任务没有额外银子消耗");
    return { valid: issues.length === 0, issues };
  }

  if (task.eggCount > 0) {
    if (draft.dedicatedEggs + draft.regularEggs > task.eggCount) {
      add("dedicatedEggs", "egg-total-mismatch", `库存蛋消耗不能超过固定需求 ${task.eggCount} 个`);
    }
    if (draft.innerShardCount !== 0) add("innerShardCount", "unexpected-resource", "蛋任务不应记录内丹碎片消耗");
    const purchase = calculateTaskEggPurchase(task, draft, eggUnitPriceWan);
    if (draft.silverWan === null) {
      add("silverWan", "required", "请确认自动补购银子");
    } else if (isNonNegativeAmount(draft.silverWan) && !amountsEqual(draft.silverWan, purchase.silverWan)) {
      add("silverWan", "fixed-amount-mismatch", `缺少的 ${purchase.shortageEggs} 个蛋应自动计 ${purchase.silverWan} 万银子`);
    }
    return { valid: issues.length === 0, issues };
  }

  if (draft.silverWan === null) {
    add("silverWan", "required", "请确认固定银子花费");
  } else if (isNonNegativeAmount(draft.silverWan) && !amountsEqual(draft.silverWan, task.priceWan)) {
    add("silverWan", "fixed-amount-mismatch", `固定消耗应为 ${task.priceWan} 万银子`);
  }
  if (draft.dedicatedEggs !== 0) add("dedicatedEggs", "unexpected-resource", "银子任务不应记录专用蛋消耗");
  if (draft.regularEggs !== 0) add("regularEggs", "unexpected-resource", "银子任务不应记录普通蛋消耗");
  if (draft.innerShardCount !== 0) add("innerShardCount", "unexpected-resource", "银子任务不应记录内丹碎片消耗");
  return { valid: issues.length === 0, issues };
}

function amountLabel(value: number) {
  const normalized = Number(value.toFixed(2));
  return normalized.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

/** A compact, reader-facing line suitable for a confirmation sheet or task row. */
export function summarizeTaskSettlementDraft(draft: TaskSettlementDraft) {
  const eggCount = draft.dedicatedEggs + draft.regularEggs;
  if (eggCount > 0) {
    const silver = draft.silverWan === null ? "待确认" : `${amountLabel(draft.silverWan)} 万`;
    return `专用蛋 ${draft.dedicatedEggs} 个、普通蛋 ${draft.regularEggs} 个、自动补购银子 ${silver}`;
  }
  if (draft.innerShardCount > 0) return `内丹碎片 ${draft.innerShardCount} 片`;

  const prefix = draft.mode === "progress" ? "本次银子" : draft.mode === "variable" ? "实际银子" : "银子";
  if (draft.silverWan === null) return `${prefix}待填写`;
  if (draft.silverWan === 0 && draft.mode !== "fixed") {
    return `${prefix} 0 万（${draft.zeroConfirmed ? "已确认" : "请确认零支出"}）`;
  }
  return `${prefix} ${amountLabel(draft.silverWan)} 万`;
}
