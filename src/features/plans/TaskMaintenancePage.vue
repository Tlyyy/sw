<script setup lang="ts">
import { computed, ref, watch } from "vue";
import TaskSettlementDialog from "../../components/TaskSettlementDialog.vue";
import { useCatalogStore } from "../../stores/catalog";
import { useAccountingStore } from "../../stores/accounting";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";
import { buildTaskPlans, taskDisplayTypeOptions, type ScheduledTask } from "../../domain/plans";
import { formatWan } from "../../domain/gems";
import type { AccountingResources } from "../../domain/accounting";
import type { TaskSettlementDraft } from "../../domain/taskSettlement";
import type { AccountId } from "../../domain/types";
import { useUiStore } from "../../stores/ui";

type TaskStatusFilter = "pending" | "done" | "ALL";

const catalog = useCatalogStore();
const accounting = useAccountingStore();
const inventory = useInventoryStore();
const settings = useSettingsStore();
const ui = useUiStore();
const account = ref<string>(ui.recentAccount);
const taskType = ref("ALL");
const status = ref<TaskStatusFilter>("pending");
const query = ref("");
const selectedTaskIds = ref<string[]>([]);
const actionFeedback = ref("");
const secondaryFiltersOpen = ref(false);
const settlementTask = ref<ScheduledTask | null>(null);
const settlementQueue = ref<ScheduledTask[]>([]);

interface TaskSettlementPayload {
  draft: TaskSettlementDraft;
  occurredAt: string;
  effectiveDate: string;
  note: string;
  complete: boolean;
  reuseExisting: boolean;
}

inventory.hydrate();
accounting.hydrate();

const planningState = computed(() => settings.snapshot(
  inventory.planningResources,
  inventory.latestSnapshot?.effectiveDate || null,
));
const taskPlans = computed(() => buildTaskPlans(catalog.data, catalog.pets, planningState.value));
const allTasks = computed(() => taskPlans.value.flatMap((plan) => plan.tasks));
const availableTaskTypes = computed(() => taskDisplayTypeOptions.filter((item) => allTasks.value.some((task) => task.displayTypeKey === item.key)));
const scopedTasks = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  return allTasks.value.filter((task) =>
    (account.value === "ALL" || task.accountId === account.value)
    && (taskType.value === "ALL" || task.displayTypeKey === taskType.value)
    && (!keyword || [task.accountId, task.typeLabel, task.actionLabel, task.kind].join(" ").toLowerCase().includes(keyword)),
  );
});
const tasks = computed(() => scopedTasks.value.filter((task) =>
  status.value === "ALL" || (status.value === "done" ? task.done : !task.done),
));
const groupedTasks = computed(() => catalog.data.accounts.map((item) => ({
  accountId: item.id,
  tasks: tasks.value.filter((task) => task.accountId === item.id),
})).filter((group) => group.tasks.length));
const pendingTaskCount = computed(() => scopedTasks.value.filter((task) => !task.done).length);
const doneTaskCount = computed(() => scopedTasks.value.length - pendingTaskCount.value);
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
const completionOverrideCount = computed(() => Object.values(settings.taskOverrides).filter((item) => item.done !== undefined).length);
const completionByTask = computed(() => new Map(settings.taskCompletions.map((entry) => [entry.taskId, entry])));
const visiblePendingTasks = computed(() => tasks.value.filter((task) => !task.done));
const selectedTaskCount = computed(() => selectedTaskIds.value.length);
const allVisiblePendingSelected = computed(() => Boolean(visiblePendingTasks.value.length)
  && visiblePendingTasks.value.every((task) => selectedTaskIds.value.includes(task.id)));
const settlementProgressWan = computed(() => settlementTask.value
  ? taskRecordedSilverWan(settlementTask.value.id)
  : 0);

watch([account, taskType, status, query], () => {
  selectedTaskIds.value = [];
});

watch(account, (value) => {
  if (value !== "ALL") ui.recentAccount = value as AccountId;
});

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
  if (task.dueDate.includes("库存") || task.dueDate.includes("普通蛋")) return { label: task.dueDate, tone: "warning" };
  return { label: task.dueDate, tone: "blocked" };
}

