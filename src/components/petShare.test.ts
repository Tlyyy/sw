import { describe, expect, it } from "vitest";
import { catalog } from "../data/catalog";
import { buildPetViews } from "../domain/pets";
import { buildPetDetailShareData } from "./petShare";

describe("pet share data", () => {
  it("keeps only the aptitude upper limit while preserving lifetime", () => {
    const pet = buildPetViews(catalog).find((row) => row.accountId === "FC" && row.name === "赤炎童子");
    expect(pet).toBeDefined();

    const data = buildPetDetailShareData(pet!, undefined, "2026-07-21T12:00:00.000Z");
    expect(data.aptitudes.find((metric) => metric.label === "攻击资质")?.value).toBe("1465");
    expect(data.aptitudes.find((metric) => metric.label === "寿命")?.value).toBe("8460");
    expect(data.aptitudes.every((metric) => !metric.value.includes("/"))).toBe(true);
  });
});
