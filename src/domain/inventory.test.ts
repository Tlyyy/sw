import { describe, expect, it } from "vitest";
import {
  calculateInventoryDeltas,
  createInventoryExport,
  latestInventoryPair,
  normalizeInventorySnapshots,
  parseInventoryExport,
  upsertInventorySnapshot,
} from "./inventory";
import type { AccountId, InventoryBalance, InventorySnapshot } from "./types";

const ids: AccountId[] = ["FC", "LG1", "PT", "LG2", "MYT"];

function accounts(seed: number) {
  return Object.fromEntries(ids.map((accountId, index) => [accountId, {
    dedicatedEggs: seed + index,
    regularEggs: seed * 2 + index,
    silverWan: seed * 10 + index,
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
    });
  });

  it("round-trips a versioned export and rejects partial account batches", () => {
    const payload = createInventoryExport([snapshot("2026-07-11", 3)]);
    expect(parseInventoryExport(JSON.stringify(payload))).toEqual(payload);
    expect(() => parseInventoryExport({
      version: 1,
      snapshots: [{
        effectiveDate: "2026-07-11",
        recordedAt: "2026-07-11T12:00:00.000Z",
        accounts: { FC: accounts(1).FC },
      }],
    })).toThrow();
  });
});
