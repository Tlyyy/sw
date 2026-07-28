<script setup lang="ts">
import "../../../styles/gem-plan.css";
import PlansNav from "../../../features/plans/PlansNav.vue";
import { useGemPlanPage } from "../../../features/plans/useGemPlanPage";

const page = useGemPlanPage();
</script>

<template>
  <div class="page-wrap plan-page mobile-gem-plan-page" data-platform-page="mobile">
    <PlansNav />
    <header class="mobile-gem-hero"><small>五号升级预算</small><h1>宝石计划</h1><p>先设目标，再逐号查看装备缺口。</p></header>
    <form class="mobile-gem-controls" aria-label="宝石计划参数" @submit.prevent>
      <label><span>目标段位</span><select :value="page.settings.gemPlan.targetLevel" aria-label="目标段位" @change="page.setTarget"><option v-for="level in page.targetLevels.value" :key="level" :value="level">{{ page.formatGemLevel(level) }}</option></select></label>
      <label><span>每号每周投入 / 万</span><input type="number" min="0" step="1" :value="page.settings.gemPlan.weeklyIncomeWan" aria-label="每号每周投入" @change="page.setWeeklyIncome"></label>
      <button type="button" :disabled="page.sharing.value" aria-label="分享宝石计划" @click="page.shareGemPlan">{{ page.sharing.value ? "生成中…" : "分享计划" }}</button>
    </form>
    <p v-if="page.shareNotice.value" class="mobile-gem-notice" role="status">{{ page.shareNotice.value }}</p>
    <section class="mobile-gem-summary" aria-label="宝石计划汇总"><div><span>总缺口</span><strong>{{ page.formatNumber(page.plan.value.totalGap) }} 颗</strong></div><div><span>总预算</span><strong>{{ page.compactCost(page.plan.value.totalCost) }}</strong></div><div><span>最长周期</span><strong>{{ page.weeksLabel(page.plan.value.longestWeeks) }}</strong></div></section>
    <p class="mobile-gem-cycle-copy">每个账号按 {{ page.formatNumber(page.plan.value.weeklyIncomeWan) }} 万 / 周独立计算</p>
    <nav class="mobile-account-tabs" aria-label="宝石计划账号">
      <button v-for="account in page.plan.value.accounts" :key="account.accountId" type="button" class="gem-account-row" :class="{ active: page.selected.value === account.accountId }" :aria-pressed="page.selected.value === account.accountId" :aria-label="`查看 ${account.accountId} 宝石计划`" @click="page.selected.value = account.accountId"><b>{{ account.accountId }}</b><span>{{ account.completion.toFixed(0) }}%</span></button>
    </nav>
    <section v-if="page.selectedPlan.value" class="mobile-gem-account">
      <header><div><small>当前账号</small><h2>{{ page.selectedPlan.value.accountId }} · 到 {{ page.formatGemLevel(page.plan.value.targetLevel) }}</h2></div><strong>{{ page.weeksLabel(page.selectedPlan.value.weeks) }}</strong></header>
      <div class="mobile-gem-account-totals"><span>剩余 <b>{{ page.formatNumber(page.selectedPlan.value.gap) }} 颗</b></span><span>预算 <b>{{ page.compactCost(page.selectedPlan.value.cost) }}</b></span><span>完成 <b>{{ page.selectedPlan.value.completion.toFixed(1) }}%</b></span></div>
      <div class="mobile-equipment-cards"><article v-for="entry in page.selectedPlan.value.items" :key="entry.item.id"><div><small>{{ entry.item.slot }}</small><strong>{{ entry.item.name }}</strong><span>{{ entry.item.gem.name }} · {{ entry.item.gem.effect }}</span></div><div><b>{{ entry.item.gem.level }} → {{ page.plan.value.targetLevel }}</b><strong>{{ entry.gap ? `${page.formatNumber(entry.gap)} 颗` : "已达成" }}</strong><small>{{ page.compactCost(entry.cost) }}</small></div></article></div>
    </section>
    <RouterLink class="mobile-market-link" to="/data/market">查看并维护当前宝石行情</RouterLink>
  </div>
</template>

