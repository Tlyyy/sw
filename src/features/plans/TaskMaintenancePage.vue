<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";
import { buildTaskPlans, taskDisplayTypeOptions, type ScheduledTask } from "../../domain/plans";
import { formatWan } from "../../domain/gems";
import { taskCompletionResourceLabel } from "../../domain/weeklyActivity";
import PlansNav from "./PlansNav.vue";

type TaskStatusFilter = "pending" | "done" | "ALL";

const catalog = useCatalogStore();
const inventory = useInventoryStore();
const settings = useSettingsStore();
const account = ref("ALL");
const taskType = ref("ALL");
const status = ref<TaskStatusFilter>("pending");
const query = ref("");
const selectedTaskIds = ref<string[]>([]);
const actionFeedback = ref("");
const secondaryFiltersOpen = ref(false);

inventory.hydrate();

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
const pendingTaskCount = computed(() => allTasks.value.filter((task) => !task.done).length);
const doneTaskCount = computed(() => allTasks.value.length - pendingTaskCount.value);
const completionRate = computed(() => allTasks.value.length ? Math.round(doneTaskCount.value / allTasks.value.length * 100) : 0);
const completionOverrideCount = computed(() => Object.values(settings.taskOverrides).filter((item) => item.done !== undefined).length);
const completionByTask = computed(() => new Map(settings.taskCompletions.map((entry) => [entry.taskId, entry])));
const visiblePendingTasks = computed(() => tasks.value.filter((task) => !task.done));
const selectedTaskCount = computed(() => selectedTaskIds.value.length);
const allVisiblePendingSelected = computed(() => Boolean(visiblePendingTasks.value.length)
  && visiblePendingTasks.value.every((task) => selectedTaskIds.value.includes(task.id)));

watch([account, taskType, status, query], () => {
  selectedTaskIds.value = [];
});

function requirementLabel(task: ScheduledTask) {
  if (task.resourceType === "innerShard") return `${task.shardCount} 片内丹碎片`;
  if (task.eggCount) return `${task.eggCount} 个蛋`;
  return formatWan(task.priceWan);
}

function scheduleLabel(task: ScheduledTask) {
  const completion = completionByTask.value.get(task.id);
  if (task.done) return completion ? `完成于 ${completion.completedOn}` : "已完成";
  return /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) ? task.dueDate : "等待条件";
}

