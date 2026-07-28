<script setup lang="ts">
import AppIcon from "../../../components/AppIcon.vue";
import { useEarningsPage } from "../../../features/accounting/useEarningsPage";

const page = useEarningsPage();
</script>

<template>
  <div class="mobile-earnings-page" data-platform-page="mobile" data-testid="earnings-page">
    <header class="mobile-title">
      <div><p>库存变化核算</p><h1>实际所得</h1></div>
      <RouterLink to="/record" aria-label="补充库存或流水"><AppIcon name="record" /></RouterLink>
    </header>

    <nav class="mobile-account-strip" aria-label="选择核算账号">
      <button
        type="button"
        :class="{ active: page.selectedScope.value === 'all' }"
        :aria-pressed="page.selectedScope.value === 'all'"
        aria-label="查看所有账号实际所得"
        @click="page.selectAccount('all')"
      ><strong>全部</strong><small>周表</small></button>
      <button
        v-for="account in page.catalog.data.accounts"
        :key="account.id"
        type="button"
        :class="{ active: page.selectedScope.value === account.id }"
        :aria-pressed="page.selectedScope.value === account.id"
        :aria-label="`查看 ${account.id} 实际所得`"
        @click="page.selectAccount(account.id)"
      ><strong>{{ account.id }}</strong><small>账号</small></button>
    </nav>

    <p v-if="page.ledgerNotice.value" class="mobile-notice" role="status">{{ page.ledgerNotice.value }}</p>
    <p v-if="page.incomeShareNotice.value" class="mobile-notice" role="status">{{ page.incomeShareNotice.value }}</p>

    <section v-if="page.selectedScope.value === 'all'" class="mobile-week-ledger" aria-labelledby="mobile-daily-title">
      <header>
        <div><small>{{ page.shortDate(page.dailyTableData.value.weekStart) }}—{{ page.shortDate(page.dailyTableData.value.weekEnd) }}</small><h2 id="mobile-daily-title">五账号每日实际所得</h2></div>
        <b>{{ page.dailyTableData.value.recordedDays }}/7 天</b>
      </header>
      <div class="mobile-metric-toggle" role="group" aria-label="切换五账号每日所得口径">
        <button type="button" :class="{ active: page.dailyTableMetric.value === 'silverWan' }" :aria-pressed="page.dailyTableMetric.value === 'silverWan'" @click="page.setDailyTableMetric('silverWan')">银子</button>
        <button type="button" :class="{ active: page.dailyTableMetric.value === 'silverWithRegularEggsWan' }" :aria-pressed="page.dailyTableMetric.value === 'silverWithRegularEggsWan'" @click="page.setDailyTableMetric('silverWithRegularEggsWan')">银+蛋折银</button>
      </div>
      <ol class="mobile-day-list">
        <li v-for="row in page.dailyTableData.value.rows" :key="row.date" :data-date="row.date">
          <header><div><strong>{{ row.label }}</strong><small>{{ page.compactDailyBasis(row.basis) }}</small></div><b :class="page.dailyTableValueTone(row.total)">{{ page.dailyTableValueLabel(row.total) }}</b></header>
          <dl>
            <div v-for="accountId in page.accountIds" :key="accountId"><dt>{{ accountId }}</dt><dd :class="page.dailyTableValueTone(row.values[accountId])">{{ page.dailyTableValueLabel(row.values[accountId]) }}</dd></div>
          </dl>
        </li>
      </ol>
      <dl class="mobile-week-totals">
        <div v-for="row in page.dailyTableSummaryRows.value" :key="row.label"><dt>{{ row.label }}</dt><dd :class="page.dailyTableValueTone(row.total)">{{ page.dailyTableValueLabel(row.total) }} 万</dd></div>
      </dl>
      <button
        class="mobile-share"
        type="button"
        :disabled="!page.hasDailyIncomeToShare.value || page.sharingAnyIncome.value"
        :aria-busy="page.sharingDailyTable.value"
        :aria-label="page.dailyTableShareButtonLabel.value"
        @click="page.shareVisibleDailyIncome"
      ><AppIcon :name="page.sharingDailyTable.value ? 'refresh' : 'share'" />{{ page.sharingDailyTable.value ? "生成中…" : "分享本周五账号表格" }}</button>
    </section>

    <template v-else>
      <section class="mobile-account-hero" aria-label="当前库存">
        <header>
          <div><small>{{ page.selectedAccount.value }} · 当前库存</small><h2 id="mobile-account-overview-title">{{ page.wanLabel(page.selectedBalance.value?.silverWan, false) }}</h2></div>
          <button type="button" :disabled="!page.latestInterval.value || page.sharingAnyIncome.value" :aria-busy="page.sharingIncome.value" :aria-label="page.shareButtonLabel.value" @click="page.shareLatestIncome"><AppIcon :name="page.sharingIncome.value ? 'refresh' : 'share'" /></button>
        </header>
        <dl class="selected-account-metrics">
          <div><dt>专用蛋</dt><dd>{{ page.inventoryCountLabel(page.selectedBalance.value?.dedicatedEggs, "个") }}</dd></div>
          <div><dt>普通蛋</dt><dd>{{ page.inventoryCountLabel(page.selectedBalance.value?.regularEggs, "个") }}</dd></div>
          <div><dt>碎片</dt><dd>{{ page.inventoryCountLabel(page.selectedBalance.value?.innerShardCount, "片") }}</dd></div>
        </dl>
        <p v-if="page.summary.value.pending.entries.length">{{ page.summary.value.pending.entries.length }} 笔流水等待下次库存核销</p>
      </section>

      <section class="mobile-records" aria-labelledby="mobile-records-title">
        <header><h2 id="mobile-records-title">{{ page.selectedAccount.value }} 核算记录</h2><div role="tablist" aria-label="选择核算记录类型"><button id="mobile-ledger-tab" role="tab" :aria-selected="page.detailView.value === 'ledger'" :class="{ active: page.detailView.value === 'ledger' }" @click="page.detailView.value = 'ledger'">流水</button><button id="mobile-interval-tab" role="tab" :aria-selected="page.detailView.value === 'intervals'" :class="{ active: page.detailView.value === 'intervals' }" @click="page.detailView.value = 'intervals'">跨天</button></div></header>
        <div v-if="page.detailView.value === 'ledger'" class="mobile-ledger-list" role="tabpanel" aria-labelledby="mobile-ledger-tab">
          <article v-for="entry in page.ledgerEntries.value" :key="entry.id" :class="{ void: entry.status === 'void' }">
            <header><span :class="page.entryTone(entry)">{{ page.entryKind(entry) }}</span><time>{{ entry.effectiveDate.slice(5) }}</time></header>
            <strong>{{ page.entryResourceText(entry) }}</strong><p>{{ entry.note || "未填写备注" }}</p>
            <button v-if="page.canVoid(entry)" type="button" @click="page.voidLedgerEntry(entry)">撤销记录</button>
          </article>
          <p v-if="!page.ledgerEntries.value.length" class="mobile-empty">还没有流水记录。</p>
        </div>
        <div v-else class="mobile-interval-list" role="tabpanel" aria-labelledby="mobile-interval-tab">
          <article v-for="interval in page.recentCrossDayIntervals.value" :key="`${interval.fromRecordedAt}:${interval.toRecordedAt}`">
            <header><strong>{{ interval.intervalDays }} 天</strong><span>{{ page.intervalRange(interval) }}</span></header>
            <dl><div><dt>实际所得</dt><dd>{{ page.wanLabel(interval.actualIncome.silverWan) }}</dd></div><div><dt>库存变化</dt><dd>{{ page.wanLabel(interval.inventoryNetChange.silverWan) }}</dd></div><div><dt>流水修正</dt><dd>{{ page.wanLabel(interval.ledgerImpact.silverWan) }}</dd></div></dl>
          </article>
          <p v-if="!page.recentCrossDayIntervals.value.length" class="mobile-empty">目前没有跨天区间。</p>
        </div>
      </section>

      <details class="mobile-accounting-rule accounting-rule">
        <summary><strong>核算口径</strong><span>库存变化 + 流水修正 <AppIcon name="chevron-right" /></span></summary>
        <ol><li>开始与结束库存计算净变化</li><li>加回任务和其他确认支出</li><li>转账、调整等非收益变化排除</li></ol>
      </details>
    </template>
  </div>
