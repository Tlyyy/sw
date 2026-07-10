import { describe, expect, it } from "vitest";
import { extractPriceCandidates, parsePaddleGemMarketItems, type PaddleTextItem } from "./gemMarketPaddleParsing";
import { buildGemPriceCrops } from "./gemMarketRecognition";

describe("PaddleOCR gem market parsing", () => {
  it("removes percentage values and keeps the market price", () => {
    expect(extractPriceCandidates("太阳石 798 -1.24%")).toEqual([798]);
    expect(extractPriceCandidates("1257 +2.95%")).toEqual([1257]);
  });

  it("maps detected prices to the six table rows", () => {
    const values = [798, 852, 1257, 1240, 308, 264];
    const items: PaddleTextItem[] = buildGemPriceCrops(732, 816).map((crop, index) => ({
      text: `${values[index]} +${index}.12%`,
      score: 0.96,
      poly: [
        [crop.left, crop.top],
        [crop.left + crop.width, crop.top],
        [crop.left + crop.width, crop.top + crop.height],
        [crop.left, crop.top + crop.height],
      ],
    }));
    expect(parsePaddleGemMarketItems(items, 732, 816).map((row) => row.price)).toEqual(values);
  });

  it("maps rows even when the screenshot contains extra outer margins", () => {
    const values = [798, 852, 1257, 1240, 308, 264];
    const items: PaddleTextItem[] = values.map((value, index) => ({
      text: `${value} +${index}.12%`,
      score: 0.93,
      poly: [[330, 170 + index * 92], [430, 170 + index * 92], [430, 210 + index * 92], [330, 210 + index * 92]],
    }));
    expect(parsePaddleGemMarketItems(items, 800, 820).map((row) => row.price)).toEqual(values);
  });
});
