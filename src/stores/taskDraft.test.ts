import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useTaskDraftStore } from "./taskDraft";

describe("task draft store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("keeps filters, selection and a settlement queue across platform remounts", () => {
    const desktopPage = useTaskDraftStore();
    desktopPage.initialize("LG2", null);
    desktopPage.account = "FC";
    desktopPage.query = "皮肤";
    desktopPage.selectedTaskIds = ["FC:snake1:skin"];
    desktopPage.setSettlementQueue(["FC:snake1:skin", "LG1:snake1:skin"]);

    const mobilePage = useTaskDraftStore();
    expect(mobilePage.account).toBe("FC");
    expect(mobilePage.query).toBe("皮肤");
    expect(mobilePage.selectedTaskIds).toEqual(["FC:snake1:skin"]);
    expect(mobilePage.settlementQueueIds).toEqual(["FC:snake1:skin", "LG1:snake1:skin"]);
    expect(mobilePage.settlementBatchTotal).toBe(2);
  });

  it("advances and clears only the settlement queue", () => {
    const draft = useTaskDraftStore();
    draft.selectedTaskIds = ["FC:snake1:skin"];
    draft.setSettlementQueue(["FC:snake1:skin", "LG1:snake1:skin"]);

    draft.advanceSettlementQueue();
    expect(draft.settlementQueueIds).toEqual(["LG1:snake1:skin"]);
    expect(draft.settlementBatchTotal).toBe(2);

    draft.closeSettlement();
    expect(draft.settlementQueueIds).toEqual([]);
    expect(draft.settlementBatchTotal).toBe(0);
    expect(draft.selectedTaskIds).toEqual(["FC:snake1:skin"]);
  });

  it("keeps the active settlement form until it is saved or explicitly cancelled", () => {
    const firstPage = useTaskDraftStore();
    firstPage.setSettlementQueue(["FC:snake1:skin"]);
    firstPage.initializeSettlementDraft("FC:snake1:skin", {
      taskId: "FC:snake1:skin",
      accountId: "FC",
      actionKey: "skin",
      mode: "fixed",
      silverWan: 12,
      dedicatedEggs: 0,
      regularEggs: 0,
      innerShardCount: 0,
      zeroConfirmed: false,
    }, "2026-07-28T17:10", false);
    firstPage.settlementDraft!.silverWan = 18.5;
    firstPage.settlementNote = "实际消耗";

    const remountedPage = useTaskDraftStore();
    expect(remountedPage.settlementDraftTaskId).toBe("FC:snake1:skin");
    expect(remountedPage.settlementDraft?.silverWan).toBe(18.5);
    expect(remountedPage.settlementNote).toBe("实际消耗");

    remountedPage.closeSettlement();
    expect(remountedPage.settlementDraft).toBeNull();
    expect(remountedPage.settlementNote).toBe("");
  });
});
