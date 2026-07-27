<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppIcon from "../../components/AppIcon.vue";
import {
  buildAccountingByAccount,
  normalizeAccountingEntries,
  type AccountingEntry,
  type AccountingResources,
} from "../../domain/accounting";
import { accountIds, type AccountId } from "../../domain/types";
import { useAccountingStore } from "../../stores/accounting";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";
import { shareImageAccountColors } from "../../utils/shareImagePalette";
import {
  buildDailyEarningsShareData,
  createDailyEarningsShareImage,
  type DailyEarningsShareMetric,
} from "./dailyEarningsShareImage";
import { createEarningsShareImage } from "./earningsShareImage";

type DetailView = "ledger" | "intervals";
type AccountScope = "all" | AccountId;

const route = useRoute();
const router = useRouter();
const catalog = useCatalogStore();
const inventory = useInventoryStore();
const accounting = useAccountingStore();
const settings = useSettingsStore();
const ui = useUiStore();

settings.hydrate();
inventory.hydrate();
accounting.hydrate();
ui.hydrate();

function queryAccount(value: unknown): AccountId | null {
  return typeof value === "string" && accountIds.includes(value as AccountId)
    ? value as AccountId
    : null;
}

const initialAccount = queryAccount(route.query.account);
const selectedScope = ref<AccountScope>(initialAccount || "all");
const selectedAccount = ref<AccountId>(initialAccount || ui.recentAccount);
const ledgerNotice = ref("");
const sharingIncome = ref(false);
const sharingDailyIncome = ref(false);
const sharingDailyIncomeWithEggs = ref(false);
const dailyTableMetric = ref<DailyEarningsShareMetric>("silverWan");
const detailView = ref<DetailView>("ledger");
const incomeShareNotice = ref("");
let incomeShareNoticeTimer: number | null = null;

const reportByAccount = computed(() => buildAccountingByAccount({
  inventorySnapshots: inventory.snapshots,
  entries: accounting.entries,
  taskCompletions: settings.taskCompletions,
  silverExpenses: settings.silverExpenses,
  asOfDate: settings.planningAsOfDate,
}));

const summary = computed(() => reportByAccount.value[selectedAccount.value]);
const dailyIncomeShareData = computed(() => buildDailyEarningsShareData(
  reportByAccount.value,
  settings.planningAsOfDate,
));
const dailyIncomeWithEggsShareData = computed(() => buildDailyEarningsShareData(
  reportByAccount.value,
  settings.planningAsOfDate,
  "silverWithRegularEggsWan",
));
const dailyTableData = computed(() => dailyTableMetric.value === "silverWithRegularEggsWan"
  ? dailyIncomeWithEggsShareData.value
  : dailyIncomeShareData.value);
const dailyTableSummaryRows = computed(() => [
  dailyTableData.value.weeklyTotal,
  dailyTableData.value.dailyAverage,
]);
const sharingDailyTable = computed(() => dailyTableMetric.value === "silverWithRegularEggsWan"
  ? sharingDailyIncomeWithEggs.value
  : sharingDailyIncome.value);
const hasDailyIncomeToShare = computed(() => dailyIncomeShareData.value.recordedDays > 0);
const sharingAnyIncome = computed(() => (
  sharingIncome.value
  || sharingDailyIncome.value
  || sharingDailyIncomeWithEggs.value
));
const latestInterval = computed(() => summary.value.intervals.at(-1) || null);
const latestSnapshot = computed(() => inventory.snapshots
  .filter((snapshot) => snapshot.effectiveDate <= settings.planningAsOfDate)
  .at(-1) || null);
const selectedBalance = computed(() => latestSnapshot.value?.accounts[selectedAccount.value] || null);
const normalizedEntries = computed(() => normalizeAccountingEntries({
  entries: accounting.entries,
  taskCompletions: settings.taskCompletions,
  silverExpenses: settings.silverExpenses,
}));
const ledgerEntries = computed(() => normalizedEntries.value
  .filter((entry) => entry.accountId === selectedAccount.value)
  .sort((left, right) => (
    right.effectiveDate.localeCompare(left.effectiveDate)
    || right.occurredAt.localeCompare(left.occurredAt)
    || right.recordedAt.localeCompare(left.recordedAt)
  ))
  .slice(0, 30));
const storedEntryIds = computed(() => new Set(accounting.entries.map((entry) => entry.id)));
const pendingEntryIds = computed(() => new Set(summary.value.pending.entries.map((entry) => entry.id)));
const recentCrossDayIntervals = computed(() => [...summary.value.intervals]
  .filter((interval) => interval.kind !== "daily")
  .reverse()
  .slice(0, 8));
const latestTitle = computed(() => {
  const interval = latestInterval.value;
  if (!interval) return "最近实际所得";
  return interval.kind === "daily"
    ? `${shortDate(interval.toDate)} 实际所得`
    : `最近 ${interval.intervalDays} 天实际所得`;
});
const shareButtonText = computed(() => latestInterval.value?.kind === "daily"
  ? `${selectedAccount.value}·当日`
  : `${selectedAccount.value}·区间`);
const shareButtonLabel = computed(() => latestInterval.value
  ? `分享 ${selectedAccount.value} ${latestTitle.value}图片`
  : `${selectedAccount.value} 暂无可分享的实际所得`);
const dailyShareButtonLabel = computed(() => hasDailyIncomeToShare.value
  ? `分享五个账号 ${dailyIncomeShareData.value.weekStart} 至 ${dailyIncomeShareData.value.weekEnd} 每日实际所得图片`
  : "本周暂无可分享的五账号每日实际所得");
