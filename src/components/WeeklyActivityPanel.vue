<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { InventoryWeekReport } from "../domain/inventory";
import {
  buildWeeklyActivitySummary,
  taskCompletionResourceLabel,
  type WeeklyAccountActivitySummary,
} from "../domain/weeklyActivity";
import { catalog } from "../data/catalog";
import type { AccountId } from "../domain/types";
import { useSettingsStore } from "../stores/settings";
import AppIcon from "./AppIcon.vue";
import { createWeeklyActivityReportImage } from "./weeklyActivityReportImage";

const props = defineProps<{
  report: InventoryWeekReport;
  currentDate: string;
}>();

const settings = useSettingsStore();
const accounts = catalog.accounts;
const expenseFormOpen = ref(false);
const expenseAccountId = ref<AccountId>(accounts[0]?.id || "FC");
const expenseDate = ref("");
const expenseAmount = ref<number | null>(null);
const expenseNote = ref("");
const expenseError = ref("");
const actionNotice = ref("");
const generating = ref(false);
const previewUrl = ref("");
const previewFileName = ref("");
const previewClose = ref<HTMLButtonElement>();
let noticeTimer: number | null = null;
let previouslyFocused: HTMLElement | null = null;
let previousBodyOverflow = "";
let previousRootOverflow = "";

const activity = computed(() => buildWeeklyActivitySummary(
  props.report,
  settings.taskCompletions,
  settings.silverExpenses,
  props.currentDate,
));

watch(() => [activity.value.weekStart, activity.value.reportEnd], () => {
  expenseDate.value = activity.value.reportEnd;
  expenseFormOpen.value = false;
  expenseError.value = "";
}, { immediate: true });

onBeforeUnmount(() => {
  if (noticeTimer !== null) window.clearTimeout(noticeTimer);
  releasePreviewUrl();
  unlockPreview();
});

