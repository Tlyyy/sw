<script setup lang="ts">
import TaskSettlementDialog from "../components/DesktopTaskSettlementDialog.vue";
import { useTaskPage } from "../../../features/tasks/useTaskPage";

const {
  catalog,
  accounting,
  inventory,
  settings,
  account,
  taskType,
  status,
  query,
  selectedTaskIds,
  actionFeedback,
  secondaryFiltersOpen,
  settlementBatchTotal,
  settlementTask,
  availableTaskTypes,
  tasks,
  groupedTasks,
  pendingTaskCount,
  doneTaskCount,
  accountProgress,
  completionOverrideCount,
  visiblePendingTasks,
  selectedTaskCount,
  allVisiblePendingSelected,
  settlementProgressWan,
  settlementQueueIndex,
  requirementLabel,
  scheduleLabel,
  taskState,
  setStatus,
  selectAccount,
  clearFilters,
  toggleTaskSelection,
  toggleVisibleSelection,
  taskLedgerSummary,
  handleTaskAction,
  closeSettlement,
  saveTaskSettlement,
  completeSelectedTasks,
  taskActionLabel,
  resetCompletion,
} = useTaskPage();
</script>

<template>
  <div class="page-wrap plan-page task-maintenance-page desktop-task-page" data-platform-page="desktop" data-testid="desktop-task-page">
    <header class="task-page-intro">
      <div>
        <p>PC 任务工作台</p>
        <h1>按账号维护任务</h1>
        <span>五个账号并行筛选和批量处理；完成前逐项确认真实消耗。</span>
      </div>
      <RouterLink class="button" to="/record">返回录入</RouterLink>
    </header>

    <section class="task-account-overview" aria-labelledby="task-account-overview-title">
      <header>
        <div><p>逐账号查看</p><h2 id="task-account-overview-title">各账号任务进度</h2></div>
        <span>点账号可直接筛选</span>
      </header>
      <div>
        <button
          v-for="item in accountProgress"
          :key="item.accountId"
          type="button"
          :class="{ active: account === item.accountId }"
          :data-account-id="item.accountId"
          :aria-label="`筛选 ${item.accountId} 账号任务`"
          :aria-pressed="account === item.accountId"
          @click="selectAccount(item.accountId)"
        >
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
      <label id="task-secondary-filters" :class="['task-secondary-filter', { open: secondaryFiltersOpen }]">
        <span>账号</span>
        <select v-model="account" aria-label="任务账号筛选">
          <option value="ALL">全部账号</option>
          <option v-for="item in catalog.data.accounts" :key="item.id" :value="item.id">{{ item.id }}</option>
        </select>
      </label>
      <label :class="['task-secondary-filter', { open: secondaryFiltersOpen }]">
        <span>用途</span>
        <select v-model="taskType" aria-label="任务用途筛选">
          <option value="ALL">全部用途</option>
          <option v-for="item in availableTaskTypes" :key="item.key" :value="item.key">{{ item.label }}</option>
        </select>
      </label>
      <button class="button task-clear-filter" type="button" @click="clearFilters">清除筛选</button>
    </form>

    <div v-if="tasks.length" class="task-worklist" role="region" aria-label="神兽任务列表">
      <div class="task-worklist-head">
        <label class="task-select-cell"><input type="checkbox" :checked="allVisiblePendingSelected" :disabled="!visiblePendingTasks.length" aria-label="选择当前全部待完成任务" @change="toggleVisibleSelection(($event.target as HTMLInputElement).checked)" /></label>
        <span>账号 / 神兽</span><span>任务阶段</span><span>所需资源</span><span>预计完成</span><span>状态 / 操作</span>
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
          <div class="task-stage-cell"><strong>{{ task.actionLabel }}</strong><span>{{ task.kind }}</span><small v-if="taskLedgerSummary(task)" class="task-ledger-summary">{{ taskLedgerSummary(task) }}</small></div>
          <strong class="task-resource-cell">{{ requirementLabel(task) }}</strong>
          <div class="task-schedule-cell"><strong>{{ scheduleLabel(task) }}</strong><span v-if="scheduleLabel(task) === '等待条件'">条件满足后排期</span></div>
          <div class="task-status-cell">
            <span :class="['task-state-label', taskState(task).tone]">{{ taskState(task).label }}</span>
            <button :class="['task-row-action', { secondary: task.done }]" type="button" :aria-label="`${task.accountId} ${task.typeLabel} ${task.actionLabel} ${taskActionLabel(task)}`" @click="handleTaskAction(task)">
              {{ taskActionLabel(task) }}
            </button>
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
      :egg-unit-price-wan="settings.taskSettings.eggPriceWan"
      :inventory="inventory.latestSnapshot?.accounts[settlementTask.accountId] || null"
      :inventory-effective-date="inventory.latestSnapshot?.effectiveDate"
      :inventory-recorded-at="inventory.latestSnapshot?.recordedAt"
      :prior-inventory="inventory.snapshots.length > 1 ? inventory.snapshots.at(-2)?.accounts[settlementTask.accountId] || null : null"
      :progress-total-wan="settlementProgressWan"
      :existing-entry-count="accounting.taskEntries(settlementTask.id).length"
      :existing-summary="taskLedgerSummary(settlementTask)"
      :queue-index="settlementQueueIndex"
      :queue-total="settlementBatchTotal"
      @cancel="closeSettlement"
      @confirm="saveTaskSettlement"
    />
  </div>
