import { describe, expect, it } from "vitest";
import { catalog } from "../data/catalog";
import { beastTotals, buildPetViews } from "./pets";
import { buildAccountPlans } from "./plans";
import { matrixAccountIds, matrixColumns, matrixGroups } from "./matrix";
import { generatePublishContent, publishDefaults } from "./publish";

const pets = buildPetViews(catalog);
const state = {
  settings: structuredClone(catalog.beastConfig.taskDefaultSettings),
  resources: structuredClone(catalog.beastConfig.taskDefaultResources),
  overrides: {},
  gemPriceOverrides: {},
};

describe("migration baseline", () => {
  it("preserves the complete catalog", () => {
    expect(catalog.accounts).toHaveLength(5);
    expect(pets).toHaveLength(53);
    expect(catalog.evidence.filter((item) => item.kind === "pet")).toHaveLength(114);
    expect(new Set(pets.map((item) => item.name))).toHaveLength(12);
    expect(catalog.equipment).toHaveLength(30);
    expect(catalog.skills).toHaveLength(125);
    expect(catalog.skills.filter((item) => item.type === "兽决")).toHaveLength(62);
    expect(catalog.skills.filter((item) => item.type === "御兽")).toHaveLength(37);
    expect(catalog.skills.filter((item) => item.type === "强化技能")).toHaveLength(26);
  });

  it("preserves beast costs", () => {
    expect(beastTotals(pets)).toEqual({ confirmedWan: 8680, estimatedWan: 1850, totalWan: 10530, eggs: 1560 });
  });

  it("preserves the combined account schedule", () => {
    const plans = buildAccountPlans(catalog, pets, state);
    expect(plans[0].accountId).toBe("LG2");
    expect(plans[0].finishWeek).toBe(70);
    expect(plans.find((item) => item.accountId === "FC")?.finishWeek).toBe(48);
  });

  it("preserves the fixed comparison matrix", () => {
    expect(matrixColumns).toHaveLength(15);
    expect(matrixGroups).toHaveLength(4);
    expect(matrixAccountIds).toEqual(["FC", "LG1", "LG2", "PT", "MYT"]);
  });

  it("generates publish content from normalized assets", () => {
    const output = generatePublishContent(catalog, pets.slice(0, 2), {
      mode: "sale",
      format: "markdown",
      ...publishDefaults.sale,
      includeStats: true,
      includeSkills: true,
      includeNotes: true,
      allShots: true,
    });
    expect(output).toContain("## 资产总览");
    expect(output).toContain(pets[0].name);
    expect(output).toContain("截图证明：4 张");
  });
});
