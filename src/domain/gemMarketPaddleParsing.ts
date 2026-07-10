import { buildGemPriceCrops, type GemMarketItemName } from "./gemMarketRecognition";

export interface PaddleTextItem {
  poly: Array<[number, number]>;
  text: string;
  score: number;
}

export interface ParsedPaddleGemPrice {
  name: GemMarketItemName;
  price: number | null;
  confidence: number;
  rawText: string;
}

function center(poly: Array<[number, number]>) {
  if (!poly.length) return { x: 0, y: 0 };
  return {
    x: poly.reduce((sum, point) => sum + point[0], 0) / poly.length,
    y: poly.reduce((sum, point) => sum + point[1], 0) / poly.length,
  };
}

export function extractPriceCandidates(text: string): number[] {
  const withoutPercentages = text
    .replace(/[+\-]?\d+(?:\.\d+)%/g, " ")
    .replace(/[+\-]?\d+\.\d+/g, " ");
  return Array.from(withoutPercentages.matchAll(/\d{2,6}/g), (match) => Number(match[0]))
    .filter((value) => Number.isSafeInteger(value) && value > 0 && value <= 999_999);
}

export function parsePaddleGemMarketItems(
  items: PaddleTextItem[],
  width: number,
  height: number,
): ParsedPaddleGemPrice[] {
  const crops = buildGemPriceCrops(width, height);
  const candidates = items
    .map((item) => ({ item, position: center(item.poly), prices: extractPriceCandidates(item.text) }))
    .filter(({ prices }) => prices.length)
    .sort((left, right) => left.position.y - right.position.y);
  const rowCenters = candidates.reduce<number[]>((centers, candidate) => {
    const previous = centers.at(-1);
    if (previous !== undefined && Math.abs(candidate.position.y - previous) < height * 0.025) {
      centers[centers.length - 1] = (previous + candidate.position.y) / 2;
    } else centers.push(candidate.position.y);
    return centers;
  }, []);
  const detectedRowCenters = rowCenters.length === crops.length ? rowCenters : null;

  return crops.map((crop) => {
    const rowIndex = crops.indexOf(crop);
    const namedAnchor = items.find((item) => item.text.includes(crop.name));
    const targetY = namedAnchor ? center(namedAnchor.poly).y : detectedRowCenters?.[rowIndex] ?? crop.top + crop.height / 2;
    const tolerance = detectedRowCenters ? Math.max(height * 0.035, crop.height * 0.72) : crop.height * 0.72;
    const rowItems = candidates
      .filter(({ position }) => Math.abs(position.y - targetY) <= tolerance)
      .sort((left, right) => {
        const leftXDistance = Math.abs(left.position.x - (crop.left + crop.width / 2));
        const rightXDistance = Math.abs(right.position.x - (crop.left + crop.width / 2));
        const leftRank = leftXDistance / width - left.item.score * 0.2;
        const rightRank = rightXDistance / width - right.item.score * 0.2;
        return leftRank - rightRank;
      });
    const best = rowItems[0];
    return {
      name: crop.name,
      price: best?.prices[0] ?? null,
      confidence: best ? Math.round(Math.max(0, Math.min(1, best.item.score)) * 100) : 0,
      rawText: best?.item.text ?? "",
    };
  });
}