</template>

<style scoped>
.task-maintenance-page { width: min(100%, 1320px); padding-top: 14px; padding-bottom: 56px; }
.task-page-intro { min-height: 74px; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 0 4px 13px; border-bottom: 1px solid var(--color-border); }
.task-page-intro > div { min-width: 0; }
.task-page-intro p { color: var(--color-accent-strong); font-size: 11px; font-weight: 850; letter-spacing: .1em; }
.task-page-intro h1 { margin-top: 1px; font-size: 27px; line-height: 1.2; letter-spacing: -.04em; }
.task-page-intro span { display: block; margin-top: 3px; color: var(--color-text-muted); font-size: 12px; line-height: 1.45; }
.task-page-intro .button { min-height: 44px; white-space: nowrap; }
.task-account-overview { overflow: hidden; margin: 16px 0; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); }
.task-account-overview > header { min-height: 58px; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 10px 14px; border-bottom: 1px solid var(--color-border); background: var(--color-surface-subtle); }
.task-account-overview > header p { color: var(--color-accent-strong); font-size: 10px; font-weight: 850; letter-spacing: .08em; }
.task-account-overview > header h2 { margin-top: 1px; font-size: 17px; }
.task-account-overview > header > span { color: var(--color-text-muted); font-size: 11px; font-weight: 750; }
.task-account-overview > div { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); }
.task-account-overview button { min-width: 0; min-height: 94px; display: grid; place-items: center; align-content: center; gap: 2px; padding: 9px 7px; border: 0; border-right: 1px solid var(--color-border); color: var(--color-text); background: var(--color-surface); font: inherit; }
.task-account-overview button:last-child { border-right: 0; }
.task-account-overview button.active { color: var(--color-accent-strong); background: var(--color-accent-soft); }
.task-account-overview button strong { font-size: 14px; }
.task-account-overview button > span { font-size: 12px; font-weight: 850; }
.task-account-overview button > i { width: 100%; height: 4px; overflow: hidden; margin: 3px 0; border-radius: 999px; background: var(--color-border); }
.task-account-overview button > i > b { height: 100%; display: block; border-radius: inherit; background: var(--color-accent); }
.task-account-overview button small { color: var(--color-text-muted); font-size: 10px; white-space: nowrap; }
.task-ledger-summary { overflow: hidden; color: var(--color-accent-strong); font-size: 10px; font-weight: 800; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.task-state-label.progress { border-color: #d9c28a; color: #845000; background: #fff8e8; }
@media (max-width: 1100px) {
  .task-maintenance-page { --task-grid: 36px minmax(130px, 1fr) minmax(108px, .78fr) 104px 112px minmax(158px, .9fr); }
}
</style>
