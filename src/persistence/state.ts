import { z } from "zod";
import { parseInventoryExport } from "../domain/inventory";
import type { PublishOptions } from "../domain/publish";
import type { BeastTaskSettings, GemPriceHistoryEntry, InventoryExportPayload } from "../domain/types";
import type { TaskOverride } from "../domain/plans";

const nonNegativeNumber = z.number().finite().nonnegative();
const nonNegativeInteger = nonNegativeNumber.int();
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const taskSettingsSchema = z.object({
  startDate: dateKey,
  thisWeekEggs: nonNegativeNumber,
  weeklyEggs: nonNegativeNumber,
  thisWeekInnerShards: nonNegativeInteger,
  weeklyInnerShards: nonNegativeInteger,
  eggPriceWan: nonNegativeNumber,
}).strict();
const taskOverrideSchema = z.object({ done: z.boolean().optional(), priceWan: nonNegativeNumber.optional() }).strict();
const historyEntrySchema = z.object({
  id: z.string().min(1),
  capturedAt: z.string().refine((value) => Number.isFinite(Date.parse(value))),
  source: z.enum(["screenshot", "manual"]),
  items: z.array(z.object({ name: z.string().min(1), price: z.number().finite().positive() }).strict()),
}).strict();

export interface SettingsState {
  version: 3;
  gemPriceOverrides: Record<string, number>;
  settings: BeastTaskSettings;
  overrides: Record<string, TaskOverride>;
  gemPriceHistory: GemPriceHistoryEntry[];
}

const settingsStateSchema = z.object({
  version: z.literal(3),
  gemPriceOverrides: z.record(z.string(), nonNegativeNumber),
  settings: taskSettingsSchema,
  overrides: z.record(z.string(), taskOverrideSchema),
  gemPriceHistory: z.array(historyEntrySchema),
}).strict();

const legacySettingsSchema = z.object({
  version: z.literal(2),
  gemPriceOverrides: z.record(z.string(), nonNegativeNumber).optional(),
  settings: taskSettingsSchema.partial().optional(),
  overrides: z.record(z.string(), taskOverrideSchema).optional(),
  gemPriceHistory: z.array(historyEntrySchema).optional(),
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
  if ((raw as { version?: unknown } | null)?.version === 2) {
    const legacy = legacySettingsSchema.parse(raw);
    return validateMarketState(settingsStateSchema.parse({
      version: 3,
      gemPriceOverrides: legacy.gemPriceOverrides || {},
      settings: { ...defaults, ...(legacy.settings || {}) },
      overrides: legacy.overrides || {},
      gemPriceHistory: legacy.gemPriceHistory || [],
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
  version: 1;
  exportedAt: string;
  inventory: InventoryExportPayload;
  settings: SettingsState;
  publish: PublishState;
  ui: UiState;
}

const workspaceEnvelopeSchema = z.object({
  format: z.literal("sw-workspace-backup"),
  version: z.literal(1),
  exportedAt: z.string().refine((value) => Number.isFinite(Date.parse(value))),
  inventory: z.unknown(),
  settings: z.unknown(),
  publish: z.unknown(),
  ui: z.unknown(),
}).strict();

export function createWorkspaceBackup(parts: Omit<WorkspaceBackup, "format" | "version" | "exportedAt">, now = () => new Date()): WorkspaceBackup {
  return { format: "sw-workspace-backup", version: 1, exportedAt: now().toISOString(), ...parts };
}

export function parseWorkspaceBackup(value: string | unknown, defaults: BeastTaskSettings, marketNames: string[]): WorkspaceBackup {
  const raw = typeof value === "string" ? JSON.parse(value) : value;
  const envelope = workspaceEnvelopeSchema.parse(raw);
  return {
    format: "sw-workspace-backup",
    version: 1,
    exportedAt: envelope.exportedAt,
    inventory: parseInventoryExport(envelope.inventory),
    settings: parseSettingsState(envelope.settings, defaults, marketNames),
    publish: parsePublishState(envelope.publish, {
      mode: "sale", format: "markdown", title: "", intro: "",
      includeStats: true, includeSkills: true, includeNotes: true, allShots: true,
    }),
    ui: parseUiState(envelope.ui),
  };
}
