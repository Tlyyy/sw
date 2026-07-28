<script setup lang="ts">
import { nextTick, ref } from "vue";
import AppIcon from "../../../components/AppIcon.vue";
import InventorySnapshotDialog from "../components/MobileInventorySnapshotDialog.vue";
import { useRecordPage } from "../../../features/record/useRecordPage";

const expenseAmountInput = ref<HTMLInputElement>();
const {
  catalog,
  inventory,
  ui,
  today,
  todayInventory,
  pendingTaskAccountCount,
  completedTodayAccountCount,
  expenseTodayAccountCount,
  accountTodayRows,
  latestMarketRecord,
  inventoryDialogOpen,
  notice,
  expenseFormOpen,
  expenseAccountId,
  expenseAmount,
  expenseNote,
  expenseError,
  openInventoryDialog,
  closeInventoryDialog,
  toggleExpenseForm: toggleExpenseDraft,
  cancelExpense,
  saveInventorySnapshot,
  selectAccount,
  saveExpense,
  shortDateTime,
} = useRecordPage();

async function toggleExpenseForm() {
  const opening = toggleExpenseDraft();
  if (opening) {
    await nextTick();
    expenseAmountInput.value?.focus();
  }
}
</script>

<template>
  <div class="page-wrap mobile-purpose-page record-page mobile-record-page" data-testid="record-page" data-platform-page="mobile">
    <header class="mobile-purpose-intro">
      <div><p>录入</p><h1>今天要记什么？</h1></div>
      <span>{{ today }}</span>
    </header>

    <p v-if="notice" class="mobile-action-notice" role="status" aria-live="polite">{{ notice }}</p>

    <section class="record-account-status" aria-labelledby="record-account-status-title">
      <header><div><p>先选账号</p><h2 id="record-account-status-title">五个账号今天的记录</h2></div><span>库存仍为五号同批录入</span></header>
      <div class="record-account-status-list">
        <article
          v-for="row in accountTodayRows"
          :key="row.accountId"
          role="button"
          tabindex="0"
          :class="{ active: ui.recentAccount === row.accountId }"
          :data-account-id="row.accountId"
          :aria-pressed="ui.recentAccount === row.accountId"
          :aria-label="`选择 ${row.accountId} 账号录入，库存${row.inventoryRecorded ? '已记录' : '待补'}，任务 ${row.taskCount} 项，其他支出 ${row.expenseCount} 笔`"
          @click="selectAccount(row.accountId)"
          @keydown.enter.prevent="selectAccount(row.accountId)"
          @keydown.space.prevent="selectAccount(row.accountId)"
        >
          <strong :class="`account-pill account-${row.accountId.toLowerCase()}`">{{ row.accountId }}</strong>
          <dl>
            <div :class="{ complete: row.inventoryRecorded }"><dt>库存</dt><dd>{{ row.inventoryRecorded ? "已记录" : "待补" }}</dd></div>
            <div :class="{ complete: row.taskCount }"><dt>任务</dt><dd>{{ row.taskCount }} 项</dd></div>
            <div :class="{ complete: row.expenseCount }"><dt>其他支出</dt><dd>{{ row.expenseCount }} 笔</dd></div>
          </dl>
        </article>
      </div>
    </section>

    <section class="record-primary-card" aria-labelledby="record-inventory-title">
      <span class="record-card-icon"><AppIcon name="assets" /></span>
      <div>
        <p>五号库存</p>
        <h2 id="record-inventory-title">{{ todayInventory ? "今天库存已记录" : "记录今天库存" }}</h2>
        <span>{{ todayInventory ? "再次打开可核对并更新今天的数据" : "一次填写五个账号的蛋、银子和内丹碎片" }}</span>
      </div>
      <button class="record-primary-action" type="button" @click="openInventoryDialog">
        <AppIcon name="plus" />{{ todayInventory ? "检查并更新" : "开始录入" }}
      </button>
    </section>

    <div class="record-option-grid">
      <RouterLink class="record-option-card" to="/plans/tasks">
        <span class="record-card-icon task"><AppIcon name="plan" /></span>
        <div>
          <p>任务完成</p>
          <h2>按账号标记任务</h2>
          <span>{{ completedTodayAccountCount ? `今天已有 ${completedTodayAccountCount} 个账号完成任务` : `${pendingTaskAccountCount} 个账号有待完成任务` }}</span>
        </div>
        <strong>去标记 <AppIcon name="chevron-right" /></strong>
      </RouterLink>

      <button class="record-option-card" type="button" :aria-expanded="expenseFormOpen" aria-controls="quick-expense-form" @click="toggleExpenseForm">
        <span class="record-card-icon expense"><AppIcon name="account" /></span>
        <div>
          <p>银子支出</p>
          <h2>选择账号记支出</h2>
          <span>{{ expenseTodayAccountCount ? `今天已有 ${expenseTodayAccountCount} 个账号记录支出` : "任务外花掉的银子按账号单独记账" }}</span>
        </div>
        <strong>{{ expenseFormOpen ? "收起" : "填写" }} <AppIcon name="chevron-right" /></strong>
      </button>

      <RouterLink class="record-option-card" to="/data/market">
        <span class="record-card-icon market"><AppIcon name="analysis" /></span>
        <div>
          <p>宝石行情</p>
          <h2>{{ latestMarketRecord ? "更新今日行情" : "录入行情" }}</h2>
          <span>{{ latestMarketRecord ? `最近一次 ${shortDateTime(latestMarketRecord.capturedAt)}` : "上传截图识别或手动核对价格" }}</span>
        </div>
        <strong>去录入 <AppIcon name="chevron-right" /></strong>
      </RouterLink>
    </div>

    <form v-if="expenseFormOpen" id="quick-expense-form" class="quick-expense-form" aria-label="记录今天的银子支出" @submit.prevent="saveExpense">
      <header><div><p>银子支出</p><h2>记录今天的一笔支出</h2></div><span>{{ today }}</span></header>
      <label><span>账号</span><select v-model="expenseAccountId" aria-label="支出账号" required><option v-for="account in catalog.data.accounts" :key="account.id" :value="account.id">{{ account.label }}</option></select></label>
      <label><span>金额 / 万</span><input ref="expenseAmountInput" v-model.number="expenseAmount" type="number" min="0.01" step="0.01" inputmode="decimal" aria-label="支出金额（万）" placeholder="0" required /></label>
      <label class="quick-expense-note"><span>用途</span><input v-model="expenseNote" type="text" maxlength="80" aria-label="支出用途" placeholder="例如：购买普通蛋" required /></label>
      <p v-if="expenseError" role="alert">{{ expenseError }}</p>
      <div class="quick-expense-actions"><button class="button" type="button" @click="cancelExpense">取消</button><button class="button primary" type="submit">保存支出</button></div>
    </form>

    <InventorySnapshotDialog
      v-if="inventoryDialogOpen"
      :open="inventoryDialogOpen"
      :initial-date="today"
      :max-date="today"
      :snapshots="inventory.snapshots"
      @close="closeInventoryDialog"
      @save="saveInventorySnapshot"
    />
  </div>
