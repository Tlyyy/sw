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
import {
  buildDailyEarningsShareData,
  createDailyEarningsShareImage,
} from "./dailyEarningsShareImage";
import { createEarningsShareImage } from "./earningsShareImage";

type ResourceKey = "silverWan" | "dedicatedEggs" | "regularEggs" | "innerShards";
type MovementMode = "transfer" | "adjustment";

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

const selectedAccount = ref<AccountId>(queryAccount(route.query.account) || ui.recentAccount);
const movementOpen = ref(false);
const movementMode = ref<MovementMode>("transfer");
const movementAccount = ref<AccountId>(selectedAccount.value);
const movementTarget = ref<AccountId>(accountIds.find((id) => id !== selectedAccount.value) || "FC");
const movementDirection = ref<"increase" | "decrease">("increase");
const movementResource = ref<ResourceKey>("silverWan");
const movementAmount = ref<number | null>(null);
const movementTime = ref(shanghaiDateTimeLocal());
const movementNote = ref("");
const movementError = ref("");
const movementNotice = ref("");
const sharingIncome = ref(false);
const sharingDailyIncome = ref(false);
const incomeShareNotice = ref("");
let incomeShareNoticeTimer: number | null = null;

const accountTones: Record<AccountId, string> = {
  FC: "#12678f",
  LG1: "#6446a6",
  PT: "#a33838",
  LG2: "#8a5a00",
  MYT: "#28764a",
};

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
const hasDailyIncomeToShare = computed(() => dailyIncomeShareData.value.recordedDays > 0);
const sharingAnyIncome = computed(() => sharingIncome.value || sharingDailyIncome.value);
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
const latestIntervals = computed(() => [...summary.value.intervals].reverse().slice(0, 8));
const weekAvailable = computed(() => summary.value.week.status === "available");
const latestTitle = computed(() => {
  const interval = latestInterval.value;
  if (!interval) return "最近实际所得";
  return interval.kind === "daily"
    ? `${shortDate(interval.toDate)} 实际所得`
    : `最近 ${interval.intervalDays} 天实际所得`;
});
const shareButtonText = computed(() => latestInterval.value?.kind === "daily"
  ? "分享每日所得"
  : "分享区间所得");
const shareButtonLabel = computed(() => latestInterval.value
  ? `分享 ${selectedAccount.value} ${latestTitle.value}图片`
  : `${selectedAccount.value} 暂无可分享的实际所得`);
const dailyShareButtonLabel = computed(() => hasDailyIncomeToShare.value
  ? `分享五个账号 ${dailyIncomeShareData.value.weekStart} 至 ${dailyIncomeShareData.value.weekEnd} 每日实际所得图片`
  : "本周暂无可分享的五账号每日实际所得");
const weekStatusText = computed(() => {
  const week = summary.value.week;
  if (week.status === "available") {
    return `${shortDate(week.weekStart)}—${shortDate(week.latestSnapshotDate || week.reportEnd)}`;
  }
  if (week.unavailableReason === "missing-baseline") return "需要周日库存作为本周起点";
  if (week.unavailableReason === "baseline-gap") return "周日库存缺失，不能把跨周区间当成本周";
  return "本周还没有可用于结算的库存";
});
const movementResourceLabel = computed(() => ({
  silverWan: "银子",
  dedicatedEggs: "专用蛋",
  regularEggs: "普通蛋",
  innerShards: "内丹碎片",
})[movementResource.value]);

watch(() => route.query.account, (value) => {
  const next = queryAccount(value);
  if (next && next !== selectedAccount.value) selectedAccount.value = next;
});

watch(selectedAccount, (accountId) => {
  ui.recentAccount = accountId;
  movementAccount.value = accountId;
  if (movementTarget.value === accountId) {
    movementTarget.value = accountIds.find((id) => id !== accountId) || "FC";
  }
});

watch(movementMode, () => {
  movementError.value = "";
  movementNotice.value = "";
});

onBeforeUnmount(() => {
  if (incomeShareNoticeTimer !== null) window.clearTimeout(incomeShareNoticeTimer);
});

