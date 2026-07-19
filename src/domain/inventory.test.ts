import { describe, expect, it } from "vitest";
import {
  buildInventoryWeekReport,
  calculateInventoryDeltas,
  createInventoryExport,
  inventoryRegularEggValueWan,
  latestInventoryPair,
  naturalWeekRange,
  normalizeInventorySnapshots,
  parseInventoryExport,
  summarizeInventoryWeeklyChange,
  upsertInventorySnapshot,
} from "./inventory";
import type { AccountId, InventoryBalance, InventorySnapshot } from "./types";

const ids: AccountId[] = ["FC", "LG1", "PT", "LG2", "MYT"];

function accounts(seed: number) {
  return Object.fromEntries(ids.map((accountId, index) => [accountId, {
    dedicatedEggs: seed + index,
    regularEggs: seed * 2 + index,
    silverWan: seed * 10 + index,
    innerShardCount: seed * 3 + index,
  }])) as Record<AccountId, InventoryBalance>;
}

function snapshot(effectiveDate: string, seed: number): InventorySnapshot {
  return { effectiveDate, recordedAt: `${effectiveDate}T12:00:00.000Z`, accounts: accounts(seed) };
}

describe("inventory snapshots", () => {
  it("sorts backfills and upserts the same effective date", () => {
    const initial = normalizeInventorySnapshots([snapshot("2026-07-10", 10), snapshot("2026-07-01", 1)]);
    expect(initial.map((item) => item.effectiveDate)).toEqual(["2026-07-01", "2026-07-10"]);

    const updated = upsertInventorySnapshot(initial, {
      effectiveDate: "2026-07-10",
      recordedAt: "2026-07-12T09:00:00.000Z",
      accounts: accounts(20),
    });
    expect(updated).toHaveLength(2);
    expect(updated.at(-1)?.accounts.FC.dedicatedEggs).toBe(20);
    expect(updated.at(-1)?.recordedAt).toBe("2026-07-12T09:00:00.000Z");
  });

  it("returns the latest pair and per-account net delta", () => {
    const history = [snapshot("2026-07-01", 1), snapshot("2026-07-11", 3)];
    const pair = latestInventoryPair(history);
    const deltas = calculateInventoryDeltas(pair.latest, pair.previous);
    expect(deltas?.FC).toMatchObject({
      fromEffectiveDate: "2026-07-01",
      toEffectiveDate: "2026-07-11",
      intervalDays: 10,
      dedicatedEggs: 2,
      regularEggs: 4,
      silverWan: 20,
      innerShardCount: 6,
    });
  });

  it("round-trips a versioned export and rejects partial account batches", () => {
    const payload = createInventoryExport([snapshot("2026-07-11", 3)]);
    expect(parseInventoryExport(JSON.stringify(payload))).toEqual(payload);
    expect(() => parseInventoryExport({
      version: 2,
      snapshots: [{
        effectiveDate: "2026-07-11",
        recordedAt: "2026-07-11T12:00:00.000Z",
        accounts: { FC: accounts(1).FC },
      }],
    })).toThrow();
  });

  it("migrates v1 snapshots without inventing dated inner-fragment values", () => {
    const migrated = parseInventoryExport({
      version: 1,
      snapshots: [{
        effectiveDate: "2026-07-11",
        recordedAt: "2026-07-11T12:00:00.000Z",
        accounts: Object.fromEntries(ids.map((accountId, index) => [accountId, {
          dedicatedEggs: index,
          regularEggs: index + 1,
          silverWan: index + 2,
        }])),
      }],
    });
    expect(migrated.version).toBe(2);
    expect(migrated.snapshots[0].accounts.FC.innerShardCount).toBeNull();
  });
});

