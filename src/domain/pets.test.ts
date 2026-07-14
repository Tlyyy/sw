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

  it("keeps divine-beast progression out of ordinary pets and includes the small horse", () => {
    const pets = buildPetViews(catalog);
    const ordinaryPets = pets.filter((row) => !row.beastType);
    const horses = pets.filter((row) => row.beastType === "horse");

    expect(ordinaryPets).toHaveLength(38);
    expect(ordinaryPets.every((row) => row.beastCost === undefined)).toBe(true);
    expect(horses).toHaveLength(5);
    expect(horses.every((row) => row.name === "神兽龙马" && row.role.tags.includes("神兽"))).toBe(true);
  });

  it("applies the four divine-beast steps to snakes and small horses, with horse strengthening only", () => {
    const allMissing = structuredClone(catalog);
    for (const pet of allMissing.pets.filter((row) => row.accountId === "FC" && row.beastType)) {
      pet.beastProgress = { ornament: false, advance1: false, advance2: false, skin: false, strengthen: false };
    }
    const pets = buildPetViews(allMissing);
    const missingKeys = (type: "snake1" | "horse") => pets
      .find((row) => row.accountId === "FC" && row.beastType === type)!
      .beastCost!.missing.map((item) => item.key);

    expect(missingKeys("snake1")).toEqual(["ornament", "advance1", "advance2", "skin"]);
    expect(missingKeys("horse")).toEqual(["ornament", "advance1", "advance2", "skin", "strengthen"]);
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
