import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { useDataWorkspaceDraftStore } from "./dataWorkspaceDraft";

describe("data workspace draft", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("keeps inventory navigation and dialog state across consumers", () => {
    const first = useDataWorkspaceDraftStore();
    first.inventoryView = "records";
    first.inventoryAnchor = "2026-07-20";
    first.inventoryDialogOpen = true;
    first.inventoryDialogDate = "2026-07-21";

    const next = useDataWorkspaceDraftStore();
    expect(next.inventoryView).toBe("records");
    expect(next.inventoryAnchor).toBe("2026-07-20");
    expect(next.inventoryDialogOpen).toBe(true);
    expect(next.inventoryDialogDate).toBe("2026-07-21");
  });
});