describe("inventory weekly change summary", () => {
  it("sums five accounts and includes ordinary eggs valued at 5.5 wan each", () => {
    const deltas = calculateInventoryDeltas(
      snapshot("2026-07-19", 5),
      snapshot("2026-07-12", 1),
    );

    expect(inventoryRegularEggValueWan).toBe(5.5);
    expect(summarizeInventoryWeeklyChange(deltas!)).toEqual({
      dedicatedEggs: 20,
      regularEggs: 40,
      directSilverWan: 200,
      regularEggEquivalentWan: 220,
      totalSilverWan: 420,
      innerShardCount: 60,
    });
  });

  it("supports negative ordinary-egg changes and normalizes wan amounts to two decimals", () => {
    const prior = snapshot("2026-07-12", 5);
    const latest = snapshot("2026-07-19", 5);
    ids.forEach((accountId) => {
      latest.accounts[accountId].regularEggs -= 1;
    });
    latest.accounts.FC.silverWan += 0.105;
    latest.accounts.LG1.silverWan += 0.206;

    const summary = summarizeInventoryWeeklyChange(calculateInventoryDeltas(latest, prior)!);

    expect(summary).toMatchObject({
      regularEggs: -5,
      directSilverWan: 0.31,
      regularEggEquivalentWan: -27.5,
      totalSilverWan: -27.19,
    });
  });

  it("keeps the fragment total unknown when any account delta is unknown", () => {
    const prior = snapshot("2026-07-12", 1);
    const latest = snapshot("2026-07-19", 2);
    prior.accounts.LG2.innerShardCount = null;

    const summary = summarizeInventoryWeeklyChange(calculateInventoryDeltas(latest, prior)!);

    expect(summary.innerShardCount).toBeNull();
    expect(summary.dedicatedEggs).toBe(5);
    expect(summary.regularEggs).toBe(10);
  });
});

