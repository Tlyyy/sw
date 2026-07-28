import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { accountIds, type AccountId, type InventoryBalance } from "../domain/types";
import { useRecordDraftStore } from "./recordDraft";

function inventoryRows(): Record<AccountId, InventoryBalance> {
  return Object.fromEntries(accountIds.map((accountId, index) => [accountId, {
    dedicatedEggs: index,
    regularEggs: index + 1,
    silverWan: index + 2,
    innerShardCount: index + 3,
  }])) as Record<AccountId, InventoryBalance>;
}

describe("record draft store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("keeps an expense draft while platform pages remount", () => {
    const firstPage = useRecordDraftStore();
    firstPage.openExpenseForm("FC");
    firstPage.expenseAmount = 12.5;
    firstPage.expenseNote = "购买材料";

    const remountedPage = useRecordDraftStore();
    expect(remountedPage.expenseFormOpen).toBe(true);
    expect(remountedPage.expenseAccountId).toBe("FC");
    expect(remountedPage.expenseAmount).toBe(12.5);
    expect(remountedPage.expenseNote).toBe("购买材料");
    expect(remountedPage.expenseDirty).toBe(true);
  });

  it("clears completed or explicitly discarded expense input", () => {
    const draft = useRecordDraftStore();
    draft.openExpenseForm("LG1");
    draft.expenseAmount = 8;
    draft.expenseNote = "普通蛋";

    draft.clearExpenseDraft("LG1");

    expect(draft.expenseFormOpen).toBe(false);
    expect(draft.expenseAccountId).toBe("LG1");
    expect(draft.expenseAmount).toBeNull();
    expect(draft.expenseNote).toBe("");
    expect(draft.expenseDirty).toBe(false);
  });

  it("keeps inventory input and progress while platform pages remount", () => {
    const firstPage = useRecordDraftStore();
    firstPage.openInventoryDialog();
    firstPage.initializeInventoryDraft("2026-07-28", inventoryRows());
    firstPage.inventoryDraftRows.FC.silverWan = 88.5;
    firstPage.inventoryDraftDirty = true;
    firstPage.inventoryDraftActiveAccountIndex = 2;
    firstPage.inventoryDraftReviewedAccounts = ["FC", "LG1"];

    const remountedPage = useRecordDraftStore();
    expect(remountedPage.inventoryDialogOpen).toBe(true);
    expect(remountedPage.inventoryDraftDate).toBe("2026-07-28");
    expect(remountedPage.inventoryDraftRows.FC.silverWan).toBe(88.5);
    expect(remountedPage.inventoryDraftActiveAccountIndex).toBe(2);
    expect(remountedPage.inventoryDraftReviewedAccounts).toEqual(["FC", "LG1"]);
  });

  it("clears inventory input only after an explicit close", () => {
    const draft = useRecordDraftStore();
    draft.openInventoryDialog();
    draft.initializeInventoryDraft("2026-07-28", inventoryRows());
    draft.inventoryDraftRows.PT.regularEggs = 99;

    draft.closeInventoryDialog();

    expect(draft.inventoryDialogOpen).toBe(false);
    expect(draft.inventoryDraftInitialized).toBe(false);
    expect(draft.inventoryDraftDate).toBe("");
    expect(draft.inventoryDraftRows.PT.regularEggs).toBe(0);
  });
});
