import type {
  GemMarketItem,
  GemMarketSnapshot,
  GemPriceHistoryEntry,
  GemPriceHistorySource,
} from "./types";

export interface GemPriceTrendPoint extends Omit<GemPriceHistoryEntry, "source"> {
  source: GemPriceHistorySource | "baseline";
}

function validItems(items: GemMarketItem[], requiredNames?: string[]) {
  const normalized = items
    .filter((item) => item && typeof item.name === "string" && Number.isFinite(Number(item.price)) && Number(item.price) > 0)
    .map((item) => ({ name: item.name.trim(), price: Math.round(Number(item.price)) }));
  if (!requiredNames?.length) return normalized;
  const byName = new Map(normalized.map((item) => [item.name, item.price]));
  return requiredNames.flatMap((name) => byName.has(name) ? [{ name, price: byName.get(name)! }] : []);
}

export function createGemPriceHistoryEntry(
  items: GemMarketItem[],
  source: GemPriceHistorySource,
  capturedAt = new Date().toISOString(),
  id = `${capturedAt}:${source}`,
): GemPriceHistoryEntry {
  return { id, capturedAt, source, items: validItems(items) };
}

export function normalizeGemPriceHistory(value: unknown, requiredNames: string[]): GemPriceHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const row = candidate as Partial<GemPriceHistoryEntry>;
    if (!row.id || !row.capturedAt || (row.source !== "manual" && row.source !== "screenshot") || Number.isNaN(Date.parse(row.capturedAt))) return [];
    const items = validItems(Array.isArray(row.items) ? row.items : [], requiredNames);
    return items.length === requiredNames.length ? [{ id: row.id, capturedAt: row.capturedAt, source: row.source, items }] : [];
  }).sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));
}

export function buildGemPriceTrend(snapshot: GemMarketSnapshot, history: GemPriceHistoryEntry[]): GemPriceTrendPoint[] {
  const baseline: GemPriceTrendPoint = {
    id: `baseline:${snapshot.sourceDate}`,
    capturedAt: `${snapshot.sourceDate}T00:00:00+08:00`,
    source: "baseline",
    items: validItems(snapshot.items),
  };
  return [baseline, ...history].sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));
}