describe("inventory natural-week reports", () => {
  it("resolves Monday-to-Sunday ranges with UTC date arithmetic", () => {
    expect(naturalWeekRange("2026-07-13")).toEqual({
      weekStart: "2026-07-13",
      weekEnd: "2026-07-19",
    });
    expect(naturalWeekRange("2026-07-19")).toEqual({
      weekStart: "2026-07-13",
      weekEnd: "2026-07-19",
    });
    expect(naturalWeekRange("2027-01-01")).toEqual({
      weekStart: "2026-12-28",
      weekEnd: "2027-01-03",
    });
    expect(naturalWeekRange("2028-02-29")).toEqual({
      weekStart: "2028-02-28",
      weekEnd: "2028-03-05",
    });
    expect(() => naturalWeekRange("2026-02-29")).toThrow(/YYYY-MM-DD/);
  });

  it("always returns seven slots and leaves missing dates empty", () => {
    const report = buildInventoryWeekReport([
      snapshot("2026-07-12", 1),
      snapshot("2026-07-13", 2),
      snapshot("2026-07-15", 5),
      snapshot("2026-07-19", 8),
    ], "2026-07-16");

    expect(report.days).toHaveLength(7);
    expect(report.days.map((day) => day.date)).toEqual([
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
      "2026-07-16",
      "2026-07-17",
      "2026-07-18",
      "2026-07-19",
    ]);
    expect(report.days.map((day) => day.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(report.days.map((day) => day.snapshot?.effectiveDate || null)).toEqual([
      "2026-07-13",
      null,
      "2026-07-15",
      null,
      null,
      null,
      "2026-07-19",
    ]);
    expect(report.recordedDays).toBe(3);
    expect(report.days[1].comparison).toBeNull();
    expect(report.days[3].comparison).toBeNull();
  });

  it("compares each recorded day with the nearest earlier real snapshot", () => {
    const report = buildInventoryWeekReport([
      snapshot("2026-07-19", 8),
      snapshot("2026-07-12", 1),
      snapshot("2026-07-15", 5),
      snapshot("2026-07-13", 2),
    ], "2026-07-13");

    expect(report.days[0].comparison).toMatchObject({
      fromEffectiveDate: "2026-07-12",
      toEffectiveDate: "2026-07-13",
      intervalDays: 1,
      deltas: {
        FC: { dedicatedEggs: 1, regularEggs: 2, silverWan: 10, innerShardCount: 3 },
      },
    });
    expect(report.days[2].comparison).toMatchObject({
      fromEffectiveDate: "2026-07-13",
      toEffectiveDate: "2026-07-15",
      intervalDays: 2,
      deltas: {
        FC: { dedicatedEggs: 3, regularEggs: 6, silverWan: 30, innerShardCount: 9 },
      },
    });
    expect(report.days[6].comparison).toMatchObject({
      fromEffectiveDate: "2026-07-15",
      toEffectiveDate: "2026-07-19",
      intervalDays: 4,
      deltas: {
        FC: { dedicatedEggs: 3, regularEggs: 6, silverWan: 30, innerShardCount: 9 },
      },
    });
  });

  it("prefers the nearest pre-week snapshot for the weekly change", () => {
    const report = buildInventoryWeekReport([
      snapshot("2026-07-01", 1),
      snapshot("2026-07-12", 3),
      snapshot("2026-07-13", 4),
      snapshot("2026-07-16", 7),
    ], "2026-07-16");

    expect(report.weeklyChangeBasis).toBe("before-week");
    expect(report.weeklyChange).toMatchObject({
      fromEffectiveDate: "2026-07-12",
      toEffectiveDate: "2026-07-16",
      intervalDays: 4,
      deltas: {
        FC: { dedicatedEggs: 4, regularEggs: 8, silverWan: 40, innerShardCount: 12 },
      },
    });
  });

  it("falls back to the first and last in-week snapshots without a baseline", () => {
    const report = buildInventoryWeekReport([
      snapshot("2026-07-13", 2),
      snapshot("2026-07-15", 4),
      snapshot("2026-07-18", 9),
      snapshot("2026-07-20", 20),
    ], "2026-07-19");

    expect(report.weeklyChangeBasis).toBe("within-week");
    expect(report.weeklyChange).toMatchObject({
      fromEffectiveDate: "2026-07-13",
      toEffectiveDate: "2026-07-18",
      intervalDays: 5,
      deltas: {
        FC: { dedicatedEggs: 7, regularEggs: 14, silverWan: 70, innerShardCount: 21 },
      },
    });
  });

  it("has no weekly change when the week has only one observation and no baseline", () => {
    const report = buildInventoryWeekReport([
      snapshot("2026-07-15", 4),
      snapshot("2026-07-20", 20),
    ], "2026-07-15");

    expect(report.recordedDays).toBe(1);
    expect(report.days[2].comparison).toBeNull();
    expect(report.weeklyChange).toBeNull();
    expect(report.weeklyChangeBasis).toBeNull();
  });

  it("uses a pre-week baseline even when the week has only one observation", () => {
    const report = buildInventoryWeekReport([
      snapshot("2026-06-30", 1),
      snapshot("2026-07-15", 4),
    ], "2026-07-15");

    expect(report.recordedDays).toBe(1);
    expect(report.weeklyChangeBasis).toBe("before-week");
    expect(report.weeklyChange).toMatchObject({
      fromEffectiveDate: "2026-06-30",
      toEffectiveDate: "2026-07-15",
      intervalDays: 15,
    });
  });

  it("keeps nullable fragment deltas unknown and collapses duplicate dates", () => {
    const missingFragments = snapshot("2026-07-12", 1);
    missingFragments.accounts.FC.innerShardCount = null;
    const firstMonday = snapshot("2026-07-13", 2);
    const correctedMonday = snapshot("2026-07-13", 7);
    const report = buildInventoryWeekReport([
      missingFragments,
      firstMonday,
      correctedMonday,
    ], "2026-07-13");

    expect(report.recordedDays).toBe(1);
    expect(report.days[0].snapshot?.accounts.FC.dedicatedEggs).toBe(7);
    expect(report.days[0].comparison?.deltas.FC).toMatchObject({
      dedicatedEggs: 6,
      innerShardCount: null,
    });
  });

  it("returns an empty seven-day report when the selected week has no snapshots", () => {
    const report = buildInventoryWeekReport([
      snapshot("2026-07-01", 1),
      snapshot("2026-07-20", 2),
    ], "2026-07-15");

    expect(report.recordedDays).toBe(0);
    expect(report.days.every((day) => day.snapshot === null && day.comparison === null)).toBe(true);
    expect(report.weeklyChange).toBeNull();
    expect(report.weeklyChangeBasis).toBeNull();
  });
});