function taskState(task: ScheduledTask) {
  if (task.done) return { label: "已完成", tone: "done" };
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

function setTaskCompletion(task: ScheduledTask, done: boolean) {
  const completion = done ? settings.completeTask(task) : null;
  if (!done) settings.setTaskDone(task.id, false);
  selectedTaskIds.value = selectedTaskIds.value.filter((id) => id !== task.id);
  actionFeedback.value = done
    ? `已完成 ${task.accountId} · ${task.typeLabel} · ${task.actionLabel}${completion ? `，并记录 ${taskCompletionResourceLabel(completion)}支出` : ""}。`
    : `已将 ${task.accountId} · ${task.typeLabel} · ${task.actionLabel} 恢复为未完成，关联支出已撤销。`;
}

function completeSelectedTasks() {
  const selected = allTasks.value.filter((task) => selectedTaskIds.value.includes(task.id) && !task.done);
  const completions = selected.flatMap((task) => {
    const completion = settings.completeTask(task);
    return completion ? [completion] : [];
  });
  const silverSpentWan = completions.reduce((sum, entry) => sum + entry.silverSpentWan, 0);
  selectedTaskIds.value = [];
  actionFeedback.value = `已完成 ${selected.length} 项任务并记录完成日期${silverSpentWan ? `，其中银子支出 ${formatWan(silverSpentWan)}` : ""}。`;
}

function resetCompletion() {
  if (!completionOverrideCount.value) return;
  if (confirm("确认清除全部任务完成状态？单项价格和计划参数不会改变。")) {
    settings.resetTaskCompletionOverrides();
    selectedTaskIds.value = [];
    actionFeedback.value = "已恢复全部任务的默认完成状态。";
  }
}
</script>

<template>
  <div class="page-wrap plan-page task-maintenance-page">
    <PlansNav />

    <section class="task-operation-guide" aria-label="操作指引">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 10.7v6M12 7.3h.01" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2"/></svg>
      <div>
        <strong>操作指引</strong>
        <p>单项可直接标记完成；多项先勾选，再批量完成。系统会同时记录完成日期和对应资源支出，恢复未完成时一并撤销。</p>
      </div>
      <button v-if="completionOverrideCount" class="button danger task-reset-action" type="button" @click="resetCompletion">清除全部完成记录</button>
    </section>

    <section class="task-progress-overview" aria-label="任务进度">
      <div class="task-progress-primary">
        <span>任务进度</span>
        <strong>{{ doneTaskCount }} / {{ allTasks.length }}</strong>
        <div class="task-progress-track" role="progressbar" aria-label="任务完成进度" :aria-valuenow="completionRate" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: `${completionRate}%` }"></i></div>
        <em>{{ completionRate }}%</em>
      </div>
      <dl class="task-progress-stats">
        <div><dt><i class="pending"></i>待完成</dt><dd>{{ pendingTaskCount }}</dd></div>
        <div><dt><i class="done"></i>已完成</dt><dd>{{ doneTaskCount }}</dd></div>
        <div><dt><i class="edited"></i>本地修改</dt><dd>{{ completionOverrideCount }}</dd></div>
      </dl>
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

    <div v-if="tasks.length" class="task-worklist" role="table" aria-label="神兽任务列表">
      <div class="task-worklist-head" role="row">
        <label class="task-select-cell"><input type="checkbox" :checked="allVisiblePendingSelected" :disabled="!visiblePendingTasks.length" aria-label="选择当前全部待完成任务" @change="toggleVisibleSelection(($event.target as HTMLInputElement).checked)" /></label>
        <span role="columnheader">账号 / 神兽</span>
        <span role="columnheader">任务阶段</span>
        <span role="columnheader">所需资源</span>
        <span role="columnheader">预计完成</span>
        <span role="columnheader">状态 / 操作</span>
      </div>

      <section v-for="group in groupedTasks" :key="group.accountId" class="task-account-group" role="rowgroup" :aria-label="`${group.accountId} 账号任务`">
        <header class="task-account-header">
          <span class="task-account-mark">{{ group.accountId }}</span>
          <strong>{{ group.accountId }}</strong>
          <span>共 {{ group.tasks.length }} 项</span>
        </header>
        <article v-for="task in group.tasks" :key="task.id" :class="['task-work-row', { done: task.done }]" role="row">
          <label class="task-select-cell"><input type="checkbox" :checked="selectedTaskIds.includes(task.id)" :disabled="task.done" :aria-label="`选择 ${task.accountId} ${task.typeLabel} ${task.actionLabel}`" @change="toggleTaskSelection(task.id, ($event.target as HTMLInputElement).checked)" /></label>
          <div class="task-identity-cell" role="cell"><strong>{{ task.typeLabel }}</strong><span>{{ task.accountId }} · {{ task.typeKey === 'horse' ? '神兽龙马' : '神兽青蛇' }}</span></div>
          <div class="task-stage-cell" role="cell"><strong>{{ task.actionLabel }}</strong><span>{{ task.kind }}</span></div>
          <strong class="task-resource-cell" role="cell">{{ requirementLabel(task) }}</strong>
          <div class="task-schedule-cell" role="cell"><strong>{{ scheduleLabel(task) }}</strong><span v-if="scheduleLabel(task) === '等待条件'">条件满足后排期</span></div>
          <div class="task-status-cell" role="cell">
            <span :class="['task-state-label', taskState(task).tone]">{{ taskState(task).label }}</span>
            <button :class="['task-row-action', { secondary: task.done }]" type="button" :aria-label="`${task.accountId} ${task.typeLabel} ${task.actionLabel} ${task.done ? '恢复未完成' : '标记完成'}`" @click="setTaskCompletion(task, !task.done)">{{ task.done ? "恢复未完成" : "标记完成" }}</button>
          </div>
        </article>
      </section>
    </div>
    <p v-else class="empty-state">没有符合当前筛选条件的任务，请调整状态或筛选条件。</p>

    <aside v-if="selectedTaskCount" class="task-bulk-action-bar" aria-label="批量任务操作">
      <div><strong>已选 {{ selectedTaskCount }} 项</strong><span>完成后可在“已完成”中查看</span></div>
      <button class="button primary" type="button" @click="completeSelectedTasks">批量标记完成</button>
      <button class="text-button" type="button" @click="selectedTaskIds = []">取消选择</button>
    </aside>
  </div>
</template>
