import { describe, expect, it } from "vitest";
import type {
  AccountId,
  InventoryBalance,
  InventorySnapshot,
  SilverExpenseRecord,
  TaskCompletionRecord,
} from "./types";
import {
  buildAccountingByAccount,
  normalizeAccountingEntries,
  type AccountingEntry,
  type AccountingResources,
} from "./accounting";

const accountIds: AccountId[] = ["FC", "LG1", "PT", "LG2", "MYT"];

function resources(overrides: Partial<AccountingResources> = {}): AccountingResources {
  return {
    silverWan: 0,
    dedicatedEggs: 0,
    regularEggs: 0,
    innerShards: 0,
    ...overrides,
  };
}

function balance(overrides: Partial<InventoryBalance> = {}): InventoryBalance {
  return {
    silverWan: 100,
    dedicatedEggs: 10,
    regularEggs: 5,
    innerShardCount: 20,
    ...overrides,
  };
}

function snapshot(
  effectiveDate: string,
  overrides: Partial<Record<AccountId, Partial<InventoryBalance>>> = {},
  recordedAt = `${effectiveDate}T10:00:00.000Z`,
): InventorySnapshot {
  return {
    effectiveDate,
    recordedAt,
    accounts: Object.fromEntries(accountIds.map((accountId) => [
      accountId,
      balance(overrides[accountId]),
    ])) as InventorySnapshot["accounts"],
  };
}

function entry(overrides: Partial<AccountingEntry> = {}): AccountingEntry {
  return {
    id: "entry-1",
    accountId: "FC",
    effectiveDate: "2026-07-21",
    occurredAt: "2026-07-21T09:00:00.000Z",
    recordedAt: "2026-07-21T09:01:00.000Z",
    status: "confirmed",
    legs: [{ kind: "expense", resources: resources({ silverWan: 20 }) }],
    ...overrides,
  };
}

function completion(overrides: Partial<TaskCompletionRecord> = {}): TaskCompletionRecord {
  return {
    taskId: "FC:snake1:skin",
    completedOn: "2026-07-21",
    recordedAt: "2026-07-21T09:00:00.000Z",
    accountId: "FC",
    typeLabel: "剑气蛇",
    actionLabel: "皮肤",
    taskKind: "进阶",
    resourceKind: "silver",
    resourceAmount: 30,
    silverSpentWan: 30,
    ...overrides,
  };
}

function expense(overrides: Partial<SilverExpenseRecord> = {}): SilverExpenseRecord {
  return {
    id: "old-expense",
    effectiveDate: "2026-07-21",
    recordedAt: "2026-07-21T09:00:00.000Z",
    accountId: "FC",
    amountWan: 20,
    note: "打书",
    ...overrides,
  };
}

