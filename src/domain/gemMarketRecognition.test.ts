import { describe, expect, it } from "vitest";
import { buildGemPriceCrops, gemRecognitionLevel, parseRecognizedGemPrice } from "./gemMarketRecognition";

describe("gem market screenshot recognition helpers", () => {
  it("builds six price crops for the current 244×272 screenshot", () => {
    const crops = buildGemPriceCrops(244, 272);
    expect(crops).toHaveLength(6);
    expect(crops.map((item) => item.name)).toEqual(["太阳石", "月亮石", "舍利子", "黑宝石", "红玛瑙", "神秘石"]);
    expect(crops[0]).toMatchObject({ left: 105, top: 35, width: 61, height: 34 });
    expect(crops[5].top).toBe(235);
  });

  it("keeps only valid price digits", () => {
    expect(parseRecognizedGemPrice(" 1 257\n")).toBe(1257);
    expect(parseRecognizedGemPrice("¥852")).toBe(852);
    expect(parseRecognizedGemPrice("no result")).toBeNull();
    expect(parseRecognizedGemPrice("1000000")).toBeNull();
  });

  it("marks missing and uncertain values for manual review", () => {
    expect(gemRecognitionLevel(92, 798)).toBe("high");
    expect(gemRecognitionLevel(70, 852)).toBe("medium");
    expect(gemRecognitionLevel(99, null)).toBe("low");
  });
});
