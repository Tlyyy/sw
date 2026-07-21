<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useCatalogStore } from "../../stores/catalog";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";
import {
  buildGemPlanProjection,
  formatCurrency,
  formatGemLevel,
  formatNumber,
  gemPlanTargetLevels,
  marketItems,
} from "../../domain/gems";
import type { AccountId } from "../../domain/types";
import { createGemPlanShareImage } from "./gemPlanShareImage";
import PlansNav from "./PlansNav.vue";

const catalog = useCatalogStore();
const settings = useSettingsStore();
const ui = useUiStore();
const selected = ref<AccountId>(ui.recentAccount);
const sharing = ref(false);
const shareNotice = ref("");
let shareNoticeTimer: number | null = null;

const accountTones: Record<AccountId, string> = {
  FC: "var(--radar-account-fc)",
  LG1: "var(--radar-account-lg1)",
  LG2: "var(--radar-account-lg2)",
  PT: "var(--radar-account-pt)",
  MYT: "var(--radar-account-myt)",
};

settings.hydrate();
watch(selected, (accountId) => { ui.recentAccount = accountId; });

const targetLevels = computed(() => gemPlanTargetLevels(catalog.data));
const market = computed(() => marketItems(catalog.data, settings.gemPriceOverrides));
const plan = computed(() => buildGemPlanProjection(
  catalog.data,
  settings.gemPriceOverrides,
  settings.gemPlan.targetLevel,
  settings.gemPlan.weeklyIncomeWan,
  settings.planningAsOfDate,
));
const selectedPlan = computed(() => plan.value.accounts.find((account) => account.accountId === selected.value) || plan.value.accounts[0]);

