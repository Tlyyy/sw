import { z } from "zod";
import type { AccountingEntry, AccountingResources } from "../domain/accounting";
import { defaultGemPlanSettings } from "../domain/gems";
import { parseInventoryExport } from "../domain/inventory";
import type { PublishOptions } from "../domain/publish";
import type {
  BeastTaskSettings,
  GemPlanSettings,
  GemPriceHistoryEntry,
  InventoryExportPayload,
  SilverExpenseRecord,
  TaskCompletionRecord,
} from "../domain/types";
import type { TaskOverride } from "../domain/plans";

const nonNegativeNumber = z.number().finite().nonnegative();
const nonNegativeInteger = nonNegativeNumber.int();
function isRealDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}
const dateKey = z.string().refine(isRealDateKey, "日期必须是真实的 YYYY-MM-DD");
const timestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const accountId = z.enum(["FC", "LG1", "PT", "LG2", "MYT"]);
const accountingResourcesSchema: z.ZodType<AccountingResources> = z.object({
  silverWan: nonNegativeNumber,
  dedicatedEggs: nonNegativeNumber,
  regularEggs: nonNegativeNumber,
  innerShards: nonNegativeNumber.nullable(),
}).strict();
const accountingEntrySchema: z.ZodType<AccountingEntry> = z.object({
  id: z.string().min(1),
  accountId,
  effectiveDate: dateKey,
  occurredAt: timestamp,
  recordedAt: timestamp,
  legs: z.array(z.object({
    kind: z.enum(["expense", "transfer-out", "transfer-in", "adjustment-increase", "adjustment-decrease"]),
    resources: accountingResourcesSchema,
    note: z.string().trim().max(120).optional(),
  }).strict()).min(1),
  taskId: z.string().min(1).optional(),
  groupId: z.string().min(1).optional(),
  source: z.string().min(1).optional(),
  status: z.enum(["confirmed", "draft", "void"]).optional(),
  note: z.string().trim().max(120).optional(),
}).strict();
const taskSettingsSchema = z.object({
  startDate: dateKey,
  thisWeekEggs: nonNegativeNumber,
  weeklyEggs: nonNegativeNumber,
  weeklyDedicatedEggs: nonNegativeNumber.default(2),
  weeklyRegularEggs: nonNegativeNumber.default(2),
  weeklySilverWan: nonNegativeNumber.default(50),
  thisWeekInnerShards: nonNegativeInteger,
  weeklyInnerShards: nonNegativeInteger,
  eggPriceWan: nonNegativeNumber,
}).strict();
const taskOverrideSchema = z.object({ done: z.boolean().optional(), priceWan: nonNegativeNumber.optional() }).strict();
const taskCompletionSchema: z.ZodType<TaskCompletionRecord> = z.object({
  taskId: z.string().min(1),
  completedOn: dateKey,
  recordedAt: timestamp,
  accountId,
  typeLabel: z.string().min(1),
  actionLabel: z.string().min(1),
  taskKind: z.string().min(1),
  resourceKind: z.enum(["silver", "eggs", "innerShards"]),
  resourceAmount: nonNegativeNumber,
  silverSpentWan: nonNegativeNumber,
}).strict();
const silverExpenseSchema: z.ZodType<SilverExpenseRecord> = z.object({
  id: z.string().min(1),
  effectiveDate: dateKey,
  recordedAt: timestamp,
  accountId: accountId.optional(),
  amountWan: z.number().finite().positive(),
  note: z.string().trim().min(1).max(80),
}).strict();
const historyEntrySchema = z.object({
  id: z.string().min(1),
  capturedAt: timestamp,
  source: z.enum(["screenshot", "manual"]),
  items: z.array(z.object({ name: z.string().min(1), price: z.number().finite().positive() }).strict()),
}).strict();
const gemPlanSettingsSchema = z.object({
  targetLevel: z.string().min(1),
  weeklyIncomeWan: nonNegativeNumber,
}).strict().default({ ...defaultGemPlanSettings });