const dailyWithEggsShareButtonLabel = computed(() => hasDailyIncomeToShare.value
  ? `分享五个账号 ${dailyIncomeWithEggsShareData.value.weekStart} 至 ${dailyIncomeWithEggsShareData.value.weekEnd} 每日实际所得银加蛋折银图片`
  : "本周暂无可分享的五账号每日实际所得银加蛋折银");
const dailyTableShareButtonLabel = computed(() => dailyTableMetric.value === "silverWithRegularEggsWan"
  ? dailyWithEggsShareButtonLabel.value
  : dailyShareButtonLabel.value);
watch(() => route.query.account, (value) => {
  const next = queryAccount(value);
  selectedScope.value = next || "all";
  if (next && next !== selectedAccount.value) selectedAccount.value = next;
});

watch(selectedAccount, (accountId) => {
  ui.recentAccount = accountId;
});

onBeforeUnmount(() => {
  if (incomeShareNoticeTimer !== null) window.clearTimeout(incomeShareNoticeTimer);
});

function selectAccount(scope: AccountScope) {
  selectedScope.value = scope;
  if (scope === "all") {
    const query = { ...route.query };
    delete query.account;
    void router.replace({ query });
    return;
  }
  const accountId = scope;
  selectedAccount.value = accountId;
  void router.replace({
    query: { ...route.query, account: accountId },
  });
}

function numberLabel(value: number, suffix = "") {
  const normalized = Number(value.toFixed(2));
  return `${normalized > 0 ? "+" : ""}${normalized.toLocaleString("zh-CN", {
    maximumFractionDigits: 2,
  })}${suffix}`;
}

function dailyTableValueLabel(value: number | null) {
  return value === null ? "—" : numberLabel(value);
}

