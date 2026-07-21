import { describe, expect, it } from "vitest";
import rawCatalog from "./source/catalog.json";
import { catalogSchema } from "./schema";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe("catalogSchema relationships", () => {
  it("accepts the canonical catalog", () => {
    expect(catalogSchema.safeParse(rawCatalog).success).toBe(true);
  });

  it("stores low-level skill names canonically", () => {
    const legacySkillNames = rawCatalog.pets.flatMap((pet) => pet.skills)
      .filter((skill) => skill.startsWith("小"));
    expect(legacySkillNames).toEqual([]);
  });

  it("rejects duplicate skill identities", () => {
    const invalid = clone(rawCatalog);
    invalid.skills.push(clone(invalid.skills[0]));
    expect(catalogSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects broken evidence relationships", () => {
    const invalid = clone(rawCatalog);
    invalid.pets[0].evidenceIds[0] = "missing:evidence";
    expect(catalogSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects an equipment latest-evidence pointer that is not the list tail", () => {
    const invalid = clone(rawCatalog);
    Object.assign(invalid.equipment[0], { evidenceIds: [invalid.equipment[0].evidenceId, "missing:evidence"] });
    expect(catalogSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects duplicate task identities", () => {
    const invalid = clone(rawCatalog);
    invalid.beastConfig.taskActionOrder.push(clone(invalid.beastConfig.taskActionOrder[0]));
    expect(catalogSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects divine-beast progression on an ordinary pet", () => {
    const invalid = clone(rawCatalog);
    const ordinaryPet = invalid.pets.find((pet) => !("beastType" in pet));
    expect(ordinaryPet).toBeDefined();
    Object.assign(ordinaryPet!, { beastProgress: { ornament: true } });
    expect(catalogSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects horse strengthening progress on a divine-beast snake", () => {
    const invalid = clone(rawCatalog);
    const snake = invalid.pets.find((pet) => pet.beastType === "snake1");
    expect(snake).toBeDefined();
    Object.assign(snake!, { beastProgress: { ...snake!.beastProgress, strengthen: true } });
    expect(catalogSchema.safeParse(invalid).success).toBe(false);
  });
});