export interface SettingsState {
  version: 4;
  gemPriceOverrides: Record<string, number>;
  settings: BeastTaskSettings;
  overrides: Record<string, TaskOverride>;
  taskCompletions: TaskCompletionRecord[];
  silverExpenses: SilverExpenseRecord[];
  gemPriceHistory: GemPriceHistoryEntry[];
  gemPlan: GemPlanSettings;
}

const settingsStateSchema = z.object({
  version: z.literal(4),
  gemPriceOverrides: z.record(z.string(), nonNegativeNumber),
  settings: taskSettingsSchema,
  overrides: z.record(z.string(), taskOverrideSchema),
  taskCompletions: z.array(taskCompletionSchema),
  silverExpenses: z.array(silverExpenseSchema),
  gemPriceHistory: z.array(historyEntrySchema),
  gemPlan: gemPlanSettingsSchema,
}).strict();

const previousSettingsSchema = z.object({
  version: z.literal(3),
  gemPriceOverrides: z.record(z.string(), nonNegativeNumber),
  settings: taskSettingsSchema,
  overrides: z.record(z.string(), taskOverrideSchema),
  gemPriceHistory: z.array(historyEntrySchema),
  gemPlan: gemPlanSettingsSchema,
}).strict();

const legacySettingsSchema = z.object({
  version: z.literal(2),
  gemPriceOverrides: z.record(z.string(), nonNegativeNumber).optional(),
  settings: taskSettingsSchema.partial().optional(),
  overrides: z.record(z.string(), taskOverrideSchema).optional(),
  gemPriceHistory: z.array(historyEntrySchema).optional(),
  gemPlan: gemPlanSettingsSchema.optional(),
}).passthrough();

function validateMarketState(state: SettingsState, marketNames: string[]) {
  const allowed = new Set(marketNames);
  if (Object.keys(state.gemPriceOverrides).some((name) => !allowed.has(name))) throw new Error("行情覆盖包含未知宝石");
  for (const entry of state.gemPriceHistory) {
    if (entry.items.length !== marketNames.length || new Set(entry.items.map((item) => item.name)).size !== marketNames.length || marketNames.some((name) => !entry.items.some((item) => item.name === name))) {
      throw new Error("行情历史缺少宝石价格或包含重复项");
    }
  }
  return state;
}

export function parseSettingsState(value: unknown, defaults: BeastTaskSettings, marketNames: string[]): SettingsState {
  const raw = typeof value === "string" ? JSON.parse(value) : value;
  if ((raw as { version?: unknown } | null)?.version === 3) {
    const previous = previousSettingsSchema.parse(raw);
    return validateMarketState(settingsStateSchema.parse({
      ...previous,
      version: 4,
      taskCompletions: [],
      silverExpenses: [],
    }) as SettingsState, marketNames);
  }
  if ((raw as { version?: unknown } | null)?.version === 2) {
    const legacy = legacySettingsSchema.parse(raw);
    return validateMarketState(settingsStateSchema.parse({
      version: 4,
      gemPriceOverrides: legacy.gemPriceOverrides || {},
      settings: { ...defaults, ...(legacy.settings || {}) },
      overrides: legacy.overrides || {},
      taskCompletions: [],
      silverExpenses: [],
      gemPriceHistory: legacy.gemPriceHistory || [],
      gemPlan: legacy.gemPlan,
    }) as SettingsState, marketNames);
  }
  return validateMarketState(settingsStateSchema.parse(raw) as SettingsState, marketNames);
}

const publishOptionsSchema = z.object({
  mode: z.enum(["sale", "record"]),
  format: z.enum(["markdown", "plain"]),
  title: z.string(),
  intro: z.string(),
  includeStats: z.boolean(),
  includeSkills: z.boolean(),
  includeNotes: z.boolean(),
  allShots: z.boolean(),
}).strict();

export interface PublishState {
  version: 2;
  selectedIds: string[];
  options: PublishOptions;
  draft: string;
  generatedSource: string;
}

const publishStateSchema = z.object({
  version: z.literal(2),
  selectedIds: z.array(z.string()).transform((items) => [...new Set(items)]),
  options: publishOptionsSchema,
  draft: z.string(),
  generatedSource: z.string(),
}).strict();

