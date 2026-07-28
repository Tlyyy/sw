<script setup lang="ts">
import { onMounted } from "vue";
import AppIcon from "../../../components/AppIcon.vue";
import InventorySnapshotDialog from "../components/DesktopInventorySnapshotDialog.vue";
import { useRecordPage } from "../../../features/record/useRecordPage";

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
  expenseAccountId,
  expenseAmount,
  expenseNote,
  expenseError,
  expenseDirty,
  openInventoryDialog,
  closeInventoryDialog,
  openExpenseForm,
  cancelExpense,
  saveInventorySnapshot,
  selectAccount,
  saveExpense,
  shortDateTime,
} = useRecordPage();

onMounted(() => {
  openExpenseForm();
});
</script>

<template>
  <div class="desktop-record-page" data-testid="record-page" data-platform-page="desktop">
    <header class="desktop-record-head">
      <div>
        <p>PC 录入工作台</p>
        <h1>今天要记什么？</h1>
        <span>五个账号并行核对，保存后手机端立即使用同一份数据。</span>
      </div>
      <time :datetime="today">{{ today }}</time>
    </header>

    <p v-if="notice" class="desktop-record-notice" role="status" aria-live="polite">{{ notice }}</p>

    <div class="desktop-record-layout">
      <main class="desktop-record-workspace">
        <section class="desktop-inventory-panel" aria-labelledby="desktop-record-inventory-title">
          <div class="desktop-inventory-copy">
            <span class="desktop-record-icon inventory"><AppIcon name="assets" /></span>
            <div>
              <p>今日五号库存</p>
              <h2 id="desktop-record-inventory-title">{{ todayInventory ? "今天库存已记录" : "等待录入今天库存" }}</h2>
              <span>{{ todayInventory ? "可以重新打开，按账号核对并更新。" : "五个账号同屏填写蛋、银子和内丹碎片。" }}</span>
            </div>
          </div>
          <button class="desktop-inventory-action" type="button" @click="openInventoryDialog">
            <AppIcon name="plus" />
            {{ todayInventory ? "检查并更新" : "开始录入" }}
          </button>
        </section>

        <section class="desktop-account-ledger" aria-labelledby="desktop-account-ledger-title">
          <header>
            <div>
              <p>今日记录覆盖</p>
              <h2 id="desktop-account-ledger-title">五个账号状态</h2>
            </div>
            <span>点击账号会同步右侧支出表单</span>
          </header>

          <div class="desktop-account-table" role="table" aria-label="五个账号今天的录入状态">
            <div class="desktop-account-table-head" role="row">
              <span role="columnheader">账号</span>
              <span role="columnheader">库存</span>
              <span role="columnheader">任务完成</span>
              <span role="columnheader">其他支出</span>
              <span role="columnheader">操作</span>
            </div>
            <button
              v-for="row in accountTodayRows"
              :key="row.accountId"
              class="desktop-account-row"
              :class="{ active: ui.recentAccount === row.accountId }"
              type="button"
              role="row"
              :data-account-id="row.accountId"
              :aria-pressed="ui.recentAccount === row.accountId"
              :aria-label="`选择 ${row.accountId} 账号录入`"
              @click="selectAccount(row.accountId)"
            >
              <span role="cell">
                <strong :class="`account-pill account-${row.accountId.toLowerCase()}`">{{ row.accountId }}</strong>
                <small>{{ row.accountLabel }}</small>
              </span>
              <span role="cell" :class="{ complete: row.inventoryRecorded }">{{ row.inventoryRecorded ? "已记录" : "待补" }}</span>
              <span role="cell" :class="{ complete: row.taskCount }">{{ row.taskCount }} 项</span>
              <span role="cell" :class="{ complete: row.expenseCount }">{{ row.expenseCount }} 笔</span>
              <span role="cell">{{ ui.recentAccount === row.accountId ? "当前账号" : "选择" }}</span>
            </button>
          </div>
        </section>
      </main>

      <aside class="desktop-record-sidebar" aria-label="快速录入与相关入口">
        <form class="desktop-expense-form" aria-label="记录今天的银子支出" @submit.prevent="saveExpense">
          <header>
            <span class="desktop-record-icon expense"><AppIcon name="account" /></span>
            <div>
              <p>快速支出</p>
              <h2>记录一笔银子支出</h2>
            </div>
          </header>

          <label>
            <span>账号</span>
            <select v-model="expenseAccountId" aria-label="支出账号" required>
              <option v-for="account in catalog.data.accounts" :key="account.id" :value="account.id">{{ account.label }}</option>
            </select>
          </label>
          <label>
            <span>金额 / 万</span>
            <input v-model.number="expenseAmount" type="number" min="0.01" step="0.01" inputmode="decimal" aria-label="支出金额（万）" placeholder="0" required />
          </label>
          <label>
            <span>用途</span>
            <input v-model="expenseNote" type="text" maxlength="80" aria-label="支出用途" placeholder="例如：购买普通蛋" required />
          </label>
          <p v-if="expenseError" class="desktop-expense-error" role="alert">{{ expenseError }}</p>
          <div class="desktop-expense-actions">
            <button class="button" type="button" :disabled="!expenseDirty" @click="cancelExpense">清空</button>
            <button class="button primary" type="submit">保存支出</button>
          </div>
          <small>今日已有 {{ expenseTodayAccountCount }} 个账号记录其他支出</small>
        </form>

        <nav class="desktop-record-shortcuts" aria-label="其他录入入口">
          <RouterLink to="/plans/tasks">
            <span class="desktop-record-icon task"><AppIcon name="plan" /></span>
            <div><strong>任务完成</strong><small>{{ completedTodayAccountCount ? `今天已涉及 ${completedTodayAccountCount} 个账号` : `${pendingTaskAccountCount} 个账号仍有待办` }}</small></div>
            <AppIcon name="chevron-right" />
          </RouterLink>
          <RouterLink to="/data/market">
            <span class="desktop-record-icon market"><AppIcon name="analysis" /></span>
            <div><strong>宝石行情</strong><small>{{ latestMarketRecord ? `最近更新 ${shortDateTime(latestMarketRecord.capturedAt)}` : "尚未记录行情" }}</small></div>
            <AppIcon name="chevron-right" />
          </RouterLink>
        </nav>
      </aside>
    </div>

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
.desktop-record-page {
  width: min(100%, 1440px);
  margin: 0 auto;
  padding: 28px 34px 72px;
}

