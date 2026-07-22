<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import AppIcon from "../../components/AppIcon.vue";
import InventorySnapshotDialog from "../../components/InventorySnapshotDialog.vue";
import { buildInventoryWeekReport } from "../../domain/inventory";
import { buildTaskPlans } from "../../domain/plans";
import type { AccountId, InventorySnapshotInput } from "../../domain/types";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";

const catalog = useCatalogStore();
const inventory = useInventoryStore();
const settings = useSettingsStore();
const inventoryDialogOpen = ref(false);
const notice = ref("");
const expenseFormOpen = ref(false);
const expenseAccountId = ref<AccountId>(catalog.data.accounts[0]?.id || "FC");
const expenseAmount = ref<number | null>(null);
const expenseNote = ref("");
const expenseError = ref("");
const expenseAmountInput = ref<HTMLInputElement>();

inventory.hydrate();

const today = computed(() => settings.planningAsOfDate);
const report = computed(() => buildInventoryWeekReport(inventory.snapshots, today.value));
const todayInventory = computed(() => report.value.days.find((day) => day.date === today.value)?.snapshot || null);
const planningState = computed(() => settings.snapshot(
  inventory.planningResources,
  inventory.latestSnapshot?.effectiveDate || null,
));
const tasks = computed(() => buildTaskPlans(catalog.data, catalog.pets, planningState.value).flatMap((plan) => plan.tasks));
const pendingTaskCount = computed(() => tasks.value.filter((task) => !task.done).length);
const completedTodayCount = computed(() => settings.taskCompletions.filter((entry) => entry.completedOn === today.value).length);
const expensesToday = computed(() => settings.silverExpenses.filter((entry) => entry.effectiveDate === today.value));
const latestMarketRecord = computed(() => settings.gemPriceHistory.at(-1) || null);

function saveInventorySnapshot(draft: InventorySnapshotInput) {
  const updating = inventory.snapshots.some((item) => item.effectiveDate === draft.effectiveDate);
  inventory.saveSnapshot(draft);
  inventoryDialogOpen.value = false;
  notice.value = `${updating ? "已更新" : "已保存"} ${draft.effectiveDate} 的五号库存`;
}

async function toggleExpenseForm() {
  const opening = !expenseFormOpen.value;
  expenseFormOpen.value = opening;
  expenseError.value = "";
  if (opening) {
    await nextTick();
    expenseAmountInput.value?.focus();
  }
}

function saveExpense() {
  const record = settings.addSilverExpense({
    effectiveDate: today.value,
    accountId: expenseAccountId.value,
    amountWan: Number(expenseAmount.value),
    note: expenseNote.value,
  });
  if (!record) {
    expenseError.value = "请填写有效金额和用途";
    return;
  }
  expenseAmount.value = null;
  expenseNote.value = "";
  expenseFormOpen.value = false;
  expenseError.value = "";
  notice.value = `已记录 ${record.accountId} 的 ${Number(record.amountWan.toFixed(2)).toLocaleString("zh-CN")} 万银子支出`;
}

function shortDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
</script>

