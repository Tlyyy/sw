import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createInventoryReportShareImage,
  type InventoryMatrixShareData,
  type InventorySummaryShareData,
} from "./inventoryReportShareImage";

function installCanvasStub() {
  const gradient = { addColorStop: vi.fn() };
  const context = new Proxy({
    measureText: (text: string) => ({ width: text.length * 12 }),
    createLinearGradient: () => gradient,
  } as unknown as CanvasRenderingContext2D, {
    get(target, property, receiver) {
      if (Reflect.has(target, property)) return Reflect.get(target, property, receiver);
      return vi.fn();
    },
    set(target, property, value, receiver) {
      return Reflect.set(target, property, value, receiver);
    },
  });
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    toDataURL: () => "data:image/png;base64,iVBORw0KGgo=",
  };
  vi.stubGlobal("document", { createElement: () => canvas });
  vi.stubGlobal("window", { atob: globalThis.atob });
}

afterEach(() => vi.unstubAllGlobals());

describe("inventory report share image", () => {
  it("renders the current inventory summary branch", () => {
    installCanvasStub();
    const data: InventorySummaryShareData = {
      view: "summary",
      weekStart: "2026-07-20",
      weekEnd: "2026-07-26",
      recordedDays: 2,
      snapshot: {
        date: "2026-07-20",
        rows: ["FC", "LG1", "PT", "LG2", "MYT"].map((label) => ({ label, values: [9, 8, 161, 205, 32] })),
        total: { label: "合计", values: [45, 40, 805, 1_025, 160] },
      },
      change: {
        caption: "2026-07-19 → 2026-07-20 · 1 天",
        rows: ["FC", "LG1", "PT", "LG2", "MYT"].map((label) => ({ label, values: [2, 1, 31, 36.5, 2] })),
        total: { label: "合计", values: [10, 5, 155, 182.5, 10] },
      },
      valuationNote: "银+蛋 = 银子 + 普通蛋 × 5.5 万/个",
    };

    const image = createInventoryReportShareImage(data);
    expect(image.type).toBe("image/png");
    expect(image.size).toBeGreaterThan(0);
  });

  it("renders the selected daily matrix branch", () => {
    installCanvasStub();
    const data: InventoryMatrixShareData = {
      view: "matrix",
      weekStart: "2026-07-20",
      weekEnd: "2026-07-26",
      recordedDays: 1,
      metricLabel: "银+蛋",
      unit: "万",
      conversionNote: "银子 + 普通蛋 × 5.5 万/个",
      rows: Array.from({ length: 7 }, (_, index) => ({
        label: `周${index + 1}`,
        basis: index ? "未记录" : "较前次 · 1天",
        values: index ? [null, null, null, null, null, null] : [36.5, 19, 18, 25.5, 22.5, 121.5],
      })),
      weeklyTotal: { label: "本周合计", values: [36.5, 19, 18, 25.5, 22.5, 121.5] },
      dailyAverage: { label: "区间日均", values: [36.5, 19, 18, 25.5, 22.5, 121.5] },
      intervalLabel: "1 天区间",
    };

    const image = createInventoryReportShareImage(data);
    expect(image.type).toBe("image/png");
    expect(image.size).toBeGreaterThan(0);
  });
});
