import { naturalWeekRange, normalizeInventorySnapshots } from "./inventory";
import { accountIds } from "./types";
import type {
  AccountId,
  InventoryBalance,
  InventorySnapshot,
  SilverExpenseRecord,
  TaskCompletionRecord,
} from "./types";

const dayMs = 86_400_000;

/**
 * Quantities are kept in their native units. Silver is measured in 万; eggs
 * and inner shards are counts. `innerShards` is null only when an inventory
 * observation cannot provide that balance.
 */
export interface AccountingResources {
  silverWan: number;
  dedicatedEggs: number;
  regularEggs: number;
  innerShards: number | null;
}

export type AccountingLegKind =
  | "expense"
  | "transfer-out"
  | "transfer-in"
  | "adjustment-increase"
  | "adjustment-decrease";

export type AccountingEntryStatus = "confirmed" | "draft" | "void";

export interface AccountingLeg {
  kind: AccountingLegKind;
  resources: AccountingResources;
  note?: string;
}

/**
 * An entry belongs to one account and may contain several resource legs. A
 * transfer is represented by paired entries (transfer-out and transfer-in)
 * so each account remains independently auditable.
 */
export interface AccountingEntry {
  id: string;
  accountId: AccountId;
  effectiveDate: string;
  /** When the spend/transfer actually occurred; used at same-day cut-offs. */
  occurredAt: string;
  /** Audit timestamp for creation or the latest replacement of this entry. */
  recordedAt: string;
  legs: AccountingLeg[];
  taskId?: string;
  /** Links paired transfer entries or related records created in one action. */
  groupId?: string;
  source?: string;
  status?: AccountingEntryStatus;
  note?: string;
}

export interface AccountingEntryNormalizationInput {
  entries?: AccountingEntry[];
  taskCompletions?: TaskCompletionRecord[];
  silverExpenses?: SilverExpenseRecord[];
  /** Legacy task records did not distinguish egg types. */
  legacyEggKind?: "dedicatedEggs" | "regularEggs";
}

export interface AccountingNormalizationInput extends AccountingEntryNormalizationInput {
  inventorySnapshots: InventorySnapshot[];
}

export interface NormalizedAccountingData {
  inventorySnapshots: InventorySnapshot[];
  entries: AccountingEntry[];
  /** Old records without an account cannot safely participate in per-account results. */
  unassignedSilverExpenses: SilverExpenseRecord[];
}

export type AccountingLegTotals = Record<AccountingLegKind, AccountingResources>;
export type AccountingIntervalKind = "daily" | "interval";

export interface AccountingIntervalResult {
  accountId: AccountId;
  kind: AccountingIntervalKind;
  fromDate: string;
  toDate: string;
  fromRecordedAt: string;
  toRecordedAt: string;
  intervalDays: number;
  inventoryNetChange: AccountingResources;
  ledgerByKind: AccountingLegTotals;
  ledgerImpact: AccountingResources;
  actualIncome: AccountingResources;
  entries: AccountingEntry[];
}

export type AccountingWeekUnavailableReason =
  | "missing-baseline"
  | "baseline-gap"
  | "missing-current-snapshot";

export interface AccountingWeekResult {
  accountId: AccountId;
  weekStart: string;
  weekEnd: string;
  reportEnd: string;
  status: "available" | "unavailable";
  unavailableReason: AccountingWeekUnavailableReason | null;
  baselineDate: string | null;
  latestSnapshotDate: string | null;
  inventoryNetChange: AccountingResources | null;
  ledgerByKind: AccountingLegTotals;
  ledgerImpact: AccountingResources | null;
  actualIncome: AccountingResources | null;
  entries: AccountingEntry[];
}

export interface AccountingPendingResult {
  accountId: AccountId;
  afterSnapshotDate: string | null;
  ledgerByKind: AccountingLegTotals;
  ledgerImpact: AccountingResources;
  entries: AccountingEntry[];
}

