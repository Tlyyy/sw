import { afterEach, describe, expect, it, vi } from "vitest";
import { createPetBatchShareImage } from "./petBatchShareImage";
import type { PetDetailShareData } from "./petDetailShareImage";

function installCanvasStub() {
  const fillText = vi.fn();
  const gradient = { addColorStop: vi.fn() };
  const context = new Proxy({
    fillText,
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
  return { fillText, canvas };
}

function pet(accountId: string, petName: string, accountTone: string): PetDetailShareData {
  return {
    accountId,
    accountTone,
    petName,
    levelLabel: "145级",
    role: "隐攻",
    meta: "天资：极",
    advice: "",
    tags: ["隐攻"],
    capturedAt: "2026-07-01",
    stats: [
      { label: "气血", value: "4004" },
      { label: "攻击", value: "1012" },
      { label: "防御", value: "822" },
      { label: "速度", value: "470" },
      { label: "灵力", value: "1473" },
    ],
    aptitudes: [],
    skills: ["高级连击", "高级隐身"],
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("pet batch share image", () => {
  it("renders multiple pets into one PNG canvas", async () => {
    const { fillText, canvas } = installCanvasStub();
    const onProgress = vi.fn();
    const image = await createPetBatchShareImage([
      pet("FC", "祸斗", "#12678f"),
      pet("LG1", "雷司", "#6446a6"),
      pet("PT", "冥卫", "#a33838"),
    ], { dataDate: "2026-07-13", onProgress });

    const renderedText = fillText.mock.calls.map(([text]) => String(text));
    expect(renderedText).toContain("宠物合集");
    expect(renderedText).toContain("3 只宠物");
    expect(renderedText).toContain("祸斗");
    expect(renderedText).toContain("雷司");
    expect(renderedText).toContain("冥卫");
    expect(renderedText).toContain("面板");
    expect(renderedText).toContain("资质");
    expect(renderedText).toContain("技能 · 2");
    expect(renderedText).not.toContain("暂无截图");
    expect(canvas.width).toBe(1080);
    expect(canvas.height).toBeGreaterThan(600);
    expect(onProgress).toHaveBeenLastCalledWith(3, 3);
    expect(image.type).toBe("image/png");
    expect(image.size).toBeGreaterThan(0);
  });
});
