import { describe, expect, it } from "vitest";
import { catalog } from "../data/catalog";
import { buildPetViews } from "./pets";

describe("buildPetViews", () => {
  it("uses explicit beast identities even when pet source order changes", () => {
    const expected = new Map(buildPetViews(catalog).filter((row) => row.beastType).map((row) => [row.id, row.beastType]));
    const shuffled = { ...catalog, pets: [...catalog.pets].reverse() };
    const actual = new Map(buildPetViews(shuffled).filter((row) => row.beastType).map((row) => [row.id, row.beastType]));
    expect(actual).toEqual(expected);
    expect(actual.size).toBe(15);
  });

  it("uses explicit beast progress for stages that screenshots confirm", () => {
    const magicSnake = buildPetViews(catalog).find((row) => row.id === "FC:pet:17");
    expect(magicSnake?.beastProgress?.skin).toBe(true);
    expect(magicSnake?.beastCost?.missing.some((item) => item.key === "skin")).toBe(false);

    const swordSnake = buildPetViews(catalog).find((row) => row.id === "LG1:pet:09");
    expect(swordSnake?.beastProgress?.advance2).toBe(true);
    expect(swordSnake?.beastStage).toBe("进阶2");
    expect(swordSnake?.beastCost?.missing.some((item) => item.key === "advance2")).toBe(false);

    const lg2MagicSnake = buildPetViews(catalog).find((row) => row.id === "LG2:pet:05");
    expect(lg2MagicSnake?.beastProgress?.advance2).toBe(true);
    expect(lg2MagicSnake?.beastStage).toBe("进阶2");
    expect(lg2MagicSnake?.beastCost?.missing.some((item) => item.key === "advance2")).toBe(false);

    const mytSwordSnake = buildPetViews(catalog).find((row) => row.id === "MYT:pet:11");
    expect(mytSwordSnake?.beastProgress).toMatchObject({ ornament: true, advance1: true });
    expect(mytSwordSnake?.beastStage).toBe("进阶1");
    expect(mytSwordSnake?.beastCost?.missing.some((item) => ["ornament", "advance1"].includes(item.key))).toBe(false);
  });
});