</template>

<style scoped>
.mobile-purpose-page { width: min(100%, 980px); padding-top: 14px; }
.mobile-purpose-intro { min-height: 48px; display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 12px; padding: 0 4px 10px; border-bottom: 1px solid var(--color-border); }
.mobile-purpose-intro > div { min-width: 0; display: flex; align-items: baseline; gap: 8px; }
.mobile-purpose-intro > p { color: var(--color-brand); font-size: 12px; font-weight: 850; letter-spacing: .12em; }
.mobile-purpose-intro > div > p { color: var(--color-brand); font-size: 11px; font-weight: 850; letter-spacing: .1em; }
.mobile-purpose-intro h1 { font-size: 25px; line-height: 1.2; letter-spacing: -.04em; white-space: nowrap; }
.mobile-purpose-intro > span { color: var(--color-text-muted); font-size: 12px; font-weight: 750; white-space: nowrap; }
.mobile-action-notice { margin: 0 0 12px; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--color-accent) 35%, var(--color-border)); border-radius: 9px; color: var(--color-accent-strong); background: var(--color-accent-soft); font-size: 13px; font-weight: 750; }

.record-primary-card,
.record-option-card,
.quick-expense-form,
.record-account-status { border: 1px solid var(--color-border); border-radius: 15px; background: var(--color-surface); box-shadow: 0 7px 20px rgba(17, 24, 39, .06); }