function dailyTableValueTone(value: number | null) {
  if (value === null) return "unknown";
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function compactDailyBasis(value: string) {
  return value
    .replace("连续库存 · ", "")
    .replace("尚未到日期", "未到日期")
    .replace(/^\d+ 天区间，非单日$/, "跨天区间");
}

function wanLabel(value: number | null | undefined, signed = true) {
  if (value === null || value === undefined) return "—";
  const normalized = Number(value.toFixed(2));
  return `${signed && normalized > 0 ? "+" : ""}${normalized.toLocaleString("zh-CN", {
    maximumFractionDigits: 2,
  })} 万`;
}

function inventoryCountLabel(value: number | null | undefined, suffix: string) {
  if (value === undefined) return "—";
  if (value === null) return "未知";
  return `${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })} ${suffix}`;
}

function shortDate(date: string) {
  const [, month, day] = date.split("-").map(Number);
  return `${month}月${day}日`;
}

function intervalRange(entry: { fromDate: string; toDate: string }) {
  return `${shortDate(entry.fromDate)} → ${shortDate(entry.toDate)}`;
}

function showIncomeShareNotice(message: string) {
  incomeShareNotice.value = message;
  if (incomeShareNoticeTimer !== null) window.clearTimeout(incomeShareNoticeTimer);
  incomeShareNoticeTimer = window.setTimeout(() => {
    incomeShareNotice.value = "";
    incomeShareNoticeTimer = null;
  }, 2_800);
}

function downloadShareImage(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function shareDailyIncome(metric: DailyEarningsShareMetric = "silverWan") {
  if (!hasDailyIncomeToShare.value || sharingAnyIncome.value) return;
  const withEggs = metric === "silverWithRegularEggsWan";
  const sharingState = withEggs ? sharingDailyIncomeWithEggs : sharingDailyIncome;
  sharingState.value = true;

  try {
    const data = withEggs
      ? dailyIncomeWithEggsShareData.value
      : dailyIncomeShareData.value;
    const blob = createDailyEarningsShareImage(data);
    const fileName = withEggs
      ? `五号每日实际所得-银加蛋折银-${data.weekStart}-${data.weekEnd}.png`
      : `五号每日实际所得-${data.weekStart}-${data.weekEnd}.png`;
    const file = new File([blob], fileName, { type: "image/png" });
    const nativeShareData: ShareData = {
      files: [file],
      title: withEggs ? "五号每日实际所得 · 银+蛋折银" : "五号每日实际所得",
    };
    const supportsFileShare = typeof navigator.share === "function"
      && typeof navigator.canShare === "function"
      && navigator.canShare(nativeShareData);

    if (supportsFileShare) {
      try {
        await navigator.share(nativeShareData);
        showIncomeShareNotice(withEggs
          ? "五号银+蛋折银图片已打开系统分享"
          : "五号每日所得图片已打开系统分享");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    downloadShareImage(blob, fileName);
    showIncomeShareNotice(withEggs
      ? "五号银+蛋折银图片已下载"
      : "五号每日所得图片已下载");
  } catch {
    showIncomeShareNotice("图片生成失败，请重试");
  } finally {
    sharingState.value = false;
  }
}

function shareVisibleDailyIncome() {
  void shareDailyIncome(dailyTableMetric.value);
}

async function shareLatestIncome() {
  const interval = latestInterval.value;
  if (!interval || sharingAnyIncome.value) return;
  sharingIncome.value = true;

  try {
    const blob = createEarningsShareImage({
      accountId: selectedAccount.value,
      accountTone: shareImageAccountColors[selectedAccount.value],
      kind: interval.kind,
      fromDate: interval.fromDate,
      toDate: interval.toDate,
      intervalDays: interval.intervalDays,
      inventoryNetChange: interval.inventoryNetChange,
      ledgerImpact: interval.ledgerImpact,
      actualIncome: interval.actualIncome,
      settledEntryCount: interval.entries.length,
    });
    const reportName = interval.kind === "daily" ? "每日实际所得" : "区间实际所得";
    const rangeName = interval.kind === "daily"
      ? interval.toDate
      : `${interval.fromDate}-${interval.toDate}`;
    const fileName = `${selectedAccount.value}-${rangeName}-${reportName}.png`;
    const file = new File([blob], fileName, { type: "image/png" });
    const nativeShareData: ShareData = {
      files: [file],
      title: `${selectedAccount.value} ${reportName}`,
    };
    const supportsFileShare = typeof navigator.share === "function"
      && typeof navigator.canShare === "function"
      && navigator.canShare(nativeShareData);

    if (supportsFileShare) {
      try {
        await navigator.share(nativeShareData);
        showIncomeShareNotice("实际所得图片已打开系统分享");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    downloadShareImage(blob, fileName);
    showIncomeShareNotice("实际所得图片已下载");
  } catch {
    showIncomeShareNotice("图片生成失败，请重试");
  } finally {
    sharingIncome.value = false;
  }
}

function entryKind(entry: AccountingEntry) {
  const kinds = new Set(entry.legs.map((leg) => leg.kind));
  if (kinds.has("transfer-out")) return "转出";
  if (kinds.has("transfer-in")) return "转入";
  if (kinds.has("adjustment-increase")) return "非收益增加";
  if (kinds.has("adjustment-decrease")) return "非收益减少";
  if (entry.source === "task-progress") return "任务进度";
  if (entry.taskId) return "任务支出";
  return "其他支出";
}

function entryTone(entry: AccountingEntry) {
  const kind = entry.legs[0]?.kind;
  if (kind === "transfer-in" || kind === "transfer-out") return "transfer";
  if (kind === "adjustment-increase" || kind === "adjustment-decrease") return "adjustment";
  return "expense";
}

function entryResourceText(entry: AccountingEntry) {
  const totals = entry.legs.reduce<AccountingResources>((sum, leg) => ({
    silverWan: sum.silverWan + leg.resources.silverWan,
    dedicatedEggs: sum.dedicatedEggs + leg.resources.dedicatedEggs,
    regularEggs: sum.regularEggs + leg.resources.regularEggs,
    innerShards: (sum.innerShards || 0) + (leg.resources.innerShards || 0),
  }), {
    silverWan: 0,
    dedicatedEggs: 0,
    regularEggs: 0,
    innerShards: 0,
  });
  const parts = [
    totals.silverWan ? `${Number(totals.silverWan.toFixed(2)).toLocaleString("zh-CN")} 万银子` : "",
    totals.dedicatedEggs ? `${totals.dedicatedEggs} 专用蛋` : "",
    totals.regularEggs ? `${totals.regularEggs} 普通蛋` : "",
    totals.innerShards ? `${totals.innerShards} 碎片` : "",
  ].filter(Boolean);
  return parts.join(" · ") || "0 支出";
}

function canVoid(entry: AccountingEntry) {
  return storedEntryIds.value.has(entry.id) && (entry.status || "confirmed") === "confirmed";
}

function voidLedgerEntry(entry: AccountingEntry) {
  if (!canVoid(entry)) return;
  const linked = entry.groupId ? "，同一笔转账的两端会一起撤销" : "";
  if (!confirm(`确认撤销这笔“${entryKind(entry)}”记录${linked}？库存不会改变。`)) return;
  if (accounting.voidEntry(entry.id)) {
    ledgerNotice.value = "已撤销实际流水；库存没有变化。";
  }
}
</script>

<template>
  <div class="earnings-page" data-testid="earnings-page">
    <header class="earnings-intro">
      <div>
        <h1>实际所得</h1>
        <span>按库存变化核算 · 不改库存</span>
      </div>
    </header>

    <nav class="earnings-account-tabs" aria-label="选择核算账号">
      <button
        type="button"
        :class="{ active: selectedScope === 'all' }"
        :aria-pressed="selectedScope === 'all'"
        aria-label="查看所有账号实际所得"
        @click="selectAccount('all')"
      >
        <strong>全部</strong>
        <span>5 个账号</span>
      </button>
      <button
        v-for="account in catalog.data.accounts"
        :key="account.id"
        type="button"
        :class="[{ active: selectedScope === account.id }, `account-${account.id.toLowerCase()}`]"
        :aria-pressed="selectedScope === account.id"
        :aria-label="`查看 ${account.id} 实际所得`"
        @click="selectAccount(account.id)"
      >
        <strong>{{ account.id }}</strong>
        <span>{{ latestSnapshot?.effectiveDate ? shortDate(latestSnapshot.effectiveDate) : "待录库存" }}</span>
      </button>
    </nav>

    <p v-if="ledgerNotice" class="ledger-notice" role="status">{{ ledgerNotice }}</p>

    <main class="earnings-workspace">
      <section class="earnings-summary" aria-label="实际所得概览">
        <section v-if="selectedScope === 'all'" class="daily-earnings-table" aria-labelledby="daily-earnings-table-title">
          <header>
            <div>
              <p>本周五号 · 单位：万</p>
              <h2 id="daily-earnings-table-title">五账号每日实际所得</h2>
            </div>
            <div class="daily-table-actions">
              <div class="daily-metric-toggle" role="group" aria-label="切换五账号每日所得口径">
                <button
                  type="button"
                  :class="{ active: dailyTableMetric === 'silverWan' }"
                  :aria-pressed="dailyTableMetric === 'silverWan'"
                  @click="dailyTableMetric = 'silverWan'"
                >
                  银子
                </button>
                <button
                  type="button"
                  :class="{ active: dailyTableMetric === 'silverWithRegularEggsWan' }"
                  :aria-pressed="dailyTableMetric === 'silverWithRegularEggsWan'"
                  @click="dailyTableMetric = 'silverWithRegularEggsWan'"
                >
                  银+蛋折银
                </button>
              </div>
              <button
                class="earnings-share-button combined daily-table-share"
                type="button"
                :disabled="!hasDailyIncomeToShare || sharingAnyIncome"
                :aria-busy="sharingDailyTable"
                :aria-label="dailyTableShareButtonLabel"
                @click="shareVisibleDailyIncome"
              >
                <AppIcon :name="sharingDailyTable ? 'refresh' : 'share'" />
                <span>{{ sharingDailyTable ? "生成中…" : "分享表格" }}</span>
              </button>
            </div>
          </header>
          <div class="daily-table-meta">
            <span>{{ shortDate(dailyTableData.weekStart) }}—{{ shortDate(dailyTableData.weekEnd) }}</span>
            <b>{{ dailyTableData.recordedDays }} / 7 天已结算</b>
          </div>
          <div class="daily-table-scroll" tabindex="0" aria-label="五账号每日实际所得表格，可横向滚动">
            <table data-testid="five-account-daily-table">
              <caption class="visually-hidden">
                五账号本周每日实际所得（{{ dailyTableData.metricLabel }}）
              </caption>
              <colgroup>
                <col class="daily-date-column">
                <col v-for="accountId in accountIds" :key="accountId" class="daily-value-column">
                <col class="daily-total-column">
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">日期</th>
                  <th v-for="accountId in accountIds" :key="accountId" scope="col">{{ accountId }}</th>
                  <th scope="col">合计</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in dailyTableData.rows"
                  :key="row.date"
                  :data-date="row.date"
                  :class="{ unsettled: row.total === null }"
                >
                  <th scope="row" :title="row.basis">
                    <strong>{{ row.label }}</strong>
                    <small>{{ compactDailyBasis(row.basis) }}</small>
                  </th>
                  <td
                    v-for="accountId in accountIds"
                    :key="accountId"
                    :data-account-id="accountId"
                    :class="dailyTableValueTone(row.values[accountId])"
                  >
                    {{ dailyTableValueLabel(row.values[accountId]) }}
                  </td>
                  <td class="daily-total" :class="dailyTableValueTone(row.total)">
                    {{ dailyTableValueLabel(row.total) }}
                  </td>
                </tr>
                <tr
                  v-for="row in dailyTableSummaryRows"
                  :key="row.label"
                  class="daily-summary-row"
                  :class="{ average: row.label === '结算日均' }"
                >
                  <th scope="row">
                    <strong>{{ row.label }}</strong>
                    <small>{{ row.basis }}</small>
                  </th>
                  <td
                    v-for="accountId in accountIds"
                    :key="accountId"
                    :data-account-id="accountId"
                    :class="dailyTableValueTone(row.values[accountId])"
                  >
                    {{ dailyTableValueLabel(row.values[accountId]) }}
                  </td>
                  <td class="daily-total" :class="dailyTableValueTone(row.total)">
                    {{ dailyTableValueLabel(row.total) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <p v-if="incomeShareNotice" class="income-share-notice" role="status">{{ incomeShareNotice }}</p>

        <section v-if="selectedScope !== 'all'" class="selected-account-overview" aria-labelledby="selected-account-overview-title">
          <header>
            <div>
              <p>{{ selectedAccount }} 账号</p>
              <h2 id="selected-account-overview-title">当前库存</h2>
            </div>
            <button
              class="earnings-share-button account account-overview-share"
              type="button"
              :disabled="!latestInterval || sharingAnyIncome"
              :aria-busy="sharingIncome"
              :aria-label="shareButtonLabel"
              @click="shareLatestIncome"
            >
              <AppIcon :name="sharingIncome ? 'refresh' : 'share'" />
              <span>{{ sharingIncome ? "生成中…" : shareButtonText }}</span>
            </button>
          </header>
          <dl class="selected-account-metrics">
            <div>
              <dt>银子</dt>
              <dd>{{ wanLabel(selectedBalance?.silverWan, false) }}</dd>
              <small>{{ summary.latestSnapshotDate ? shortDate(summary.latestSnapshotDate) : "待录库存" }}</small>
            </div>
            <div>
              <dt>专用蛋</dt>
              <dd>{{ inventoryCountLabel(selectedBalance?.dedicatedEggs, "个") }}</dd>
              <small>当前库存</small>
            </div>
            <div>
              <dt>普通蛋</dt>
              <dd>{{ inventoryCountLabel(selectedBalance?.regularEggs, "个") }}</dd>
              <small>当前库存</small>
            </div>
            <div>
              <dt>碎片</dt>
              <dd>{{ inventoryCountLabel(selectedBalance?.innerShardCount, "片") }}</dd>
              <small>当前库存</small>
            </div>
          </dl>

          <aside v-if="summary.pending.entries.length" class="pending-ledger" aria-label="等待下次库存核销的流水">
            <span><AppIcon name="refresh" /></span>
            <div><strong>{{ summary.pending.entries.length }} 笔流水等待下次库存核销</strong><p>发生在 {{ summary.pending.afterSnapshotDate ? `${shortDate(summary.pending.afterSnapshotDate)} 库存记录之后` : "首份库存之前" }}，暂不并入已结算所得，避免重复计算。</p></div>
            <b>{{ wanLabel(summary.pending.ledgerImpact.silverWan) }}</b>
          </aside>
        </section>
      </section>

      <details v-if="selectedScope !== 'all'" class="accounting-rule">
        <summary>
          <span class="accounting-rule-icon"><AppIcon name="analysis" /></span>
          <span class="accounting-rule-copy">
            <small>核算说明</small>
            <strong>实际所得 = 库存净变化 + 流水修正</strong>
          </span>
          <span class="accounting-rule-action">查看口径 <AppIcon name="chevron-right" /></span>
        </summary>
        <div class="accounting-rule-content">
          <ol>
            <li><b>先看真实库存</b><span>结束库存 − 开始库存</span></li>
            <li><b>再加回已确认支出</b><span>任务、打书、洗护符和其他支出</span></li>
            <li><b>排除非收益变化</b><span>账号转移与手动调整不算所得</span></li>
          </ol>
          <RouterLink to="/plans/tasks">去维护任务 <AppIcon name="chevron-right" /></RouterLink>
        </div>
      </details>
    </main>

    <section v-if="selectedScope !== 'all'" class="earnings-detail-panel" aria-labelledby="earnings-detail-title">
      <header>
        <div>
          <p>当前账号明细</p>
          <h2 id="earnings-detail-title">{{ selectedAccount }} 核算记录</h2>
        </div>
        <div class="earnings-detail-tabs" role="tablist" aria-label="选择核算记录类型">
          <button
            id="ledger-tab"
            type="button"
            role="tab"
            aria-controls="ledger-panel"
            :aria-selected="detailView === 'ledger'"
            :class="{ active: detailView === 'ledger' }"
            @click="detailView = 'ledger'"
          >
            实际流水 <span>{{ ledgerEntries.length }}</span>
          </button>
          <button
            id="interval-tab"
            type="button"
            role="tab"
            aria-controls="interval-panel"
            :aria-selected="detailView === 'intervals'"
            :class="{ active: detailView === 'intervals' }"
            @click="detailView = 'intervals'"
          >
            跨天区间 <span>{{ recentCrossDayIntervals.length }}</span>
          </button>
        </div>
      </header>

      <section
        v-if="detailView === 'ledger'"
        id="ledger-panel"
        class="ledger-history"
        role="tabpanel"
        aria-labelledby="ledger-tab"
      >
        <div v-if="ledgerEntries.length" class="ledger-list">
          <article v-for="entry in ledgerEntries" :key="entry.id" :class="{ void: entry.status === 'void' }">
            <span :class="['ledger-kind', entryTone(entry)]">{{ entryKind(entry) }}</span>
            <div>
              <strong>{{ entryResourceText(entry) }}</strong>
              <p>{{ entry.note || "未填写备注" }}</p>
              <small>{{ entry.effectiveDate }}<template v-if="pendingEntryIds.has(entry.id)"> · 等待库存核销</template><template v-if="entry.status === 'void'"> · 已撤销</template></small>
            </div>
            <button v-if="canVoid(entry)" type="button" @click="voidLedgerEntry(entry)">撤销</button>
          </article>
        </div>
        <p v-else class="earnings-empty">还没有支出、转账或调整记录。完成任务时会自动进入这里。</p>
      </section>

      <section
        v-else
        id="interval-panel"
        class="interval-history"
        role="tabpanel"
        aria-labelledby="interval-tab"
      >
        <div v-if="recentCrossDayIntervals.length" class="interval-list">
          <article v-for="interval in recentCrossDayIntervals" :key="`${interval.fromRecordedAt}:${interval.toRecordedAt}`">
            <div><strong>{{ interval.intervalDays }} 天区间</strong><span>{{ intervalRange(interval) }}</span></div>
            <dl>
              <div><dt>实际所得</dt><dd>{{ wanLabel(interval.actualIncome.silverWan) }}</dd></div>
              <div><dt>库存变化</dt><dd>{{ wanLabel(interval.inventoryNetChange.silverWan) }}</dd></div>
              <div><dt>流水修正</dt><dd>{{ wanLabel(interval.ledgerImpact.silverWan) }}</dd></div>
            </dl>
          </article>
        </div>
        <p v-else class="earnings-empty">每日记录已在上表展示；只有缺天形成的跨天区间才会列在这里。</p>
      </section>
    </section>
  </div>
</template>

<style scoped>
.earnings-page {
  width: min(100%, 1320px);
  margin: 0 auto;
  padding: 14px clamp(16px, 2vw, 28px) 60px;
  color: var(--color-text);
}

.earnings-intro {
  min-height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 0 4px 10px;
  border-bottom: 1px solid var(--color-border);
}
.earnings-intro > div { min-width: 0; }
.daily-earnings-table > header p,
.selected-account-overview > header p,
.earnings-detail-panel > header p {
  color: var(--color-accent-strong);
  font-size: 10px;
  font-weight: 850;
  letter-spacing: .09em;
}
.earnings-intro h1 { font-size: 26px; line-height: 1.2; letter-spacing: -.04em; }
.earnings-intro > div > span { display: block; margin-top: 2px; color: var(--color-text-muted); font-size: 12px; line-height: 1.35; white-space: nowrap; }

.earnings-account-tabs {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  overflow: hidden;
  margin-top: 14px;
  border: 1px solid var(--color-border);
  border-radius: 13px;
  background: var(--color-surface);
}
.earnings-account-tabs button {
  min-width: 0;
  min-height: 68px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 2px;
  padding: 8px;
  border: 0;
  border-right: 1px solid var(--color-border);
  color: var(--color-text);
  background: var(--color-surface);
  font: inherit;
}
.earnings-account-tabs button:last-child { border-right: 0; }
.earnings-account-tabs button strong { font-size: 15px; }
.earnings-account-tabs button span { color: var(--color-text-muted); font-size: 10px; font-weight: 750; }
.earnings-account-tabs button.active {
  color: var(--color-accent-strong);
  background: var(--color-accent-soft);
  box-shadow: inset 0 -3px var(--color-accent);
}
.earnings-account-tabs button.active span { color: var(--color-accent-strong); }

.daily-earnings-table,
.selected-account-overview,
.accounting-rule,
.earnings-detail-panel {
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-surface);
  box-shadow: 0 7px 20px rgba(17, 24, 39, .055);
}
.selected-account-overview > header,
.earnings-detail-panel > header {
  min-height: 62px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-subtle);
}
.selected-account-overview > header h2,
.earnings-detail-panel > header h2 { margin-top: 1px; font-size: 18px; }
.ledger-notice { margin-top: 10px; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 9px; color: var(--color-success); background: #effaf4; font-size: 12px; font-weight: 750; }

.earnings-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  margin-top: 14px;
}
.earnings-summary { min-width: 0; display: grid; gap: 12px; }
.earnings-share-button {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--color-accent) 55%, var(--color-border));
  border-radius: 8px;
  color: var(--color-accent-strong);
  background: color-mix(in srgb, var(--color-accent-soft) 68%, #ffffff);
  font: inherit;
  font-size: 12px;
  font-weight: 850;
  white-space: nowrap;
}
.earnings-share-button.combined {
  border-color: var(--color-accent-strong);
  color: var(--color-text-on-strong);
  background: var(--color-accent-strong);
}
.earnings-share-button.account {
  border-color: var(--color-border);
  color: var(--color-text);
  background: var(--color-surface);
}
.earnings-share-button:disabled {
  cursor: not-allowed;
  opacity: .5;
}
.earnings-share-button :deep(svg) { width: 16px; height: 16px; }
.income-share-notice {
  margin: 0;
  padding: 9px 11px;
  border: 1px solid color-mix(in srgb, var(--color-success) 34%, var(--color-border));
  border-radius: 8px;
  color: var(--color-success);
  background: #effaf4;
  font-size: 11px;
  font-weight: 800;
}
.daily-earnings-table {
  min-width: 0;
  margin: 0;
  overflow: hidden;
}
.daily-earnings-table > header {
  min-height: 66px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 13px;
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-accent-soft) 42%, #ffffff);
}
.daily-earnings-table > header p {
  color: var(--color-accent-strong);
  font-size: 9px;
  font-weight: 850;
  letter-spacing: .07em;
}
.daily-earnings-table > header h2 {
  margin-top: 1px;
  font-size: 18px;
}
.daily-table-actions {
  min-width: 0;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 7px;
}
.daily-metric-toggle {
  min-width: 0;
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 2px;
  border: 1px solid var(--color-border);
  border-radius: 9px;
  background: var(--color-surface);
}
.daily-metric-toggle button {
  min-height: 40px;
  padding: 0 10px;
  border: 0;
  border-radius: 7px;
  color: var(--color-text-muted);
  background: transparent;
  font: inherit;
  font-size: 10px;
  font-weight: 850;
  white-space: nowrap;
}
.daily-metric-toggle button.active {
  color: var(--color-text-on-strong);
  background: var(--color-accent-strong);
}
.daily-table-share { flex: 0 0 auto; }
.daily-table-meta {
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 11px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: 9px;
  font-weight: 750;
}
.daily-table-meta b {
  color: var(--color-success);
  white-space: nowrap;
}
.daily-table-scroll {
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-width: thin;
}
.daily-table-scroll table {
  width: 100%;
  min-width: 380px;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  font-variant-numeric: tabular-nums;
}
.daily-date-column { width: 22%; }
.daily-value-column { width: 13%; }
.daily-total-column { width: 13%; }
.daily-table-scroll :is(th, td) {
  height: 42px;
  padding: 5px 3px;
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  text-align: center;
}
.daily-table-scroll :is(th, td):last-child { border-right: 0; }
.daily-table-scroll tbody tr:last-child :is(th, td) { border-bottom: 0; }
.daily-table-scroll thead th {
  height: 34px;
  color: var(--color-text-muted);
  background: var(--color-surface-subtle);
  font-size: 9px;
  font-weight: 850;
}
.daily-table-scroll thead th:last-child { color: var(--color-accent-strong); }
.daily-table-scroll tbody th {
  position: sticky;
  left: 0;
  z-index: 1;
  color: var(--color-text);
  background: var(--color-surface);
  text-align: left;
}
.daily-table-scroll tbody th strong,
.daily-table-scroll tbody th small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.daily-table-scroll tbody th strong { font-size: 10px; }
.daily-table-scroll tbody th small {
  margin-top: 1px;
  color: var(--color-text-muted);
  font-size: 8px;
  font-weight: 650;
}
.daily-table-scroll td {
  color: var(--color-text);
  font-size: 10px;
  font-weight: 800;
}
.daily-table-scroll td.positive { color: var(--color-success); }
.daily-table-scroll td.negative { color: var(--color-danger); }
.daily-table-scroll td.unknown { color: var(--color-text-muted); }
.daily-table-scroll td.daily-total {
  color: var(--color-accent-strong);
  background: color-mix(in srgb, var(--color-accent-soft) 30%, #ffffff);
  font-weight: 900;
}
.daily-table-scroll tr.unsettled td { background: #fbfcfc; }
.daily-table-scroll tr.daily-summary-row :is(th, td) {
  background: color-mix(in srgb, var(--color-accent-soft) 58%, #ffffff);
  font-weight: 900;
}
.daily-table-scroll tr.daily-summary-row.average :is(th, td) {
  background: color-mix(in srgb, var(--color-accent-soft) 34%, #ffffff);
}
.selected-account-overview { min-width: 0; overflow: hidden; }
.selected-account-overview > header > div { min-width: 0; }
.account-overview-share { flex: 0 0 auto; }
.selected-account-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0;
}
.selected-account-metrics > div {
  min-width: 0;
  padding: 10px 13px;
  border-left: 1px solid var(--color-border);
}
.selected-account-metrics > div:first-child { border-left: 0; }
.selected-account-metrics dt {
  color: var(--color-text-muted);
  font-size: 10px;
  font-weight: 750;
}
.selected-account-metrics dd {
  overflow: hidden;
  margin: 2px 0 0;
  color: var(--color-text);
  font-size: 16px;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.selected-account-metrics small {
  display: block;
  margin-top: 1px;
  color: var(--color-text-muted);
  font-size: 9px;
}
.pending-ledger { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 10px; margin: 0 12px 12px; padding: 10px 12px; border: 1px solid #e0bd78; border-radius: 9px; color: #774800; background: #fff8e8; }
.pending-ledger > span { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; background: var(--color-surface); }
.pending-ledger > span :deep(svg) { width: 17px; height: 17px; }
.pending-ledger strong { font-size: 12px; }
.pending-ledger p { margin-top: 1px; font-size: 10px; line-height: 1.4; }
.pending-ledger > b { font-size: 13px; white-space: nowrap; }

.accounting-rule { min-width: 0; overflow: hidden; }
.accounting-rule > summary {
  min-height: 54px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  cursor: pointer;
  list-style: none;
  background: var(--color-surface-subtle);
}
.accounting-rule > summary::-webkit-details-marker { display: none; }
.accounting-rule-icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--color-accent-strong);
  background: var(--color-accent-soft);
}
.accounting-rule-icon :deep(svg) { width: 17px; height: 17px; }
.accounting-rule-copy { min-width: 0; display: grid; gap: 1px; }
.accounting-rule-copy small { color: var(--color-accent-strong); font-size: 9px; font-weight: 850; letter-spacing: .06em; }
.accounting-rule-copy strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.accounting-rule-action {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--color-accent-strong);
  font-size: 10px;
  font-weight: 850;
  white-space: nowrap;
}
.accounting-rule-action :deep(svg) { width: 14px; height: 14px; transition: transform .18s ease; }
.accounting-rule[open] .accounting-rule-action :deep(svg) { transform: rotate(90deg); }
.accounting-rule-content { border-top: 1px solid var(--color-border); }
.accounting-rule ol { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; padding: 0; list-style: none; counter-reset: rule; }
.accounting-rule li { position: relative; min-width: 0; display: grid; gap: 1px; padding: 12px 10px 12px 42px; border-left: 1px solid var(--color-border); counter-increment: rule; }
.accounting-rule li:first-child { border-left: 0; }
.accounting-rule li::before { position: absolute; top: 12px; left: 10px; width: 24px; height: 24px; display: grid; place-items: center; border-radius: 50%; color: var(--color-accent-strong); background: var(--color-accent-soft); font-size: 11px; font-weight: 850; content: counter(rule); }
.accounting-rule li b { font-size: 12px; }
.accounting-rule li span { color: var(--color-text-muted); font-size: 10px; line-height: 1.4; }
.accounting-rule-content > a { min-height: 44px; display: flex; align-items: center; justify-content: center; gap: 4px; border-top: 1px solid var(--color-border); color: var(--color-accent-strong); font-size: 12px; font-weight: 850; }
.accounting-rule-content > a :deep(svg) { width: 15px; height: 15px; }

.earnings-detail-panel { min-width: 0; overflow: hidden; margin-top: 14px; }
.earnings-detail-panel > header > div { min-width: 0; }
.earnings-detail-tabs {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 9px;
  background: var(--color-surface);
}
.earnings-detail-tabs button {
  min-width: 108px;
  min-height: 44px;
  padding: 0 11px;
  border: 0;
  border-left: 1px solid var(--color-border);
  color: var(--color-text-muted);
  background: transparent;
  font: inherit;
  font-size: 11px;
  font-weight: 850;
  white-space: nowrap;
}
.earnings-detail-tabs button:first-child { border-left: 0; }
.earnings-detail-tabs button.active { color: var(--color-text-on-strong); background: var(--color-accent-strong); }
.earnings-detail-tabs button span { margin-left: 3px; opacity: .75; font-size: 9px; }
.interval-history,
.ledger-history { min-width: 0; overflow: hidden; }
.interval-list,
.ledger-list { display: grid; }
.interval-list > article { min-height: 72px; display: grid; grid-template-columns: minmax(120px, .8fr) minmax(0, 1.55fr); align-items: center; gap: 12px; padding: 9px 13px; border-bottom: 1px solid var(--color-border); }
.interval-list > article:last-child,
.ledger-list > article:last-child { border-bottom: 0; }
.interval-list > article > div { display: grid; gap: 1px; }
.interval-list > article > div strong { font-size: 13px; }
.interval-list > article > div span { color: var(--color-text-muted); font-size: 10px; }
.interval-list dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; }
.interval-list dl > div { min-width: 0; padding: 0 9px; border-left: 1px solid var(--color-border); }
.interval-list dt { color: var(--color-text-muted); font-size: 9px; font-weight: 750; }
.interval-list dd { overflow: hidden; margin: 1px 0 0; color: var(--color-text); font-size: 12px; font-weight: 850; text-overflow: ellipsis; white-space: nowrap; }
.interval-list dl > div:first-child dd { color: var(--color-success); }
.ledger-list > article { min-height: 70px; display: grid; grid-template-columns: 68px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 9px 12px; border-bottom: 1px solid var(--color-border); }
.ledger-list > article.void { opacity: .55; }
.ledger-kind { min-height: 27px; display: inline-flex; align-items: center; justify-content: center; padding: 0 7px; border: 1px solid var(--color-border); border-radius: 999px; color: var(--color-text-muted); background: var(--color-surface-subtle); font-size: 9px; font-weight: 850; white-space: nowrap; }
.ledger-kind.expense { color: #874900; background: #fff4df; }
.ledger-kind.transfer { color: var(--color-info); background: var(--color-info-soft); }
.ledger-kind.adjustment { color: var(--color-accent-strong); background: var(--color-accent-soft); }
.ledger-list article > div { min-width: 0; }
.ledger-list article > div strong { display: block; overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.ledger-list article > div p { overflow: hidden; margin-top: 1px; color: var(--color-text-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.ledger-list article > div small { display: block; margin-top: 2px; color: var(--color-text-muted); font-size: 9px; }
.ledger-list article > button { min-width: 52px; min-height: 44px; border: 1px solid var(--color-border); border-radius: 7px; color: var(--color-danger); background: var(--color-surface); font: inherit; font-size: 10px; font-weight: 800; }
.earnings-empty { padding: 24px 16px; color: var(--color-text-muted); font-size: 12px; text-align: center; }

@media (max-width: 820px) {
  .earnings-page { padding: 10px 12px 34px; }
  .earnings-intro { min-height: 60px; gap: 12px; }
  .earnings-intro h1 { font-size: 24px; }
  .earnings-intro > div > span { font-size: 11px; }
  .earnings-account-tabs { margin-top: 10px; border-radius: 11px; }
  .earnings-account-tabs button { min-height: 58px; padding: 5px 2px; }
  .earnings-account-tabs button strong { font-size: 14px; }
  .earnings-account-tabs button span { font-size: 9px; }
  .earnings-workspace { margin-top: 12px; }
  .earnings-detail-panel { margin-top: 12px; }
}

@media (max-width: 520px) {
  .earnings-account-tabs button { min-height: 50px; }
  .earnings-account-tabs button span { display: none; }
  .earnings-share-button { min-width: 0; min-height: 44px; gap: 5px; padding-inline: 9px; font-size: 11px; letter-spacing: -.02em; }
  .earnings-share-button :deep(svg) { width: 15px; height: 15px; }
  .daily-earnings-table > header { min-height: 0; align-items: stretch; flex-direction: column; gap: 7px; padding: 9px 8px 8px; }
  .daily-earnings-table > header h2 { font-size: 15px; }
  .daily-table-actions { width: 100%; }
  .daily-metric-toggle button { min-height: 44px; padding-inline: 8px; }
  .daily-table-share { min-width: 98px; }
  .daily-table-meta { padding-inline: 8px; }
  .selected-account-overview > header { min-height: 56px; padding: 6px 8px; }
  .selected-account-overview > header h2 { font-size: 15px; }
  .selected-account-metrics > div { padding: 9px 5px; text-align: center; }
  .selected-account-metrics dt { font-size: 9px; }
  .selected-account-metrics dd { font-size: 14px; }
  .selected-account-metrics small { display: none; }
  .pending-ledger { grid-template-columns: auto minmax(0, 1fr); }
  .pending-ledger > b { grid-column: 2; }
  .accounting-rule ol { grid-template-columns: 1fr; }
  .accounting-rule li { border-top: 1px solid var(--color-border); border-left: 0; }
  .accounting-rule li:first-child { border-top: 0; }
  .accounting-rule-action { font-size: 9px; }
  .earnings-detail-panel > header { align-items: stretch; flex-direction: column; gap: 8px; padding: 9px 10px; }
  .earnings-detail-panel > header h2 { font-size: 16px; }
  .earnings-detail-tabs { width: 100%; }
  .earnings-detail-tabs button { min-width: 0; }
  .interval-list > article { grid-template-columns: 1fr; gap: 7px; padding: 11px 12px; }
  .interval-list dl > div { padding-inline: 7px; }
  .ledger-list > article { grid-template-columns: 62px minmax(0, 1fr) auto; gap: 7px; }
}

@media (max-width: 380px) {
  .earnings-page { padding-inline: 9px; }
  .earnings-intro > div > span { max-width: 220px; }
  .daily-table-actions { align-items: stretch; flex-direction: column; }
  .daily-table-share { width: 100%; }
  .selected-account-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .selected-account-metrics > div { border-top: 1px solid var(--color-border); }
  .selected-account-metrics > div:nth-child(-n+2) { border-top: 0; }
  .selected-account-metrics > div:nth-child(odd) { border-left: 0; }
  .accounting-rule-copy strong { font-size: 11px; }
  .accounting-rule-action { width: 44px; justify-content: flex-end; font-size: 0; }
}
</style>
