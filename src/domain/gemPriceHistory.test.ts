import { describe, expect, it } from "vitest";
import { buildGemPriceTrend, createGemPriceHistoryEntry, normalizeGemPriceHistory } from "./gemPriceHistory";
import type { GemMarketSnapshot } from "./types";

const names = ["太阳石", "月亮石", "舍利子", "黑宝石", "红玛瑙", "神秘石"];
const items = names.map((name, index) => ({ name, price: 100 + index }));
const snapshot: GemMarketSnapshot = {
  sourceDate: "2026-07-09",
  sourceType: "screenshot",
  currency: "silver",
  unit: "piece",
  sourceImage: "market.png",
  items,
};

describe("gem price history", () => {
  it("keeps a complete normalized six-price snapshot", () => {
    const entry = createGemPriceHistoryEntry(items, "manual", "2026-07-10T10:00:00.000Z", "row-1");
    expect(normalizeGemPriceHistory([entry], names)).toEqual([entry]);
    expect(normalizeGemPriceHistory([{ ...entry, items: entry.items.slice(0, 5) }], names)).toEqual([]);
  });

  it("adds the source baseline and sorts records chronologically", () => {
    const later = createGemPriceHistoryEntry(items, "manual", "2026-07-11T10:00:00.000Z", "later");
    const earlier = createGemPriceHistoryEntry(items, "screenshot", "2026-07-10T10:00:00.000Z", "earlier");
    const trend = buildGemPriceTrend(snapshot, [later, earlier]);
    expect(trend.map((point) => point.id)).toEqual(["baseline:2026-07-09", "earlier", "later"]);
    expect(trend[0].source).toBe("baseline");
  });
});
