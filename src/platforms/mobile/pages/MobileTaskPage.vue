<script setup lang="ts">
import AppIcon from "../../../components/AppIcon.vue";
import TaskSettlementDialog from "../components/MobileTaskSettlementDialog.vue";
import { useTaskPage } from "../../../features/tasks/useTaskPage";

const {
  catalog,
  accounting,
  inventory,
  settings,
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
  mobileScopedTasks,
  mobileTasks,
  mobileGroupedTasks,
  mobileReadyTaskCount,
  mobileLaterTaskCount,
  mobileDoneTaskCount,
  mobileDetailSections,
  mobileDetailPendingTaskCount,
  mobileVisiblePendingTasks,
  selectedTaskCount,
  mobileVisibleSelectedCount,
  mobileVisibleSelectionState,
  settlementProgressWan,
  settlementQueueIndex,
  requirementLabel,
  scheduleLabel,
  setMobileStatus,
  clearMobileFilters,
  openMobileAccount,
  closeMobileAccount,
  changeMobileAccountFilter,
  toggleMobileBatchMode,
  toggleMobileLaterSection,
  handleMobileTaskPrimary,
  toggleTaskSelection,
  toggleMobileVisibleSelection,
  taskLedgerSummary,
  closeSettlement,
  saveTaskSettlement,
  completeSelectedTasks,
  taskActionLabel,
} = useTaskPage();
</script>