function formatDate(value: string | null) {
  if (!value) return "待设置投入";
  const [year, month, day] = value.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function weeksLabel(value: number | null) {
  if (value === null) return "待排期";
  return value === 0 ? "已达成" : `${value} 周`;
}

function compactCost(value: number) {
  return formatCurrency(value).replace("银币", "");
}

function setTarget(event: Event) {
  settings.setGemPlanTargetLevel((event.target as HTMLSelectElement).value);
}

function setWeeklyIncome(event: Event) {
  settings.setGemPlanWeeklyIncome(Number((event.target as HTMLInputElement).value));
}

function showShareNotice(message: string) {
  shareNotice.value = message;
  if (shareNoticeTimer !== null) window.clearTimeout(shareNoticeTimer);
  shareNoticeTimer = window.setTimeout(() => {
    shareNotice.value = "";
    shareNoticeTimer = null;
  }, 2_800);
}

function downloadImage(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function shareGemPlan() {
  if (sharing.value) return;
  sharing.value = true;
  try {
    const blob = createGemPlanShareImage({
      projection: plan.value,
      marketDate: catalog.data.gemMarketSnapshots.at(-1)?.sourceDate || "待更新",
    });
    const target = plan.value.targetLevel.replaceAll("★", "星");
    const fileName = `宝石计划-${target}-${plan.value.startDate}.png`;
    const file = new File([blob], fileName, { type: "image/png" });
    const shareData: ShareData = { files: [file], title: `宝石计划 · ${formatGemLevel(plan.value.targetLevel)}` };
    const supportsFileShare = typeof navigator.share === "function"
      && typeof navigator.canShare === "function"
      && navigator.canShare(shareData);

    if (supportsFileShare) {
      try {
        await navigator.share(shareData);
        showShareNotice("宝石计划图片已生成");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    downloadImage(blob, fileName);
    showShareNotice("宝石计划图片已下载");
  } catch {
    showShareNotice("图片生成失败，请重试");
  } finally {
    sharing.value = false;
  }
}
</script>

<template>
  <div class="page-wrap plan-page gem-plan-page">
    <PlansNav />

    <section class="gem-plan-header">
      <div class="gem-plan-heading">
        <h2 class="gem-plan-heading-desktop">目标与投入</h2>
        <h2 class="gem-plan-heading-mobile">宝石计划</h2>
        <p>选定目标段位和每周投入，查看五个账号的完成时间。</p>
      </div>
      <form class="gem-plan-controls" aria-label="宝石计划参数" @submit.prevent>
        <label>
          <span>目标段位</span>
          <select :value="settings.gemPlan.targetLevel" aria-label="目标段位" @change="setTarget">
            <option v-for="level in targetLevels" :key="level" :value="level">{{ formatGemLevel(level) }}</option>
          </select>
        </label>
        <label>
          <span>每号每周投入 / 万</span>
          <input type="number" min="0" step="1" :value="settings.gemPlan.weeklyIncomeWan" aria-label="每号每周投入" @change="setWeeklyIncome" />
        </label>
        <button class="button primary gem-plan-share" type="button" :disabled="sharing" aria-label="分享宝石计划" @click="shareGemPlan">
          {{ sharing ? "正在生成…" : "生成分享图" }}
        </button>
      </form>
    </section>
    <p v-if="shareNotice" class="gem-plan-notice" role="status">{{ shareNotice }}</p>

    <section class="gem-plan-summary" aria-label="宝石计划汇总">
      <div class="gem-plan-summary-primary">
        <span>目标</span>
        <strong>{{ formatGemLevel(plan.targetLevel) }}</strong>
        <small>五号装备统一目标</small>
      </div>
      <div>
        <span>总缺口</span>
        <strong>{{ formatNumber(plan.totalGap) }}</strong>
        <small>颗</small>
      </div>
      <div>
        <span>总预算</span>
        <strong>{{ compactCost(plan.totalCost) }}</strong>
        <small>当前行情</small>
      </div>
      <div class="gem-plan-summary-finish">
        <span>最长周期</span>
        <strong>{{ weeksLabel(plan.longestWeeks) }}</strong>
        <small>{{ formatDate(plan.finishDate) }}</small>
      </div>
    </section>

    <section class="gem-account-ledger" aria-labelledby="gem-account-ledger-title">
      <header>
        <div><h2 id="gem-account-ledger-title">五号进度</h2><p>每个账号按 {{ formatNumber(plan.weeklyIncomeWan) }} 万 / 周独立计算</p></div>
      </header>
      <div class="gem-account-ledger-head" aria-hidden="true">
        <span>账号</span><span>当前完成度</span><span>剩余缺口</span><span>预算</span><span>周期</span><span>预计完成</span>
      </div>
      <div class="gem-account-ledger-body">
        <button
          v-for="account in plan.accounts"
          :key="account.accountId"
          type="button"
          class="gem-account-row"
          :class="{ selected: selected === account.accountId }"
          :style="{ '--account-tone': accountTones[account.accountId] }"
          :aria-pressed="selected === account.accountId"
          :aria-label="`查看 ${account.accountId} 宝石计划`"
          @click="selected = account.accountId"
        >
          <b>{{ account.accountId }}</b>
          <span class="gem-account-progress">
            <em>{{ account.completion.toFixed(1) }}%</em>
            <i><i :style="{ width: `${account.completion}%` }"></i></i>
          </span>
          <span class="gem-account-gap"><strong>{{ formatNumber(account.gap) }}</strong><small>颗</small></span>
          <span class="gem-account-budget"><strong>{{ compactCost(account.cost) }}</strong></span>
          <span class="gem-account-cycle"><strong>{{ weeksLabel(account.weeks) }}</strong></span>
          <span class="gem-account-due"><strong>{{ formatDate(account.finishDate) }}</strong></span>
        </button>
      </div>
    </section>

    <section v-if="selectedPlan" class="gem-equipment-plan" aria-labelledby="gem-equipment-title">
      <header>
        <div>
          <h2 id="gem-equipment-title">{{ selectedPlan.accountId }} · 到 {{ formatGemLevel(plan.targetLevel) }}</h2>
          <p>六件装备</p>
        </div>
        <div class="gem-equipment-totals">
          <span>剩余宝石<strong>{{ formatNumber(selectedPlan.gap) }}</strong></span>
          <span>预计总预算<strong>{{ compactCost(selectedPlan.cost) }}</strong></span>
          <span>预计所需周期<strong>{{ weeksLabel(selectedPlan.weeks) }}</strong></span>
        </div>
      </header>
      <div class="gem-equipment-head" aria-hidden="true">
        <span>部位 / 装备</span><span>宝石</span><span>当前 → 目标</span><span>剩余宝石</span><span>预计费用</span><span>进度</span>
      </div>
      <div class="gem-equipment-list">
        <article v-for="entry in selectedPlan.items" :key="entry.item.id">
          <div class="gem-equipment-identity"><span>{{ entry.item.slot }}</span><strong>{{ entry.item.name }}</strong></div>
          <div class="gem-equipment-name"><strong>{{ entry.item.gem.name }}</strong><small>{{ entry.item.gem.effect }}</small></div>
          <div class="gem-equipment-level"><strong>{{ entry.item.gem.level }} → {{ plan.targetLevel }}</strong></div>
          <div class="gem-equipment-gap"><strong>{{ entry.gap ? formatNumber(entry.gap) : "已达成" }}</strong><small v-if="entry.gap">颗</small></div>
          <div class="gem-equipment-cost"><strong>{{ compactCost(entry.cost) }}</strong></div>
          <div class="gem-equipment-progress"><i><i :style="{ width: `${entry.completion}%` }"></i></i><small>{{ entry.completion.toFixed(1) }}%</small></div>
        </article>
      </div>
    </section>

    <section class="gem-market-strip">
      <header><div><h2>当前生效行情</h2><p>{{ catalog.data.gemMarketSnapshots.at(-1)?.sourceDate }} · 银币 / 颗</p></div><RouterLink to="/data/market">维护行情 →</RouterLink></header>
      <div>
        <span v-for="item in market" :key="item.name"><small>{{ item.name }}</small><strong>{{ formatNumber(item.price) }}</strong><em v-if="item.edited">本地覆盖</em></span>
      </div>
    </section>
  </div>
</template>
