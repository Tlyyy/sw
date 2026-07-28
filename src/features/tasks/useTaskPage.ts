import { computed, watch } from "vue";
import { storeToRefs } from "pinia";
import { useRoute, useRouter } from "vue-router";
import { formatWan } from "../../domain/gems";
import {
  buildTaskPlans,
  taskDisplayTypeOptions,
  type ScheduledTask,
} from "../../domain/plans";
import type { AccountingResources } from "../../domain/accounting";
import type { TaskSettlementDraft } from "../../domain/taskSettlement";
import { accountIds, type AccountId } from "../../domain/types";
import { useAccountingStore } from "../../stores/accounting";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";
import {
  useTaskDraftStore,
  type MobileTaskStatusFilter,
  type TaskStatusFilter,
} from "../../stores/taskDraft";
import { useUiStore } from "../../stores/ui";

export interface TaskSettlementPayload {
  draft: TaskSettlementDraft;
  occurredAt: string;
  effectiveDate: string;
  note: string;
  complete: boolean;
  reuseExisting: boolean;
}

export function useTaskPage() {
  const catalog = useCatalogStore();
  const accounting = useAccountingStore();
  const inventory = useInventoryStore();
  const settings = useSettingsStore();
  const ui = useUiStore();
  const taskDraft = useTaskDraftStore();
  const route = useRoute();
  const router = useRouter();
  const requestedAccount = typeof route.query.account === "string"
    && accountIds.includes(route.query.account as AccountId)
    ? route.query.account as AccountId
    : null;

  taskDraft.initialize(ui.recentAccount, requestedAccount);
  accounting.hydrate();
  inventory.hydrate();

  const {
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
  } = storeToRefs(taskDraft);

  const planningState = computed(() => settings.snapshot(
    inventory.planningResources,
    inventory.latestSnapshot?.effectiveDate || null,
  ));
  const taskPlans = computed(() => buildTaskPlans(catalog.data, catalog.pets, planningState.value));
  const allTasks = computed(() => taskPlans.value.flatMap((plan) => plan.tasks));
  const settlementTask = computed(() => (
    allTasks.value.find((task) => task.id === settlementQueueIds.value[0]) || null
  ));
  const availableTaskTypes = computed(() => taskDisplayTypeOptions.filter(
    (item) => allTasks.value.some((task) => task.displayTypeKey === item.key),
  ));
  const scopedTasks = computed(() => {
    const keyword = query.value.trim().toLowerCase();
    return allTasks.value.filter((task) =>
      (account.value === "ALL" || task.accountId === account.value)
      && (taskType.value === "ALL" || task.displayTypeKey === taskType.value)
      && (!keyword || taskSearchText(task).includes(keyword)),
    );
  });
  const tasks = computed(() => scopedTasks.value.filter((task) =>
    status.value === "ALL" || (status.value === "done" ? task.done : !task.done),
  ));
  const mobileScopedTasks = computed(() => {
    const keyword = mobileQuery.value.trim().toLowerCase();
    return allTasks.value.filter((task) =>
      (mobileAccount.value === "ALL" || task.accountId === mobileAccount.value)
      && (mobileTaskType.value === "ALL" || task.displayTypeKey === mobileTaskType.value)
      && (!keyword || taskSearchText(task).includes(keyword)),
    );
  });
  const mobileTasks = computed(() => mobileScopedTasks.value.filter(
    (task) => mobileTaskBucket(task) === mobileStatus.value,
  ));
  const mobileGroupedTasks = computed(() => catalog.data.accounts.map((item) => ({
    accountId: item.id,
    tasks: mobileTasks.value.filter((task) => task.accountId === item.id),
  })).filter((group) => group.tasks.length));
  const groupedTasks = computed(() => catalog.data.accounts.map((item) => ({
    accountId: item.id,
    tasks: tasks.value.filter((task) => task.accountId === item.id),
  })).filter((group) => group.tasks.length));
  const pendingTaskCount = computed(() => scopedTasks.value.filter((task) => !task.done).length);
  const doneTaskCount = computed(() => scopedTasks.value.length - pendingTaskCount.value);
  const mobileReadyTaskCount = computed(() => mobileScopedTasks.value.filter(
    (task) => mobileTaskBucket(task) === "ready",
  ).length);
  const mobileLaterTaskCount = computed(() => mobileScopedTasks.value.filter(
    (task) => mobileTaskBucket(task) === "later",
  ).length);
  const mobileDoneTaskCount = computed(() => mobileScopedTasks.value.filter(
    (task) => mobileTaskBucket(task) === "done",
  ).length);
  const mobileDetailReadyTasks = computed(() => mobileScopedTasks.value.filter(
    (task) => mobileTaskBucket(task) === "ready",
  ));
  const mobileDetailLaterTasks = computed(() => mobileScopedTasks.value.filter(
    (task) => mobileTaskBucket(task) === "later",
  ));
  const mobileDetailDoneTasks = computed(() => mobileScopedTasks.value.filter(
    (task) => mobileTaskBucket(task) === "done",
  ));
  const mobileDetailSections = computed(() => {
    if (mobileStatus.value === "done") {
      return mobileDetailDoneTasks.value.length
        ? [{ key: "done" as const, label: "已完成", tasks: mobileDetailDoneTasks.value, collapsible: false }]
        : [];
    }
    const sections: Array<{
      key: "ready" | "later";
      label: string;
      tasks: ScheduledTask[];
      collapsible: boolean;
    }> = [];
    if (mobileStatus.value === "ready" && mobileDetailReadyTasks.value.length) {
      sections.push({ key: "ready", label: "可处理", tasks: mobileDetailReadyTasks.value, collapsible: false });
    }
    if (mobileDetailLaterTasks.value.length) {
      sections.push({ key: "later", label: "后续任务", tasks: mobileDetailLaterTasks.value, collapsible: true });
    }
    return sections;
  });
  const mobileDetailVisibleTasks = computed(() => mobileDetailSections.value.flatMap((section) =>
    section.collapsible && !mobileLaterExpanded.value ? [] : section.tasks,
  ));
  const mobileDetailPendingTaskCount = computed(() =>
    mobileDetailReadyTasks.value.length + mobileDetailLaterTasks.value.length,
  );
  const accountProgress = computed(() => catalog.data.accounts.map((item) => {
    const accountTasks = allTasks.value.filter((task) => task.accountId === item.id);
    const done = accountTasks.filter((task) => task.done).length;
    return {
      accountId: item.id,
      total: accountTasks.length,
      done,
      pending: accountTasks.length - done,
      rate: accountTasks.length ? Math.round(done / accountTasks.length * 100) : 0,
    };
  }));
  const completionOverrideCount = computed(() => Object.values(settings.taskOverrides).filter(
    (item) => item.done !== undefined,
  ).length);
  const completionByTask = computed(() => new Map(
    settings.taskCompletions.map((entry) => [entry.taskId, entry]),
  ));
  const visiblePendingTasks = computed(() => tasks.value.filter((task) => !task.done));
  const mobileVisiblePendingTasks = computed(() => mobileDetailVisibleTasks.value.filter((task) => !task.done));
  const selectedTaskCount = computed(() => selectedTaskIds.value.length);
  const allVisiblePendingSelected = computed(() => Boolean(visiblePendingTasks.value.length)
    && visiblePendingTasks.value.every((task) => selectedTaskIds.value.includes(task.id)));
  const mobileVisibleSelectedCount = computed(() => mobileVisiblePendingTasks.value.filter(
    (task) => selectedTaskIds.value.includes(task.id),
  ).length);
  const mobileVisibleSelectionState = computed<"none" | "mixed" | "all">(() => {
    if (!mobileVisibleSelectedCount.value) return "none";
    return mobileVisibleSelectedCount.value === mobileVisiblePendingTasks.value.length ? "all" : "mixed";
  });
  const settlementProgressWan = computed(() => settlementTask.value
    ? taskRecordedSilverWan(settlementTask.value.id)
    : 0);
  const settlementQueueIndex = computed(() => settlementTask.value
    ? settlementBatchTotal.value - settlementQueueIds.value.length + 1
    : 0);

  watch([account, taskType, status, query], () => {
    selectedTaskIds.value = [];
  });
  watch([mobileAccount, mobileTaskType, mobileStatus, mobileQuery], () => {
    selectedTaskIds.value = [];
    mobileBatchMode.value = false;
    mobileLaterExpanded.value = false;
  });
  watch(account, (value) => {
    if (value !== "ALL") ui.recentAccount = value as AccountId;
  });
  watch(() => route.query.account, (value) => {
    mobileAccount.value = typeof value === "string" && accountIds.includes(value as AccountId)
      ? value
      : "ALL";
  });

  function taskSearchText(task: ScheduledTask) {
    return [task.accountId, task.typeLabel, task.actionLabel, task.kind].join(" ").toLowerCase();
  }

  function requirementLabel(task: ScheduledTask) {
    if (task.resourceType === "innerShard") return `${task.shardCount} 片内丹碎片`;
    if (task.eggCount) return `${task.eggCount} 个蛋`;
    return formatWan(task.priceWan);
  }

  function scheduleLabel(task: ScheduledTask) {
    const completion = completionByTask.value.get(task.id);
    if (task.done) return completion ? `完成于 ${completion.completedOn}` : "已完成";
    const entries = accounting.taskEntries(task.id);
    if (entries.length) {
      return task.actionKey === "talisman"
        ? `已记录 ${entries.length} 次进度`
        : `已保留 ${entries.length} 笔实际记录`;
    }
    return /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) ? task.dueDate : "等待条件";
  }

  function taskState(task: ScheduledTask) {
    if (task.done) return { label: "已完成", tone: "done" };
    if (task.actionKey === "talisman" && accounting.taskEntries(task.id).length) {
      return { label: "进行中", tone: "progress" };
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) {
      return task.dueDate <= planningState.value.asOfDate
        ? { label: "可完成", tone: "ready" }
        : { label: "已排期", tone: "scheduled" };
    }
    if (task.dueDate.includes("库存") || task.dueDate.includes("普通蛋")) {
      return { label: task.dueDate, tone: "warning" };
    }
    return { label: task.dueDate, tone: "blocked" };
  }

  function mobileTaskBucket(task: ScheduledTask): MobileTaskStatusFilter {
    if (task.done) return "done";
    if (
      task.actionKey === "talisman"
      && (task.dueDate === "待洗护符" || accounting.taskEntries(task.id).length)
    ) return "ready";
    return /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)
      && task.dueDate <= planningState.value.asOfDate
      ? "ready"
      : "later";
  }

  function setStatus(value: TaskStatusFilter) {
    status.value = value;
  }

  function setMobileStatus(value: MobileTaskStatusFilter) {
    mobileStatus.value = value;
  }

  function selectAccount(accountId: string) {
    account.value = account.value === accountId ? "ALL" : accountId;
    status.value = "pending";
    if (account.value !== "ALL") ui.recentAccount = account.value as AccountId;
  }

  function clearFilters() {
    account.value = "ALL";
    taskType.value = "ALL";
    status.value = "pending";
    query.value = "";
    secondaryFiltersOpen.value = false;
  }

  function clearMobileFilters() {
    mobileTaskType.value = "ALL";
    mobileStatus.value = "ready";
    mobileQuery.value = "";
    secondaryFiltersOpen.value = false;
    closeMobileAccount();
  }

  function openMobileAccount(accountId: AccountId) {
    secondaryFiltersOpen.value = false;
    ui.recentAccount = accountId;
    if (route.query.account === accountId) {
      mobileAccount.value = accountId;
      return;
    }
    void router.push({ query: { ...route.query, account: accountId } });
  }

  function closeMobileAccount() {
    if (!("account" in route.query)) {
      mobileAccount.value = "ALL";
      return;
    }
    const { account: _account, ...queryWithoutAccount } = route.query;
    void router.push({ query: queryWithoutAccount });
  }

  function changeMobileAccountFilter(value: string) {
    if (value === "ALL") closeMobileAccount();
    else openMobileAccount(value as AccountId);
  }

  function toggleMobileBatchMode() {
    mobileBatchMode.value = !mobileBatchMode.value;
    selectedTaskIds.value = [];
  }

  function toggleMobileLaterSection() {
    mobileLaterExpanded.value = !mobileLaterExpanded.value;
    if (!mobileLaterExpanded.value) {
      const laterIds = new Set(mobileDetailLaterTasks.value.map((task) => task.id));
      selectedTaskIds.value = selectedTaskIds.value.filter((id) => !laterIds.has(id));
    }
  }

  function handleMobileTaskPrimary(task: ScheduledTask) {
    if (mobileBatchMode.value && !task.done) {
      toggleTaskSelection(task.id, !selectedTaskIds.value.includes(task.id));
      return;
    }
    handleTaskAction(task);
  }

  function toggleTaskSelection(taskId: string, checked: boolean) {
    selectedTaskIds.value = checked
      ? [...new Set([...selectedTaskIds.value, taskId])]
      : selectedTaskIds.value.filter((id) => id !== taskId);
  }

  function toggleVisibleSelection(checked: boolean) {
    selectedTaskIds.value = checked ? visiblePendingTasks.value.map((task) => task.id) : [];
  }

  function toggleMobileVisibleSelection(checked: boolean) {
    selectedTaskIds.value = checked ? mobileVisiblePendingTasks.value.map((task) => task.id) : [];
  }

  function taskRecordedSilverWan(taskId: string) {
    return accounting.taskEntries(taskId).reduce((sum, entry) => (
      sum + entry.legs
        .filter((leg) => leg.kind === "expense")
        .reduce((entrySum, leg) => entrySum + leg.resources.silverWan, 0)
    ), 0);
  }

  function taskLedgerSummary(task: ScheduledTask) {
    const entries = accounting.taskEntries(task.id);
    if (!entries.length) return "";
    const totals = entries.reduce<AccountingResources>((sum, entry) => {
      for (const leg of entry.legs) {
        if (leg.kind !== "expense") continue;
        sum.silverWan += leg.resources.silverWan;
        sum.dedicatedEggs += leg.resources.dedicatedEggs;
        sum.regularEggs += leg.resources.regularEggs;
        sum.innerShards = (sum.innerShards || 0) + (leg.resources.innerShards || 0);
      }
      return sum;
    }, {
      silverWan: 0,
      dedicatedEggs: 0,
      regularEggs: 0,
      innerShards: 0,
    });
    const resources = [
      totals.silverWan > 0
        ? `银子 ${Number(totals.silverWan.toFixed(2)).toLocaleString("zh-CN")} 万`
        : "",
      totals.dedicatedEggs > 0 ? `专用蛋 ${totals.dedicatedEggs}` : "",
      totals.regularEggs > 0 ? `普通蛋 ${totals.regularEggs}` : "",
      (totals.innerShards || 0) > 0 ? `碎片 ${totals.innerShards}` : "",
    ].filter(Boolean);
    const countLabel = task.actionKey === "talisman"
      ? `${entries.length} 次进度`
      : `${entries.length} 笔实际记录`;
    return [countLabel, ...resources].join(" · ");
  }

  function openSettlement(taskItems: ScheduledTask[]) {
    taskDraft.setSettlementQueue(taskItems.map((task) => task.id));
  }

  function closeSettlement() {
    taskDraft.closeSettlement();
  }

  function advanceSettlementQueue() {
    taskDraft.advanceSettlementQueue();
  }

  function restoreTask(task: ScheduledTask) {
    const legacyCompletion = completionByTask.value.get(task.id);
    if (legacyCompletion && !accounting.hasTaskAuthority(task.id)) {
      accounting.materializeLegacyTaskCompletion(legacyCompletion);
    }
    const entries = accounting.taskEntries(task.id);
    settings.setTaskDone(task.id, false);
    selectedTaskIds.value = selectedTaskIds.value.filter((id) => id !== task.id);
    actionFeedback.value = `已将 ${task.accountId} · ${task.typeLabel} · ${task.actionLabel} 恢复为${task.actionKey === "talisman" ? "进行中" : "未完成"}`
      + `${entries.length ? `；${entries.length} 笔实际记录继续保留` : ""}，库存没有变化。`;
  }

  function handleTaskAction(task: ScheduledTask) {
    if (task.done) {
      restoreTask(task);
      return;
    }
    openSettlement([task]);
  }

  function saveTaskSettlement(payload: TaskSettlementPayload) {
    const task = settlementTask.value;
    if (!task) return;
    const resources: AccountingResources = {
      silverWan: Number(payload.draft.silverWan || 0),
      dedicatedEggs: payload.draft.dedicatedEggs,
      regularEggs: payload.draft.regularEggs,
      innerShards: payload.draft.innerShardCount,
    };
    const source = payload.draft.mode === "progress"
      ? "task-progress"
      : payload.draft.mode === "variable"
        ? "task-variable"
        : "task-fixed";
    if (!payload.reuseExisting) {
      accounting.addTaskSettlement({
        accountId: task.accountId,
        effectiveDate: payload.effectiveDate,
        occurredAt: payload.occurredAt,
        taskId: task.id,
        source,
        resources,
        note: payload.note || `${task.typeLabel} · ${task.actionLabel}`,
      });
    }
    let completion = null;
    if (payload.complete) {
      completion = settings.completeTask(task, payload.effectiveDate, () => new Date(), {
        silverSpentWan: payload.reuseExisting ? 0 : resources.silverWan,
      });
      selectedTaskIds.value = selectedTaskIds.value.filter((id) => id !== task.id);
    }
    actionFeedback.value = payload.complete
      ? `已完成 ${task.accountId} · ${task.typeLabel} · ${task.actionLabel}${completion ? payload.reuseExisting ? "，沿用已有实际流水" : "，实际花费已独立记账" : ""}；库存未被修改。`
      : `已记录 ${task.accountId} · 洗护符本次进度，累计 ${Number(taskRecordedSilverWan(task.id).toFixed(2)).toLocaleString("zh-CN")} 万；任务继续进行中。`;
    taskDraft.clearSettlementDraft();
    advanceSettlementQueue();
  }

  function completeSelectedTasks() {
    const selected = allTasks.value.filter(
      (task) => selectedTaskIds.value.includes(task.id) && !task.done,
    );
    if (selected.length) openSettlement(selected);
  }

  function taskActionLabel(task: ScheduledTask) {
    if (task.done) return task.actionKey === "talisman" ? "恢复进行中" : "恢复未完成";
    if (task.actionKey === "talisman") return "记录进度";
    return "标记完成";
  }

  function resetCompletion() {
    if (!completionOverrideCount.value) return;
    if (confirm("确认清除全部任务完成状态？实际支出流水、库存、单项价格和计划参数都不会改变。")) {
      settings.resetTaskCompletionOverrides();
      selectedTaskIds.value = [];
      actionFeedback.value = "已恢复全部任务的默认完成状态；真实支出流水继续保留，库存没有变化。";
    }
  }

  return {
    catalog,
    accounting,
    inventory,
    settings,
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
    settlementBatchTotal,
    settlementTask,
    availableTaskTypes,
    tasks,
    mobileScopedTasks,
    mobileTasks,
    mobileGroupedTasks,
    groupedTasks,
    pendingTaskCount,
    doneTaskCount,
    mobileReadyTaskCount,
    mobileLaterTaskCount,
    mobileDoneTaskCount,
    mobileDetailSections,
    mobileDetailPendingTaskCount,
    accountProgress,
    completionOverrideCount,
    visiblePendingTasks,
    mobileVisiblePendingTasks,
    selectedTaskCount,
    allVisiblePendingSelected,
    mobileVisibleSelectedCount,
    mobileVisibleSelectionState,
    settlementProgressWan,
    settlementQueueIndex,
    requirementLabel,
    scheduleLabel,
    taskState,
    setStatus,
    setMobileStatus,
    selectAccount,
    clearFilters,
    clearMobileFilters,
    openMobileAccount,
    closeMobileAccount,
    changeMobileAccountFilter,
    toggleMobileBatchMode,
    toggleMobileLaterSection,
    handleTaskAction,
    handleMobileTaskPrimary,
    toggleTaskSelection,
    toggleVisibleSelection,
    toggleMobileVisibleSelection,
    taskLedgerSummary,
    closeSettlement,
    saveTaskSettlement,
    completeSelectedTasks,
    taskActionLabel,
    resetCompletion,
  };
}
