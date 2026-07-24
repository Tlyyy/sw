import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAccountingByAccount } from "../../domain/accounting";
import { accountIds, type AccountId, type InventorySnapshot } from "../../domain/types";
import {
  buildDailyEarningsShareData,
  createDailyEarningsShareImage,
} from "./dailyEarningsShareImage";

function snapshot(
  effectiveDate: string,
  silverByAccount: Record<AccountId, number>,
): InventorySnapshot {
  return {
    effectiveDate,
    recordedAt: `${effectiveDate}T10:00:00.000Z`,
    accounts: Object.fromEntries(accountIds.map((accountId) => [
      accountId,
      {
        silverWan: silverByAccount[accountId],
        dedicatedEggs: 0,
        regularEggs: 0,
        innerShardCount: 0,
      },
    ])) as InventorySnapshot["accounts"],
  };
}

function installCanvasStub(renderedText: string[]) {
  const gradient = { addColorStop: vi.fn() };
  const context = new Proxy({
    createLinearGradient: () => gradient,
    fillText: (text: string) => renderedText.push(String(text)),
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

describe("five-account daily earnings share image", () => {
  it("builds seven daily rows and keeps all five account earnings together", () => {
    const baseline = { FC: 100, LG1: 100, PT: 100, LG2: 100, MYT: 100 };
    const monday = { FC: 131, LG1: 119, PT: 120, LG2: 118, MYT: 117 };
    const tuesday = { FC: 132, LG1: 121, PT: 123, LG2: 122, MYT: 122 };
    const reports = buildAccountingByAccount({
      inventorySnapshots: [
        snapshot("2026-07-19", baseline),
        snapshot("2026-07-20", monday),
        snapshot("2026-07-21", tuesday),
      ],
      asOfDate: "2026-07-24",
    });

    const data = buildDailyEarningsShareData(reports, "2026-07-24");

    expect(data).toMatchObject({
      weekStart: "2026-07-20",
      weekEnd: "2026-07-26",
      recordedDays: 2,
      weeklyTotal: {
        values: { FC: 32, LG1: 21, PT: 23, LG2: 22, MYT: 22 },
        total: 120,
      },
    });
    expect(data.rows).toHaveLength(7);
    expect(data.rows[0]).toMatchObject({
      label: "周一 7/20",
      values: { FC: 31, LG1: 19, PT: 20, LG2: 18, MYT: 17 },
      total: 105,
    });
    expect(data.rows[4].basis).toBe("未结算");
    expect(data.rows[5].basis).toBe("尚未到日期");
  });

  it("renders the five account headers and summary into a PNG", () => {
    const renderedText: string[] = [];
    installCanvasStub(renderedText);
    const emptyValues = { FC: null, LG1: null, PT: null, LG2: null, MYT: null };
    const firstDayValues = { FC: 31, LG1: 19, PT: 20, LG2: 18, MYT: 17 };
    const image = createDailyEarningsShareImage({
      weekStart: "2026-07-20",
      weekEnd: "2026-07-26",
      recordedDays: 1,
      rows: Array.from({ length: 7 }, (_, index) => ({
        label: `周${index + 1} 7/${20 + index}`,
        date: `2026-07-${20 + index}`,
        basis: index === 0 ? "连续库存 · 核销 0 笔" : "未结算",
        values: index === 0 ? firstDayValues : emptyValues,
        total: index === 0 ? 105 : null,
      })),
      weeklyTotal: {
        label: "本周已结算",
        basis: "1 天每日记录",
        values: firstDayValues,
        total: 105,
      },
      dailyAverage: {
        label: "结算日均",
        basis: "按已结算天数",
        values: firstDayValues,
        total: 105,
      },
    });

    expect(image.type).toBe("image/png");
    expect(image.size).toBeGreaterThan(0);
    expect(renderedText).toEqual(expect.arrayContaining([
      "五号每日实际所得 · 银子",
      "FC",
      "LG1",
      "PT",
      "LG2",
      "MYT",
      "五号合计",
      "+105",
      "本周已结算",
      "结算日均",
    ]));
  });
});