function selectAccount(accountId: AccountId) {
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

function wanLabel(value: number | null | undefined, signed = true) {
  if (value === null || value === undefined) return "—";
  const normalized = Number(value.toFixed(2));
  return `${signed && normalized > 0 ? "+" : ""}${normalized.toLocaleString("zh-CN", {
    maximumFractionDigits: 2,
  })} 万`;
}

function resourceValue(resources: AccountingResources | null | undefined, key: ResourceKey) {
  if (!resources) return null;
  return resources[key];
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

async function shareDailyIncome() {
  if (!hasDailyIncomeToShare.value || sharingAnyIncome.value) return;
  sharingDailyIncome.value = true;

  try {
    const data = dailyIncomeShareData.value;
    const blob = createDailyEarningsShareImage(data);
    const fileName = `五号每日实际所得-${data.weekStart}-${data.weekEnd}.png`;
    const file = new File([blob], fileName, { type: "image/png" });
    const nativeShareData: ShareData = {
      files: [file],
      title: "五号每日实际所得",
    };
    const supportsFileShare = typeof navigator.share === "function"
      && typeof navigator.canShare === "function"
      && navigator.canShare(nativeShareData);

    if (supportsFileShare) {
      try {
        await navigator.share(nativeShareData);
        showIncomeShareNotice("五号每日所得图片已打开系统分享");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    downloadShareImage(blob, fileName);
    showIncomeShareNotice("五号每日所得图片已下载");
  } catch {
    showIncomeShareNotice("图片生成失败，请重试");
  } finally {
    sharingDailyIncome.value = false;
  }
}

async function shareLatestIncome() {
  const interval = latestInterval.value;
  if (!interval || sharingAnyIncome.value) return;
  sharingIncome.value = true;

  try {
    const blob = createEarningsShareImage({
      accountId: selectedAccount.value,
      accountTone: accountTones[selectedAccount.value],
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
    movementNotice.value = "已撤销实际流水；库存没有变化。";
  }
}

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

function shanghaiDateTimeLocal(now = Date.now()) {
  const shanghai = new Date(now + 8 * 60 * 60 * 1_000);
  return `${shanghai.getUTCFullYear()}-${twoDigits(shanghai.getUTCMonth() + 1)}-${twoDigits(shanghai.getUTCDate())}`
    + `T${twoDigits(shanghai.getUTCHours())}:${twoDigits(shanghai.getUTCMinutes())}`;
}

function parseShanghaiDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const epoch = Date.UTC(year, month - 1, day, hour - 8, minute);
  const check = new Date(epoch + 8 * 60 * 60 * 1_000);
  if (
    check.getUTCFullYear() !== year
    || check.getUTCMonth() + 1 !== month
    || check.getUTCDate() !== day
    || check.getUTCHours() !== hour
    || check.getUTCMinutes() !== minute
  ) return null;
  return {
    occurredAt: new Date(epoch).toISOString(),
    effectiveDate: `${yearText}-${monthText}-${dayText}`,
  };
}

function movementResources(): AccountingResources {
  const resources: AccountingResources = {
    silverWan: 0,
    dedicatedEggs: 0,
    regularEggs: 0,
    innerShards: 0,
  };
  const amount = Number(movementAmount.value);
  if (movementResource.value === "innerShards") resources.innerShards = amount;
  else resources[movementResource.value] = amount;
  return resources;
}

function resetMovementForm() {
  movementAmount.value = null;
  movementNote.value = "";
  movementTime.value = shanghaiDateTimeLocal();
  movementError.value = "";
}

function saveMovement() {
  movementError.value = "";
  movementNotice.value = "";
  const amount = Number(movementAmount.value);
  const occurrence = parseShanghaiDateTime(movementTime.value);
  const note = movementNote.value.trim();
  if (!Number.isFinite(amount) || amount <= 0) {
    movementError.value = "请输入大于 0 的实际数量。";
    return;
  }
  if (!occurrence) {
    movementError.value = "请选择有效的发生时间。";
    return;
  }
  if (!note) {
    movementError.value = "请写明这次变动的原因，方便以后核对。";
    return;
  }

  if (movementMode.value === "transfer") {
    if (movementAccount.value === movementTarget.value) {
      movementError.value = "转出与转入不能是同一个账号。";
      return;
    }
    const result = accounting.addTransfer({
      fromAccountId: movementAccount.value,
      toAccountId: movementTarget.value,
      effectiveDate: occurrence.effectiveDate,
      occurredAt: occurrence.occurredAt,
      resources: movementResources(),
      note,
    });
    if (!result) {
      movementError.value = "这笔转账没有保存，请检查账号、数量和备注。";
      return;
    }
    movementNotice.value = `已记录 ${movementAccount.value} → ${movementTarget.value} 的${movementResourceLabel.value}转移；不会改库存，也不会被算成所得。`;
  } else {
    const result = accounting.addAdjustment({
      accountId: movementAccount.value,
      effectiveDate: occurrence.effectiveDate,
      occurredAt: occurrence.occurredAt,
      direction: movementDirection.value,
      resources: movementResources(),
      note,
    });
    if (!result) {
      movementError.value = "这笔调整没有保存，请检查数量和备注。";
      return;
    }
    movementNotice.value = `已记录 ${movementAccount.value} 的非收益${movementDirection.value === "increase" ? "增加" : "减少"}；不会改库存。`;
  }
  resetMovementForm();
}
</script>

<template>
  <div class="earnings-page" data-testid="earnings-page">
    <header class="earnings-intro">
      <div>
        <p>独立核算</p>
        <h1>实际所得</h1>
        <span>库存仍以每天手工录入为准；这里只解释变化，不会自动扣库存。</span>
      </div>
      <button class="movement-toggle" type="button" :aria-expanded="movementOpen" aria-controls="special-movement-form" @click="movementOpen = !movementOpen">
        <AppIcon name="plus" />
        <span>记录特殊变动</span>
      </button>
    </header>

    <nav class="earnings-account-tabs" aria-label="选择核算账号">
      <button
        v-for="account in catalog.data.accounts"
        :key="account.id"
        type="button"
        :class="[{ active: selectedAccount === account.id }, `account-${account.id.toLowerCase()}`]"
        :aria-pressed="selectedAccount === account.id"
        :aria-label="`查看 ${account.id} 实际所得`"
        @click="selectAccount(account.id)"
      >
        <strong>{{ account.id }}</strong>
        <span>{{ latestSnapshot?.effectiveDate ? shortDate(latestSnapshot.effectiveDate) : "待录库存" }}</span>
      </button>
    </nav>

    <section v-if="movementOpen" id="special-movement-form" class="movement-panel" aria-labelledby="movement-title">
      <header>
        <div><p>只在必要时使用</p><h2 id="movement-title">排除转账或非收益变化</h2></div>
        <button type="button" aria-label="关闭特殊变动表单" @click="movementOpen = false"><AppIcon name="close" /></button>
      </header>
      <p class="movement-explanation">账号间转移和系统调整会改变库存，但不是真实所得。记录后只修正核算口径，不会写回库存。</p>
      <form @submit.prevent="saveMovement">
        <fieldset class="movement-mode">
          <legend>变动类型</legend>
          <div>
            <button type="button" :class="{ active: movementMode === 'transfer' }" :aria-pressed="movementMode === 'transfer'" @click="movementMode = 'transfer'">账号间转移</button>
            <button type="button" :class="{ active: movementMode === 'adjustment' }" :aria-pressed="movementMode === 'adjustment'" @click="movementMode = 'adjustment'">非收益调整</button>
          </div>
        </fieldset>
        <label><span>{{ movementMode === "transfer" ? "转出账号" : "账号" }}</span><select v-model="movementAccount" aria-label="特殊变动账号"><option v-for="account in catalog.data.accounts" :key="account.id" :value="account.id">{{ account.id }}</option></select></label>
        <label v-if="movementMode === 'transfer'"><span>转入账号</span><select v-model="movementTarget" aria-label="转入账号"><option v-for="account in catalog.data.accounts" :key="account.id" :value="account.id" :disabled="account.id === movementAccount">{{ account.id }}</option></select></label>
        <label v-else><span>库存变化</span><select v-model="movementDirection" aria-label="调整方向"><option value="increase">增加，但不是所得</option><option value="decrease">减少，但不是支出</option></select></label>
        <label><span>资源</span><select v-model="movementResource" aria-label="特殊变动资源"><option value="silverWan">银子 / 万</option><option value="dedicatedEggs">专用蛋 / 个</option><option value="regularEggs">普通蛋 / 个</option><option value="innerShards">内丹碎片 / 片</option></select></label>
        <label><span>实际数量</span><input v-model.number="movementAmount" type="number" min="0.01" step="0.01" inputmode="decimal" aria-label="特殊变动数量" placeholder="请输入数量" /></label>
        <label><span>发生时间</span><input v-model="movementTime" type="datetime-local" step="60" aria-label="特殊变动发生时间" /></label>
        <label class="movement-note"><span>原因</span><input v-model="movementNote" type="text" maxlength="120" aria-label="特殊变动原因" placeholder="例如：FC 转给 LG1，或补偿到账" /></label>
        <button class="movement-save" type="submit">保存核算记录</button>
      </form>
      <p v-if="movementError" class="movement-message error" role="alert">{{ movementError }}</p>
    </section>

    <p v-if="movementNotice" class="movement-message success" role="status">{{ movementNotice }}</p>

    <main class="earnings-workspace">
      <section class="earnings-summary" aria-labelledby="earnings-summary-title">
        <header>
          <div>
            <p>{{ selectedAccount }} 账号</p>
            <h2 id="earnings-summary-title">库存变化与实际所得</h2>
          </div>
          <div class="earnings-summary-actions">
            <small>五账号合并 + 当前账号</small>
            <div class="earnings-share-buttons">
              <button
                class="earnings-share-button combined"
                type="button"
                :disabled="!hasDailyIncomeToShare || sharingAnyIncome"
                :aria-busy="sharingDailyIncome"
                :aria-label="dailyShareButtonLabel"
                @click="shareDailyIncome"
              >
                <AppIcon :name="sharingDailyIncome ? 'refresh' : 'share'" />
                <span>{{ sharingDailyIncome ? "生成中…" : "五号每日所得" }}</span>
              </button>
              <button
                class="earnings-share-button account"
                type="button"
                :disabled="!latestInterval || sharingAnyIncome"
                :aria-busy="sharingIncome"
                :aria-label="shareButtonLabel"
                @click="shareLatestIncome"
              >
                <AppIcon :name="sharingIncome ? 'refresh' : 'share'" />
                <span>{{ sharingIncome ? "生成中…" : shareButtonText }}</span>
              </button>
            </div>
          </div>
        </header>
        <p v-if="incomeShareNotice" class="income-share-notice" role="status">{{ incomeShareNotice }}</p>

        <div class="earnings-primary-grid">
          <article class="earnings-primary-card latest">
            <div>
              <p>{{ latestTitle }}</p>
              <strong>{{ wanLabel(latestInterval?.actualIncome.silverWan) }}</strong>
              <span v-if="latestInterval">{{ intervalRange(latestInterval) }} · {{ latestInterval.kind === "daily" ? "连续库存" : `${latestInterval.intervalDays} 天区间` }}</span>
              <span v-else>至少需要两份不同日期的库存</span>
            </div>
            <dl>
              <div><dt>库存净变化</dt><dd>{{ wanLabel(latestInterval?.inventoryNetChange.silverWan) }}</dd></div>
              <div><dt>流水修正</dt><dd>{{ wanLabel(latestInterval?.ledgerImpact.silverWan) }}</dd></div>
            </dl>
          </article>

          <article class="earnings-primary-card week" :class="{ unavailable: !weekAvailable }">
            <div>
              <p>本周实际所得</p>
              <strong>{{ wanLabel(summary.week.actualIncome?.silverWan) }}</strong>
              <span>{{ weekStatusText }}</span>
            </div>
            <dl>
              <div><dt>库存净变化</dt><dd>{{ wanLabel(summary.week.inventoryNetChange?.silverWan) }}</dd></div>
              <div><dt>流水修正</dt><dd>{{ wanLabel(summary.week.ledgerImpact?.silverWan) }}</dd></div>
            </dl>
          </article>
        </div>

        <dl class="earnings-resource-strip">
          <div><dt>当前银子</dt><dd>{{ wanLabel(selectedBalance?.silverWan, false) }}</dd><small>{{ summary.latestSnapshotDate ? `库存 ${shortDate(summary.latestSnapshotDate)}` : "待录库存" }}</small></div>
          <div><dt>最近专用蛋所得</dt><dd>{{ resourceValue(latestInterval?.actualIncome, "dedicatedEggs") === null ? "—" : numberLabel(resourceValue(latestInterval?.actualIncome, "dedicatedEggs") || 0, " 个") }}</dd><small>独立于普通蛋</small></div>
          <div><dt>最近普通蛋所得</dt><dd>{{ resourceValue(latestInterval?.actualIncome, "regularEggs") === null ? "—" : numberLabel(resourceValue(latestInterval?.actualIncome, "regularEggs") || 0, " 个") }}</dd><small>独立于专用蛋</small></div>
          <div><dt>最近碎片所得</dt><dd>{{ resourceValue(latestInterval?.actualIncome, "innerShards") === null ? "未知" : numberLabel(resourceValue(latestInterval?.actualIncome, "innerShards") || 0, " 片") }}</dd><small>旧库存缺值时不猜</small></div>
        </dl>

        <aside v-if="summary.pending.entries.length" class="pending-ledger" aria-label="等待下次库存核销的流水">
          <span><AppIcon name="refresh" /></span>
          <div><strong>{{ summary.pending.entries.length }} 笔流水等待下次库存核销</strong><p>发生在 {{ summary.pending.afterSnapshotDate ? `${shortDate(summary.pending.afterSnapshotDate)} 库存记录之后` : "首份库存之前" }}，暂不并入已结算所得，避免重复计算。</p></div>
          <b>{{ wanLabel(summary.pending.ledgerImpact.silverWan) }}</b>
        </aside>
      </section>

      <aside class="accounting-rule" aria-labelledby="accounting-rule-title">
        <header><span><AppIcon name="analysis" /></span><div><p>核算口径</p><h2 id="accounting-rule-title">实际所得怎么来</h2></div></header>
        <ol>
          <li><b>先看真实库存</b><span>结束库存 − 开始库存</span></li>
          <li><b>再加回已确认支出</b><span>任务、打书、洗护符和其他支出</span></li>
          <li><b>排除非收益变化</b><span>账号转移与手动调整不算所得</span></li>
        </ol>
        <strong>实际所得 = 库存净变化 + 流水修正</strong>
        <RouterLink to="/plans/tasks">去维护任务 <AppIcon name="chevron-right" /></RouterLink>
      </aside>
    </main>

    <section class="earnings-detail-grid">
      <section class="interval-history" aria-labelledby="interval-history-title">
        <header><div><p>按库存区间</p><h2 id="interval-history-title">每日与最近区间</h2></div><span>缺天不伪装成单日</span></header>
        <div v-if="latestIntervals.length" class="interval-list">
          <article v-for="interval in latestIntervals" :key="`${interval.fromRecordedAt}:${interval.toRecordedAt}`">
            <div><strong>{{ interval.kind === "daily" ? shortDate(interval.toDate) : `${interval.intervalDays} 天区间` }}</strong><span>{{ intervalRange(interval) }}</span></div>
            <dl>
              <div><dt>实际所得</dt><dd>{{ wanLabel(interval.actualIncome.silverWan) }}</dd></div>
              <div><dt>库存变化</dt><dd>{{ wanLabel(interval.inventoryNetChange.silverWan) }}</dd></div>
              <div><dt>流水修正</dt><dd>{{ wanLabel(interval.ledgerImpact.silverWan) }}</dd></div>
            </dl>
          </article>
        </div>
        <p v-else class="earnings-empty">录入第二个不同日期的库存后，这里会出现第一段真实区间。</p>
      </section>

      <section class="ledger-history" aria-labelledby="ledger-history-title">
        <header><div><p>只读真实事实</p><h2 id="ledger-history-title">{{ selectedAccount }} 实际流水</h2></div><span>{{ ledgerEntries.length }} 笔</span></header>
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
    </section>
  </div>
</template>

<style scoped>
.earnings-page {
  width: min(100%, 1320px);
  margin: 0 auto;
  padding: 14px clamp(16px, 2vw, 28px) 60px;
  color: var(--radar-ink);
}

.earnings-intro {
  min-height: 78px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 0 4px 13px;
  border-bottom: 1px solid var(--radar-line);
}
.earnings-intro > div { min-width: 0; }
.earnings-intro p,
.earnings-summary > header p,
.accounting-rule header p,
.interval-history > header p,
.ledger-history > header p,
.movement-panel > header p {
  color: var(--radar-cyan-strong);
  font-size: 10px;
  font-weight: 850;
  letter-spacing: .09em;
}
.earnings-intro h1 { margin-top: 1px; font-size: 28px; line-height: 1.2; letter-spacing: -.04em; }
.earnings-intro > div > span { display: block; margin-top: 3px; color: var(--radar-muted); font-size: 12px; line-height: 1.45; }
.movement-toggle {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 14px;
  border: 1px solid var(--radar-line-strong);
  border-radius: 9px;
  color: var(--radar-cyan-strong);
  background: #ffffff;
  font: inherit;
  font-size: 13px;
  font-weight: 850;
  white-space: nowrap;
}
.movement-toggle :deep(svg) { width: 17px; height: 17px; }

.earnings-account-tabs {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  overflow: hidden;
  margin-top: 14px;
  border: 1px solid var(--radar-line);
  border-radius: 13px;
  background: #ffffff;
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
  border-right: 1px solid var(--radar-line);
  color: var(--radar-ink);
  background: #ffffff;
  font: inherit;
}
.earnings-account-tabs button:last-child { border-right: 0; }
.earnings-account-tabs button strong { font-size: 15px; }
.earnings-account-tabs button span { color: var(--radar-muted); font-size: 10px; font-weight: 750; }
.earnings-account-tabs button.active {
  color: var(--radar-cyan-strong);
  background: var(--radar-cyan-soft);
  box-shadow: inset 0 -3px var(--radar-cyan);
}
.earnings-account-tabs button.active span { color: var(--radar-cyan-strong); }

.movement-panel,
.earnings-summary,
.accounting-rule,
.interval-history,
.ledger-history {
  border: 1px solid var(--radar-line);
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 7px 20px rgba(17, 24, 39, .055);
}
.movement-panel { overflow: hidden; margin-top: 12px; }
.movement-panel > header,
.earnings-summary > header,
.interval-history > header,
.ledger-history > header {
  min-height: 62px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--radar-line);
  background: var(--radar-surface-2);
}
.movement-panel > header h2,
.earnings-summary > header h2,
.interval-history > header h2,
.ledger-history > header h2 { margin-top: 1px; font-size: 18px; }
.movement-panel > header > button {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border: 1px solid var(--radar-line);
  border-radius: 50%;
  color: var(--radar-muted);
  background: #ffffff;
}
.movement-explanation { padding: 11px 14px 0; color: var(--radar-muted); font-size: 12px; }
.movement-panel form {
  display: grid;
  grid-template-columns: 1.1fr repeat(5, minmax(120px, 1fr)) auto;
  align-items: end;
  gap: 10px;
  padding: 12px 14px 14px;
}
.movement-panel label { min-width: 0; display: grid; gap: 5px; }
.movement-panel label > span,
.movement-mode legend { color: var(--radar-muted); font-size: 11px; font-weight: 800; }
.movement-panel :is(input, select) {
  width: 100%;
  height: 44px;
  padding: 0 10px;
  border: 1px solid var(--radar-line-strong);
  border-radius: 8px;
  background: #ffffff;
  font-size: 16px;
}
.movement-mode { min-width: 0; margin: 0; padding: 0; border: 0; }
.movement-mode > div { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); height: 44px; overflow: hidden; margin-top: 5px; border: 1px solid var(--radar-line-strong); border-radius: 8px; }
.movement-mode button { border: 0; border-right: 1px solid var(--radar-line); color: var(--radar-muted); background: #ffffff; font: inherit; font-size: 12px; font-weight: 800; }
.movement-mode button:last-child { border-right: 0; }
.movement-mode button.active { color: var(--radar-cyan-strong); background: var(--radar-cyan-soft); }
.movement-note { grid-column: span 2; }
.movement-save {
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid #a84600;
  border-radius: 8px;
  color: #ffffff;
  background: var(--brand-orange);
  font: inherit;
  font-size: 13px;
  font-weight: 850;
  white-space: nowrap;
}
.movement-message { margin-top: 10px; padding: 10px 12px; border: 1px solid var(--radar-line); border-radius: 9px; font-size: 12px; font-weight: 750; }
.movement-message.error { margin: 0 14px 14px; color: var(--radar-danger); background: #fff5f4; }
.movement-message.success { color: var(--radar-success); background: #effaf4; }

.earnings-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 14px;
  margin-top: 14px;
}
.earnings-summary { min-width: 0; overflow: hidden; }
.earnings-summary > header > span,
.interval-history > header > span,
.ledger-history > header > span { color: var(--radar-muted); font-size: 11px; font-weight: 750; }
.earnings-summary-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 9px;
}
.earnings-summary-actions > small {
  color: var(--radar-muted);
  font-size: 10px;
  font-weight: 750;
  white-space: nowrap;
}
.earnings-share-buttons {
  display: flex;
  align-items: center;
  gap: 7px;
}
.earnings-share-button {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--radar-cyan) 55%, var(--radar-line));
  border-radius: 8px;
  color: var(--radar-cyan-strong);
  background: color-mix(in srgb, var(--radar-cyan-soft) 68%, #ffffff);
  font: inherit;
  font-size: 12px;
  font-weight: 850;
  white-space: nowrap;
}
.earnings-share-button.combined {
  border-color: var(--radar-cyan-strong);
  color: #ffffff;
  background: var(--radar-cyan-strong);
}
.earnings-share-button:disabled {
  cursor: not-allowed;
  opacity: .5;
}
.earnings-share-button :deep(svg) { width: 16px; height: 16px; }
.income-share-notice {
  margin: 10px 13px 0;
  padding: 9px 11px;
  border: 1px solid color-mix(in srgb, var(--radar-success) 34%, var(--radar-line));
  border-radius: 8px;
  color: var(--radar-success);
  background: #effaf4;
  font-size: 11px;
  font-weight: 800;
}
.earnings-primary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-bottom: 1px solid var(--radar-line); }
.earnings-primary-card { min-width: 0; padding: 16px; }
.earnings-primary-card + .earnings-primary-card { border-left: 1px solid var(--radar-line); }
.earnings-primary-card > div > p { color: var(--radar-muted); font-size: 11px; font-weight: 800; }
.earnings-primary-card > div > strong { display: block; margin-top: 2px; color: var(--radar-success); font-size: 29px; line-height: 1.2; letter-spacing: -.04em; font-variant-numeric: tabular-nums; }
.earnings-primary-card.week > div > strong { color: var(--radar-cyan-strong); }
.earnings-primary-card.unavailable > div > strong { color: var(--radar-muted); }
.earnings-primary-card > div > span { display: block; min-height: 18px; margin-top: 4px; color: var(--radar-muted); font-size: 11px; line-height: 1.45; }
.earnings-primary-card dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 13px 0 0; overflow: hidden; border: 1px solid var(--radar-line); border-radius: 9px; background: var(--radar-surface-2); }
.earnings-primary-card dl > div { min-width: 0; padding: 8px 10px; border-left: 1px solid var(--radar-line); }
.earnings-primary-card dl > div:first-child { border-left: 0; }
.earnings-primary-card dt { color: var(--radar-muted); font-size: 10px; font-weight: 750; }
.earnings-primary-card dd { overflow: hidden; margin: 1px 0 0; color: var(--radar-ink); font-size: 12px; font-weight: 850; text-overflow: ellipsis; white-space: nowrap; }
.earnings-resource-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; }
.earnings-resource-strip > div { min-width: 0; padding: 12px 13px; border-left: 1px solid var(--radar-line); }
.earnings-resource-strip > div:first-child { border-left: 0; }
.earnings-resource-strip dt { color: var(--radar-muted); font-size: 10px; font-weight: 750; }
.earnings-resource-strip dd { overflow: hidden; margin: 2px 0 0; color: var(--radar-ink); font-size: 15px; font-weight: 850; text-overflow: ellipsis; white-space: nowrap; }
.earnings-resource-strip small { display: block; margin-top: 1px; color: var(--radar-muted); font-size: 9px; }
.pending-ledger { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 10px; margin: 0 13px 13px; padding: 10px 12px; border: 1px solid #e0bd78; border-radius: 9px; color: #774800; background: #fff8e8; }
.pending-ledger > span { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; background: #ffffff; }
.pending-ledger > span :deep(svg) { width: 17px; height: 17px; }
.pending-ledger strong { font-size: 12px; }
.pending-ledger p { margin-top: 1px; font-size: 10px; line-height: 1.4; }
.pending-ledger > b { font-size: 13px; white-space: nowrap; }

.accounting-rule { align-self: start; overflow: hidden; }
.accounting-rule > header { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 10px; padding: 13px; border-bottom: 1px solid var(--radar-line); background: var(--radar-surface-2); }
.accounting-rule > header > span { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 50%; color: var(--radar-cyan-strong); background: var(--radar-cyan-soft); }
.accounting-rule h2 { margin-top: 1px; font-size: 17px; }
.accounting-rule ol { display: grid; gap: 0; margin: 0; padding: 0 13px; list-style: none; counter-reset: rule; }
.accounting-rule li { position: relative; display: grid; gap: 1px; padding: 11px 0 11px 34px; border-bottom: 1px solid var(--radar-line); counter-increment: rule; }
.accounting-rule li::before { position: absolute; top: 12px; left: 0; width: 24px; height: 24px; display: grid; place-items: center; border-radius: 50%; color: var(--radar-cyan-strong); background: var(--radar-cyan-soft); font-size: 11px; font-weight: 850; content: counter(rule); }
.accounting-rule li b { font-size: 12px; }
.accounting-rule li span { color: var(--radar-muted); font-size: 10px; line-height: 1.4; }
.accounting-rule > strong { display: block; margin: 12px 13px; padding: 10px; border-radius: 8px; color: var(--radar-cyan-strong); background: var(--radar-cyan-soft); font-size: 12px; text-align: center; }
.accounting-rule > a { min-height: 44px; display: flex; align-items: center; justify-content: center; gap: 4px; margin: 0 13px 13px; border: 1px solid var(--radar-line); border-radius: 8px; color: var(--radar-cyan-strong); font-size: 12px; font-weight: 850; }
.accounting-rule > a :deep(svg) { width: 15px; height: 15px; }

.earnings-detail-grid { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); gap: 14px; margin-top: 14px; }
.interval-history,
.ledger-history { min-width: 0; overflow: hidden; }
.interval-list,
.ledger-list { display: grid; }
.interval-list > article { min-height: 72px; display: grid; grid-template-columns: minmax(120px, .8fr) minmax(0, 1.55fr); align-items: center; gap: 12px; padding: 9px 13px; border-bottom: 1px solid var(--radar-line); }
.interval-list > article:last-child,
.ledger-list > article:last-child { border-bottom: 0; }
.interval-list > article > div { display: grid; gap: 1px; }
.interval-list > article > div strong { font-size: 13px; }
.interval-list > article > div span { color: var(--radar-muted); font-size: 10px; }
.interval-list dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; }
.interval-list dl > div { min-width: 0; padding: 0 9px; border-left: 1px solid var(--radar-line); }
.interval-list dt { color: var(--radar-muted); font-size: 9px; font-weight: 750; }
.interval-list dd { overflow: hidden; margin: 1px 0 0; color: var(--radar-ink); font-size: 12px; font-weight: 850; text-overflow: ellipsis; white-space: nowrap; }
.interval-list dl > div:first-child dd { color: var(--radar-success); }
.ledger-list > article { min-height: 70px; display: grid; grid-template-columns: 68px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 9px 12px; border-bottom: 1px solid var(--radar-line); }
.ledger-list > article.void { opacity: .55; }
.ledger-kind { min-height: 27px; display: inline-flex; align-items: center; justify-content: center; padding: 0 7px; border: 1px solid var(--radar-line); border-radius: 999px; color: var(--radar-muted); background: var(--radar-surface-2); font-size: 9px; font-weight: 850; white-space: nowrap; }
.ledger-kind.expense { color: #874900; background: #fff4df; }
.ledger-kind.transfer { color: #12678f; background: #edf4fb; }
.ledger-kind.adjustment { color: var(--radar-cyan-strong); background: var(--radar-cyan-soft); }
.ledger-list article > div { min-width: 0; }
.ledger-list article > div strong { display: block; overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.ledger-list article > div p { overflow: hidden; margin-top: 1px; color: var(--radar-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.ledger-list article > div small { display: block; margin-top: 2px; color: var(--radar-muted); font-size: 9px; }
.ledger-list article > button { min-width: 52px; min-height: 44px; border: 1px solid var(--radar-line); border-radius: 7px; color: var(--radar-danger); background: #ffffff; font: inherit; font-size: 10px; font-weight: 800; }
.earnings-empty { padding: 24px 16px; color: var(--radar-muted); font-size: 12px; text-align: center; }

@media (max-width: 1100px) {
  .movement-panel form { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .movement-mode,
  .movement-note { grid-column: span 2; }
  .movement-save { min-height: 44px; }
  .earnings-workspace { grid-template-columns: minmax(0, 1fr) 270px; }
}

@media (max-width: 820px) {
  .earnings-page { padding: 10px 12px 34px; }
  .earnings-intro { min-height: 68px; }
  .earnings-intro h1 { font-size: 25px; }
  .earnings-intro > div > span { max-width: 260px; font-size: 11px; }
  .movement-toggle { width: 46px; padding: 0; }
  .movement-toggle span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .earnings-account-tabs { margin-top: 10px; border-radius: 11px; }
  .earnings-account-tabs button { min-height: 58px; padding: 5px 2px; }
  .earnings-account-tabs button strong { font-size: 14px; }
  .earnings-account-tabs button span { font-size: 9px; }
  .movement-panel form { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .movement-mode,
  .movement-note { grid-column: 1 / -1; }
  .movement-save { grid-column: 1 / -1; min-height: 50px; }
  .earnings-workspace { grid-template-columns: 1fr; gap: 12px; margin-top: 12px; }
  .accounting-rule { order: 2; }
  .earnings-detail-grid { grid-template-columns: 1fr; gap: 12px; margin-top: 12px; }
}

@media (max-width: 520px) {
  .earnings-summary > header { align-items: stretch; flex-direction: column; }
  .earnings-summary-actions { width: 100%; gap: 6px; }
  .earnings-summary-actions > small { display: none; }
  .earnings-share-buttons { width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .earnings-share-button { width: 100%; min-height: 44px; padding-inline: 8px; }
  .earnings-primary-grid { grid-template-columns: 1fr; }
  .earnings-primary-card + .earnings-primary-card { border-top: 1px solid var(--radar-line); border-left: 0; }
  .earnings-primary-card { padding: 14px; }
  .earnings-primary-card > div > strong { font-size: 27px; }
  .earnings-resource-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .earnings-resource-strip > div:nth-child(3) { border-top: 1px solid var(--radar-line); border-left: 0; }
  .earnings-resource-strip > div:nth-child(4) { border-top: 1px solid var(--radar-line); }
  .pending-ledger { grid-template-columns: auto minmax(0, 1fr); }
  .pending-ledger > b { grid-column: 2; }
  .interval-list > article { grid-template-columns: 1fr; gap: 7px; padding: 11px 12px; }
  .interval-list dl > div { padding-inline: 7px; }
  .ledger-list > article { grid-template-columns: 62px minmax(0, 1fr) auto; gap: 7px; }
}

@media (max-width: 380px) {
  .earnings-page { padding-inline: 9px; }
  .earnings-intro > div > span { max-width: 220px; }
  .earnings-account-tabs button span { display: none; }
  .earnings-account-tabs button { min-height: 50px; }
  .movement-panel form { grid-template-columns: 1fr; }
  .movement-panel form > * { grid-column: 1 / -1; }
}
</style>