</template>

<style scoped>
.mobile-earnings-page{width:100%;padding:8px 12px 112px;color:#1d2939}.mobile-title{display:flex;align-items:center;justify-content:space-between;padding:5px 2px 12px}.mobile-title p{color:#c44d00;font-size:10px;font-weight:800;letter-spacing:.08em}.mobile-title h1{font-size:24px}.mobile-title>a{width:42px;height:42px;display:grid;place-items:center;border:1px solid rgba(60,60,67,.15);border-radius:12px;color:#c44d00;background:white}.mobile-title svg{width:19px}.mobile-account-strip{position:sticky;z-index:40;top:calc(var(--ios-mobile-header-height,68px) + env(safe-area-inset-top));display:flex;gap:7px;overflow-x:auto;margin:0 -12px 10px;padding:8px 12px;background:rgba(246,247,249,.94);backdrop-filter:blur(18px)}.mobile-account-strip button{min-width:58px;min-height:51px;display:grid;place-items:center;align-content:center;gap:1px;padding:5px;border:1px solid rgba(60,60,67,.15);border-radius:11px;background:white}.mobile-account-strip button:first-child{min-width:68px}.mobile-account-strip button.active{border-color:#c44d00;color:#c44d00;background:#fff7f0;box-shadow:inset 0 0 0 1px rgba(196,77,0,.15)}.mobile-account-strip strong{font-size:12px}.mobile-account-strip small{color:#8b95a5;font-size:9px}.mobile-notice{margin:7px 0;padding:10px 12px;border-radius:9px;color:#06705f;font-size:11px;background:#eaf8f4}.mobile-week-ledger,.mobile-account-hero,.mobile-records,.mobile-accounting-rule{overflow:hidden;border:1px solid rgba(60,60,67,.15);border-radius:13px;background:rgba(255,255,255,.94);box-shadow:0 4px 14px rgba(17,24,39,.04)}.mobile-week-ledger>header{display:flex;align-items:center;justify-content:space-between;padding:13px 14px 9px}.mobile-week-ledger>header small,.mobile-account-hero small{color:#8b95a5;font-size:10px}.mobile-week-ledger h2{margin-top:2px;font-size:16px}.mobile-week-ledger>header>b{padding:5px 7px;border-radius:6px;color:#06705f;font-size:10px;background:#eaf8f4}.mobile-metric-toggle{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:0 12px 10px;padding:3px;border-radius:9px;background:#eff1f4}.mobile-metric-toggle button{min-height:34px;border:0;border-radius:7px;color:#697386;font-size:11px;background:transparent}.mobile-metric-toggle button.active{color:#1d2939;background:white;box-shadow:0 1px 4px rgba(17,24,39,.12)}.mobile-day-list{display:grid;gap:7px;margin:0;padding:0 10px 10px;list-style:none}.mobile-day-list>li{padding:10px;border:1px solid rgba(60,60,67,.12);border-radius:10px;background:#fbfcfd}.mobile-day-list header{display:flex;align-items:center;justify-content:space-between}.mobile-day-list header div{display:grid}.mobile-day-list header strong{font-size:12px}.mobile-day-list header small{color:#8b95a5;font-size:9px}.mobile-day-list header>b{font-size:14px}.mobile-day-list dl{display:grid;grid-template-columns:repeat(5,1fr);margin-top:8px;padding-top:8px;border-top:1px solid rgba(60,60,67,.1)}.mobile-day-list dl div{text-align:center}.mobile-day-list dt{color:#8b95a5;font-size:8px}.mobile-day-list dd{margin-top:2px;font-size:10px;font-weight:750}.positive{color:#06705f}.negative{color:#bd351f}.unknown{color:#a2a9b4}.mobile-week-totals{display:grid;grid-template-columns:1fr 1fr;margin:0 10px 10px;border:1px solid rgba(196,77,0,.16);border-radius:10px;background:#fff8f2}.mobile-week-totals div{padding:10px 12px}.mobile-week-totals div+div{border-left:1px solid rgba(196,77,0,.14)}.mobile-week-totals dt{color:#8b5a3c;font-size:9px}.mobile-week-totals dd{margin-top:3px;font-size:14px;font-weight:850}.mobile-share{min-height:46px;width:calc(100% - 20px);display:flex;align-items:center;justify-content:center;gap:7px;margin:0 10px 10px;border:0;border-radius:10px;color:white;font-weight:750;background:#c44d00}.mobile-share svg{width:16px}.mobile-account-hero{margin-bottom:10px;background:linear-gradient(145deg,#fff 0%,#fff7f0 100%)}.mobile-account-hero>header{display:flex;align-items:center;justify-content:space-between;padding:15px 14px 12px}.mobile-account-hero h2{margin-top:3px;font-size:27px}.mobile-account-hero>header button{width:42px;height:42px;display:grid;place-items:center;border:1px solid rgba(196,77,0,.2);border-radius:11px;color:#c44d00;background:white}.mobile-account-hero>header svg{width:18px}.mobile-account-hero>dl{display:grid;grid-template-columns:repeat(3,1fr);margin:0;border-top:1px solid rgba(60,60,67,.1)}.mobile-account-hero>dl div{padding:11px 10px;border-right:1px solid rgba(60,60,67,.1);text-align:center}.mobile-account-hero>dl div:last-child{border:0}.mobile-account-hero dt{color:#8b95a5;font-size:9px}.mobile-account-hero dd{margin-top:3px;font-size:13px;font-weight:800}.mobile-account-hero>p{padding:9px 12px;border-top:1px solid rgba(60,60,67,.1);color:#9b5b00;font-size:10px;background:#fff7db}.mobile-records{margin-bottom:10px}.mobile-records>header{display:flex;align-items:center;justify-content:space-between;padding:11px 12px;border-bottom:1px solid rgba(60,60,67,.12)}.mobile-records h2{font-size:14px}.mobile-records>header>div{display:flex;padding:2px;border-radius:7px;background:#eff1f4}.mobile-records>header button{min-height:29px;padding:0 9px;border:0;border-radius:6px;color:#697386;font-size:10px;background:transparent}.mobile-records>header button.active{color:#1d2939;background:white;box-shadow:0 1px 3px rgba(17,24,39,.1)}.mobile-ledger-list article{padding:12px;border-bottom:1px solid rgba(60,60,67,.1)}.mobile-ledger-list article.void{opacity:.55}.mobile-ledger-list article>header{display:flex;justify-content:space-between;margin-bottom:7px}.mobile-ledger-list article>header span{padding:3px 6px;border-radius:5px;color:#bd351f;font-size:9px;font-weight:800;background:#fff0ec}.mobile-ledger-list article>header span.transfer{color:#185a91;background:#edf6ff}.mobile-ledger-list article>header span.adjustment{color:#915c00;background:#fff7db}.mobile-ledger-list time{color:#8b95a5;font-size:9px}.mobile-ledger-list article>strong{font-size:13px}.mobile-ledger-list article>p{margin-top:3px;color:#697386;font-size:10px}.mobile-ledger-list article>button{min-height:30px;margin-top:8px;border:1px solid rgba(60,60,67,.15);border-radius:7px;color:#bd351f;font-size:10px;background:white}.mobile-interval-list article{padding:12px;border-bottom:1px solid rgba(60,60,67,.1)}.mobile-interval-list article header{display:flex;justify-content:space-between}.mobile-interval-list article header span{color:#8b95a5;font-size:10px}.mobile-interval-list dl{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:9px}.mobile-interval-list dl div{padding:7px;border-radius:7px;background:#f6f7f9}.mobile-interval-list dt{color:#8b95a5;font-size:8px}.mobile-interval-list dd{margin-top:2px;font-size:10px;font-weight:750}.mobile-empty{padding:30px 12px;color:#8b95a5;font-size:11px;text-align:center}.mobile-accounting-rule summary{min-height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;list-style:none}.mobile-accounting-rule summary span{display:flex;align-items:center;gap:5px;color:#8b95a5;font-size:10px}.mobile-accounting-rule summary svg{width:14px}.mobile-accounting-rule[open] summary svg{transform:rotate(90deg)}.mobile-accounting-rule ol{display:grid;gap:7px;margin:0;padding:11px 12px 14px 30px;border-top:1px solid rgba(60,60,67,.1);color:#697386;font-size:10px}
.mobile-title p,.mobile-account-strip small,.mobile-week-ledger>header small,.mobile-account-hero small,.mobile-week-ledger>header>b,.mobile-day-list header small,.mobile-day-list dt,.mobile-day-list dd,.mobile-week-totals dt,.mobile-account-hero dt,.mobile-account-hero>p,.mobile-records>header button,.mobile-ledger-list article>header span,.mobile-ledger-list time,.mobile-ledger-list article>p,.mobile-ledger-list article>button,.mobile-interval-list article header span,.mobile-interval-list dt,.mobile-interval-list dd,.mobile-accounting-rule summary span,.mobile-accounting-rule ol{font-size:11px}
</style>
