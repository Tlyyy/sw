import { describe, expect, it } from "vitest";
import { catalog } from "../data/catalog";
import {
  buildGemPlanProjection,
  formatGemLevel,
  gemPlanTargetLevels,
  itemTargetGap,
} from "./gems";

describe("gem planning", () => {
  it("exposes every planning target from the canonical upgrade chain", () => {
    const levels = gemPlanTargetLevels(catalog);
    expect(levels).toContain("9★★");
    expect(levels).toContain("12★★★");
    expect(levels).toContain("13★★★");
    expect(levels).toContain("14★★★★★");
    expect(levels.length).toBeGreaterThan(10);
    expect(formatGemLevel("14★★")).toBe("14 段★★");
  });

  it("recalculates five independent account schedules for the selected target", () => {
    const plan13 = buildGemPlanProjection(catalog, {}, "13", 88, "2026-07-21");
    const plan14 = buildGemPlanProjection(catalog, {}, "14", 88, "2026-07-21");

    expect(plan13.accounts).toHaveLength(5);
    expect(plan13.accounts.every((account) => account.items.length === 6)).toBe(true);
    expect(plan13.longestWeeks).toBeGreaterThan(0);
    expect(plan13.finishDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(plan14.totalGap).toBeGreaterThan(plan13.totalGap);
    expect(plan14.totalCost).toBeGreaterThan(plan13.totalCost);
    expect(plan14.longestWeeks).toBeGreaterThan(plan13.longestWeeks || 0);
  });

  it("keeps lower targets complete and leaves dates unscheduled when weekly input is zero", () => {
    const equipment = catalog.equipment[0];
    expect(itemTargetGap(catalog, equipment, "9")).toBe(0);
    const plan = buildGemPlanProjection(catalog, {}, "14", 0, "2026-07-21");
    expect(plan.longestWeeks).toBeNull();
    expect(plan.finishDate).toBeNull();
    expect(plan.accounts.every((account) => account.weeks === null)).toBe(true);
  });
});
