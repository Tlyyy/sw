import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createEarningsShareImage,
  type EarningsShareImageData,
} from "./earningsShareImage";

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
}

afterEach(() => vi.unstubAllGlobals());

describe("actual income share image", () => {
  it("renders one account's reconciled daily income into a PNG", () => {
    installCanvasStub();
    const data: EarningsShareImageData = {
      accountId: "FC",
      accountTone: "#12678f",
      kind: "daily",
      fromDate: "2026-07-22",
      toDate: "2026-07-23",
      intervalDays: 1,
      inventoryNetChange: {
        silverWan: -20,
        dedicatedEggs: 0,
        regularEggs: -1,
        innerShards: 2,
      },
      ledgerImpact: {
        silverWan: 40,
        dedicatedEggs: 0,
        regularEggs: 1,
        innerShards: 0,
      },
      actualIncome: {
        silverWan: 20,
        dedicatedEggs: 0,
        regularEggs: 0,
        innerShards: 2,
      },
      settledEntryCount: 1,
    };

    const image = createEarningsShareImage(data);
    expect(image.type).toBe("image/png");
    expect(image.size).toBeGreaterThan(0);
  });
});
