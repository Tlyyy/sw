import { afterEach, describe, expect, it, vi } from "vitest";
import { catalog } from "../../data/catalog";
import { buildGemPlanProjection } from "../../domain/gems";
import { createGemPlanShareImage } from "./gemPlanShareImage";

function installCanvasStub() {
  const fillText = vi.fn();
  const context = new Proxy({
    fillText,
    measureText: (text: string) => ({ width: text.length * 11 }),
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

afterEach(() => vi.unstubAllGlobals());

describe("gem plan share image", () => {
  it("renders all five accounts and their equipment into one image", () => {
    const { fillText, canvas } = installCanvasStub();
    const projection = buildGemPlanProjection(catalog, {}, "13", 88, "2026-07-21");
    const image = createGemPlanShareImage({ projection, marketDate: "2026-07-09" });
    const text = fillText.mock.calls.map(([value]) => String(value));

    expect(text).toContain("宝石计划");
    expect(text).toContain("13 段");
    expect(text).toContain("每号每周投入 88 万");
    for (const account of ["FC", "LG1", "LG2", "PT", "MYT"]) expect(text).toContain(account);
    expect(text.some((value) => value.includes("武器 ·"))).toBe(true);
    expect(text.some((value) => value.includes("→ 13"))).toBe(true);
    expect(canvas.width).toBe(1080);
    expect(canvas.height).toBe(1350);
    expect(image.type).toBe("image/png");
    expect(image.size).toBeGreaterThan(0);
  });
});