function setStatus(value: TaskStatusFilter) {
  status.value = value;
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

function toggleTaskSelection(taskId: string, checked: boolean) {
  selectedTaskIds.value = checked
    ? [...new Set([...selectedTaskIds.value, taskId])]
    : selectedTaskIds.value.filter((id) => id !== taskId);
}

function toggleVisibleSelection(checked: boolean) {
  selectedTaskIds.value = checked ? visiblePendingTasks.value.map((task) => task.id) : [];
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

function openSettlement(tasks: ScheduledTask[]) {
  settlementQueue.value = [...tasks];
  settlementTask.value = settlementQueue.value[0] || null;
}

function closeSettlement() {
  settlementTask.value = null;
  settlementQueue.value = [];
}

function advanceSettlementQueue() {
  settlementQueue.value = settlementQueue.value.slice(1);
  settlementTask.value = settlementQueue.value[0] || null;
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
    completion = settings.completeTask(
      task,
      payload.effectiveDate,
      () => new Date(),
      {
        // The legacy weekly summary remains completion-based. Only the
        // current settlement belongs to this completion date; earlier
        // talisman instalments stay exclusively in the independent ledger.
        silverSpentWan: payload.reuseExisting ? 0 : resources.silverWan,
      },
    );
    selectedTaskIds.value = selectedTaskIds.value.filter((id) => id !== task.id);
  }

  actionFeedback.value = payload.complete
    ? `已完成 ${task.accountId} · ${task.typeLabel} · ${task.actionLabel}${completion ? payload.reuseExisting ? "，沿用已有实际流水" : "，实际花费已独立记账" : ""}；库存未被修改。`
    : `已记录 ${task.accountId} · 洗护符本次进度，累计 ${Number(taskRecordedSilverWan(task.id).toFixed(2)).toLocaleString("zh-CN")} 万；任务继续进行中。`;
  advanceSettlementQueue();
}

function completeSelectedTasks() {
  const selected = allTasks.value.filter((task) => selectedTaskIds.value.includes(task.id) && !task.done);
  if (!selected.length) return;
  openSettlement(selected);
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
</script>

<template>
  <div class="page-wrap plan-page task-maintenance-page">
    <header class="task-page-intro">
      <div><p>任务</p><h1>按账号维护任务</h1><span>完成前确认真实消耗；这里只记账，不会自动扣减你手工录入的库存。</span></div>
      <RouterLink class="button" to="/record">返回录入</RouterLink>
    </header>

    <section class="task-account-overview" aria-labelledby="task-account-overview-title">
      <header><div><p>逐账号查看</p><h2 id="task-account-overview-title">各账号任务进度</h2></div><span>点账号可直接筛选</span></header>
      <div>
        <button v-for="item in accountProgress" :key="item.accountId" type="button" :class="{ active: account === item.accountId }" :data-account-id="item.accountId" :aria-label="`筛选 ${item.accountId} 账号任务`" :aria-pressed="account === item.accountId" @click="selectAccount(item.accountId)">
          <strong>{{ item.accountId }}</strong>
          <span>{{ item.done }} / {{ item.total }}</span>
          <i aria-hidden="true"><b :style="{ width: `${item.rate}%` }"></b></i>
          <small>{{ item.pending }} 项待完成</small>
        </button>
      </div>
    </section>

    <section class="task-operation-guide" aria-label="操作指引">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 10.7v6M12 7.3h.01" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2"/></svg>
      <div>
        <strong>先确认消耗，再完成任务</strong>
        <p>固定消耗只需确认，打书填写实际银子，洗护符可跨天多次记录；恢复任务状态不会删除实际流水。</p>
      </div>
      <button v-if="completionOverrideCount" class="button danger task-reset-action" type="button" @click="resetCompletion">清除全部完成记录</button>
    </section>

    <p v-if="actionFeedback" class="task-action-feedback" role="status">{{ actionFeedback }}</p>

    <form class="task-workflow-filter" aria-label="任务筛选" @submit.prevent>
      <label class="task-search-field">
        <span class="visually-hidden">搜索任务</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.7" cy="10.7" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m15.6 15.6 4.2 4.2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8"/></svg>
        <input v-model="query" type="search" aria-label="任务关键词筛选" placeholder="搜索账号、神兽或任务" />
      </label>
      <fieldset class="task-status-segments">
        <legend>状态</legend>
        <div role="group" aria-label="任务状态筛选">
          <button type="button" :class="{ active: status === 'pending' }" :aria-pressed="status === 'pending'" @click="setStatus('pending')">待完成 <span>{{ pendingTaskCount }}</span></button>
          <button type="button" :class="{ active: status === 'done' }" :aria-pressed="status === 'done'" @click="setStatus('done')">已完成 <span>{{ doneTaskCount }}</span></button>
          <button type="button" :class="{ active: status === 'ALL' }" :aria-pressed="status === 'ALL'" @click="setStatus('ALL')">全部</button>
        </div>
      </fieldset>
      <button class="button task-mobile-filter-toggle" type="button" :aria-expanded="secondaryFiltersOpen" aria-controls="task-secondary-filters" @click="secondaryFiltersOpen = !secondaryFiltersOpen">
        {{ secondaryFiltersOpen ? "收起筛选" : "更多筛选" }}
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7"/></svg>
      </button>
      <label id="task-secondary-filters" :class="['task-secondary-filter', { open: secondaryFiltersOpen }]"><span>账号</span><select v-model="account" aria-label="任务账号筛选"><option value="ALL">全部账号</option><option v-for="item in catalog.data.accounts" :key="item.id" :value="item.id">{{ item.id }}</option></select></label>
      <label :class="['task-secondary-filter', { open: secondaryFiltersOpen }]"><span>用途</span><select v-model="taskType" aria-label="任务用途筛选"><option value="ALL">全部用途</option><option v-for="item in availableTaskTypes" :key="item.key" :value="item.key">{{ item.label }}</option></select></label>
      <button class="button task-clear-filter" type="button" @click="clearFilters">清除筛选</button>
    </form>

    <div v-if="tasks.length" class="task-worklist" role="region" aria-label="神兽任务列表">
      <div class="task-worklist-head">
        <label class="task-select-cell"><input type="checkbox" :checked="allVisiblePendingSelected" :disabled="!visiblePendingTasks.length" aria-label="选择当前全部待完成任务" @change="toggleVisibleSelection(($event.target as HTMLInputElement).checked)" /></label>
        <span>账号 / 神兽</span>
        <span>任务阶段</span>
        <span>所需资源</span>
        <span>预计完成</span>
        <span>状态 / 操作</span>
      </div>

      <section v-for="group in groupedTasks" :key="group.accountId" class="task-account-group" :aria-labelledby="`task-account-${group.accountId}`">
        <header :id="`task-account-${group.accountId}`" class="task-account-header">
          <span class="task-account-mark">{{ group.accountId }}</span>
          <strong>{{ group.accountId }}</strong>
          <span>共 {{ group.tasks.length }} 项</span>
        </header>
        <article v-for="task in group.tasks" :key="task.id" :class="['task-work-row', { done: task.done }]" :aria-label="`${task.accountId} ${task.typeLabel} ${task.actionLabel}`">
          <label class="task-select-cell"><input type="checkbox" :checked="selectedTaskIds.includes(task.id)" :disabled="task.done" :aria-label="`选择 ${task.accountId} ${task.typeLabel} ${task.actionLabel}`" @change="toggleTaskSelection(task.id, ($event.target as HTMLInputElement).checked)" /></label>
          <div class="task-identity-cell"><strong>{{ task.typeLabel }}</strong><span>{{ task.accountId }} · {{ task.typeKey === 'horse' ? '神兽龙马' : '神兽青蛇' }}</span></div>
          <div class="task-stage-cell">
            <strong>{{ task.actionLabel }}</strong>
            <span>{{ task.kind }}</span>
            <small v-if="taskLedgerSummary(task)" class="task-ledger-summary">{{ taskLedgerSummary(task) }}</small>
          </div>
          <strong class="task-resource-cell">{{ requirementLabel(task) }}</strong>
          <div class="task-schedule-cell"><strong>{{ scheduleLabel(task) }}</strong><span v-if="scheduleLabel(task) === '等待条件'">条件满足后排期</span></div>
          <div class="task-status-cell">
            <span :class="['task-state-label', taskState(task).tone]">{{ taskState(task).label }}</span>
            <button :class="['task-row-action', { secondary: task.done }]" type="button" :aria-label="`${task.accountId} ${task.typeLabel} ${task.actionLabel} ${taskActionLabel(task)}`" @click="handleTaskAction(task)">{{ taskActionLabel(task) }}</button>
          </div>
        </article>
      </section>
    </div>
    <p v-else class="empty-state">没有符合当前筛选条件的任务，请调整状态或筛选条件。</p>

    <aside v-if="selectedTaskCount" class="task-bulk-action-bar" aria-label="批量任务操作">
      <div><strong>已选 {{ selectedTaskCount }} 项</strong><span>将按顺序逐项确认真实消耗</span></div>
      <button class="button primary" type="button" @click="completeSelectedTasks">逐项确认并完成</button>
      <button class="text-button" type="button" @click="selectedTaskIds = []">取消选择</button>
    </aside>

    <TaskSettlementDialog
      v-if="settlementTask"
      :key="settlementTask.id"
      :task="settlementTask"
      :inventory="inventory.latestSnapshot?.accounts[settlementTask.accountId] || null"
      :progress-total-wan="settlementProgressWan"
      :existing-entry-count="accounting.taskEntries(settlementTask.id).length"
      :existing-summary="taskLedgerSummary(settlementTask)"
      @cancel="closeSettlement"
      @confirm="saveTaskSettlement"
    />
  </div>
</template>

<style scoped>
.task-maintenance-page { width: min(100%, 1320px); padding-top: 14px; padding-bottom: 56px; }
.task-page-intro { min-height: 74px; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 0 4px 13px; border-bottom: 1px solid var(--radar-line); }
.task-page-intro > div { min-width: 0; }
.task-page-intro p { color: var(--radar-cyan-strong); font-size: 11px; font-weight: 850; letter-spacing: .1em; }
.task-page-intro h1 { margin-top: 1px; font-size: 27px; line-height: 1.2; letter-spacing: -.04em; }
.task-page-intro span { display: block; margin-top: 3px; color: var(--radar-muted); font-size: 12px; line-height: 1.45; }
.task-page-intro .button { min-height: 44px; white-space: nowrap; }
.task-account-overview { overflow: hidden; margin: 16px 0; border: 1px solid var(--radar-line); border-radius: 12px; background: #ffffff; }
.task-account-overview > header { min-height: 58px; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 10px 14px; border-bottom: 1px solid var(--radar-line); background: var(--radar-surface-2); }
.task-account-overview > header p { color: var(--radar-cyan-strong); font-size: 10px; font-weight: 850; letter-spacing: .08em; }
.task-account-overview > header h2 { margin-top: 1px; font-size: 17px; }
.task-account-overview > header > span { color: var(--radar-muted); font-size: 11px; font-weight: 750; }
.task-account-overview > div { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); }
.task-account-overview button { min-width: 0; min-height: 94px; display: grid; place-items: center; align-content: center; gap: 2px; padding: 9px 7px; border: 0; border-right: 1px solid var(--radar-line); color: var(--radar-ink); background: #ffffff; font: inherit; }
.task-account-overview button:last-child { border-right: 0; }
.task-account-overview button.active { color: var(--radar-cyan-strong); background: var(--radar-cyan-soft); }
.task-account-overview button strong { font-size: 14px; }
.task-account-overview button > span { font-size: 12px; font-weight: 850; }
.task-account-overview button > i { width: 100%; height: 4px; overflow: hidden; margin: 3px 0; border-radius: 999px; background: var(--radar-line); }
.task-account-overview button > i > b { height: 100%; display: block; border-radius: inherit; background: var(--radar-cyan); }
.task-account-overview button small { color: var(--radar-muted); font-size: 10px; white-space: nowrap; }
.task-ledger-summary {
  overflow: hidden;
  color: var(--radar-cyan-strong);
  font-size: 10px;
  font-weight: 800;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-state-label.progress {
  border-color: #d9c28a;
  color: #845000;
  background: #fff8e8;
}

@media (min-width: 861px) and (max-width: 1100px) {
  .task-maintenance-page { --task-grid: 36px minmax(130px, 1fr) minmax(108px, .78fr) 104px 112px minmax(158px, .9fr); }
}

@media (max-width: 720px) {
  .task-maintenance-page { padding: 10px 10px 32px; }
  .task-page-intro { min-height: 0; align-items: flex-start; }
  .task-page-intro h1 { font-size: 24px; }
  .task-page-intro span { max-width: 240px; }
  .task-account-overview { margin: 12px 0; }
  .task-account-overview > header { min-height: 52px; padding: 8px 10px; }
  .task-account-overview button { min-height: 84px; padding-inline: 4px; }
  .task-account-overview button small { font-size: 10px; }
  .task-ledger-summary {
    overflow: visible;
    white-space: normal;
  }
}
</style>