.desktop-record-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 28px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--color-border);
}

.desktop-record-head > div { min-width: 0; }
.desktop-record-head p,
.desktop-inventory-panel p,
.desktop-account-ledger > header p,
.desktop-expense-form header p {
  color: var(--color-accent-strong);
  font-size: 11px;
  font-weight: 850;
  letter-spacing: .08em;
}
.desktop-record-head h1 { margin-top: 3px; font-size: 32px; line-height: 1.16; letter-spacing: -.045em; }
.desktop-record-head div > span { display: block; margin-top: 5px; color: var(--color-text-muted); font-size: 13px; }
.desktop-record-head time {
  flex: 0 0 auto;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-muted);
  background: var(--color-surface);
  font-size: 13px;
  font-weight: 800;
}

.desktop-record-notice {
  margin-top: 16px;
  padding: 11px 14px;
  border: 1px solid color-mix(in srgb, var(--color-accent) 35%, var(--color-border));
  border-radius: 8px;
  color: var(--color-accent-strong);
  background: var(--color-accent-soft);
  font-size: 13px;
  font-weight: 750;
}

.desktop-record-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 350px;
  align-items: start;
  gap: 20px;
  margin-top: 20px;
}
.desktop-record-workspace,
.desktop-record-sidebar { min-width: 0; display: grid; gap: 16px; }

.desktop-inventory-panel,
.desktop-account-ledger,
.desktop-expense-form,
.desktop-record-shortcuts {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  box-shadow: 0 8px 24px rgba(17, 24, 39, .05);
}

.desktop-inventory-panel {
  min-height: 116px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 20px 22px;
}
.desktop-inventory-copy { min-width: 0; display: flex; align-items: center; gap: 14px; }
.desktop-inventory-copy h2 { margin-top: 2px; font-size: 22px; letter-spacing: -.025em; }
.desktop-inventory-copy div > span { display: block; margin-top: 4px; color: var(--color-text-muted); font-size: 12px; }

