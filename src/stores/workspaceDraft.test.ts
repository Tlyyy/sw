import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { useWorkspaceDraftStore } from "./workspaceDraft";

describe("workspace draft", () => {
  beforeEach(() => setActivePinia(createPinia()));
  it("keeps analysis, publish and settings drafts across page remounts", () => {
    const first = useWorkspaceDraftStore();
    first.recommendationQuery = "祸斗";
    first.publishAccount = "PT";
    first.nextPassword = "pending-secret";
    const next = useWorkspaceDraftStore();
    expect(next.recommendationQuery).toBe("祸斗");
    expect(next.publishAccount).toBe("PT");
    expect(next.nextPassword).toBe("pending-secret");
  });
});
