export const GEM_MARKET_ITEM_NAMES = ["太阳石", "月亮石", "舍利子", "黑宝石", "红玛瑙", "神秘石"] as const;

export type GemMarketItemName = (typeof GEM_MARKET_ITEM_NAMES)[number];

export interface GemPriceCrop {
  name: GemMarketItemName;
  left: number;
  top: number;
  width: number;
  height: number;
}

export function buildGemPriceCrops(width: number, height: number): GemPriceCrop[] {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 120 || height < 160) {
    throw new Error("截图尺寸过小，请上传包含表头和六行价格的清晰截图。");
  }

  const headerHeight = height * (32 / 272);
  const rowHeight = (height - headerHeight) / GEM_MARKET_ITEM_NAMES.length;
  const left = width * 0.43;
  const cropWidth = width * 0.25;

  return GEM_MARKET_ITEM_NAMES.map((name, index) => ({
    name,
    left: Math.round(left),
    top: Math.round(headerHeight + rowHeight * index + rowHeight * 0.08),
    width: Math.round(cropWidth),
    height: Math.round(rowHeight * 0.84),
  }));
}

export function parseRecognizedGemPrice(text: string): number | null {
  const digits = text.replace(/\D/g, "");
  if (!digits) return null;
  const value = Number(digits);
  return Number.isSafeInteger(value) && value > 0 && value <= 999_999 ? value : null;
}

export function gemRecognitionLevel(confidence: number, price: number | null): "high" | "medium" | "low" {
  if (price === null || confidence < 55) return "low";
  if (confidence < 78) return "medium";
  return "high";
}