.desktop-record-icon {
  flex: 0 0 auto;
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 9px;
}
.desktop-record-icon :deep(svg) { width: 21px; height: 21px; }
.desktop-record-icon.inventory { color: var(--color-brand); background: var(--color-brand-soft); }
.desktop-record-icon.expense { color: #9a5a00; background: #fff4df; }
.desktop-record-icon.task { color: var(--color-accent-strong); background: var(--color-accent-soft); }
.desktop-record-icon.market { color: var(--color-info); background: var(--color-info-soft); }

.desktop-inventory-action {
  flex: 0 0 auto;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 16px;
  border: 1px solid #a84600;
  border-radius: 8px;
  color: var(--color-text-on-strong);
  background: var(--color-brand);
  font-size: 13px;
  font-weight: 850;
}
.desktop-inventory-action :deep(svg) { width: 18px; height: 18px; }

.desktop-account-ledger { overflow: hidden; }
.desktop-account-ledger > header {
  min-height: 66px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-subtle);
}
.desktop-account-ledger > header h2 { margin-top: 1px; font-size: 18px; }
.desktop-account-ledger > header > span { color: var(--color-text-muted); font-size: 11px; font-weight: 750; }

.desktop-account-table { min-width: 680px; }
.desktop-account-table-head,
.desktop-account-row {
  display: grid;
  grid-template-columns: minmax(150px, 1.2fr) repeat(3, minmax(90px, .75fr)) 84px;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
}
.desktop-account-table-head {
  min-height: 38px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-muted);
  background: var(--color-surface);
  font-size: 10px;
  font-weight: 800;
}
.desktop-account-row {
  width: 100%;
  min-height: 64px;
  border: 0;
  border-bottom: 1px solid var(--color-border);
  color: inherit;
  background: var(--color-surface);
  text-align: left;
  font: inherit;
}
.desktop-account-row:last-child { border-bottom: 0; }
.desktop-account-row:hover,
.desktop-account-row.active { background: var(--color-surface-subtle); }
.desktop-account-row.active { box-shadow: inset 3px 0 var(--color-accent); }
.desktop-account-row:focus-visible { position: relative; z-index: 1; outline: 3px solid color-mix(in srgb, var(--color-accent) 36%, transparent); outline-offset: -3px; }
.desktop-account-row > span { min-width: 0; color: #9a5a00; font-size: 13px; font-weight: 800; }
.desktop-account-row > span:first-child { display: flex; align-items: center; gap: 9px; color: var(--color-text); }
.desktop-account-row > span:first-child small { overflow: hidden; color: var(--color-text-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.desktop-account-row > span:last-child { color: var(--color-accent-strong); text-align: right; }
.desktop-account-row > span.complete { color: var(--color-success); }

.desktop-expense-form { display: grid; gap: 12px; padding: 17px; }
.desktop-expense-form header { display: flex; align-items: center; gap: 11px; padding-bottom: 12px; border-bottom: 1px solid var(--color-border); }
.desktop-expense-form header h2 { margin-top: 1px; font-size: 17px; }
.desktop-expense-form label { display: grid; gap: 5px; }
.desktop-expense-form label > span { color: var(--color-text-muted); font-size: 11px; font-weight: 800; }
.desktop-expense-form :is(input, select) {
  width: 100%;
  height: 42px;
  padding: 0 10px;
  border: 1px solid var(--color-border-strong);
  border-radius: 7px;
  color: var(--color-text);
  background: var(--color-surface);
  font-size: 14px;
}
.desktop-expense-error { color: var(--color-danger); font-size: 12px; font-weight: 750; }
.desktop-expense-actions { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 8px; }
.desktop-expense-actions .button { min-height: 42px; }
.desktop-expense-form > small { color: var(--color-text-muted); font-size: 10px; }

.desktop-record-shortcuts { overflow: hidden; }
.desktop-record-shortcuts > a {
  min-height: 76px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 11px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border);
  color: inherit;
}
.desktop-record-shortcuts > a:last-child { border-bottom: 0; }
.desktop-record-shortcuts > a:hover { background: var(--color-surface-subtle); }
.desktop-record-shortcuts > a > div { min-width: 0; display: grid; gap: 2px; }
.desktop-record-shortcuts strong { font-size: 14px; }
.desktop-record-shortcuts small { overflow: hidden; color: var(--color-text-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.desktop-record-shortcuts > a > :deep(svg) { width: 17px; height: 17px; color: var(--color-text-muted); }

@media (max-width: 1160px) {
  .desktop-record-page { padding-inline: 24px; }
  .desktop-record-layout { grid-template-columns: 1fr; }
  .desktop-record-sidebar { grid-template-columns: minmax(320px, .9fr) minmax(0, 1.1fr); }
}
</style>