<template>
  <div class="page-wrap mobile-purpose-page record-page" data-testid="record-page">
    <header class="mobile-purpose-intro">
      <p>录入</p>
      <h1>今天要记什么？</h1>
      <span>库存、任务和支出分别记清楚，本周小结会自动汇总。</span>
    </header>

    <p v-if="notice" class="mobile-action-notice" role="status" aria-live="polite">{{ notice }}</p>

    <section class="record-primary-card" aria-labelledby="record-inventory-title">
      <span class="record-card-icon"><AppIcon name="assets" /></span>
      <div>
        <p>五号库存</p>
        <h2 id="record-inventory-title">{{ todayInventory ? "今天库存已记录" : "记录今天库存" }}</h2>
        <span>{{ todayInventory ? "再次打开可核对并更新今天的数据" : "一次填写五个账号的蛋、银子和内丹碎片" }}</span>
      </div>
      <button class="record-primary-action" type="button" @click="inventoryDialogOpen = true">
        <AppIcon name="plus" />{{ todayInventory ? "检查并更新" : "开始录入" }}
      </button>
    </section>

    <div class="record-option-grid">
      <RouterLink class="record-option-card" to="/plans/tasks">
        <span class="record-card-icon task"><AppIcon name="plan" /></span>
        <div>
          <p>任务完成</p>
          <h2>{{ pendingTaskCount }} 项待完成</h2>
          <span>{{ completedTodayCount ? `今天已完成 ${completedTodayCount} 项` : "标记完成时自动记录日期和资源支出" }}</span>
        </div>
        <strong>去标记 <AppIcon name="chevron-right" /></strong>
      </RouterLink>

      <button class="record-option-card" type="button" :aria-expanded="expenseFormOpen" aria-controls="quick-expense-form" @click="toggleExpenseForm">
        <span class="record-card-icon expense"><AppIcon name="account" /></span>
        <div>
          <p>银子支出</p>
          <h2>{{ expensesToday.length ? `今天 ${expensesToday.length} 笔` : "补记一笔支出" }}</h2>
          <span>任务外花掉的银子在这里单独记账</span>
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
      <div class="quick-expense-actions"><button class="button" type="button" @click="toggleExpenseForm">取消</button><button class="button primary" type="submit">保存支出</button></div>
    </form>

    <section class="record-today-summary" aria-labelledby="record-today-summary-title">
      <div><p>今天的记录</p><h2 id="record-today-summary-title">一眼确认有没有漏项</h2></div>
      <dl>
        <div :class="{ complete: todayInventory }"><dt>库存</dt><dd>{{ todayInventory ? "已记录" : "待补" }}</dd></div>
        <div :class="{ complete: completedTodayCount }"><dt>任务</dt><dd>{{ completedTodayCount }} 项</dd></div>
        <div :class="{ complete: expensesToday.length }"><dt>其他支出</dt><dd>{{ expensesToday.length }} 笔</dd></div>
      </dl>
    </section>

    <InventorySnapshotDialog
      v-if="inventoryDialogOpen"
      :open="inventoryDialogOpen"
      :initial-date="today"
      :max-date="today"
      :snapshots="inventory.snapshots"
      @close="inventoryDialogOpen = false"
      @save="saveInventorySnapshot"
    />
  </div>
</template>

<style scoped>
.mobile-purpose-page { width: min(100%, 980px); padding-top: 22px; }
.mobile-purpose-intro { display: grid; gap: 4px; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--radar-line); }
.mobile-purpose-intro > p { color: var(--brand-orange); font-size: 12px; font-weight: 850; letter-spacing: .12em; }
.mobile-purpose-intro h1 { font-size: 32px; line-height: 1.2; letter-spacing: -.04em; }
.mobile-purpose-intro > span { color: var(--radar-muted); font-size: 14px; }
.mobile-action-notice { margin: 0 0 12px; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--radar-cyan) 35%, var(--radar-line)); border-radius: 9px; color: var(--radar-cyan-strong); background: var(--radar-cyan-soft); font-size: 13px; font-weight: 750; }