const legacyPublishSchema = z.object({
  selectedIds: z.array(z.string()).optional(),
  options: publishOptionsSchema.partial().optional(),
  draft: z.string().optional(),
  generatedSource: z.string().optional(),
}).passthrough();

export function parsePublishState(value: unknown, defaults: PublishOptions): PublishState {
  const raw = typeof value === "string" ? JSON.parse(value) : value;
  const version = (raw as { version?: unknown } | null)?.version;
  if (version !== undefined) {
    if (version !== 2) throw new Error(`不支持的发布状态版本：${String(version)}`);
    return publishStateSchema.parse(raw) as PublishState;
  }
  const legacy = legacyPublishSchema.parse(raw);
  const draft = legacy.draft || "";
  return publishStateSchema.parse({
    version: 2,
    selectedIds: legacy.selectedIds || [],
    options: { ...defaults, ...(legacy.options || {}) },
    draft,
    generatedSource: legacy.generatedSource ?? draft,
  }) as PublishState;
}

export interface UiState {
  version: 2;
  accountScope: "ALL" | "FC" | "LG1" | "PT" | "LG2" | "MYT";
  recentAccount: "FC" | "LG1" | "PT" | "LG2" | "MYT";
  matrixDensity: "compact" | "comfortable";
  matrixDisplay: { stats: boolean; aptitudes: boolean; skills: boolean };
}

export interface AccountingState {
  version: 1;
  entries: AccountingEntry[];
}

const accountingStateSchema = z.object({
  version: z.literal(1),
  entries: z.array(accountingEntrySchema),
}).strict();

export function emptyAccountingState(): AccountingState {
  return { version: 1, entries: [] };
}

export function parseAccountingState(value: unknown): AccountingState {
  if (value === undefined || value === null) return emptyAccountingState();
  const raw = typeof value === "string" ? JSON.parse(value) : value;
  const parsed = accountingStateSchema.parse(raw) as AccountingState;
  const transferGroups = new Map<string, AccountingEntry[]>();
  parsed.entries.forEach((entry) => {
    const transferLegs = entry.legs.filter((leg) => (
      leg.kind === "transfer-out" || leg.kind === "transfer-in"
    ));
    if (!transferLegs.length) return;
    if (!entry.groupId || transferLegs.length !== 1 || entry.legs.length !== 1) {
      throw new Error("账号转移必须由一组可核对的转出与转入记录组成");
    }
    transferGroups.set(entry.groupId, [...(transferGroups.get(entry.groupId) || []), entry]);
  });
  transferGroups.forEach((entries) => {
    const outgoing = entries.find((entry) => entry.legs[0].kind === "transfer-out");
    const incoming = entries.find((entry) => entry.legs[0].kind === "transfer-in");
    const resourcesMatch = outgoing && incoming
      ? JSON.stringify(outgoing.legs[0].resources) === JSON.stringify(incoming.legs[0].resources)
      : false;
    if (
      entries.length !== 2
      || !outgoing
      || !incoming
      || outgoing.accountId === incoming.accountId
      || outgoing.effectiveDate !== incoming.effectiveDate
      || outgoing.occurredAt !== incoming.occurredAt
      || (outgoing.status || "confirmed") !== (incoming.status || "confirmed")
      || !resourcesMatch
    ) {
      throw new Error("账号转移的两端不完整或资源数量不一致");
    }
  });
  return {
    version: 1,
    entries: [...parsed.entries].sort((left, right) => (
      left.effectiveDate.localeCompare(right.effectiveDate)
      || left.occurredAt.localeCompare(right.occurredAt)
      || left.id.localeCompare(right.id)
    )),
  };
}

const uiStateSchema = z.object({
  version: z.literal(2),
  accountScope: z.enum(["ALL", "FC", "LG1", "PT", "LG2", "MYT"]),
  recentAccount: z.enum(["FC", "LG1", "PT", "LG2", "MYT"]),
  matrixDensity: z.enum(["compact", "comfortable"]),
  matrixDisplay: z.object({ stats: z.boolean(), aptitudes: z.boolean(), skills: z.boolean() }).strict(),
}).strict();

