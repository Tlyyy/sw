<script setup lang="ts">
import "../../../styles/gem-plan.css";
import PlansNav from "../../../features/plans/PlansNav.vue";
import { useGemPlanPage } from "../../../features/plans/useGemPlanPage";

const page = useGemPlanPage();
</script>

<template>
  <div class="page-wrap plan-page gem-plan-page desktop-gem-plan-page" data-platform-page="desktop">
    <PlansNav />
    <section class="gem-plan-header">
      <div class="gem-plan-heading"><h2>目标与投入</h2><p>选定目标段位和每周投入，查看五个账号的完成时间。</p></div>
      <form class="gem-plan-controls" aria-label="宝石计划参数" @submit.prevent>
        <label><span>目标段位</span><select :value="page.settings.gemPlan.targetLevel" aria-label="目标段位" @change="page.setTarget"><option v-for="level in page.targetLevels.value" :key="level" :value="level">{{ page.formatGemLevel(level) }}</option></select></label>
        <label><span>每号每周投入 / 万</span><input type="number" min="0" step="1" :value="page.settings.gemPlan.weeklyIncomeWan" aria-label="每号每周投入" @change="page.setWeeklyIncome"></label>
        <button class="button primary gem-plan-share" type="button" :disabled="page.sharing.value" aria-label="分享宝石计划" @click="page.shareGemPlan">{{ page.sharing.value ? "正在生成…" : "生成分享图" }}</button>
      </form>
    </section>
    <p v-if="page.shareNotice.value" class="gem-plan-notice" role="status">{{ page.shareNotice.value }}</p>
    <section class="gem-plan-summary" aria-label="宝石计划汇总">
      <div class="gem-plan-summary-primary"><span>目标</span><strong>{{ page.formatGemLevel(page.plan.value.targetLevel) }}</strong><small>五号装备统一目标</small></div>
      <div><span>总缺口</span><strong>{{ page.formatNumber(page.plan.value.totalGap) }}</strong><small>颗</small></div>
      <div><span>总预算</span><strong>{{ page.compactCost(page.plan.value.totalCost) }}</strong><small>当前行情</small></div>
      <div class="gem-plan-summary-finish"><span>最长周期</span><strong>{{ page.weeksLabel(page.plan.value.longestWeeks) }}</strong><small>{{ page.formatDate(page.plan.value.finishDate) }}</small></div>
    </section>
    <section class="gem-account-ledger" aria-labelledby="desktop-gem-account-title">
      <header><div><h2 id="desktop-gem-account-title">五号进度</h2><p>每个账号按 {{ page.formatNumber(page.plan.value.weeklyIncomeWan) }} 万 / 周独立计算</p></div></header>
      <div class="gem-account-ledger-head" aria-hidden="true"><span>账号</span><span>当前完成度</span><span>剩余缺口</span><span>预算</span><span>周期</span><span>预计完成</span></div>
      <div class="gem-account-ledger-body">
        <button v-for="account in page.plan.value.accounts" :key="account.accountId" type="button" class="gem-account-row" :class="{ selected: page.selected.value === account.accountId }" :style="{ '--account-tone': page.accountTones[account.accountId] }" :aria-pressed="page.selected.value === account.accountId" :aria-label="`查看 ${account.accountId} 宝石计划`" @click="page.selected.value = account.accountId">
          <b>{{ account.accountId }}</b><span class="gem-account-progress"><em>{{ account.completion.toFixed(1) }}%</em><i><i :style="{ width: `${account.completion}%` }"></i></i></span><span class="gem-account-gap"><strong>{{ page.formatNumber(account.gap) }}</strong><small>颗</small></span><span class="gem-account-budget"><strong>{{ page.compactCost(account.cost) }}</strong></span><span class="gem-account-cycle"><strong>{{ page.weeksLabel(account.weeks) }}</strong></span><span class="gem-account-due"><strong>{{ page.formatDate(account.finishDate) }}</strong></span>
        </button>
      </div>
    </section>
    <section v-if="page.selectedPlan.value" class="gem-equipment-plan" aria-labelledby="desktop-gem-equipment-title">
      <header><div><h2 id="desktop-gem-equipment-title">{{ page.selectedPlan.value.accountId }} · 到 {{ page.formatGemLevel(page.plan.value.targetLevel) }}</h2><p>六件装备</p></div><div class="gem-equipment-totals"><span>剩余宝石<strong>{{ page.formatNumber(page.selectedPlan.value.gap) }}</strong></span><span>预计总预算<strong>{{ page.compactCost(page.selectedPlan.value.cost) }}</strong></span><span>预计所需周期<strong>{{ page.weeksLabel(page.selectedPlan.value.weeks) }}</strong></span></div></header>
      <div class="gem-equipment-head" aria-hidden="true"><span>部位 / 装备</span><span>宝石</span><span>当前 → 目标</span><span>剩余宝石</span><span>预计费用</span><span>进度</span></div>
      <div class="gem-equipment-list"><article v-for="entry in page.selectedPlan.value.items" :key="entry.item.id"><div class="gem-equipment-identity"><span>{{ entry.item.slot }}</span><strong>{{ entry.item.name }}</strong></div><div class="gem-equipment-name"><strong>{{ entry.item.gem.name }}</strong><small>{{ entry.item.gem.effect }}</small></div><div class="gem-equipment-level"><strong>{{ entry.item.gem.level }} → {{ page.plan.value.targetLevel }}</strong></div><div class="gem-equipment-gap"><strong>{{ entry.gap ? page.formatNumber(entry.gap) : "已达成" }}</strong><small v-if="entry.gap">颗</small></div><div class="gem-equipment-cost"><strong>{{ page.compactCost(entry.cost) }}</strong></div><div class="gem-equipment-progress"><i><i :style="{ width: `${entry.completion}%` }"></i></i><small>{{ entry.completion.toFixed(1) }}%</small></div></article></div>
    </section>
    <section class="gem-market-strip"><header><div><h2>当前生效行情</h2><p>{{ page.catalog.data.gemMarketSnapshots.at(-1)?.sourceDate }} · 银币 / 颗</p></div><RouterLink to="/data/market">维护行情 →</RouterLink></header><div><span v-for="item in page.market.value" :key="item.name"><small>{{ item.name }}</small><strong>{{ page.formatNumber(item.price) }}</strong><em v-if="item.edited">本地覆盖</em></span></div></section>
  </div>
</template>
