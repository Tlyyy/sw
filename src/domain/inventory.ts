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

export interface InventoryWeekRange {
  weekStart: string;
  weekEnd: string;
}

export interface InventorySnapshotComparison {
  fromEffectiveDate: string;
  toEffectiveDate: string;
  intervalDays: number;
  deltas: Record<AccountId, InventoryAccountDelta>;
}

export const inventoryRegularEggValueWan = 5.5;

export interface InventoryWeeklyChangeSummary {
  dedicatedEggs: number;
  regularEggs: number;
  directSilverWan: number;
  regularEggEquivalentWan: number;
  totalSilverWan: number;
  innerShardCount: number | null;
}

export interface InventoryWeekDaySlot {
  /** Monday is 1 and Sunday is 7. */
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  date: string;
  snapshot: InventorySnapshot | null;
  /** The comparison is against the nearest earlier real snapshot, if one exists. */
  comparison: InventorySnapshotComparison | null;
}

export type InventoryWeeklyChangeBasis = "before-week" | "within-week";

export interface InventoryWeekReport extends InventoryWeekRange {
  anchorDate: string;
  recordedDays: number;
  days: InventoryWeekDaySlot[];
  /**
   * Prefer the nearest snapshot before Monday as the baseline. If none exists,
   * compare the first and last observations inside the week when possible.
   */
  weeklyChange: InventorySnapshotComparison | null;
  weeklyChangeBasis: InventoryWeeklyChangeBasis | null;
}

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

function parseDateKey(value: string) {
  if (!isDateKey(value)) throw new Error("date must be a real YYYY-MM-DD date");
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addDateKeyDays(value: string, days: number) {
  return formatDateKey(new Date(parseDateKey(value).getTime() + days * dayMs));
}

/** Return the Monday-to-Sunday natural week containing a YYYY-MM-DD date. */
export function naturalWeekRange(anchorDate: string): InventoryWeekRange {
  const anchor = parseDateKey(anchorDate);
  const daysSinceMonday = (anchor.getUTCDay() + 6) % 7;
  const weekStart = formatDateKey(new Date(anchor.getTime() - daysSinceMonday * dayMs));
  return { weekStart, weekEnd: addDateKeyDays(weekStart, 6) };
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

function normalizeWan(value: number) {
  const rounded = Math.round((value + Math.sign(value) * Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Value pure silver plus ordinary eggs at the fixed inventory reporting rate. */
export function inventorySilverWithRegularEggsWan(
  value: Pick<InventoryBalance, "regularEggs" | "silverWan">,
) {
  return normalizeWan(value.silverWan + value.regularEggs * inventoryRegularEggValueWan);
}

/**
 * Sum five-account weekly changes and value ordinary eggs at the fixed
 * inventory reporting rate. Monetary outputs are normalized to two decimals.
 */
export function summarizeInventoryWeeklyChange(
  deltas: Record<AccountId, InventoryAccountDelta>,
): InventoryWeeklyChangeSummary {
  const rows = accountIds.map((accountId) => deltas[accountId]);
  const dedicatedEggs = rows.reduce((sum, row) => sum + row.dedicatedEggs, 0);
  const regularEggs = rows.reduce((sum, row) => sum + row.regularEggs, 0);
  const directSilverWan = normalizeWan(rows.reduce((sum, row) => sum + row.silverWan, 0));
  const regularEggEquivalentWan = normalizeWan(regularEggs * inventoryRegularEggValueWan);
  const totalSilverWan = normalizeWan(directSilverWan + regularEggEquivalentWan);
  const innerShardCount = rows.some((row) => row.innerShardCount === null)
    ? null
    : rows.reduce((sum, row) => sum + (row.innerShardCount ?? 0), 0);

  return {
    dedicatedEggs,
    regularEggs,
    directSilverWan,
    regularEggEquivalentWan,
    totalSilverWan,
    innerShardCount,
  };
}

function compareInventorySnapshots(
  latest: InventorySnapshot | null | undefined,
  previous: InventorySnapshot | null | undefined,
): InventorySnapshotComparison | null {
  const deltas = calculateInventoryDeltas(latest, previous);
  if (!latest || !previous || !deltas) return null;
  return {
    fromEffectiveDate: previous.effectiveDate,
    toEffectiveDate: latest.effectiveDate,
    intervalDays: deltas.FC.intervalDays,
    deltas,
  };
}

/**
 * Derive one natural-week report without inventing observations for missing
 * dates. Every recorded day compares with the nearest earlier real snapshot,
 * even when that snapshot belongs to an earlier week.
 */
export function buildInventoryWeekReport(
  snapshots: InventorySnapshot[],
  anchorDate: string,
): InventoryWeekReport {
  const { weekStart, weekEnd } = naturalWeekRange(anchorDate);
  const normalized = normalizeInventorySnapshots(snapshots);
  const snapshotsByDate = new Map(normalized.map((snapshot) => [snapshot.effectiveDate, snapshot]));
  const previousByDate = new Map<string, InventorySnapshot | null>();
  let previousSnapshot: InventorySnapshot | null = null;

  normalized.forEach((snapshot) => {
    previousByDate.set(snapshot.effectiveDate, previousSnapshot);
    previousSnapshot = snapshot;
  });

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDateKeyDays(weekStart, index);
    const snapshot = snapshotsByDate.get(date) || null;
    return {
      weekday: (index + 1) as InventoryWeekDaySlot["weekday"],
      date,
      snapshot,
      comparison: snapshot
        ? compareInventorySnapshots(snapshot, previousByDate.get(date))
        : null,
    } satisfies InventoryWeekDaySlot;
  });

  const weekSnapshots = normalized.filter((snapshot) => (
    snapshot.effectiveDate >= weekStart && snapshot.effectiveDate <= weekEnd
  ));
  const baseline = normalized.filter((snapshot) => snapshot.effectiveDate < weekStart).at(-1) || null;
  const latestInWeek = weekSnapshots.at(-1) || null;
  let weeklyChange: InventorySnapshotComparison | null = null;
  let weeklyChangeBasis: InventoryWeeklyChangeBasis | null = null;

  if (baseline && latestInWeek) {
    weeklyChange = compareInventorySnapshots(latestInWeek, baseline);
    weeklyChangeBasis = weeklyChange ? "before-week" : null;
  } else if (weekSnapshots.length >= 2) {
    weeklyChange = compareInventorySnapshots(weekSnapshots.at(-1), weekSnapshots[0]);
    weeklyChangeBasis = weeklyChange ? "within-week" : null;
  }

  return {
    anchorDate,
    weekStart,
    weekEnd,
    recordedDays: weekSnapshots.length,
    days,
    weeklyChange,
    weeklyChangeBasis,
  };
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
