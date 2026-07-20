import { afterEach, describe, expect, it, vi } from "vitest";
import { createMainlineOverviewShareImage, type MainlineOverviewShareData } from "./mainlineOverviewShareImage";

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

describe("five-account mainline share image", () => {
  it("renders all five account progress cards into one PNG", () => {
    installCanvasStub();
    const accountIds = ["FC", "LG1", "LG2", "PT", "MYT"];
    const data: MainlineOverviewShareData = {
      inventoryDate: "2026-07-20",
      accounts: accountIds.map((accountId, index) => ({
        accountId,
        accountTone: ["#12678f", "#6446a6", "#8a5a00", "#a33838", "#28764a"][index],
        status: index === 2 ? "资源不足" : "资金够用",
        statusTone: index === 2 ? "danger" : "positive",
        resourceStatus: index === 2 ? "缺 30个蛋" : `可补 ${23 + index}个蛋`,
        tasks: [
          { stage: "当前", title: "隐攻蛇 · 皮肤", due: "预计 7月20日完成" },
          { stage: "下一步", title: "隐攻蛇 · 进阶1", due: "预计 9月8日完成" },
          { stage: "再下一步", title: "隐攻蛇 · 进阶2", due: "预计 9月30日完成" },
        ],
        finish: "预计 2027年1月24日完成",
        resources: { dedicatedEggs: "9", regularEggs: "8", silverWan: "161", innerShards: "32" },
      })),
    };

    const image = createMainlineOverviewShareImage(data);
    expect(data.accounts).toHaveLength(5);
    expect(image.type).toBe("image/png");
    expect(image.size).toBeGreaterThan(0);
  });
});
