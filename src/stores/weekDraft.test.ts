import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useWeekDraftStore } from "./weekDraft";

describe("week draft store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("keeps the selected week while platform pages remount", () => {
    const firstPage = useWeekDraftStore();
    firstPage.initialize("2026-07-28");
    firstPage.selectedAnchor = "2026-07-21";

    const remountedPage = useWeekDraftStore();
    remountedPage.initialize("2026-07-28");
    expect(remountedPage.selectedAnchor).toBe("2026-07-21");
  });
});
