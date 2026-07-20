import { afterEach, describe, expect, it, vi } from "vitest";
import { createPetDetailShareImage, type PetDetailShareData } from "./petDetailShareImage";

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
  return { fillText };
}

afterEach(() => vi.unstubAllGlobals());

describe("pet detail share image", () => {
  it("renders a compact portrait pet card into a PNG", async () => {
    const { fillText } = installCanvasStub();
    const data: PetDetailShareData = {
      accountId: "FC",
      accountTone: "#12678f",
      petName: "祸斗",
      levelLabel: "145级",
      role: "隐攻蛇",
      meta: "天资：极(16945)｜血脉：125级血脉",
      advice: "隐攻推进主力",
      tags: ["隐攻", "高连", "高隐"],
      capturedAt: "2026-07-01",
      stats: [
        { label: "气血", value: "4004" },
        { label: "攻击", value: "1012" },
        { label: "防御", value: "822" },
        { label: "速度", value: "470" },
        { label: "灵力", value: "1473" },
      ],
      aptitudes: [
        { label: "攻资", value: "1446" },
        { label: "防资", value: "1426" },
        { label: "体资", value: "1560" },
        { label: "法资", value: "1615" },
        { label: "速资", value: "1620" },
        { label: "寿命", value: "15961" },
      ],
      skills: ["高级连击", "高级隐身", "高级吸血"],
    };

    const image = await createPetDetailShareImage(data);
    const renderedText = fillText.mock.calls.map(([text]) => String(text));
    expect(renderedText).toContain("宠物档案");
    expect(renderedText).toContain("祸斗");
    expect(renderedText.some((text) => text.includes("高级连击"))).toBeTruthy();
    expect(image.type).toBe("image/png");
    expect(image.size).toBeGreaterThan(0);
  });
});