function numberLabel(value: number) {
  return Number(value.toFixed(2)).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function wanLabel(value: number | null, signed = false) {
  if (value === null) return "待计算";
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${numberLabel(value)} 万`;
}

function shortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function accountTaskSummary(account: WeeklyAccountActivitySummary) {
  if (!account.taskCompletions.length) return "本周无完成任务";
  const names = account.taskCompletions.slice(0, 2).map((task) => `${task.typeLabel} · ${task.actionLabel}`);
  const remainder = account.taskCompletions.length - names.length;
  return `${names.join("、")}${remainder > 0 ? `，另 ${remainder} 项` : ""}`;
}

function showNotice(message: string) {
  actionNotice.value = message;
  if (noticeTimer !== null) window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    actionNotice.value = "";
    noticeTimer = null;
  }, 3_200);
}

function openExpenseForm() {
  expenseFormOpen.value = true;
  expenseDate.value = activity.value.reportEnd;
  expenseError.value = "";
}

function cancelExpenseForm() {
  expenseFormOpen.value = false;
  expenseAmount.value = null;
  expenseNote.value = "";
  expenseError.value = "";
}

function saveExpense() {
  const record = settings.addSilverExpense({
    effectiveDate: expenseDate.value,
    accountId: expenseAccountId.value,
    amountWan: Number(expenseAmount.value),
    note: expenseNote.value,
  });
  if (!record) {
    expenseError.value = "请填写有效日期、支出金额和用途";
    return;
  }
  cancelExpenseForm();
  showNotice(`已记录 ${record.accountId} 在 ${record.effectiveDate} 的 ${numberLabel(record.amountWan)} 万银子支出`);
}

function removeExpense(id: string, note: string) {
  if (!confirm(`确认删除“${note}”这笔银子支出？`)) return;
  settings.removeSilverExpense(id);
  showNotice("支出记录已删除，周报已重新计算");
}

function shanghaiGeneratedAt() {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date()).replaceAll("/", "-");
}

function releasePreviewUrl() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = "";
  previewFileName.value = "";
}

async function lockPreview() {
  previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  previousBodyOverflow = document.body.style.overflow;
  previousRootOverflow = document.documentElement.style.overflow;
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
  document.querySelector("#app")?.setAttribute("inert", "");
  await nextTick();
  previewClose.value?.focus();
}

function unlockPreview(restoreFocus = false) {
  document.body.style.overflow = previousBodyOverflow;
  document.documentElement.style.overflow = previousRootOverflow;
  document.querySelector("#app")?.removeAttribute("inert");
  if (restoreFocus) void nextTick(() => previouslyFocused?.focus());
}

async function generateWeeklyReport() {
  if (generating.value) return;
  generating.value = true;
  try {
    releasePreviewUrl();
    const blob = createWeeklyActivityReportImage({
      ...activity.value,
      generatedAt: shanghaiGeneratedAt(),
    });
    previewFileName.value = `本周周报-${activity.value.weekStart}-${activity.value.reportEnd}.png`;
    previewUrl.value = URL.createObjectURL(blob);
    await lockPreview();
  } catch {
    showNotice("周报图片生成失败，请重试");
  } finally {
    generating.value = false;
  }
}

function closePreview() {
  unlockPreview(true);
  releasePreviewUrl();
}

function handlePreviewKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    closePreview();
  }
}

function downloadPreview() {
  if (!previewUrl.value) return;
  const link = document.createElement("a");
  link.href = previewUrl.value;
  link.download = previewFileName.value;
  link.click();
  showNotice("周报图片已下载");
}
</script>

<template>
  <section class="weekly-activity-panel" aria-labelledby="weekly-activity-title" data-testid="weekly-activity-panel">
    <header class="weekly-activity-head">
      <div>
        <p>本周截至 {{ shortDate(activity.reportEnd) }}</p>
        <h3 id="weekly-activity-title">银子收获与任务记录</h3>
        <span>花掉的银子单独记账，不再从本周收获里消失。</span>
      </div>
      <div class="weekly-activity-actions">
        <button v-if="!expenseFormOpen" class="button weekly-expense-button" type="button" @click="openExpenseForm">
          <AppIcon name="plus" />
          <span>补记其他支出</span>
        </button>
        <button class="button primary weekly-generate-button" type="button" :disabled="generating" :aria-busy="generating" @click="generateWeeklyReport">
          <AppIcon :name="generating ? 'refresh' : 'report'" />
          <span>{{ generating ? "正在生成" : "生成本周周报" }}</span>
        </button>
      </div>
    </header>

    <dl class="weekly-cashflow-metrics">
      <div class="harvest">
        <dt>本周收获</dt>
        <dd>{{ wanLabel(activity.harvestedSilverWan) }}</dd>
        <small>库存净变化 + 已记录支出</small>
      </div>
      <div class="expense">
        <dt>本周支出</dt>
        <dd>{{ wanLabel(activity.totalSilverExpenseWan) }}</dd>
        <small>任务 {{ numberLabel(activity.taskSilverExpenseWan) }} · 其他 {{ numberLabel(activity.manualSilverExpenseWan) }}</small>
      </div>
      <div>
        <dt>库存净变化</dt>
        <dd>{{ wanLabel(activity.inventoryNetChangeWan, true) }}</dd>
        <small v-if="activity.inventoryChangeTo">{{ activity.inventoryChangeFrom }} → {{ activity.inventoryChangeTo }}</small>
        <small v-else>需要周前基线或本周两份库存</small>
      </div>
      <div>
        <dt>当前银子库存</dt>
        <dd>{{ wanLabel(activity.currentSilverWan) }}</dd>
        <small>{{ activity.latestInventoryDate ? `库存日期 ${activity.latestInventoryDate}` : "本周尚无库存记录" }}</small>
      </div>
    </dl>

    <p class="weekly-cashflow-formula">
      <strong>计算口径</strong>
      <span>本周收获 = 库存净变化 + 已记录的银子支出</span>
      <em>{{ activity.weekStart }} 至 {{ activity.reportEnd }}</em>
    </p>

    <section class="weekly-account-breakdown" aria-labelledby="weekly-account-title">
      <header>
        <div><h4 id="weekly-account-title">各账号本周情况</h4><span>固定展示五个账号，支出和任务分别归集</span></div>
        <strong>{{ activity.accountSummaries.length }} 个账号</strong>
      </header>
      <div class="weekly-account-table" role="table" aria-label="五账号本周情况">
        <div class="weekly-account-table-head" role="row">
          <span role="columnheader">账号</span><span role="columnheader">收获</span><span role="columnheader">支出</span><span role="columnheader">净变化</span><span role="columnheader">当前库存</span><span role="columnheader">完成任务</span>
        </div>
        <article v-for="account in activity.accountSummaries" :key="account.accountId" class="weekly-account-row" role="row" :data-account-id="account.accountId">
          <strong :class="`account-pill account-${account.accountId.toLowerCase()}`" role="rowheader">{{ account.accountId }}</strong>
          <span class="account-harvest" data-label="收获" role="cell"><b>{{ wanLabel(account.harvestedSilverWan) }}</b></span>
          <span class="account-expense" data-label="支出" role="cell"><b>{{ wanLabel(account.totalSilverExpenseWan) }}</b><small>任务 {{ numberLabel(account.taskSilverExpenseWan) }} · 其他 {{ numberLabel(account.manualSilverExpenseWan) }}</small></span>
          <span data-label="净变化" role="cell"><b>{{ wanLabel(account.inventoryNetChangeWan, true) }}</b></span>
          <span data-label="当前库存" role="cell"><b>{{ wanLabel(account.currentSilverWan) }}</b></span>
          <span class="weekly-account-task" data-label="完成任务" role="cell"><b>{{ account.taskCompletions.length }} 项</b><small>{{ accountTaskSummary(account) }}</small></span>
        </article>
      </div>
      <p v-if="activity.unassignedManualSilverExpenseWan > 0" class="weekly-account-warning">
        旧记录中有 {{ wanLabel(activity.unassignedManualSilverExpenseWan) }} 支出未分账号：已计入总览，未计入单账号小计。
      </p>
    </section>

    <form v-if="expenseFormOpen" class="weekly-expense-form" aria-label="补记其他银子支出" @submit.prevent="saveExpense">
      <label><span>支出账号</span><select v-model="expenseAccountId" aria-label="其他支出账号" required><option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.label }}</option></select></label>
      <label><span>支出日期</span><input v-model="expenseDate" type="date" :min="activity.weekStart" :max="activity.reportEnd" aria-label="其他支出日期" required /></label>
      <label><span>金额 / 万</span><input v-model.number="expenseAmount" type="number" min="0.01" step="0.01" inputmode="decimal" aria-label="其他支出金额（万）" placeholder="0" required /></label>
      <label class="weekly-expense-note"><span>用途</span><input v-model="expenseNote" type="text" maxlength="80" aria-label="其他支出用途" placeholder="例如：购买普通蛋" required /></label>
      <div class="weekly-expense-form-actions">
        <button class="button secondary" type="button" @click="cancelExpenseForm">取消</button>
        <button class="button primary" type="submit">保存支出</button>
      </div>
      <p v-if="expenseError" role="alert">{{ expenseError }}</p>
    </form>

    <p v-if="actionNotice" class="weekly-activity-notice" role="status" aria-live="polite">{{ actionNotice }}</p>

    <div class="weekly-activity-ledgers">
      <section aria-labelledby="weekly-completed-title">
        <header><h4 id="weekly-completed-title">完成任务</h4><span>{{ activity.taskCompletions.length }} 项</span></header>
        <ul v-if="activity.taskCompletions.length">
          <li v-for="task in activity.taskCompletions" :key="task.taskId">
            <time :datetime="task.completedOn">{{ shortDate(task.completedOn) }}</time>
            <strong :class="`account-pill account-${task.accountId.toLowerCase()}`">{{ task.accountId }}</strong>
            <span><b>{{ task.typeLabel }} · {{ task.actionLabel }}</b><small>{{ task.taskKind }}</small></span>
            <em :class="{ silver: task.silverSpentWan > 0 }">{{ taskCompletionResourceLabel(task) }}</em>
          </li>
        </ul>
        <p v-else>本周还没有标记完成的任务。</p>
      </section>

      <section class="manual-expense-ledger" aria-labelledby="weekly-expense-title">
        <header><h4 id="weekly-expense-title">其他银子支出</h4><span>{{ activity.manualExpenses.length }} 笔</span></header>
        <ul v-if="activity.manualExpenses.length">
          <li v-for="expense in activity.manualExpenses" :key="expense.id">
            <time :datetime="expense.effectiveDate">{{ shortDate(expense.effectiveDate) }}</time>
            <span><b>{{ expense.note }}</b><small>{{ expense.accountId || "未分账号" }} · 手动补记</small></span>
            <em class="silver">{{ numberLabel(expense.amountWan) }} 万</em>
            <button type="button" :aria-label="`删除支出：${expense.note}`" title="删除这笔支出" @click="removeExpense(expense.id, expense.note)"><AppIcon name="trash" /></button>
          </li>
        </ul>
        <p v-else>任务外的银子消费，可以用“补记其他支出”记录。</p>
      </section>
    </div>

    <Teleport to="body">
      <div v-if="previewUrl" class="weekly-report-preview-backdrop" @click.self="closePreview">
        <section class="weekly-report-preview" role="dialog" aria-modal="true" aria-labelledby="weekly-preview-title" @keydown="handlePreviewKeydown">
          <header>
            <div><h2 id="weekly-preview-title">本周周报图片</h2><p>{{ activity.weekStart }} 至 {{ activity.reportEnd }}，确认后可下载保存。</p></div>
            <button ref="previewClose" type="button" aria-label="关闭周报图片预览" @click="closePreview"><AppIcon name="close" /></button>
          </header>
          <div class="weekly-report-preview-image"><img :src="previewUrl" alt="生成的本周银子与任务周报图片预览" /></div>
          <footer>
            <button class="button secondary" type="button" @click="closePreview">关闭</button>
            <button class="button primary" type="button" @click="downloadPreview"><AppIcon name="download" />下载 PNG</button>
          </footer>
        </section>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.weekly-activity-panel {
  margin: 12px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--radar-cyan) 28%, var(--radar-line));
  border-radius: 8px;
  background: #ffffff;
}

.weekly-activity-head {
  min-height: 84px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 13px 14px;
  border-bottom: 1px solid var(--radar-line);
  background: linear-gradient(105deg, color-mix(in srgb, var(--radar-cyan) 9%, #ffffff), #ffffff 64%);
}

.weekly-activity-head p {
  margin: 0 0 2px;
  color: var(--radar-cyan-strong);
  font-size: 11px !important;
  font-weight: 850;
  letter-spacing: .06em;
}

.weekly-activity-head h3 {
  color: var(--radar-ink);
  font-size: 19px;
  line-height: 1.3;
}

.weekly-activity-head > div:first-child > span {
  display: block;
  margin-top: 3px;
  color: var(--radar-muted);
  font-size: 12px;
  line-height: 1.4;
}

.weekly-activity-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.weekly-activity-actions .button {
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding-inline: 13px;
  font-size: 13px;
  white-space: nowrap;
}

.weekly-activity-actions :deep(svg),
.weekly-report-preview footer :deep(svg) {
  width: 17px;
  height: 17px;
}

.weekly-generate-button[aria-busy="true"] :deep(svg) {
  animation: weekly-report-spin .75s linear infinite;
}

.weekly-cashflow-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-bottom: 1px solid var(--radar-line);
}

.weekly-cashflow-metrics > div {
  min-width: 0;
  min-height: 112px;
  padding: 16px;
  border-right: 1px solid var(--radar-line);
  background: #ffffff;
}

.weekly-cashflow-metrics > div:last-child { border-right: 0; }
.weekly-cashflow-metrics > div.harvest { background: color-mix(in srgb, var(--radar-cyan) 8%, #ffffff); }
.weekly-cashflow-metrics > div.expense { background: #fffaf1; }

.weekly-cashflow-metrics dt {
  color: var(--radar-muted);
  font-size: 12px;
  font-weight: 800;
}

.weekly-cashflow-metrics dd {
  overflow: hidden;
  margin: 7px 0 5px;
  color: var(--radar-ink);
  font-size: 24px;
  font-weight: 900;
  letter-spacing: -.03em;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weekly-cashflow-metrics .harvest dd { color: var(--radar-success); }
.weekly-cashflow-metrics .expense dd { color: #9a5a00; }

.weekly-cashflow-metrics small {
  display: block;
  overflow: hidden;
  color: var(--radar-muted);
  font-size: 11px;
  font-weight: 650;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weekly-cashflow-formula {
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: 8px 14px;
  border-bottom: 1px solid var(--radar-line);
  color: var(--radar-muted);
  background: var(--radar-surface-2);
  font-size: 12px !important;
}

.weekly-cashflow-formula strong { color: var(--radar-cyan-strong); }
.weekly-cashflow-formula em { margin-left: auto; font-style: normal; font-variant-numeric: tabular-nums; }

.weekly-account-breakdown {
  border-bottom: 1px solid var(--radar-line);
  background: #ffffff;
}

.weekly-account-breakdown > header {
  min-height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 9px 14px;
  border-bottom: 1px solid var(--radar-line);
  background: #f7f9f8;
}

.weekly-account-breakdown > header h4 { color: var(--radar-ink); font-size: 14px; }
.weekly-account-breakdown > header span { display: block; margin-top: 2px; color: var(--radar-muted); font-size: 10px; }
.weekly-account-breakdown > header > strong { color: var(--radar-cyan-strong); font-size: 11px; white-space: nowrap; }

.weekly-account-table-head,
.weekly-account-row {
  display: grid;
  grid-template-columns: 72px repeat(4, minmax(90px, 1fr)) minmax(150px, 1.35fr);
  align-items: center;
  column-gap: 10px;
  padding-inline: 14px;
}

.weekly-account-table-head {
  min-height: 34px;
  border-bottom: 1px solid var(--radar-line);
  color: var(--radar-muted);
  background: var(--radar-surface-2);
  font-size: 10px;
  font-weight: 800;
}

.weekly-account-row {
  min-height: 68px;
  border-bottom: 1px solid var(--radar-line);
}

.weekly-account-row:last-child { border-bottom: 0; }
.weekly-account-row > strong { justify-self: start; }
.weekly-account-row > span { min-width: 0; display: grid; gap: 2px; }
.weekly-account-row > span::before { display: none; content: attr(data-label); }
.weekly-account-row b { overflow: hidden; color: var(--radar-ink); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.weekly-account-row .account-harvest b { color: var(--radar-success); }
.weekly-account-row .account-expense b { color: #9a5a00; }
.weekly-account-row small { overflow: hidden; color: var(--radar-muted); font-size: 9px; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }

.weekly-account-warning {
  margin: 0;
  padding: 9px 14px;
  border-top: 1px solid #ecd8b0;
  color: #8a5700;
  background: #fff8eb;
  font-size: 11px !important;
  font-weight: 700;
}

.weekly-expense-form {
  display: grid;
  grid-template-columns: 120px 160px 140px minmax(200px, 1fr) auto;
  align-items: end;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid color-mix(in srgb, #d59224 32%, var(--radar-line));
  background: #fffaf1;
}

.weekly-expense-form label { display: grid; gap: 5px; }
.weekly-expense-form label > span { color: var(--radar-muted); font-size: 11px; font-weight: 800; }
.weekly-expense-form :is(input, select) {
  width: 100%;
  height: 40px;
  padding: 0 10px;
  border: 1px solid var(--radar-line-strong);
  border-radius: 6px;
  color: var(--radar-ink);
  background: #ffffff;
  font: inherit;
}

.weekly-expense-form :is(input, select):focus { border-color: var(--radar-cyan); outline: 2px solid color-mix(in srgb, var(--radar-cyan) 18%, transparent); }
.weekly-expense-form-actions { display: flex; gap: 7px; }
.weekly-expense-form-actions .button { min-height: 40px; }
.weekly-expense-form > p { grid-column: 1 / -1; margin: 0; color: var(--radar-danger); font-size: 12px; font-weight: 750; }

.weekly-activity-notice {
  margin: 0;
  padding: 9px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--radar-success) 28%, var(--radar-line));
  color: var(--radar-success);
  background: color-mix(in srgb, var(--radar-success) 7%, #ffffff);
  font-size: 12px !important;
  font-weight: 750;
}

.weekly-activity-ledgers {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(300px, .75fr);
}

.weekly-activity-ledgers > section { min-width: 0; }
.weekly-activity-ledgers > section + section { border-left: 1px solid var(--radar-line); }
.weekly-activity-ledgers section > header {
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--radar-line);
  background: #f7f9f8;
}

.weekly-activity-ledgers h4 { color: var(--radar-ink); font-size: 14px; }
.weekly-activity-ledgers header span { color: var(--radar-muted); font-size: 11px; font-weight: 800; }
.weekly-activity-ledgers ul { max-height: 260px; overflow: auto; margin: 0; padding: 0; list-style: none; }
.weekly-activity-ledgers li {
  min-height: 58px;
  display: grid;
  grid-template-columns: 48px auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--radar-line);
}

.weekly-activity-ledgers li:last-child { border-bottom: 0; }
.weekly-activity-ledgers time { color: var(--radar-muted); font-size: 11px; font-weight: 750; white-space: nowrap; }
.weekly-activity-ledgers li > span { min-width: 0; display: grid; gap: 2px; }
.weekly-activity-ledgers li b { overflow: hidden; color: var(--radar-ink); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.weekly-activity-ledgers li small { color: var(--radar-muted); font-size: 10px; }
.weekly-activity-ledgers li em { color: var(--radar-muted); font-size: 11px; font-style: normal; font-weight: 800; white-space: nowrap; }
.weekly-activity-ledgers li em.silver { color: #9a5a00; }
.weekly-activity-ledgers li > button {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 5px;
  color: var(--radar-muted);
  background: transparent;
}
.weekly-activity-ledgers li > button:hover { color: var(--radar-danger); background: color-mix(in srgb, var(--radar-danger) 8%, #ffffff); }
.weekly-activity-ledgers li > button :deep(svg) { width: 16px; height: 16px; }
.weekly-activity-ledgers section > p { min-height: 78px; display: grid; place-items: center; margin: 0; padding: 14px; color: var(--radar-muted); font-size: 12px !important; text-align: center; }

.weekly-report-preview-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(10, 24, 22, .72);
  backdrop-filter: blur(5px);
}

.weekly-report-preview {
  width: min(880px, 100%);
  max-height: calc(100vh - 48px);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  border: 1px solid var(--radar-line);
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 24px 70px rgba(0, 0, 0, .34);
}

.weekly-report-preview > header,
.weekly-report-preview > footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--radar-line);
}

.weekly-report-preview > header h2 { color: var(--radar-ink); font-size: 20px; }
.weekly-report-preview > header p { margin-top: 3px; color: var(--radar-muted); font-size: 12px; }
.weekly-report-preview > header > button {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border: 1px solid var(--radar-line);
  border-radius: 7px;
  color: var(--radar-muted);
  background: #ffffff;
}
.weekly-report-preview > header > button :deep(svg) { width: 18px; height: 18px; }
.weekly-report-preview-image { overflow: auto; padding: 18px; background: #e7edeb; }
.weekly-report-preview-image img { display: block; width: min(540px, 100%); height: auto; margin: 0 auto; border-radius: 8px; box-shadow: 0 12px 32px rgba(20, 37, 34, .18); }
.weekly-report-preview > footer { justify-content: flex-end; border-top: 1px solid var(--radar-line); border-bottom: 0; }
.weekly-report-preview > footer .button { min-height: 42px; display: inline-flex; align-items: center; gap: 7px; }

@keyframes weekly-report-spin { to { transform: rotate(360deg); } }

@media (max-width: 920px) {
  .weekly-cashflow-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .weekly-cashflow-metrics > div:nth-child(2) { border-right: 0; }
  .weekly-cashflow-metrics > div:nth-child(-n + 2) { border-bottom: 1px solid var(--radar-line); }
  .weekly-account-table-head,
  .weekly-account-row { grid-template-columns: 62px repeat(4, minmax(74px, 1fr)) minmax(130px, 1.25fr); column-gap: 7px; padding-inline: 10px; }
  .weekly-expense-form { grid-template-columns: 120px 150px 140px minmax(180px, 1fr); }
  .weekly-expense-form-actions { grid-column: 1 / -1; justify-content: flex-end; }
}

@media (max-width: 720px) {
  .weekly-activity-panel { margin: 10px; }
  .weekly-activity-head { align-items: stretch; flex-direction: column; gap: 12px; padding: 12px; }
  .weekly-activity-head h3 { font-size: 18px; }
  .weekly-activity-actions { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); }
  .weekly-activity-actions .button { min-height: 44px; padding-inline: 8px; }
  .weekly-cashflow-metrics > div { min-height: 104px; padding: 13px 12px; }
  .weekly-cashflow-metrics dd { font-size: 21px; }
  .weekly-cashflow-metrics small { white-space: normal; }
  .weekly-cashflow-formula { align-items: flex-start; flex-wrap: wrap; gap: 3px 8px; padding: 9px 12px; }
  .weekly-cashflow-formula strong { width: 100%; }
  .weekly-cashflow-formula em { width: 100%; margin-left: 0; }
  .weekly-account-table-head { display: none; }
  .weekly-account-row {
    min-height: 118px;
    grid-template-columns: 58px repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: 8px 12px;
    padding: 12px;
  }
  .weekly-account-row > strong { grid-row: 1 / 4; align-self: stretch; display: grid; place-items: center; }
  .weekly-account-row > span::before { display: block; color: var(--radar-muted); font-size: 9px; font-weight: 800; }
  .weekly-account-row .weekly-account-task { grid-column: 2 / -1; }
  .weekly-account-row b { font-size: 12px; }
  .weekly-account-row small { white-space: normal; }
  .weekly-expense-form { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 12px; }
  .weekly-expense-note { grid-column: 1 / -1; }
  .weekly-expense-form-actions { grid-column: 1 / -1; }
  .weekly-expense-form-actions .button { flex: 1; min-height: 44px; }
  .weekly-activity-ledgers { grid-template-columns: 1fr; }
  .weekly-activity-ledgers > section + section { border-top: 1px solid var(--radar-line); border-left: 0; }
  .weekly-activity-ledgers li { grid-template-columns: 44px auto minmax(0, 1fr) auto; padding-inline: 10px; }
  .weekly-report-preview-backdrop { align-items: end; padding: 0; }
  .weekly-report-preview { width: 100%; max-height: 94vh; border-radius: 12px 12px 0 0; }
  .weekly-report-preview-image { padding: 12px; }
  .weekly-report-preview > footer { padding-bottom: max(14px, env(safe-area-inset-bottom)); }
  .weekly-report-preview > footer .button { flex: 1; min-height: 44px; justify-content: center; }
}

@media (max-width: 430px) {
  .weekly-activity-actions { grid-template-columns: 1fr; }
  .weekly-expense-form { grid-template-columns: 1fr; }
  .weekly-expense-note, .weekly-expense-form-actions { grid-column: 1; }
  .weekly-activity-ledgers li { grid-template-columns: 42px auto minmax(0, 1fr); }
  .weekly-activity-ledgers li em { grid-column: 3; }
  .weekly-activity-ledgers .manual-expense-ledger li { grid-template-columns: 42px minmax(0, 1fr) 32px; }
  .weekly-activity-ledgers .manual-expense-ledger li > span { grid-column: 2; }
  .weekly-activity-ledgers .manual-expense-ledger li em { grid-column: 2; grid-row: 2; justify-self: start; }
  .weekly-activity-ledgers .manual-expense-ledger li > button { grid-column: 3; grid-row: 1 / 3; }
}

@media (prefers-reduced-motion: reduce) {
  .weekly-generate-button[aria-busy="true"] :deep(svg) { animation: none; }
}
</style>