describe("independent accounting", () => {
  it("derives daily and week-to-date actual income without changing inventory", () => {
    const before = snapshot("2026-07-19", { FC: { silverWan: 100 } });
    const monday = snapshot("2026-07-20", { FC: { silverWan: 106 } });
    const tuesday = snapshot("2026-07-21", { FC: { silverWan: 110 } });
    const report = buildAccountingByAccount({
      inventorySnapshots: [before, monday, tuesday],
      silverExpenses: [expense()],
      asOfDate: "2026-07-21",
    }).FC;

    expect(report.intervals.at(-1)).toMatchObject({
      kind: "daily",
      intervalDays: 1,
      inventoryNetChange: { silverWan: 4 },
      ledgerImpact: { silverWan: 20 },
      actualIncome: { silverWan: 24 },
    });
    expect(report.week).toMatchObject({
      status: "available",
      baselineDate: "2026-07-19",
      latestSnapshotDate: "2026-07-21",
      inventoryNetChange: { silverWan: 10 },
      ledgerImpact: { silverWan: 20 },
      actualIncome: { silverWan: 30 },
    });
    expect(before.accounts.FC.silverWan).toBe(100);
    expect(tuesday.accounts.FC.silverWan).toBe(110);
  });

  it("restores an egg earned and spent on the same day from the task ledger", () => {
    const report = buildAccountingByAccount({
      inventorySnapshots: [
        snapshot("2026-07-20", {
          FC: { silverWan: 300, dedicatedEggs: 0, regularEggs: 0 },
        }),
        snapshot("2026-07-21", {
          FC: { silverWan: 85.5, dedicatedEggs: 0, regularEggs: 0 },
        }),
      ],
      entries: [entry({
        taskId: "FC:snake1:skin",
        legs: [{
          kind: "expense",
          resources: resources({ silverWan: 214.5, regularEggs: 1 }),
        }],
      })],
      asOfDate: "2026-07-21",
    }).FC.intervals[0];

    expect(report.inventoryNetChange).toMatchObject({
      silverWan: -214.5,
      regularEggs: 0,
    });
    expect(report.ledgerImpact).toMatchObject({
      silverWan: 214.5,
      regularEggs: 1,
    });
    expect(report.actualIncome).toMatchObject({
      silverWan: 0,
      regularEggs: 1,
    });
  });

  it("labels a gap between adjacent observations as an interval, never a daily result", () => {
    const result = buildAccountingByAccount({
      inventorySnapshots: [
        snapshot("2026-07-20"),
        snapshot("2026-07-22", { FC: { silverWan: 112 } }),
      ],
      asOfDate: "2026-07-22",
    }).FC.intervals[0];

    expect(result).toMatchObject({
      kind: "interval",
      intervalDays: 2,
      fromDate: "2026-07-20",
      toDate: "2026-07-22",
    });
  });

  it("keeps entries after the latest real-time snapshot pending, including same-day entries", () => {
    const report = buildAccountingByAccount({
      inventorySnapshots: [
        snapshot("2026-07-20", {}, "2026-07-20T10:00:00.000Z"),
        snapshot("2026-07-21", {}, "2026-07-21T10:00:00.000Z"),
      ],
      entries: [
        entry({ id: "before-cutoff", occurredAt: "2026-07-21T09:59:59.000Z" }),
        entry({ id: "after-cutoff", occurredAt: "2026-07-21T10:00:01.000Z" }),
        entry({
          id: "tomorrow",
          effectiveDate: "2026-07-22",
          occurredAt: "2026-07-22T09:00:00.000Z",
        }),
      ],
      asOfDate: "2026-07-21",
    }).FC;

    expect(report.intervals[0].entries.map((item) => item.id)).toEqual(["before-cutoff"]);
    expect(report.pending.entries.map((item) => item.id)).toEqual(["after-cutoff"]);
    expect(report.pending.ledgerImpact.silverWan).toBe(20);
  });

  it("lets new task entries override legacy completions without collapsing multi-day instalments", () => {
    const newEntries = [
      entry({
        id: "wash-day-1",
        taskId: "FC:snake1:skin",
        legs: [{ kind: "expense", resources: resources({ silverWan: 7 }) }],
      }),
      entry({
        id: "wash-day-2",
        taskId: "FC:snake1:skin",
        occurredAt: "2026-07-21T09:30:00.000Z",
        legs: [{ kind: "expense", resources: resources({ silverWan: 8 }) }],
      }),
    ];
    const normalized = normalizeAccountingEntries({
      entries: newEntries,
      taskCompletions: [completion()],
    });
    const report = buildAccountingByAccount({
      inventorySnapshots: [
        snapshot("2026-07-20"),
        snapshot("2026-07-21"),
      ],
      entries: newEntries,
      taskCompletions: [completion()],
      asOfDate: "2026-07-21",
    }).FC;

    expect(normalized.map((item) => item.id)).toEqual(["wash-day-1", "wash-day-2"]);
    expect(report.intervals[0].ledgerImpact.silverWan).toBe(15);
    expect(report.intervals[0].actualIncome.silverWan).toBe(15);
  });

  it("does not let an unconfirmed draft hide a confirmed legacy task expense", () => {
    const normalized = normalizeAccountingEntries({
      entries: [entry({
        id: "draft-correction",
        taskId: "FC:snake1:skin",
        status: "draft",
      })],
      taskCompletions: [completion()],
    });

    expect(normalized.map((item) => item.id)).toEqual([
      "legacy-task:FC:snake1:skin",
      "draft-correction",
    ]);
  });

  it("neutralizes paired account transfers instead of reporting them as income", () => {
    const transferOut = entry({
      id: "transfer-out",
      accountId: "FC",
      legs: [{ kind: "transfer-out", resources: resources({ silverWan: 10 }) }],
    });
    const transferIn = entry({
      id: "transfer-in",
      accountId: "LG1",
      legs: [{ kind: "transfer-in", resources: resources({ silverWan: 10 }) }],
    });
    const report = buildAccountingByAccount({
      inventorySnapshots: [
        snapshot("2026-07-20"),
        snapshot("2026-07-21", {
          FC: { silverWan: 90 },
          LG1: { silverWan: 110 },
        }),
      ],
      entries: [transferOut, transferIn],
      asOfDate: "2026-07-21",
    });

    expect(report.FC.intervals[0]).toMatchObject({
      inventoryNetChange: { silverWan: -10 },
      ledgerImpact: { silverWan: 10 },
      actualIncome: { silverWan: 0 },
    });
    expect(report.LG1.intervals[0]).toMatchObject({
      inventoryNetChange: { silverWan: 10 },
      ledgerImpact: { silverWan: -10 },
      actualIncome: { silverWan: 0 },
    });
  });

  it("applies non-income adjustments with the correct signs", () => {
    const report = buildAccountingByAccount({
      inventorySnapshots: [
        snapshot("2026-07-20"),
        snapshot("2026-07-21", { FC: { silverWan: 105 } }),
      ],
      entries: [entry({
        legs: [
          { kind: "adjustment-increase", resources: resources({ silverWan: 8 }) },
          { kind: "adjustment-decrease", resources: resources({ silverWan: 3 }) },
        ],
      })],
      asOfDate: "2026-07-21",
    }).FC.intervals[0];

    expect(report).toMatchObject({
      inventoryNetChange: { silverWan: 5 },
      ledgerImpact: { silverWan: -5 },
      actualIncome: { silverWan: 0 },
    });
  });

  it("marks the natural week unavailable when there is no pre-week baseline", () => {
    const week = buildAccountingByAccount({
      inventorySnapshots: [
        snapshot("2026-07-20"),
        snapshot("2026-07-21"),
      ],
      asOfDate: "2026-07-21",
    }).FC.week;

    expect(week).toMatchObject({
      status: "unavailable",
      unavailableReason: "missing-baseline",
      baselineDate: null,
      latestSnapshotDate: "2026-07-21",
      actualIncome: null,
    });
  });

  it("marks the week unavailable when the latest pre-week inventory is not Sunday", () => {
    const week = buildAccountingByAccount({
      inventorySnapshots: [
        snapshot("2026-07-17", { FC: { silverWan: 90 } }),
        snapshot("2026-07-21", { FC: { silverWan: 110 } }),
      ],
      asOfDate: "2026-07-21",
    }).FC.week;

    expect(week).toMatchObject({
      status: "unavailable",
      unavailableReason: "baseline-gap",
      baselineDate: "2026-07-17",
      latestSnapshotDate: "2026-07-21",
      actualIncome: null,
    });
  });

  it("keeps dedicated eggs, regular eggs, and unknown inner shards separate", () => {
    const report = buildAccountingByAccount({
      inventorySnapshots: [
        snapshot("2026-07-20", {
          FC: { dedicatedEggs: 10, regularEggs: 5, innerShardCount: null },
        }),
        snapshot("2026-07-21", {
          FC: { dedicatedEggs: 8, regularEggs: 8, innerShardCount: 30 },
        }),
      ],
      entries: [entry({
        legs: [{
          kind: "expense",
          resources: resources({ dedicatedEggs: 2, regularEggs: 1, innerShards: 4 }),
        }],
      })],
      asOfDate: "2026-07-21",
    }).FC.intervals[0];

    expect(report.inventoryNetChange).toMatchObject({
      dedicatedEggs: -2,
      regularEggs: 3,
      innerShards: null,
    });
    expect(report.ledgerImpact).toMatchObject({
      dedicatedEggs: 2,
      regularEggs: 1,
      innerShards: 4,
    });
    expect(report.actualIncome).toMatchObject({
      dedicatedEggs: 0,
      regularEggs: 4,
      innerShards: null,
    });
  });
});