.record-primary-card { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 14px; margin-top: 12px; padding: 18px; }
.record-card-icon { flex: 0 0 48px; width: 48px; height: 48px; display: grid; place-items: center; border-radius: 50%; color: var(--color-brand); background: var(--color-brand-soft); }
.record-card-icon :deep(svg) { width: 23px; height: 23px; }
.record-primary-card p, .record-option-card p, .quick-expense-form header p, .record-account-status > header p { color: var(--color-text-muted); font-size: 11px; font-weight: 800; }
.record-primary-card h2, .record-option-card h2 { margin-top: 1px; font-size: 19px; line-height: 1.3; }
.record-primary-card div > span, .record-option-card div > span { display: block; margin-top: 3px; color: var(--color-text-muted); font-size: 12px; line-height: 1.45; }
.record-primary-action { min-height: 46px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 0 15px; border: 1px solid #a84600; border-radius: 10px; color: var(--color-text-on-strong); background: var(--color-brand); font-size: 14px; font-weight: 850; }
.record-primary-action :deep(svg) { width: 19px; height: 19px; }

.record-option-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
.record-option-card { min-width: 0; min-height: 178px; display: grid; grid-template-columns: auto minmax(0, 1fr); align-content: start; gap: 11px; padding: 15px; color: inherit; text-align: left; }
button.record-option-card { width: 100%; font: inherit; }
.record-option-card > div { min-width: 0; }
.record-option-card > strong { grid-column: 1 / -1; align-self: end; min-height: 44px; display: flex; align-items: center; justify-content: flex-end; gap: 4px; color: var(--color-accent-strong); font-size: 13px; }
.record-option-card > strong :deep(svg) { width: 16px; height: 16px; }
.record-card-icon.task { color: var(--color-accent-strong); background: var(--color-accent-soft); }
.record-card-icon.expense { color: #9a5a00; background: #fff4df; }
.record-card-icon.market { color: var(--color-info); background: var(--color-info-soft); }

.quick-expense-form { display: grid; grid-template-columns: 140px 170px minmax(220px, 1fr) auto; align-items: end; gap: 12px; margin-top: 12px; padding: 16px; }
.quick-expense-form header { grid-column: 1 / -1; display: flex; align-items: end; justify-content: space-between; gap: 20px; padding-bottom: 11px; border-bottom: 1px solid var(--color-border); }
.quick-expense-form header h2, .record-account-status h2 { font-size: 18px; }
.quick-expense-form header > span { color: var(--color-text-muted); font-size: 12px; font-weight: 750; }
.quick-expense-form label { display: grid; gap: 5px; }
.quick-expense-form label > span { color: var(--color-text-muted); font-size: 12px; font-weight: 750; }
.quick-expense-form :is(input, select) { width: 100%; height: 44px; padding: 0 10px; border: 1px solid var(--color-border-strong); border-radius: 8px; background: var(--color-surface); font-size: 16px; }
.quick-expense-form > p { grid-column: 1 / -1; color: var(--color-danger); font-size: 12px; font-weight: 750; }
.quick-expense-actions { display: flex; gap: 7px; }
.quick-expense-actions .button { min-height: 44px; }

.record-account-status { overflow: hidden; margin-top: 12px; }
.record-account-status > header { min-height: 58px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--color-border); background: var(--color-surface-subtle); }
.record-account-status > header > div { display: grid; gap: 1px; }
.record-account-status > header > span { color: var(--color-text-muted); font-size: 10px; font-weight: 750; white-space: nowrap; }
.record-account-status-list { display: grid; }
.record-account-status-list > article { min-height: 64px; display: grid; grid-template-columns: 58px minmax(0, 1fr); align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--color-border); background: var(--color-surface); }
.record-account-status-list > article:last-child { border-bottom: 0; }
.record-account-status-list > article:hover,
.record-account-status-list > article.active { background: color-mix(in srgb, var(--color-accent-soft) 58%, #ffffff); }
.record-account-status-list > article.active { box-shadow: inset 3px 0 var(--color-accent); }
.record-account-status-list > article:focus-visible { outline: 3px solid color-mix(in srgb, var(--color-accent) 40%, transparent); outline-offset: -3px; }
.record-account-status-list > article > strong { min-height: 36px; display: grid; place-items: center; }
.record-account-status-list dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; }
.record-account-status-list dl > div { min-width: 0; padding: 0 10px; border-left: 1px solid var(--color-border); }
.record-account-status-list dl > div:first-child { padding-left: 0; border-left: 0; }
.record-account-status-list dt { color: var(--color-text-muted); font-size: 10px; font-weight: 750; }
.record-account-status-list dd { margin: 1px 0 0; color: #9a5a00; font-size: 13px; font-weight: 850; white-space: nowrap; }
.record-account-status-list .complete dd { color: var(--color-success); }

@media (max-width: 720px) {
  .mobile-purpose-page { padding: 10px 14px 24px; }
  .mobile-purpose-intro h1 { font-size: 24px; }
  .record-primary-card { grid-template-columns: auto minmax(0, 1fr); padding: 15px; }
  .record-primary-action { grid-column: 1 / -1; width: 100%; min-height: 50px; }
  .record-option-grid { grid-template-columns: 1fr; }
  .record-option-card { min-height: 126px; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; }
  .record-option-card > strong { grid-column: 3; grid-row: 1; align-self: center; font-size: 12px; white-space: nowrap; }
  .quick-expense-form { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 14px; }
  .quick-expense-note { grid-column: 1 / -1; }
  .quick-expense-actions { grid-column: 1 / -1; }
  .quick-expense-actions .button { flex: 1; }
}

@media (max-width: 430px) {
  .record-option-card { grid-template-columns: auto minmax(0, 1fr); }
  .record-option-card > strong { grid-column: 2; grid-row: 2; justify-content: flex-start; min-height: 34px; }
  .quick-expense-form { grid-template-columns: 1fr; }
  .quick-expense-note, .quick-expense-actions { grid-column: 1; }
  .record-account-status-list dl > div { padding-inline: 7px; }
}
</style>
