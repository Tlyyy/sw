import { afterEach, describe, expect, it, vi } from "vitest";
import type { WeeklyActivityReportImageData } from "./weeklyActivityReportImage";
import { createWeeklyActivityReportImage } from "./weeklyActivityReportImage";
import type { SilverExpenseRecord, TaskCompletionRecord } from "../domain/types";

function installCanvasStub() {
  const renderedText: string[] = [];
  const gradient = { addColorStop: vi.fn() };
  const context = new Proxy({
    measureText: (text: string) => ({ width: text.length * 12 }),
    createLinearGradient: () => gradient,
    fillText: (text: string) => renderedText.push(text),
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
  return { renderedText, canvas };
}

afterEach(() => vi.unstubAllGlobals());

describe("weekly activity report image", () => {
  it("renders the week-to-date cashflow and task sections", () => {
    const { renderedText, canvas } = installCanvasStub();
    const completion: TaskCompletionRecord = {
      taskId: "FC:snake1:skin",
      completedOn: "2026-07-21",
      recordedAt: "2026-07-21T02:00:00.000Z",
      accountId: "FC",
      typeLabel: "剑气蛇",
      actionLabel: "皮肤",
      taskKind: "进阶",
      resourceKind: "silver",
      resourceAmount: 30,
      silverSpentWan: 30,
    };
    const expense: SilverExpenseRecord = {
      id: "expense-1",
      effectiveDate: "2026-07-22",
      recordedAt: "2026-07-22T02:00:00.000Z",
      accountId: "FC",
      amountWan: 10,
      note: "购买材料",
    };
    const data: WeeklyActivityReportImageData = {
      weekStart: "2026-07-20",
      reportEnd: "2026-07-22",
      generatedAt: "2026-07-22 18:30",
      recordedDays: 3,
      latestInventoryDate: "2026-07-22",
      currentSilverWan: 520,
      inventoryNetChangeWan: 20,
      inventoryChangeFrom: "2026-07-19",
      inventoryChangeTo: "2026-07-22",
      taskSilverExpenseWan: 30,
      manualSilverExpenseWan: 10,
      totalSilverExpenseWan: 40,
      reconciledSilverExpenseWan: 40,
      pendingReconciliationSilverExpenseWan: 0,
      harvestedSilverWan: 60,
      unassignedManualSilverExpenseWan: 0,
      accountSummaries: ["FC", "LG1", "PT", "LG2", "MYT"].map((accountId) => ({
        accountId: accountId as "FC" | "LG1" | "PT" | "LG2" | "MYT",
        currentSilverWan: 104,
        inventoryNetChangeWan: 4,
        taskSilverExpenseWan: accountId === "FC" ? 30 : 0,
        manualSilverExpenseWan: accountId === "FC" ? 10 : 0,
        totalSilverExpenseWan: accountId === "FC" ? 40 : 0,
        reconciledSilverExpenseWan: accountId === "FC" ? 40 : 0,
        pendingReconciliationSilverExpenseWan: 0,
        harvestedSilverWan: accountId === "FC" ? 44 : 4,
        taskCompletions: accountId === "FC" ? [completion] : [],
        manualExpenses: accountId === "FC" ? [expense] : [],
      })),
      taskCompletions: [completion],
      manualExpenses: [expense],
    };

    const image = createWeeklyActivityReportImage(data);
    expect(image.type).toBe("image/png");
    expect(image.size).toBeGreaterThan(0);
    expect(renderedText).toContain("万象册");
    expect(renderedText).toContain("本周小结 · 逐账号");
    expect(renderedText).toContain("2026-07-20 至 2026-07-22");
    expect(renderedText).not.toContain("计算口径");
    expect(renderedText).not.toContain("本周收获 = 库存净变化 + 库存比较区间内的银子支出");
    expect(renderedText).toContain("各账号本周情况");
    expect(renderedText).toEqual(expect.arrayContaining(["FC", "LG1", "PT", "LG2", "MYT"]));
    expect(renderedText).toContain("剑气蛇 · 皮肤");
    expect(renderedText).toContain("购买材料");
    expect(canvas.height).toBeGreaterThan(1_250);
  });
});
