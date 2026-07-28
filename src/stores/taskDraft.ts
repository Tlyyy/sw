import { ref } from "vue";
import { defineStore } from "pinia";
import type { TaskSettlementDraft } from "../domain/taskSettlement";
import type { AccountId } from "../domain/types";

export type TaskStatusFilter = "pending" | "done" | "ALL";
export type MobileTaskStatusFilter = "ready" | "later" | "done";

export const useTaskDraftStore = defineStore("task-draft", () => {
  const account = ref<string>("ALL");
  const taskType = ref("ALL");
  const status = ref<TaskStatusFilter>("pending");
  const query = ref("");
  const mobileAccount = ref<string>("ALL");
  const mobileTaskType = ref("ALL");
  const mobileStatus = ref<MobileTaskStatusFilter>("ready");
  const mobileQuery = ref("");
  const mobileBatchMode = ref(false);
  const mobileLaterExpanded = ref(false);
  const selectedTaskIds = ref<string[]>([]);
  const actionFeedback = ref("");
  const secondaryFiltersOpen = ref(false);
  const settlementQueueIds = ref<string[]>([]);
  const settlementBatchTotal = ref(0);
  const settlementDraftTaskId = ref("");
  const settlementDraft = ref<TaskSettlementDraft | null>(null);
  const settlementOccurredAtLocal = ref("");
  const settlementNote = ref("");
  const settlementReuseExisting = ref(false);
  const settlementSubmitted = ref(false);
  const settlementTimeError = ref("");
  const initialized = ref(false);

  function initialize(defaultAccount: AccountId, requestedAccount: AccountId | null) {
    if (initialized.value) return;
    account.value = requestedAccount || defaultAccount;
    mobileAccount.value = requestedAccount || "ALL";
    initialized.value = true;
  }

  function clearSelection() {
    selectedTaskIds.value = [];
  }

  function setSettlementQueue(taskIds: string[]) {
    settlementQueueIds.value = [...taskIds];
    settlementBatchTotal.value = taskIds.length;
  }

  function closeSettlement() {
    settlementQueueIds.value = [];
    settlementBatchTotal.value = 0;
    clearSettlementDraft();
  }

  function advanceSettlementQueue() {
    settlementQueueIds.value = settlementQueueIds.value.slice(1);
    if (!settlementQueueIds.value.length) settlementBatchTotal.value = 0;
  }

  function initializeSettlementDraft(
    taskId: string,
    draft: TaskSettlementDraft,
    occurredAtLocal: string,
    reuseExisting: boolean,
  ) {
    if (settlementDraftTaskId.value === taskId && settlementDraft.value) return false;
    settlementDraftTaskId.value = taskId;
    settlementDraft.value = draft;
    settlementOccurredAtLocal.value = occurredAtLocal;
    settlementNote.value = "";
    settlementReuseExisting.value = reuseExisting;
    settlementSubmitted.value = false;
    settlementTimeError.value = "";
    return true;
  }

  function clearSettlementDraft() {
    settlementDraftTaskId.value = "";
    settlementDraft.value = null;
    settlementOccurredAtLocal.value = "";
    settlementNote.value = "";
    settlementReuseExisting.value = false;
    settlementSubmitted.value = false;
    settlementTimeError.value = "";
  }

  return {
    account,
    taskType,
    status,
    query,
    mobileAccount,
    mobileTaskType,
    mobileStatus,
    mobileQuery,
    mobileBatchMode,
    mobileLaterExpanded,
    selectedTaskIds,
    actionFeedback,
    secondaryFiltersOpen,
    settlementQueueIds,
    settlementBatchTotal,
    settlementDraftTaskId,
    settlementDraft,
    settlementOccurredAtLocal,
    settlementNote,
    settlementReuseExisting,
    settlementSubmitted,
    settlementTimeError,
    initialized,
    initialize,
    clearSelection,
    setSettlementQueue,
    closeSettlement,
    advanceSettlementQueue,
    initializeSettlementDraft,
    clearSettlementDraft,
  };
});