<template>
  <section class="page-wrap plan-page mobile-task-page task-mobile-workspace" aria-label="手机任务工作台" data-platform-page="mobile" data-testid="mobile-task-page">
    <header class="mobile-task-controller task-mobile-controller">
      <div class="mobile-task-segments task-mobile-segments" role="group" aria-label="任务状态筛选">
        <button type="button" :class="{ active: mobileStatus === 'ready' }" :aria-pressed="mobileStatus === 'ready'" @click="setMobileStatus('ready')">可处理 <span>{{ mobileReadyTaskCount }}</span></button>
        <button type="button" :class="{ active: mobileStatus === 'later' }" :aria-pressed="mobileStatus === 'later'" @click="setMobileStatus('later')">后续 <span>{{ mobileLaterTaskCount }}</span></button>
        <button type="button" :class="{ active: mobileStatus === 'done' }" :aria-pressed="mobileStatus === 'done'" @click="setMobileStatus('done')">已完成 <span>{{ mobileDoneTaskCount }}</span></button>
      </div>
      <button class="mobile-filter-button task-mobile-filter-button" type="button" aria-label="打开任务筛选" :aria-expanded="secondaryFiltersOpen" aria-controls="task-mobile-filters" @click="secondaryFiltersOpen = !secondaryFiltersOpen">
        <AppIcon name="filter" />
      </button>
    </header>

    <p v-if="actionFeedback" class="mobile-task-feedback task-mobile-feedback" role="status">{{ actionFeedback }}</p>

    <form v-if="secondaryFiltersOpen" id="task-mobile-filters" class="mobile-task-filters task-mobile-filters" aria-label="任务筛选" @submit.prevent>
      <label class="mobile-task-search task-mobile-search">
        <AppIcon name="search" aria-hidden="true" />
        <input v-model="mobileQuery" type="search" placeholder="搜索账号、神兽或任务" />
      </label>
      <label>
        <span>账号</span>
        <select :value="mobileAccount" @change="changeMobileAccountFilter(($event.target as HTMLSelectElement).value)">
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

    <section class="mobile-task-selection task-mobile-selection" :class="{ drilldown: mobileAccount !== 'ALL' }">
      <strong v-if="mobileAccount === 'ALL'">{{ mobileStatus === "ready" ? "按账号处理" : mobileStatus === "later" ? "后续安排" : "已完成账号" }}</strong>
      <div v-else class="mobile-drilldown-head task-mobile-drilldown-head">
        <button type="button" @click="closeMobileAccount">‹ 全部账号</button>
        <span>{{ mobileAccount }} · {{ mobileScopedTasks.length }} 项</span>
        <button v-if="mobileStatus !== 'done' && mobileDetailPendingTaskCount" type="button" :aria-pressed="mobileBatchMode" @click="toggleMobileBatchMode">
          {{ mobileBatchMode ? "退出批量" : "批量" }}
        </button>
      </div>
      <label v-if="mobileAccount !== 'ALL' && mobileBatchMode && mobileVisiblePendingTasks.length" class="mobile-select-all task-mobile-select-all">
        <input
          type="checkbox"
          :checked="mobileVisibleSelectionState === 'all'"
          :indeterminate="mobileVisibleSelectionState === 'mixed'"
          :aria-checked="mobileVisibleSelectionState === 'mixed' ? 'mixed' : mobileVisibleSelectionState === 'all'"
          aria-label="选择当前可见的全部未完成任务"
          @change="toggleMobileVisibleSelection(($event.target as HTMLInputElement).checked)"
        />
        <span>{{ mobileVisibleSelectionState === "all" ? "已全选" : mobileVisibleSelectionState === "mixed" ? `已选 ${mobileVisibleSelectedCount}/${mobileVisiblePendingTasks.length}` : "全选当前" }}</span>
      </label>
    </section>

    <template v-if="mobileAccount === 'ALL'">
      <div v-if="mobileTasks.length" class="mobile-task-list mobile-account-list task-mobile-list task-mobile-account-summary-list">
        <article v-for="group in mobileGroupedTasks" :key="group.accountId" class="task-mobile-summary-row" :data-account-id="group.accountId">
          <button class="task-mobile-summary-main" type="button" :data-account-id="group.accountId" @click="openMobileAccount(group.accountId)">
            <span class="mobile-account-mark task-mobile-account-mark">{{ group.accountId }}</span>
            <span>
              <small class="task-mobile-next-label">{{ mobileStatus === "done" ? "完成记录" : "下一项" }}</small>
              <strong>{{ group.tasks[0].typeLabel }} · {{ group.tasks[0].actionLabel }}</strong>
              <small>{{ group.tasks.length }} 项 · {{ scheduleLabel(group.tasks[0]) }}</small>
            </span>
            <AppIcon name="chevron-right" aria-hidden="true" />
          </button>
        </article>
      </div>
      <p v-else class="mobile-task-empty">没有符合当前筛选条件的任务。</p>
    </template>

    <template v-else>
      <div v-if="mobileDetailSections.length" class="mobile-task-list task-mobile-list task-mobile-account-group">
        <header class="mobile-account-head">
          <span class="mobile-account-mark task-mobile-account-mark">{{ mobileAccount }}</span>
          <strong>{{ mobileAccount }}</strong>
          <small>{{ mobileScopedTasks.length }} 项</small>
        </header>
        <section v-for="section in mobileDetailSections" :key="section.key" class="mobile-task-section task-mobile-detail-section" :aria-label="section.label">
          <button v-if="section.collapsible" class="mobile-section-toggle task-mobile-later-toggle" type="button" :aria-expanded="mobileLaterExpanded" @click="toggleMobileLaterSection">
            <span><strong>{{ section.label }}</strong><small>默认收起，避免误处理</small></span>
            <span>{{ section.tasks.length }} 项 <AppIcon name="chevron-right" aria-hidden="true" /></span>
          </button>
          <div v-else class="mobile-section-title task-mobile-section-title"><strong>{{ section.label }}</strong><span>{{ section.tasks.length }} 项</span></div>
          <div v-if="!section.collapsible || mobileLaterExpanded" class="task-mobile-detail-rows">
            <article v-for="task in section.tasks" :key="task.id" :class="{ done: task.done, batch: mobileBatchMode }" :data-task-id="task.id">
              <label v-if="mobileBatchMode && !task.done" class="mobile-task-check task-mobile-check">
                <input type="checkbox" :checked="selectedTaskIds.includes(task.id)" :aria-label="`选择 ${task.typeLabel} ${task.actionLabel}`" @change="toggleTaskSelection(task.id, ($event.target as HTMLInputElement).checked)" />
              </label>
              <button class="task-mobile-row-main" type="button" :aria-label="`${task.typeLabel} ${task.actionLabel} ${taskActionLabel(task)}`" @click="handleMobileTaskPrimary(task)">
                <span>
                  <strong>{{ task.typeLabel }} · {{ task.actionLabel }}</strong>
                  <small>{{ task.kind }} · {{ requirementLabel(task) }}</small>
                  <em>{{ taskLedgerSummary(task) || scheduleLabel(task) }}</em>
                </span>
                <span class="mobile-row-tail task-mobile-row-tail"><small class="mobile-task-action-label">{{ mobileBatchMode && !task.done ? selectedTaskIds.includes(task.id) ? "已选" : "选择" : taskActionLabel(task) }}</small> <AppIcon name="chevron-right" /></span>
              </button>
            </article>
          </div>
        </section>
      </div>
      <p v-else class="mobile-task-empty">没有符合当前筛选条件的任务。</p>
    </template>

    <aside v-if="selectedTaskCount" class="mobile-bulk-bar task-bulk-action-bar" aria-label="批量任务操作">
      <div><strong>已选 {{ selectedTaskCount }} 项</strong><span>将逐项确认真实消耗</span></div>
      <button type="button" @click="completeSelectedTasks">逐项确认并完成</button>
      <button type="button" @click="selectedTaskIds = []">取消</button>
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
  </section>
