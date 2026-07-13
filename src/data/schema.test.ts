import { describe, expect, it } from "vitest";
import rawCatalog from "./source/catalog.json";
import { catalogSchema } from "./schema";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe("catalogSchema relationships", () => {
  it("accepts the canonical catalog", () => {
    expect(catalogSchema.safeParse(rawCatalog).success).toBe(true);
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
});