.record-primary-card,
.record-option-card,
.quick-expense-form,
.record-today-summary { border: 1px solid var(--radar-line); border-radius: 15px; background: #ffffff; box-shadow: 0 7px 20px rgba(17, 24, 39, .06); }

.record-primary-card { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 14px; padding: 18px; }
.record-card-icon { flex: 0 0 48px; width: 48px; height: 48px; display: grid; place-items: center; border-radius: 50%; color: var(--brand-orange); background: var(--brand-orange-soft); }
.record-card-icon :deep(svg) { width: 23px; height: 23px; }
.record-primary-card p, .record-option-card p, .quick-expense-form header p, .record-today-summary > div p { color: var(--radar-muted); font-size: 11px; font-weight: 800; }
.record-primary-card h2, .record-option-card h2 { margin-top: 1px; font-size: 19px; line-height: 1.3; }
.record-primary-card div > span, .record-option-card div > span { display: block; margin-top: 3px; color: var(--radar-muted); font-size: 12px; line-height: 1.45; }
.record-primary-action { min-height: 46px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 0 15px; border: 1px solid #a84600; border-radius: 10px; color: #ffffff; background: var(--brand-orange); font-size: 14px; font-weight: 850; }
.record-primary-action :deep(svg) { width: 19px; height: 19px; }

.record-option-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
.record-option-card { min-width: 0; min-height: 178px; display: grid; grid-template-columns: auto minmax(0, 1fr); align-content: start; gap: 11px; padding: 15px; color: inherit; text-align: left; }
button.record-option-card { width: 100%; font: inherit; }
.record-option-card > div { min-width: 0; }
.record-option-card > strong { grid-column: 1 / -1; align-self: end; min-height: 44px; display: flex; align-items: center; justify-content: flex-end; gap: 4px; color: var(--radar-cyan-strong); font-size: 13px; }
.record-option-card > strong :deep(svg) { width: 16px; height: 16px; }
.record-card-icon.task { color: var(--radar-cyan-strong); background: var(--radar-cyan-soft); }
.record-card-icon.expense { color: #9a5a00; background: #fff4df; }
.record-card-icon.market { color: #12678f; background: #edf4fb; }

.quick-expense-form { display: grid; grid-template-columns: 140px 170px minmax(220px, 1fr) auto; align-items: end; gap: 12px; margin-top: 12px; padding: 16px; }
.quick-expense-form header { grid-column: 1 / -1; display: flex; align-items: end; justify-content: space-between; gap: 20px; padding-bottom: 11px; border-bottom: 1px solid var(--radar-line); }
.quick-expense-form header h2, .record-today-summary h2 { font-size: 18px; }
.quick-expense-form header > span { color: var(--radar-muted); font-size: 12px; font-weight: 750; }
.quick-expense-form label { display: grid; gap: 5px; }
.quick-expense-form label > span { color: var(--radar-muted); font-size: 12px; font-weight: 750; }
.quick-expense-form :is(input, select) { width: 100%; height: 44px; padding: 0 10px; border: 1px solid var(--radar-line-strong); border-radius: 8px; background: #ffffff; font-size: 16px; }
.quick-expense-form > p { grid-column: 1 / -1; color: var(--radar-danger); font-size: 12px; font-weight: 750; }
.quick-expense-actions { display: flex; gap: 7px; }
.quick-expense-actions .button { min-height: 44px; }

.record-today-summary { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 20px; margin-top: 12px; padding: 15px 17px; }
.record-today-summary dl { display: grid; grid-template-columns: repeat(3, minmax(88px, 1fr)); margin: 0; }
.record-today-summary dl > div { padding: 0 14px; border-left: 1px solid var(--radar-line); }
.record-today-summary dt { color: var(--radar-muted); font-size: 11px; }
.record-today-summary dd { margin: 2px 0 0; color: #9a5a00; font-size: 15px; font-weight: 850; }
.record-today-summary .complete dd { color: var(--radar-success); }

@media (max-width: 720px) {
  .mobile-purpose-page { padding: 18px 14px 24px; }
  .mobile-purpose-intro h1 { font-size: 30px; }
  .record-primary-card { grid-template-columns: auto minmax(0, 1fr); padding: 15px; }
  .record-primary-action { grid-column: 1 / -1; width: 100%; min-height: 50px; }
  .record-option-grid { grid-template-columns: 1fr; }
  .record-option-card { min-height: 126px; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; }
  .record-option-card > strong { grid-column: 3; grid-row: 1; align-self: center; font-size: 12px; white-space: nowrap; }
  .quick-expense-form { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 14px; }
  .quick-expense-note { grid-column: 1 / -1; }
  .quick-expense-actions { grid-column: 1 / -1; }
  .quick-expense-actions .button { flex: 1; }
  .record-today-summary { grid-template-columns: 1fr; }
  .record-today-summary dl { width: 100%; }
  .record-today-summary dl > div:first-child { border-left: 0; padding-left: 0; }
}

@media (max-width: 430px) {
  .record-option-card { grid-template-columns: auto minmax(0, 1fr); }
  .record-option-card > strong { grid-column: 2; grid-row: 2; justify-content: flex-start; min-height: 34px; }
  .quick-expense-form { grid-template-columns: 1fr; }
  .quick-expense-note, .quick-expense-actions { grid-column: 1; }
  .record-today-summary dl > div { padding-inline: 8px; }
}
</style>