</template>

<style scoped>
.mobile-task-page { min-height: 100%; padding: 8px 10px 116px; color: #1d1d1f; background: #f5f5f7; }
.mobile-task-controller { position: sticky; top: 0; z-index: 8; display: grid; grid-template-columns: minmax(0, 1fr) 42px; gap: 8px; margin: -8px -10px 10px; padding: 10px; border-bottom: 1px solid rgba(35,35,40,.09); background: rgba(249,249,251,.92); backdrop-filter: blur(20px) saturate(140%); }
.mobile-task-segments { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 2px; padding: 2px; border-radius: 12px; background: #e8e8ec; }
.mobile-task-segments button { min-width: 0; min-height: 36px; border: 0; border-radius: 9px; color: #3a3a40; background: transparent; font: inherit; font-size: 12px; font-weight: 760; }
.mobile-task-segments button span { color: #77777f; font-size: 10px; }
.mobile-task-segments button.active { color: white; background: #c95000; box-shadow: 0 2px 7px rgba(126,53,0,.2); }
.mobile-task-segments button.active span { color: rgba(255,255,255,.82); }
.mobile-filter-button { display: grid; place-items: center; width: 42px; height: 42px; border: 0; border-radius: 50%; color: #4a4a50; background: #e7e7eb; }
.mobile-filter-button[aria-expanded="true"] { color: white; background: #c95000; }
.mobile-task-feedback { margin: 0 0 10px; padding: 11px 12px; border: 1px solid #badbd5; border-radius: 12px; color: #075c51; background: #edf7f5; font-size: 12px; font-weight: 700; line-height: 1.5; }
.mobile-task-filters { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; margin-bottom: 10px; padding: 12px; border: 1px solid #dddde2; border-radius: 16px; background: white; box-shadow: 0 10px 30px rgba(25,25,30,.08); }
.mobile-task-filters label { min-width: 0; display: grid; gap: 5px; color: #6d6d75; font-size: 11px; font-weight: 750; }
.mobile-task-filters select,.mobile-task-filters input { width: 100%; min-height: 44px; padding: 0 10px; border: 1px solid #d7d7dc; border-radius: 10px; color: #1d1d1f; background: white; font: inherit; font-size: 14px; }
.mobile-task-search { position: relative; grid-column: 1/-1; }
.mobile-task-search :deep(svg) { position: absolute; z-index: 1; top: 13px; left: 11px; width: 18px; }
.mobile-task-search input { padding-left: 36px; }
.mobile-task-filters > button { grid-column: 1/-1; min-height: 42px; border: 0; border-radius: 10px; color: #a74800; background: #f6eee9; font-weight: 800; }
.mobile-task-selection { display: grid; gap: 8px; padding: 4px 2px 9px; }
.mobile-task-selection > strong { font-size: 15px; }
.mobile-drilldown-head { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 8px; }
.mobile-drilldown-head button { min-height: 44px; padding: 0 9px; border: 0; border-radius: 10px; color: #a74800; background: #f6eee9; font-weight: 780; }
.mobile-drilldown-head span { overflow: hidden; color: #66666e; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.mobile-select-all { justify-self: end; display: flex; align-items: center; gap: 6px; min-height: 42px; padding: 0 9px; border-radius: 10px; color: #a74800; background: #f6eee9; font-size: 11px; font-weight: 800; }
.mobile-select-all input,.mobile-task-check input { width: 20px; height: 20px; accent-color: #c95000; }
.mobile-task-list { overflow: hidden; border: 1px solid #dedee3; border-radius: 16px; background: white; box-shadow: 0 8px 24px rgba(30,30,35,.045); }
.mobile-task-list article { border-bottom: 1px solid #e8e8ec; }
.mobile-task-list article:last-child { border-bottom: 0; }
.mobile-account-list article > button,.mobile-task-section article > button { width: 100%; min-width: 0; min-height: 78px; display: grid; grid-template-columns: 42px minmax(0,1fr) 18px; align-items: center; gap: 10px; padding: 9px 11px; border: 0; color: #1d1d1f; background: white; font: inherit; text-align: left; }
.mobile-account-list button > span:nth-child(2),.mobile-task-section article button > span:first-child { min-width: 0; display: grid; gap: 2px; }
.mobile-account-list strong,.mobile-task-section article strong,.mobile-account-list em,.mobile-task-section article em,.mobile-task-section article small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mobile-account-list strong,.mobile-task-section article strong { font-size: 13px; font-weight: 820; }
.mobile-account-list small { color: #a74800; font-size: 9px; font-weight: 850; }
.mobile-account-list em,.mobile-task-section article em,.mobile-task-section article small { color: #74747c; font-size: 10px; font-style: normal; }
.mobile-account-mark { display: inline-grid; place-items: center; width: 38px; height: 36px; border: 1px solid #d17a3b; border-radius: 6px; color: #9b4200; background: #fffdfa; font-size: 12px; font-weight: 850; }
.mobile-account-head { min-height: 42px; display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-bottom: 1px solid #e7e7eb; background: #fafafc; }
.mobile-account-head .mobile-account-mark { width: 30px; height: 27px; font-size: 10px; }
.mobile-account-head small { margin-left: auto; color: #77777f; font-size: 10px; }
.mobile-task-section + .mobile-task-section { border-top: 7px solid #f5f5f7; }
.mobile-section-title,.mobile-section-toggle { width: 100%; min-height: 44px; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 11px; border: 0; border-bottom: 1px solid #e7e7eb; color: #2b2b30; background: #fafafc; font: inherit; text-align: left; }
.mobile-section-toggle span:first-child { display: grid; }
.mobile-section-title strong,.mobile-section-toggle strong { font-size: 11px; }
.mobile-section-title span,.mobile-section-toggle small,.mobile-section-toggle span:last-child { color: #77777f; font-size: 9px; }
.mobile-task-section article { display: grid; }
.mobile-task-section article.batch { grid-template-columns: 40px minmax(0,1fr); }
.mobile-task-check { min-height: 78px; display: grid; place-items: center; }
.mobile-task-section article > button { grid-template-columns: minmax(0,1fr) auto; }
.mobile-row-tail { display: inline-flex !important; align-items: center; gap: 3px; color: #a74800; font-size: 10px; font-weight: 820; white-space: nowrap; }
.mobile-row-tail :deep(svg) { width: 15px; height: 15px; }
.mobile-task-section article.done { opacity: .7; }
.mobile-task-empty { margin: 0; padding: 30px 18px; border: 1px solid #dedee3; border-radius: 16px; color: #77777f; background: white; font-size: 13px; text-align: center; }
.mobile-bulk-bar { position: fixed; z-index: 20; right: 10px; bottom: calc(88px + env(safe-area-inset-bottom)); left: 10px; display: grid; grid-template-columns: minmax(0,1fr) auto auto; align-items: center; gap: 8px; padding: 10px 11px; border: 1px solid rgba(62,62,68,.12); border-radius: 16px; background: rgba(255,255,255,.94); backdrop-filter: blur(22px); box-shadow: 0 14px 35px rgba(25,25,30,.18); }
.mobile-bulk-bar div { min-width: 0; display: grid; }
.mobile-bulk-bar strong { font-size: 12px; }
.mobile-bulk-bar span { color: #77777f; font-size: 9px; }
.mobile-bulk-bar button { min-height: 42px; padding: 0 10px; border: 0; border-radius: 10px; color: white; background: #c95000; font-size: 11px; font-weight: 800; }
.mobile-bulk-bar button:last-child { color: #66666e; background: #eeeef1; }
.task-mobile-summary-main .task-mobile-next-label { font-size: 13px !important; }
.task-mobile-summary-main strong { font-size: 17px !important; }
.task-mobile-summary-main span:nth-child(2) > small:last-child { color: #74747c; font-size: 13px !important; font-weight: 500; }
.task-mobile-row-main strong { font-size: 17px !important; }
.task-mobile-row-main span:first-child > small,
.task-mobile-row-main span:first-child > em,
.task-mobile-row-tail small { font-size: 14px !important; }
.task-mobile-row-tail .mobile-task-action-label { font-size: 14px !important; }
</style>
