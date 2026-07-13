import { z } from "zod";
import { accountIds } from "./types";
import type {
  AccountId,
  InventoryAccountDelta,
  InventoryBalance,
  InventoryExportPayload,
  InventorySnapshot,
  InventorySnapshotInput,
} from "./types";

const dayMs = 86_400_000;

function isDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const balanceSchema = z.object({
  dedicatedEggs: z.number().finite().int().nonnegative(),
  regularEggs: z.number().finite().int().nonnegative(),
  silverWan: z.number().finite().nonnegative(),
  innerShardCount: z.number().finite().int().nonnegative().nullable(),
}).strict();

const legacyBalanceSchema = balanceSchema.omit({ innerShardCount: true });

const accountsSchema = z.object({
  FC: balanceSchema,
  LG1: balanceSchema,
  PT: balanceSchema,
  LG2: balanceSchema,
  MYT: balanceSchema,
}).strict();

export const inventorySnapshotSchema = z.object({
  effectiveDate: z.string().refine(isDateKey, "effectiveDate must be a real YYYY-MM-DD date"),
  recordedAt: z.string().refine((value) => Number.isFinite(Date.parse(value)), "recordedAt must be a valid timestamp"),
  accounts: accountsSchema,
}).strict();

const inventoryExportSchema = z.object({
  version: z.literal(2),
  snapshots: z.array(inventorySnapshotSchema),
}).strict();

const legacyInventoryExportSchema = z.object({
  version: z.literal(1),
  snapshots: z.array(z.object({
    effectiveDate: z.string().refine(isDateKey, "effectiveDate must be a real YYYY-MM-DD date"),
    recordedAt: z.string().refine((value) => Number.isFinite(Date.parse(value)), "recordedAt must be a valid timestamp"),
    accounts: z.object({
      FC: legacyBalanceSchema,
      LG1: legacyBalanceSchema,
      PT: legacyBalanceSchema,
      LG2: legacyBalanceSchema,
      MYT: legacyBalanceSchema,
    }).strict(),
  }).strict()),
}).strict();

function cloneBalance(value: InventoryBalance): InventoryBalance {
  return {
    dedicatedEggs: value.dedicatedEggs,
    regularEggs: value.regularEggs,
    silverWan: value.silverWan,
    innerShardCount: value.innerShardCount,
  };
}

function cloneSnapshot(value: InventorySnapshot): InventorySnapshot {
  return {
    effectiveDate: value.effectiveDate,
    recordedAt: value.recordedAt,
    accounts: Object.fromEntries(accountIds.map((accountId) => [accountId, cloneBalance(value.accounts[accountId])])) as Record<AccountId, InventoryBalance>,
  };
}

/** Parse and clone a snapshot so callers never retain mutable input references. */
export function parseInventorySnapshot(value: unknown): InventorySnapshot {
  return cloneSnapshot(inventorySnapshotSchema.parse(value) as InventorySnapshot);
}

/**
 * Validate snapshots, collapse duplicate effective dates with last-write-wins
 * semantics, and sort them chronologically by their business date.
 */
export function normalizeInventorySnapshots(value: unknown): InventorySnapshot[] {
  const parsed = z.array(inventorySnapshotSchema).parse(value) as InventorySnapshot[];
  const byDate = new Map<string, InventorySnapshot>();
  parsed.forEach((snapshot) => byDate.set(snapshot.effectiveDate, cloneSnapshot(snapshot)));
  return [...byDate.values()].sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate));
}

export function createInventorySnapshot(input: InventorySnapshotInput, now = () => new Date()): InventorySnapshot {
  return parseInventorySnapshot({ ...input, recordedAt: input.recordedAt || now().toISOString() });
}

export function upsertInventorySnapshot(snapshots: InventorySnapshot[], input: InventorySnapshotInput, now = () => new Date()): InventorySnapshot[] {
  const next = createInventorySnapshot(input, now);
  return normalizeInventorySnapshots([...snapshots.filter((snapshot) => snapshot.effectiveDate !== next.effectiveDate), next]);
}

export function latestInventoryPair(snapshots: InventorySnapshot[]) {
  const normalized = normalizeInventorySnapshots(snapshots);
  return {
    latest: normalized.at(-1) || null,
    previous: normalized.at(-2) || null,
  };
}

export function calculateInventoryDeltas(
  latest: InventorySnapshot | null | undefined,
  previous: InventorySnapshot | null | undefined,
): Record<AccountId, InventoryAccountDelta> | null {
  if (!latest || !previous) return null;
  const intervalDays = Math.round((Date.parse(`${latest.effectiveDate}T00:00:00Z`) - Date.parse(`${previous.effectiveDate}T00:00:00Z`)) / dayMs);
  if (intervalDays <= 0) return null;
  return Object.fromEntries(accountIds.map((accountId) => {
    const current = latest.accounts[accountId];
    const prior = previous.accounts[accountId];
    return [accountId, {
      accountId,
      fromEffectiveDate: previous.effectiveDate,
      toEffectiveDate: latest.effectiveDate,
      intervalDays,
      dedicatedEggs: current.dedicatedEggs - prior.dedicatedEggs,
      regularEggs: current.regularEggs - prior.regularEggs,
      silverWan: current.silverWan - prior.silverWan,
      innerShardCount: current.innerShardCount === null || prior.innerShardCount === null
        ? null
        : current.innerShardCount - prior.innerShardCount,
    } satisfies InventoryAccountDelta];
  })) as Record<AccountId, InventoryAccountDelta>;
}

export function parseInventoryExport(value: string | unknown): InventoryExportPayload {
  const raw = typeof value === "string" ? JSON.parse(value) : value;
  if ((raw as { version?: unknown } | null)?.version === 1) {
    const legacy = legacyInventoryExportSchema.parse(raw);
    const snapshots = legacy.snapshots.map((snapshot) => ({
      ...snapshot,
      accounts: Object.fromEntries(accountIds.map((accountId) => [accountId, {
        ...snapshot.accounts[accountId],
        innerShardCount: null,
      }])) as Record<AccountId, InventoryBalance>,
    }));
    return { version: 2, snapshots: normalizeInventorySnapshots(snapshots) };
  }
  const parsed = inventoryExportSchema.parse(raw);
  return { version: 2, snapshots: normalizeInventorySnapshots(parsed.snapshots) };
}

export function createInventoryExport(snapshots: InventorySnapshot[]): InventoryExportPayload {
  return { version: 2, snapshots: normalizeInventorySnapshots(snapshots) };
}
