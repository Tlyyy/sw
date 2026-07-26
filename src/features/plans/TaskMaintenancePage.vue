<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import AppIcon from "../../components/AppIcon.vue";
import TaskSettlementDialog from "../../components/TaskSettlementDialog.vue";
import { useCatalogStore } from "../../stores/catalog";
import { useAccountingStore } from "../../stores/accounting";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";
import { buildTaskPlans, taskDisplayTypeOptions, type ScheduledTask } from "../../domain/plans";
import { formatWan } from "../../domain/gems";
import type { AccountingResources } from "../../domain/accounting";
import type { TaskSettlementDraft } from "../../domain/taskSettlement";
import { accountIds, type AccountId } from "../../domain/types";
import { useUiStore } from "../../stores/ui";

type TaskStatusFilter = "pending" | "done" | "ALL";

const catalog = useCatalogStore();
const accounting = useAccountingStore();
const inventory = useInventoryStore();
const settings = useSettingsStore();
const ui = useUiStore();
const route = useRoute();
const requestedAccount = typeof route.query.account === "string"
  && accountIds.includes(route.query.account as AccountId)
  ? route.query.account as AccountId
  : null;
const account = ref<string>(requestedAccount || ui.recentAccount);
const taskType = ref("ALL");
const status = ref<TaskStatusFilter>("pending");
const query = ref("");
const mobileAccount = ref<string>(requestedAccount || "ALL");
const mobileTaskType = ref("ALL");
const mobileStatus = ref<TaskStatusFilter>("pending");
const mobileQuery = ref("");
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
const mobileScopedTasks = computed(() => {
  const keyword = mobileQuery.value.trim().toLowerCase();
  return allTasks.value.filter((task) =>
    (mobileAccount.value === "ALL" || task.accountId === mobileAccount.value)
    && (mobileTaskType.value === "ALL" || task.displayTypeKey === mobileTaskType.value)
    && (!keyword || [task.accountId, task.typeLabel, task.actionLabel, task.kind].join(" ").toLowerCase().includes(keyword)),
  );
});
const mobileTasks = computed(() => mobileScopedTasks.value.filter((task) =>
  mobileStatus.value === "ALL" || (mobileStatus.value === "done" ? task.done : !task.done),
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
const mobilePendingTaskCount = computed(() => mobileScopedTasks.value.filter((task) => !task.done).length);
const mobileDoneTaskCount = computed(() => mobileScopedTasks.value.length - mobilePendingTaskCount.value);
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
const mobileVisiblePendingTasks = computed(() => mobileTasks.value.filter((task) => !task.done));
const selectedTaskCount = computed(() => selectedTaskIds.value.length);
const allVisiblePendingSelected = computed(() => Boolean(visiblePendingTasks.value.length)
  && visiblePendingTasks.value.every((task) => selectedTaskIds.value.includes(task.id)));
const allMobileVisiblePendingSelected = computed(() => Boolean(mobileVisiblePendingTasks.value.length)
  && mobileVisiblePendingTasks.value.every((task) => selectedTaskIds.value.includes(task.id)));
const settlementProgressWan = computed(() => settlementTask.value
  ? taskRecordedSilverWan(settlementTask.value.id)
  : 0);

watch([account, taskType, status, query], () => {
  selectedTaskIds.value = [];
});

watch([mobileAccount, mobileTaskType, mobileStatus, mobileQuery], () => {
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

function setMobileStatus(value: TaskStatusFilter) {
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
  mobileAccount.value = "ALL";
  mobileTaskType.value = "ALL";
  mobileStatus.value = "pending";
  mobileQuery.value = "";
  secondaryFiltersOpen.value = false;
}

function openMobileAccount(accountId: AccountId) {
  mobileAccount.value = accountId;
  secondaryFiltersOpen.value = false;
  ui.recentAccount = accountId;
}

function closeMobileAccount() {
  mobileAccount.value = "ALL";
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
    <section class="task-mobile-workspace" aria-label="手机任务工作台">
      <header class="task-mobile-controller">
        <div class="task-mobile-segments" role="group" aria-label="任务状态筛选">
          <button type="button" :class="{ active: mobileStatus === 'pending' }" :aria-pressed="mobileStatus === 'pending'" @click="setMobileStatus('pending')">
            待处理 <span>{{ mobilePendingTaskCount }}</span>
          </button>
          <button type="button" :class="{ active: mobileStatus === 'done' }" :aria-pressed="mobileStatus === 'done'" @click="setMobileStatus('done')">
            已完成 <span>{{ mobileDoneTaskCount }}</span>
          </button>
          <button type="button" :class="{ active: mobileStatus === 'ALL' }" :aria-pressed="mobileStatus === 'ALL'" @click="setMobileStatus('ALL')">
            全部 <span>{{ mobileScopedTasks.length }}</span>
          </button>
        </div>
        <button
          class="task-mobile-filter-button"
          type="button"
          aria-label="打开任务筛选"
          :aria-expanded="secondaryFiltersOpen"
          aria-controls="task-mobile-filters"
          @click="secondaryFiltersOpen = !secondaryFiltersOpen"
        >
          <AppIcon name="filter" />
        </button>
      </header>
      <p v-if="actionFeedback" class="task-mobile-feedback" role="status">{{ actionFeedback }}</p>

      <form v-if="secondaryFiltersOpen" id="task-mobile-filters" class="task-mobile-filters" aria-label="任务筛选" @submit.prevent>
        <label class="task-mobile-search">
          <AppIcon name="search" aria-hidden="true" />
          <input v-model="mobileQuery" type="search" placeholder="搜索账号、神兽或任务" />
        </label>
        <label>
          <span>账号</span>
          <select v-model="mobileAccount">
            <option value="ALL">全部账号</option>
            <option v-for="item in catalog.data.accounts" :key="item.id" :value="item.id">{{ item.id }}</option>
          </select>
        </label>
        <label>
          <span>用途</span>
          <select v-model="mobileTaskType">
            <option value="ALL">全部用途</option>
            <option v-for="item in availableTaskTypes" :key="item.key" :value="item.key">{{ item.label }}</option>
          </select>
        </label>
        <button type="button" @click="clearMobileFilters">清除筛选</button>
      </form>

      <div class="task-mobile-selection">
        <div v-if="mobileAccount === 'ALL'">
          <strong>{{ mobileStatus === "pending" ? "按账号处理" : mobileStatus === "done" ? "已完成账号" : "全部账号任务" }}</strong>
          <span>先看每个账号的下一项，进入账号后再处理完整队列</span>
        </div>
        <div v-else class="task-mobile-drilldown-head">
          <button type="button" @click="closeMobileAccount">
            <span aria-hidden="true">‹</span>
            全部账号
          </button>
          <span>{{ mobileAccount }} · {{ mobileTasks.length }} 项</span>
        </div>
        <label v-if="mobileAccount !== 'ALL' && mobileVisiblePendingTasks.length">
          <input
            type="checkbox"
            :checked="allMobileVisiblePendingSelected"
            aria-label="选择当前全部待处理任务"
            @change="toggleMobileVisibleSelection(($event.target as HTMLInputElement).checked)"
          />
          <span>全选</span>
        </label>
      </div>

      <div v-if="mobileTasks.length" class="task-mobile-list">
        <div v-if="mobileAccount === 'ALL'" class="task-mobile-account-summary-list">
          <article v-for="group in mobileGroupedTasks" :key="group.accountId" class="task-mobile-summary-row">
            <div>
              <button class="task-mobile-summary-main" type="button" @click="openMobileAccount(group.accountId)">
                <span class="task-mobile-account-mark">{{ group.accountId }}</span>
                <span>
                  <strong>{{ group.tasks[0].typeLabel }} · {{ group.tasks[0].actionLabel }}</strong>
                  <small>{{ group.tasks.length }} 项{{ mobileStatus === "done" ? "已完成" : "待办" }} · {{ requirementLabel(group.tasks[0]) }}</small>
                </span>
                <AppIcon name="chevron-right" aria-hidden="true" />
              </button>
              <button class="task-mobile-summary-action" type="button" @click="handleTaskAction(group.tasks[0])">
                {{ group.tasks[0].done ? "恢复" : "处理" }}
              </button>
            </div>
          </article>
        </div>
        <section v-else v-for="group in mobileGroupedTasks" :key="group.accountId" class="task-mobile-account-group">
          <header>
            <span class="task-mobile-account-mark">{{ group.accountId }}</span>
            <strong>{{ group.accountId }}</strong>
            <small>{{ group.tasks.length }} 项</small>
          </header>
          <article v-for="task in group.tasks" :key="task.id" :class="{ done: task.done }">
            <label class="task-mobile-check">
              <input
                type="checkbox"
                :checked="selectedTaskIds.includes(task.id)"
                :disabled="task.done"
                :aria-label="`选择 ${task.accountId} ${task.typeLabel} ${task.actionLabel}`"
                @change="toggleTaskSelection(task.id, ($event.target as HTMLInputElement).checked)"
              />
            </label>
            <span class="task-mobile-row-account">{{ task.accountId }}</span>
            <button class="task-mobile-row-main" type="button" @click="handleTaskAction(task)">
              <span>
                <strong>{{ task.typeLabel }} · {{ task.actionLabel }}</strong>
                <small>{{ task.kind }} · {{ requirementLabel(task) }}</small>
                <em v-if="taskLedgerSummary(task)">{{ taskLedgerSummary(task) }}</em>
                <em v-else>{{ scheduleLabel(task) }}</em>
              </span>
              <AppIcon name="chevron-right" aria-hidden="true" />
            </button>
            <button class="task-mobile-row-action" type="button" @click="handleTaskAction(task)">
              {{ task.done ? "恢复" : "处理" }}
            </button>
          </article>
        </section>
      </div>
      <p v-else class="task-mobile-empty">没有符合当前筛选条件的任务。</p>
    </section>

    <header class="task-page-intro task-desktop-only">
      <div><p>任务</p><h1>按账号维护任务</h1><span>完成前确认真实消耗；这里只记账，不会自动扣减你手工录入的库存。</span></div>
      <RouterLink class="button" to="/record">返回录入</RouterLink>
    </header>

    <section class="task-account-overview task-desktop-only" aria-labelledby="task-account-overview-title">
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

    <section class="task-operation-guide task-desktop-only" aria-label="操作指引">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 10.7v6M12 7.3h.01" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2"/></svg>
      <div>
        <strong>先确认消耗，再完成任务</strong>
        <p>固定消耗只需确认，打书填写实际银子，洗护符可跨天多次记录；恢复任务状态不会删除实际流水。</p>
      </div>
      <button v-if="completionOverrideCount" class="button danger task-reset-action" type="button" @click="resetCompletion">清除全部完成记录</button>
    </section>

    <p v-if="actionFeedback" class="task-action-feedback task-desktop-only" role="status">{{ actionFeedback }}</p>

    <form class="task-workflow-filter task-desktop-only" aria-label="任务筛选" @submit.prevent>
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

    <div v-if="tasks.length" class="task-worklist task-desktop-only" role="region" aria-label="神兽任务列表">
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
    <p v-else class="empty-state task-desktop-only">没有符合当前筛选条件的任务，请调整状态或筛选条件。</p>

    <aside v-if="selectedTaskCount" class="task-bulk-action-bar" aria-label="批量任务操作">
      <div><strong>已选 {{ selectedTaskCount }} 项</strong><span>将按顺序逐项确认真实消耗</span></div>
      <button class="button primary" type="button" @click="completeSelectedTasks">逐项确认并完成</button>
      <button class="text-button" type="button" @click="selectedTaskIds = []">取消选择</button>
    </aside>

    <TaskSettlementDialog
      v-if="settlementTask"
      :key="settlementTask.id"
      :task="settlementTask"
      :egg-unit-price-wan="settings.taskSettings.eggPriceWan"
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
.task-mobile-workspace { display: none; }

@media (min-width: 861px) and (max-width: 1100px) {
  .task-maintenance-page { --task-grid: 36px minmax(130px, 1fr) minmax(108px, .78fr) 104px 112px minmax(158px, .9fr); }
}

@media (max-width: 720px) {
  .task-maintenance-page {
    width: 100%;
    padding: 8px 10px 112px;
    background: #f5f5f7;
  }
  .task-desktop-only { display: none !important; }
  .task-mobile-workspace { display: block; }
  .task-mobile-controller {
    position: sticky;
    top: 0;
    z-index: 8;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 40px;
    align-items: center;
    gap: 8px;
    margin: -8px -10px 10px;
    padding: 10px 10px 9px;
    border-bottom: 1px solid rgba(35, 35, 40, .09);
    background: rgba(249, 249, 251, .9);
    -webkit-backdrop-filter: blur(20px) saturate(140%);
    backdrop-filter: blur(20px) saturate(140%);
  }
  .task-mobile-segments {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 2px;
    padding: 2px;
    border: 1px solid rgba(40, 40, 45, .08);
    border-radius: 12px;
    background: #ececef;
  }
  .task-mobile-segments button {
    min-width: 0;
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 0 7px;
    border: 0;
    border-radius: 9px;
    color: #3a3a40;
    background: transparent;
    font: inherit;
    font-size: 12px;
    font-weight: 760;
    white-space: nowrap;
  }
  .task-mobile-segments button span {
    color: #77777f;
    font-size: 10px;
    font-weight: 700;
  }
  .task-mobile-segments button.active {
    color: #ffffff;
    background: #c95000;
    box-shadow: 0 2px 7px rgba(126, 53, 0, .2);
  }
  .task-mobile-segments button.active span { color: rgba(255, 255, 255, .82); }
  .task-mobile-filter-button {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    color: #4a4a50;
    background: #e9e9ec;
  }
  .task-mobile-filter-button[aria-expanded="true"] {
    color: #ffffff;
    background: #c95000;
  }
  .task-mobile-filter-button :deep(svg) { width: 18px; height: 18px; }
  .task-mobile-feedback {
    margin: 0 0 10px;
    padding: 11px 12px;
    border: 1px solid #badbd5;
    border-radius: 12px;
    color: #075c51;
    background: #edf7f5;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.5;
  }
  .task-mobile-filters {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin: 0 0 10px;
    padding: 12px;
    border: 1px solid #ddddE2;
    border-radius: 16px;
    background: rgba(255, 255, 255, .92);
    box-shadow: 0 10px 30px rgba(25, 25, 30, .08);
  }
  .task-mobile-filters > label {
    min-width: 0;
    display: grid;
    gap: 5px;
  }
  .task-mobile-filters > label > span {
    color: #6d6d75;
    font-size: 11px;
    font-weight: 750;
  }
  .task-mobile-filters select,
  .task-mobile-filters input {
    width: 100%;
    min-height: 42px;
    padding: 0 10px;
    border: 1px solid #d7d7dc;
    border-radius: 10px;
    color: #1d1d1f;
    background: #ffffff;
    font: inherit;
    font-size: 14px;
  }
  .task-mobile-search {
    position: relative;
    grid-column: 1 / -1;
  }
  .task-mobile-search :deep(svg) {
    position: absolute;
    z-index: 1;
    top: 12px;
    left: 11px;
    width: 18px;
    height: 18px;
    color: #77777f;
  }
  .task-mobile-search input { padding-left: 36px; }
  .task-mobile-filters > button {
    grid-column: 1 / -1;
    min-height: 40px;
    border: 0;
    border-radius: 10px;
    color: #b64b00;
    background: #f6eee9;
    font: inherit;
    font-size: 13px;
    font-weight: 800;
  }
  .task-mobile-selection {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 4px 2px 9px;
  }
  .task-mobile-selection > div {
    min-width: 0;
    display: grid;
    gap: 2px;
  }
  .task-mobile-selection strong {
    color: #1d1d1f;
    font-size: 15px;
    letter-spacing: -.01em;
  }
  .task-mobile-selection > div span {
    overflow: hidden;
    color: #77777f;
    font-size: 10px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .task-mobile-selection > label {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 5px;
    color: #b64b00;
    font-size: 11px;
    font-weight: 800;
  }
  .task-mobile-selection input,
  .task-mobile-check input {
    width: 20px;
    height: 20px;
    margin: 0;
    accent-color: #c95000;
  }
  .task-mobile-list {
    overflow: hidden;
    border: 1px solid #dedee3;
    border-radius: 16px;
    background: #ffffff;
    box-shadow: 0 8px 24px rgba(30, 30, 35, .045);
  }
  .task-mobile-drilldown-head {
    width: 100%;
    display: flex !important;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .task-mobile-drilldown-head > button {
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0 10px 0 6px;
    border: 0;
    border-radius: 10px;
    color: #a74800;
    background: #f6eee9;
    font: inherit;
    font-size: 12px;
    font-weight: 780;
  }
  .task-mobile-drilldown-head > button span {
    color: inherit;
    font-size: 22px;
    line-height: 1;
  }
  .task-mobile-drilldown-head > span {
    color: #66666e !important;
    font-size: 11px !important;
  }
  .task-mobile-account-summary-list {
    display: grid;
  }
  .task-mobile-summary-row {
    overflow-x: auto;
    scrollbar-width: none;
    border-bottom: 1px solid #e8e8ec;
    overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory;
  }
  .task-mobile-summary-row:last-child { border-bottom: 0; }
  .task-mobile-summary-row::-webkit-scrollbar { display: none; }
  .task-mobile-summary-row > div {
    width: calc(100% + 66px);
    min-height: 70px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 66px;
  }
  .task-mobile-summary-main {
    min-width: 0;
    min-height: 70px;
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) 18px;
    align-items: center;
    gap: 10px;
    padding: 8px 11px;
    border: 0;
    color: #1d1d1f;
    background: #ffffff;
    font: inherit;
    text-align: left;
    scroll-snap-align: start;
  }
  .task-mobile-summary-main .task-mobile-account-mark {
    width: 38px;
    height: 36px;
    font-size: 14px;
  }
  .task-mobile-summary-main > span:nth-child(2) {
    min-width: 0;
    display: grid;
    gap: 3px;
  }
  .task-mobile-summary-main strong,
  .task-mobile-summary-main small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .task-mobile-summary-main strong {
    color: #25252a;
    font-size: 14px;
    font-weight: 820;
  }
  .task-mobile-summary-main small {
    color: #77777f;
    font-size: 10px;
  }
  .task-mobile-summary-main :deep(svg) {
    width: 16px;
    height: 16px;
    color: #9b9ba1;
  }
  .task-mobile-summary-action {
    border: 0;
    color: #ffffff;
    background: #c95000;
    font: inherit;
    font-size: 12px;
    font-weight: 850;
    scroll-snap-align: end;
  }
  .task-mobile-account-group + .task-mobile-account-group {
    border-top: 8px solid #f5f5f7;
  }
  .task-mobile-account-group > header {
    min-height: 38px;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 6px 10px;
    border-bottom: 1px solid #e7e7eb;
    background: #fafafc;
  }
  .task-mobile-account-mark,
  .task-mobile-row-account {
    display: inline-grid;
    place-items: center;
    border: 1px solid #d17a3b;
    border-radius: 5px;
    color: #9b4200;
    background: #fffdfa;
    font-weight: 850;
  }
  .task-mobile-account-mark {
    width: 28px;
    height: 25px;
    font-size: 10px;
  }
  .task-mobile-account-group > header strong {
    color: #2b2b30;
    font-size: 12px;
  }
  .task-mobile-account-group > header small {
    margin-left: auto;
    color: #77777f;
    font-size: 10px;
  }
  .task-mobile-account-group article {
    min-height: 76px;
    display: grid;
    grid-template-columns: 24px 38px minmax(0, 1fr) 54px;
    align-items: stretch;
    gap: 7px;
    padding-left: 10px;
    border-bottom: 1px solid #e8e8ec;
    background: #ffffff;
  }
  .task-mobile-account-group article:last-child { border-bottom: 0; }
  .task-mobile-account-group article.done { opacity: .72; }
  .task-mobile-check {
    align-self: center;
    display: grid;
    place-items: center;
  }
  .task-mobile-row-account {
    align-self: center;
    width: 38px;
    height: 34px;
    font-size: 12px;
  }
  .task-mobile-row-main {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 16px;
    align-items: center;
    gap: 4px;
    padding: 9px 0;
    border: 0;
    color: #1d1d1f;
    background: transparent;
    font: inherit;
    text-align: left;
  }
  .task-mobile-row-main > span {
    min-width: 0;
    display: grid;
    gap: 2px;
  }
  .task-mobile-row-main strong {
    overflow: hidden;
    font-size: 13px;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .task-mobile-row-main small,
  .task-mobile-row-main em {
    overflow: hidden;
    color: #74747c;
    font-size: 10px;
    font-style: normal;
    line-height: 1.3;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .task-mobile-row-main em { color: #a74800; }
  .task-mobile-row-main :deep(svg) {
    width: 15px;
    height: 15px;
    color: #9b9ba1;
  }
  .task-mobile-row-action {
    border: 0;
    color: #ffffff;
    background: #c95000;
    font: inherit;
    font-size: 12px;
    font-weight: 850;
  }
  .task-mobile-account-group article.done .task-mobile-row-action {
    color: #55555c;
    background: #eaeaed;
  }
  .task-mobile-empty {
    margin: 0;
    padding: 30px 18px;
    border: 1px solid #dedee3;
    border-radius: 16px;
    color: #77777f;
    background: #ffffff;
    font-size: 13px;
    text-align: center;
  }
  .task-bulk-action-bar {
    right: 10px;
    bottom: calc(88px + env(safe-area-inset-bottom));
    left: 10px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    padding: 10px 11px;
    border: 1px solid rgba(62, 62, 68, .12);
    border-radius: 16px;
    background: rgba(255, 255, 255, .92);
    -webkit-backdrop-filter: blur(22px) saturate(150%);
    backdrop-filter: blur(22px) saturate(150%);
    box-shadow: 0 14px 35px rgba(25, 25, 30, .18);
  }
  .task-bulk-action-bar > div {
    min-width: 0;
    display: grid;
  }
  .task-bulk-action-bar > div strong { font-size: 12px; }
  .task-bulk-action-bar > div span {
    overflow: hidden;
    color: #77777f;
    font-size: 9px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .task-bulk-action-bar .button.primary {
    min-height: 42px;
    padding-inline: 12px;
    border-color: #a84400;
    background: #c95000;
    font-size: 11px;
  }
  .task-bulk-action-bar .text-button {
    grid-column: 1 / -1;
    justify-self: center;
    min-height: 24px;
    color: #77777f;
    font-size: 10px;
  }
  .task-ledger-summary {
    overflow: visible;
    white-space: normal;
  }
}
</style>