export interface AccountAccountingSummary {
  accountId: AccountId;
  latestSnapshotDate: string | null;
  intervals: AccountingIntervalResult[];
  week: AccountingWeekResult;
  pending: AccountingPendingResult;
}

export interface BuildAccountingInput extends AccountingNormalizationInput {
  asOfDate: string;
}

function isDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function assertDateKey(value: string, label: string) {
  if (!isDateKey(value)) throw new Error(`${label} must be a real YYYY-MM-DD date`);
}

function assertTimestamp(value: string, label: string) {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${label} must be a valid timestamp`);
}

function normalizeNumber(value: number) {
  if (!Number.isFinite(value)) throw new Error("accounting resource amounts must be finite");
  const rounded = Math.round((value + Math.sign(value) * Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function zeroResources(innerShards: number | null = 0): AccountingResources {
  return {
    silverWan: 0,
    dedicatedEggs: 0,
    regularEggs: 0,
    innerShards,
  };
}

function cloneResources(value: AccountingResources): AccountingResources {
  return {
    silverWan: normalizeNumber(value.silverWan),
    dedicatedEggs: normalizeNumber(value.dedicatedEggs),
    regularEggs: normalizeNumber(value.regularEggs),
    innerShards: value.innerShards === null ? null : normalizeNumber(value.innerShards),
  };
}

function normalizeLegResources(value: AccountingResources): AccountingResources {
  const normalized = {
    silverWan: normalizeNumber(value.silverWan),
    dedicatedEggs: normalizeNumber(value.dedicatedEggs),
    regularEggs: normalizeNumber(value.regularEggs),
    innerShards: value.innerShards === null ? 0 : normalizeNumber(value.innerShards),
  };
  if (Object.values(normalized).some((amount) => amount < 0)) {
    throw new Error("accounting leg resource amounts must be non-negative");
  }
  return normalized;
}

function cloneEntry(entry: AccountingEntry): AccountingEntry {
  assertDateKey(entry.effectiveDate, "entry.effectiveDate");
  assertTimestamp(entry.occurredAt, "entry.occurredAt");
  assertTimestamp(entry.recordedAt, "entry.recordedAt");
  return {
    ...entry,
    status: entry.status || "confirmed",
    legs: entry.legs.map((leg) => ({
      ...leg,
      resources: normalizeLegResources(leg.resources),
    })),
  };
}

function legacyTaskResources(
  record: TaskCompletionRecord,
  legacyEggKind: "dedicatedEggs" | "regularEggs",
) {
  const resources = zeroResources();
  if (record.resourceKind === "eggs") {
    resources[legacyEggKind] = normalizeNumber(record.resourceAmount);
  } else if (record.resourceKind === "innerShards") {
    resources.innerShards = normalizeNumber(record.resourceAmount);
  }
  if (record.silverSpentWan > 0) {
    resources.silverWan = normalizeNumber(record.silverSpentWan);
  }
  return resources;
}

export function accountingEntryFromLegacyTaskCompletion(
  record: TaskCompletionRecord,
  legacyEggKind: "dedicatedEggs" | "regularEggs" = "dedicatedEggs",
): AccountingEntry {
  return cloneEntry({
    id: `legacy-task:${record.taskId}`,
    accountId: record.accountId,
    effectiveDate: record.completedOn,
    occurredAt: record.recordedAt,
    recordedAt: record.recordedAt,
    taskId: record.taskId,
    source: "legacy-task-completion",
    status: "confirmed",
    note: `${record.typeLabel} · ${record.actionLabel}`,
    legs: [{
      kind: "expense",
      resources: legacyTaskResources(record, legacyEggKind),
    }],
  });
}

function normalizeLegacyExpense(record: SilverExpenseRecord): AccountingEntry | null {
  if (!record.accountId) return null;
  return cloneEntry({
    id: `legacy-silver-expense:${record.id}`,
    accountId: record.accountId,
    effectiveDate: record.effectiveDate,
    occurredAt: record.recordedAt,
    recordedAt: record.recordedAt,
    source: "legacy-silver-expense",
    status: "confirmed",
    note: record.note,
    legs: [{
      kind: "expense",
      resources: {
        ...zeroResources(),
        silverWan: normalizeNumber(record.amountWan),
      },
    }],
  });
}

function entrySort(left: AccountingEntry, right: AccountingEntry) {
  return left.effectiveDate.localeCompare(right.effectiveDate)
    || Date.parse(left.occurredAt) - Date.parse(right.occurredAt)
    || Date.parse(left.recordedAt) - Date.parse(right.recordedAt)
    || left.id.localeCompare(right.id);
}

/**
 * Convert new and legacy records into one immutable stream. Independent task
 * entries are authoritative: their taskId suppresses the old completion fact,
 * while multiple new instalments for the same multi-day task remain intact.
 */
export function normalizeAccountingEntries(
  input: AccountingEntryNormalizationInput,
): AccountingEntry[] {
  const newEntries = (input.entries || []).map(cloneEntry);
  const newTaskIds = new Set(newEntries.flatMap((entry) => (
    entry.taskId && (entry.status || "confirmed") !== "draft" ? [entry.taskId] : []
  )));
  const legacyEggKind = input.legacyEggKind || "dedicatedEggs";
  const legacyTasksById = new Map<string, TaskCompletionRecord>();
  (input.taskCompletions || []).forEach((record) => {
    if (!newTaskIds.has(record.taskId)) legacyTasksById.set(record.taskId, record);
  });
  const legacyTasks = [...legacyTasksById.values()]
    .map((record) => accountingEntryFromLegacyTaskCompletion(record, legacyEggKind));
  const legacyExpenses = (input.silverExpenses || [])
    .map(normalizeLegacyExpense)
    .filter((entry): entry is AccountingEntry => entry !== null);

  const byId = new Map<string, AccountingEntry>();
  [...legacyTasks, ...legacyExpenses, ...newEntries].forEach((entry) => {
    byId.set(entry.id, entry);
  });
  return [...byId.values()].sort(entrySort);
}

export function normalizeAccountingData(
  input: AccountingNormalizationInput,
): NormalizedAccountingData {
  return {
    inventorySnapshots: normalizeInventorySnapshots(input.inventorySnapshots),
    entries: normalizeAccountingEntries(input),
    unassignedSilverExpenses: (input.silverExpenses || [])
      .filter((entry) => !entry.accountId)
      .map((entry) => ({ ...entry })),
  };
}

function dateDistance(from: string, to: string) {
  return Math.round((
    Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)
  ) / dayMs);
}

function inventoryResources(balance: InventoryBalance): AccountingResources {
  return {
    silverWan: balance.silverWan,
    dedicatedEggs: balance.dedicatedEggs,
    regularEggs: balance.regularEggs,
    innerShards: balance.innerShardCount,
  };
}

function subtractResources(
  current: AccountingResources,
  previous: AccountingResources,
): AccountingResources {
  return {
    silverWan: normalizeNumber(current.silverWan - previous.silverWan),
    dedicatedEggs: normalizeNumber(current.dedicatedEggs - previous.dedicatedEggs),
    regularEggs: normalizeNumber(current.regularEggs - previous.regularEggs),
    innerShards: current.innerShards === null || previous.innerShards === null
      ? null
      : normalizeNumber(current.innerShards - previous.innerShards),
  };
}

function addResources(
  left: AccountingResources,
  right: AccountingResources,
): AccountingResources {
  return {
    silverWan: normalizeNumber(left.silverWan + right.silverWan),
    dedicatedEggs: normalizeNumber(left.dedicatedEggs + right.dedicatedEggs),
    regularEggs: normalizeNumber(left.regularEggs + right.regularEggs),
    innerShards: left.innerShards === null || right.innerShards === null
      ? null
      : normalizeNumber(left.innerShards + right.innerShards),
  };
}

function scaleResources(value: AccountingResources, factor: number): AccountingResources {
  return {
    silverWan: normalizeNumber(value.silverWan * factor),
    dedicatedEggs: normalizeNumber(value.dedicatedEggs * factor),
    regularEggs: normalizeNumber(value.regularEggs * factor),
    innerShards: value.innerShards === null
      ? 0
      : normalizeNumber(value.innerShards * factor),
  };
}

function emptyLegTotals(): AccountingLegTotals {
  return {
    expense: zeroResources(),
    "transfer-out": zeroResources(),
    "transfer-in": zeroResources(),
    "adjustment-increase": zeroResources(),
    "adjustment-decrease": zeroResources(),
  };
}

function sumLegs(entries: AccountingEntry[]) {
  const byKind = emptyLegTotals();
  entries.forEach((entry) => {
    entry.legs.forEach((leg) => {
      byKind[leg.kind] = addResources(byKind[leg.kind], cloneResources(leg.resources));
    });
  });
  const positive = addResources(
    addResources(byKind.expense, byKind["transfer-out"]),
    byKind["adjustment-decrease"],
  );
  const negative = addResources(byKind["transfer-in"], byKind["adjustment-increase"]);
  return {
    byKind,
    impact: addResources(positive, scaleResources(negative, -1)),
  };
}

function confirmedAccountEntries(entries: AccountingEntry[], accountId: AccountId) {
  return entries.filter((entry) => (
    entry.accountId === accountId
    && (entry.status || "confirmed") === "confirmed"
  )).sort(entrySort);
}

function isAfterSnapshot(entry: AccountingEntry, snapshot: InventorySnapshot) {
  if (entry.effectiveDate !== snapshot.effectiveDate) {
    return entry.effectiveDate > snapshot.effectiveDate;
  }
  return Date.parse(entry.occurredAt) > Date.parse(snapshot.recordedAt);
}

function isAtOrBeforeSnapshot(entry: AccountingEntry, snapshot: InventorySnapshot) {
  if (entry.effectiveDate !== snapshot.effectiveDate) {
    return entry.effectiveDate < snapshot.effectiveDate;
  }
  return Date.parse(entry.occurredAt) <= Date.parse(snapshot.recordedAt);
}

function entriesBetweenSnapshots(
  entries: AccountingEntry[],
  from: InventorySnapshot,
  to: InventorySnapshot,
) {
  return entries.filter((entry) => (
    isAfterSnapshot(entry, from) && isAtOrBeforeSnapshot(entry, to)
  ));
}

/** Reconcile one account across two real inventory observations. */
export function buildAccountingInterval(
  accountId: AccountId,
  from: InventorySnapshot,
  to: InventorySnapshot,
  entries: AccountingEntry[],
): AccountingIntervalResult {
  const intervalDays = dateDistance(from.effectiveDate, to.effectiveDate);
  if (intervalDays <= 0) throw new Error("accounting interval snapshots must be chronological");
  const accountEntries = entriesBetweenSnapshots(
    confirmedAccountEntries(entries, accountId),
    from,
    to,
  );
  const inventoryNetChange = subtractResources(
    inventoryResources(to.accounts[accountId]),
    inventoryResources(from.accounts[accountId]),
  );
  const ledger = sumLegs(accountEntries);
  return {
    accountId,
    kind: intervalDays === 1 ? "daily" : "interval",
    fromDate: from.effectiveDate,
    toDate: to.effectiveDate,
    fromRecordedAt: from.recordedAt,
    toRecordedAt: to.recordedAt,
    intervalDays,
    inventoryNetChange,
    ledgerByKind: ledger.byKind,
    ledgerImpact: ledger.impact,
    actualIncome: addResources(inventoryNetChange, ledger.impact),
    entries: accountEntries,
  };
}

/** Build the natural-week result through `asOfDate` for one account. */
export function buildAccountingWeek(
  accountId: AccountId,
  snapshots: InventorySnapshot[],
  entries: AccountingEntry[],
  asOfDate: string,
): AccountingWeekResult {
  assertDateKey(asOfDate, "asOfDate");
  const { weekStart, weekEnd } = naturalWeekRange(asOfDate);
  const reportEnd = asOfDate < weekEnd ? asOfDate : weekEnd;
  const normalizedSnapshots = normalizeInventorySnapshots(snapshots);
  const baseline = normalizedSnapshots
    .filter((snapshot) => snapshot.effectiveDate < weekStart)
    .at(-1) || null;
  const hasAdjacentBaseline = Boolean(
    baseline && dateDistance(baseline.effectiveDate, weekStart) === 1,
  );
  const latest = normalizedSnapshots
    .filter((snapshot) => snapshot.effectiveDate >= weekStart && snapshot.effectiveDate <= reportEnd)
    .at(-1) || null;
  const unavailableReason: AccountingWeekUnavailableReason | null = !baseline
    ? "missing-baseline"
    : !hasAdjacentBaseline
      ? "baseline-gap"
    : !latest
      ? "missing-current-snapshot"
      : null;

  if (!baseline || !hasAdjacentBaseline || !latest) {
    return {
      accountId,
      weekStart,
      weekEnd,
      reportEnd,
      status: "unavailable",
      unavailableReason,
      baselineDate: baseline?.effectiveDate || null,
      latestSnapshotDate: latest?.effectiveDate || null,
      inventoryNetChange: null,
      ledgerByKind: emptyLegTotals(),
      ledgerImpact: null,
      actualIncome: null,
      entries: [],
    };
  }

  const interval = buildAccountingInterval(accountId, baseline, latest, entries);
  return {
    accountId,
    weekStart,
    weekEnd,
    reportEnd,
    status: "available",
    unavailableReason: null,
    baselineDate: baseline.effectiveDate,
    latestSnapshotDate: latest.effectiveDate,
    inventoryNetChange: interval.inventoryNetChange,
    ledgerByKind: interval.ledgerByKind,
    ledgerImpact: interval.ledgerImpact,
    actualIncome: interval.actualIncome,
    entries: interval.entries,
  };
}

function buildPending(
  accountId: AccountId,
  snapshots: InventorySnapshot[],
  entries: AccountingEntry[],
  asOfDate: string,
): AccountingPendingResult {
  const latest = snapshots.filter((snapshot) => snapshot.effectiveDate <= asOfDate).at(-1) || null;
  const pendingEntries = confirmedAccountEntries(entries, accountId)
    .filter((entry) => entry.effectiveDate <= asOfDate)
    .filter((entry) => !latest || isAfterSnapshot(entry, latest));
  const ledger = sumLegs(pendingEntries);
  return {
    accountId,
    afterSnapshotDate: latest?.effectiveDate || null,
    ledgerByKind: ledger.byKind,
    ledgerImpact: ledger.impact,
    entries: pendingEntries,
  };
}

/**
 * Build adjacent-snapshot, week-to-date, and unreconciled results for all
 * accounts. Inventory stays authoritative; this function never mutates it.
 */
export function buildAccountingByAccount(
  input: BuildAccountingInput,
): Record<AccountId, AccountAccountingSummary> {
  assertDateKey(input.asOfDate, "asOfDate");
  const normalized = normalizeAccountingData(input);
  const snapshots = normalized.inventorySnapshots
    .filter((snapshot) => snapshot.effectiveDate <= input.asOfDate);

  return Object.fromEntries(accountIds.map((accountId) => {
    const intervals = snapshots.slice(1).map((to, index) => (
      buildAccountingInterval(accountId, snapshots[index], to, normalized.entries)
    ));
    const latest = snapshots.at(-1) || null;
    return [accountId, {
      accountId,
      latestSnapshotDate: latest?.effectiveDate || null,
      intervals,
      week: buildAccountingWeek(
        accountId,
        snapshots,
        normalized.entries,
        input.asOfDate,
      ),
      pending: buildPending(
        accountId,
        snapshots,
        normalized.entries,
        input.asOfDate,
      ),
    } satisfies AccountAccountingSummary];
  })) as Record<AccountId, AccountAccountingSummary>;
}
