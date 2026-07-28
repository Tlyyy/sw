import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAssetDraftStore } from "./assetDraft";

describe("asset draft store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("keeps evidence filters when the platform page remounts", () => {
    const draft = useAssetDraftStore();
    draft.initialize("LG2");
    draft.evidenceQuery = "2026-07";
    draft.evidenceAccount = "PUBLIC";
    draft.evidenceKind = "market";

    const remounted = useAssetDraftStore();
    remounted.initialize("FC");

    expect(remounted.evidenceQuery).toBe("2026-07");
    expect(remounted.evidenceAccount).toBe("PUBLIC");
    expect(remounted.evidenceKind).toBe("market");
  });
});
