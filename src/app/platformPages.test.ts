import { describe, expect, it, vi } from "vitest";
import type { Component } from "vue";
import { definePlatformPage, type PlatformPageModule } from "./platformPages";

const emptyPage = {} as Component;

describe("platform page loader", () => {
  it("only preloads the requested platform and reuses its successful request", async () => {
    const mobile = vi.fn(async (): Promise<PlatformPageModule> => ({ default: emptyPage }));
    const desktop = vi.fn(async (): Promise<PlatformPageModule> => ({ default: emptyPage }));
    const page = definePlatformPage("TestPlatformPage", { mobile, desktop });

    await page.preload("desktop");
    await page.preload("desktop");

    expect(desktop).toHaveBeenCalledTimes(1);
    expect(mobile).not.toHaveBeenCalled();
  });

  it("allows a failed preload to be retried", async () => {
    const error = new Error("temporary load failure");
    const mobile = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue({ default: emptyPage });
    const desktop = vi.fn(async (): Promise<PlatformPageModule> => ({ default: emptyPage }));
    const page = definePlatformPage("RetryPlatformPage", { mobile, desktop });

    await expect(page.preload("mobile")).rejects.toBe(error);
    await expect(page.preload("mobile")).resolves.toEqual({ default: emptyPage });
    expect(mobile).toHaveBeenCalledTimes(2);
  });
});