<style scoped>
.mobile-gem-plan-page{width:100%;padding:6px 12px 112px}.mobile-gem-hero{padding:12px 2px}.mobile-gem-hero small{color:#c44d00;font-size:11px;font-weight:850}.mobile-gem-hero h1{font-size:25px}.mobile-gem-hero p{color:#697386;font-size:12px}.mobile-gem-controls{display:grid;grid-template-columns:1fr 1fr;gap:9px;padding:12px;border:1px solid rgba(60,60,67,.15);border-radius:13px;background:#fff}.mobile-gem-controls label{display:grid;gap:5px}.mobile-gem-controls span{font-size:11px;font-weight:750}.mobile-gem-controls input,.mobile-gem-controls select,.mobile-gem-controls button{min-height:44px}.mobile-gem-controls button{grid-column:1/-1;border:0;border-radius:9px;color:#fff;background:#b54b12;font-weight:800}.mobile-gem-notice{margin:8px 0;color:#18634b;font-size:12px}.mobile-gem-summary{display:grid;grid-template-columns:repeat(3,1fr);margin:10px 0;border:1px solid rgba(60,60,67,.14);border-radius:12px;background:#fff}.mobile-gem-summary div{display:grid;gap:4px;padding:11px 8px;border-right:1px solid rgba(60,60,67,.1)}.mobile-gem-summary div:last-child{border:0}.mobile-gem-summary span{font-size:10px;color:#697386}.mobile-gem-summary strong{font-size:14px}.mobile-account-tabs{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-bottom:10px}.mobile-account-tabs button{min-width:0;min-height:50px;display:grid;place-items:center;border:1px solid rgba(60,60,67,.15);border-radius:9px;background:#fff}.mobile-account-tabs button.active{border-color:#b54b12;color:#9f3b08;background:#fff3eb}.mobile-account-tabs span{font-size:10px}.mobile-gem-account{overflow:hidden;border:1px solid rgba(60,60,67,.15);border-radius:13px;background:#fff}.mobile-gem-account>header{display:flex;align-items:center;justify-content:space-between;padding:12px;border-bottom:1px solid rgba(60,60,67,.1)}.mobile-gem-account>header small,.mobile-gem-account-totals span,.mobile-equipment-cards small,.mobile-equipment-cards span{font-size:10px;color:#697386}.mobile-gem-account>header h2{font-size:17px}.mobile-gem-account>header>strong{color:#b54b12}.mobile-gem-account-totals{display:grid;grid-template-columns:repeat(3,1fr);padding:9px 12px;background:#faf8f5}.mobile-gem-account-totals span{display:grid;gap:3px}.mobile-gem-account-totals b{color:#20242b;font-size:12px}.mobile-equipment-cards article{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:12px;border-top:1px solid rgba(60,60,67,.1)}.mobile-equipment-cards article>div{display:grid;gap:4px}.mobile-equipment-cards article>div:last-child{text-align:right}.mobile-equipment-cards strong{font-size:13px}.mobile-equipment-cards b{font-size:11px}.mobile-market-link{display:flex;align-items:center;justify-content:center;min-height:46px;margin-top:10px;border:1px solid rgba(60,60,67,.15);border-radius:11px;background:#fff;font-size:13px;font-weight:800}
.mobile-gem-controls label{min-width:0}.mobile-gem-controls input,.mobile-gem-controls select{width:100%;min-width:0;box-sizing:border-box}
.mobile-gem-cycle-copy{margin:0 2px 7px;color:#697386;font-size:11px}.mobile-account-tabs .gem-account-row{min-width:0;min-height:50px;display:grid;grid-template-columns:1fr;place-items:center;gap:0;padding:4px;border:1px solid rgba(60,60,67,.15);border-radius:9px;background:#fff;text-align:center}.mobile-account-tabs .gem-account-row.active{border-color:#b54b12;color:#9f3b08;background:#fff3eb}
.mobile-gem-summary span,
.mobile-account-tabs span,
.mobile-gem-account > header small,
.mobile-gem-account-totals span,
.mobile-equipment-cards small,
.mobile-equipment-cards span { font-size: 11px; }
</style>