const uiDefaults: UiState = {
  version: 2,
  accountScope: "ALL",
  recentAccount: "LG2",
  matrixDensity: "compact",
  matrixDisplay: { stats: true, aptitudes: true, skills: true },
};

const legacyUiSchema = z.object({
  accountScope: z.enum(["ALL", "FC", "LG1", "PT", "LG2", "MYT"]).optional(),
  recentAccount: z.enum(["FC", "LG1", "PT", "LG2", "MYT"]).optional(),
  matrixDensity: z.enum(["compact", "comfortable"]).optional(),
  matrixDisplay: z.object({ stats: z.boolean(), aptitudes: z.boolean(), skills: z.boolean() }).partial().optional(),
}).passthrough();

export function parseUiState(value: unknown): UiState {
  const raw = typeof value === "string" ? JSON.parse(value) : value;
  const version = (raw as { version?: unknown } | null)?.version;
  if (version !== undefined) {
    if (version !== 2) throw new Error(`不支持的界面状态版本：${String(version)}`);
    return uiStateSchema.parse(raw) as UiState;
  }
  const legacy = legacyUiSchema.parse(raw);
  return uiStateSchema.parse({
    ...uiDefaults,
    ...legacy,
    matrixDisplay: { ...uiDefaults.matrixDisplay, ...(legacy.matrixDisplay || {}) },
  }) as UiState;
}

export interface WorkspaceBackup {
  format: "sw-workspace-backup";
  version: 2;
  exportedAt: string;
  inventory: InventoryExportPayload;
  settings: SettingsState;
  publish: PublishState;
  ui: UiState;
  accounting: AccountingState;
}

const workspaceEnvelopeV1Schema = z.object({
  format: z.literal("sw-workspace-backup"),
  version: z.literal(1),
  exportedAt: z.string().refine((value) => Number.isFinite(Date.parse(value))),
  inventory: z.unknown(),
  settings: z.unknown(),
  publish: z.unknown(),
  ui: z.unknown(),
}).strict();

const workspaceEnvelopeV2Schema = z.object({
  format: z.literal("sw-workspace-backup"),
  version: z.literal(2),
  exportedAt: z.string().refine((value) => Number.isFinite(Date.parse(value))),
  inventory: z.unknown(),
  settings: z.unknown(),
  publish: z.unknown(),
  ui: z.unknown(),
  accounting: z.unknown(),
}).strict();

const workspaceEnvelopeSchema = z.discriminatedUnion("version", [
  workspaceEnvelopeV1Schema,
  workspaceEnvelopeV2Schema,
]);

type WorkspaceBackupInput = Omit<WorkspaceBackup, "format" | "version" | "exportedAt" | "accounting"> & {
  accounting?: AccountingState;
};

export function createWorkspaceBackup(parts: WorkspaceBackupInput, now = () => new Date()): WorkspaceBackup {
  return {
    format: "sw-workspace-backup",
    version: 2,
    exportedAt: now().toISOString(),
    ...parts,
    accounting: parseAccountingState(parts.accounting),
  };
}

export function parseWorkspaceBackup(value: string | unknown, defaults: BeastTaskSettings, marketNames: string[]): WorkspaceBackup {
  const raw = typeof value === "string" ? JSON.parse(value) : value;
  const envelope = workspaceEnvelopeSchema.parse(raw);
  return {
    format: "sw-workspace-backup",
    version: 2,
    exportedAt: envelope.exportedAt,
    inventory: parseInventoryExport(envelope.inventory),
    settings: parseSettingsState(envelope.settings, defaults, marketNames),
    publish: parsePublishState(envelope.publish, {
      mode: "sale", format: "markdown", title: "", intro: "",
      includeStats: true, includeSkills: true, includeNotes: true, allShots: true,
    }),
    ui: parseUiState(envelope.ui),
    accounting: parseAccountingState(envelope.version === 2 ? envelope.accounting : undefined),
  };
}
