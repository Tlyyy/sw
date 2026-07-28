<script setup lang="ts">
import AppIcon from "../../../components/AppIcon.vue";
import { useEarningsPage } from "../../../features/accounting/useEarningsPage";

const page = useEarningsPage();
</script>

<template>
  <div class="desktop-earnings-page" data-platform-page="desktop" data-testid="earnings-page">
    <header class="desktop-earnings-head">
      <div>
        <p>PC 核算工作台</p>
        <h1>实际所得</h1>
        <span>用库存净变化与流水修正，横向核算五个账号。</span>
      </div>
      <RouterLink class="button primary" to="/record">补充库存或流水</RouterLink>
    </header>

    <nav class="desktop-account-tabs" aria-label="选择核算账号">
      <button
        type="button"
        :class="{ active: page.selectedScope.value === 'all' }"
        :aria-pressed="page.selectedScope.value === 'all'"
        aria-label="查看所有账号实际所得"
        @click="page.selectAccount('all')"
      >
        <strong>全部账号</strong><span>周度横向台账</span>
      </button>
      <button
        v-for="account in page.catalog.data.accounts"
        :key="account.id"
        type="button"
        :class="{ active: page.selectedScope.value === account.id }"
        :aria-pressed="page.selectedScope.value === account.id"
        :aria-label="`查看 ${account.id} 实际所得`"
        @click="page.selectAccount(account.id)"
      >
        <strong>{{ account.id }}</strong>
        <span>{{ page.reportByAccount.value[account.id].intervals.length }} 段已核算</span>
      </button>
    </nav>

    <p v-if="page.ledgerNotice.value" class="notice" role="status">{{ page.ledgerNotice.value }}</p>
    <p v-if="page.incomeShareNotice.value" class="notice" role="status">{{ page.incomeShareNotice.value }}</p>

    <section
      v-if="page.selectedScope.value === 'all'"
      class="desktop-daily-ledger"
      aria-labelledby="daily-earnings-table-title"
    >
      <header>
        <div>
          <p>本周五号 · 单位：万</p>
          <h2 id="daily-earnings-table-title">五账号每日实际所得</h2>
          <span>{{ page.shortDate(page.dailyTableData.value.weekStart) }}—{{ page.shortDate(page.dailyTableData.value.weekEnd) }} · {{ page.dailyTableData.value.recordedDays }} / 7 天已结算</span>
        </div>
        <div class="daily-actions">
          <div role="group" aria-label="切换五账号每日所得口径">
            <button
              type="button"
              :class="{ active: page.dailyTableMetric.value === 'silverWan' }"
              :aria-pressed="page.dailyTableMetric.value === 'silverWan'"
              @click="page.setDailyTableMetric('silverWan')"
            >银子</button>
            <button
              type="button"
              :class="{ active: page.dailyTableMetric.value === 'silverWithRegularEggsWan' }"
              :aria-pressed="page.dailyTableMetric.value === 'silverWithRegularEggsWan'"
              @click="page.setDailyTableMetric('silverWithRegularEggsWan')"
            >银+蛋折银</button>
          </div>
          <button
            class="daily-table-share"
            type="button"
            :disabled="!page.hasDailyIncomeToShare.value || page.sharingAnyIncome.value"
            :aria-busy="page.sharingDailyTable.value"
            :aria-label="page.dailyTableShareButtonLabel.value"
            @click="page.shareVisibleDailyIncome"
          >
            <AppIcon :name="page.sharingDailyTable.value ? 'refresh' : 'share'" />
            {{ page.sharingDailyTable.value ? "生成中…" : "分享表格" }}
          </button>
        </div>
      </header>

      <div class="daily-table-scroll">
        <table data-testid="five-account-daily-table">
          <caption class="visually-hidden">五账号本周每日实际所得（{{ page.dailyTableData.value.metricLabel }}）</caption>
          <thead><tr><th>日期</th><th v-for="accountId in page.accountIds" :key="accountId">{{ accountId }}</th><th>合计</th></tr></thead>
          <tbody>
            <tr
              v-for="row in page.dailyTableData.value.rows"
              :key="row.date"
              :data-date="row.date"
              :class="{ unsettled: row.total === null }"
            >
              <th scope="row"><strong>{{ row.label }}</strong><small>{{ page.compactDailyBasis(row.basis) }}</small></th>
              <td
                v-for="accountId in page.accountIds"
                :key="accountId"
                :data-account-id="accountId"
                :class="page.dailyTableValueTone(row.values[accountId])"
              >{{ page.dailyTableValueLabel(row.values[accountId]) }}</td>
              <td class="daily-total" :class="page.dailyTableValueTone(row.total)">{{ page.dailyTableValueLabel(row.total) }}</td>
            </tr>
            <tr v-for="row in page.dailyTableSummaryRows.value" :key="row.label" class="summary-row">
              <th scope="row"><strong>{{ row.label }}</strong><small>{{ row.basis }}</small></th>
              <td
                v-for="accountId in page.accountIds"
                :key="accountId"
                :data-account-id="accountId"
                :class="page.dailyTableValueTone(row.values[accountId])"
              >{{ page.dailyTableValueLabel(row.values[accountId]) }}</td>
              <td class="daily-total" :class="page.dailyTableValueTone(row.total)">{{ page.dailyTableValueLabel(row.total) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <main v-else class="desktop-account-workspace">
      <div class="account-summary-column">
        <section class="account-overview" aria-labelledby="selected-account-overview-title">
          <header>
            <div><p>{{ page.selectedAccount.value }} 账号</p><h2 id="selected-account-overview-title">当前库存</h2></div>
            <button
              type="button"
              :disabled="!page.latestInterval.value || page.sharingAnyIncome.value"
              :aria-busy="page.sharingIncome.value"
              :aria-label="page.shareButtonLabel.value"
              @click="page.shareLatestIncome"
            ><AppIcon :name="page.sharingIncome.value ? 'refresh' : 'share'" />{{ page.sharingIncome.value ? "生成中…" : page.shareButtonText.value }}</button>
          </header>
          <dl class="selected-account-metrics">
            <div><dt>银子</dt><dd>{{ page.wanLabel(page.selectedBalance.value?.silverWan, false) }}</dd></div>
            <div><dt>专用蛋</dt><dd>{{ page.inventoryCountLabel(page.selectedBalance.value?.dedicatedEggs, "个") }}</dd></div>
            <div><dt>普通蛋</dt><dd>{{ page.inventoryCountLabel(page.selectedBalance.value?.regularEggs, "个") }}</dd></div>
            <div><dt>碎片</dt><dd>{{ page.inventoryCountLabel(page.selectedBalance.value?.innerShardCount, "片") }}</dd></div>
          </dl>
          <aside v-if="page.summary.value.pending.entries.length" class="pending-ledger">
            <strong>{{ page.summary.value.pending.entries.length }} 笔流水等待库存核销</strong>
            <span>{{ page.wanLabel(page.summary.value.pending.ledgerImpact.silverWan) }}</span>
          </aside>
        </section>

        <details class="accounting-rule">
          <summary><span><small>核算说明</small><strong>实际所得 = 库存净变化 + 流水修正</strong></span><AppIcon name="chevron-right" /></summary>
          <ol>
            <li><b>先看真实库存</b><span>结束库存 − 开始库存</span></li>
            <li><b>再加回已确认支出</b><span>任务、打书、洗护符和其他支出</span></li>
            <li><b>排除非收益变化</b><span>账号转移与手动调整不算所得</span></li>
          </ol>
        </details>
      </div>

      <section class="account-detail" aria-labelledby="earnings-detail-title">
        <header>
          <div><p>当前账号明细</p><h2 id="earnings-detail-title">{{ page.selectedAccount.value }} 核算记录</h2></div>
          <div role="tablist" aria-label="选择核算记录类型">
            <button id="ledger-tab" role="tab" :aria-selected="page.detailView.value === 'ledger'" :class="{ active: page.detailView.value === 'ledger' }" @click="page.detailView.value = 'ledger'">实际流水 <span>{{ page.ledgerEntries.value.length }}</span></button>
            <button id="interval-tab" role="tab" :aria-selected="page.detailView.value === 'intervals'" :class="{ active: page.detailView.value === 'intervals' }" @click="page.detailView.value = 'intervals'">跨天区间 <span>{{ page.recentCrossDayIntervals.value.length }}</span></button>
          </div>
        </header>
        <section v-if="page.detailView.value === 'ledger'" class="ledger-list" role="tabpanel" aria-labelledby="ledger-tab">
          <article v-for="entry in page.ledgerEntries.value" :key="entry.id" :class="{ void: entry.status === 'void' }">
            <span :class="['kind', page.entryTone(entry)]">{{ page.entryKind(entry) }}</span>
            <div><strong>{{ page.entryResourceText(entry) }}</strong><p>{{ entry.note || "未填写备注" }}</p><small>{{ entry.effectiveDate }}<template v-if="page.pendingEntryIds.value.has(entry.id)"> · 等待库存核销</template><template v-if="entry.status === 'void'"> · 已撤销</template></small></div>
            <button v-if="page.canVoid(entry)" type="button" @click="page.voidLedgerEntry(entry)">撤销</button>
          </article>
          <p v-if="!page.ledgerEntries.value.length" class="empty">还没有支出、转账或调整记录。完成任务时会自动进入这里。</p>
        </section>
        <section v-else class="interval-list" role="tabpanel" aria-labelledby="interval-tab">
          <article v-for="interval in page.recentCrossDayIntervals.value" :key="`${interval.fromRecordedAt}:${interval.toRecordedAt}`">
            <header><strong>{{ interval.intervalDays }} 天区间</strong><span>{{ page.intervalRange(interval) }}</span></header>
            <dl><div><dt>实际所得</dt><dd>{{ page.wanLabel(interval.actualIncome.silverWan) }}</dd></div><div><dt>库存变化</dt><dd>{{ page.wanLabel(interval.inventoryNetChange.silverWan) }}</dd></div><div><dt>流水修正</dt><dd>{{ page.wanLabel(interval.ledgerImpact.silverWan) }}</dd></div></dl>
          </article>
          <p v-if="!page.recentCrossDayIntervals.value.length" class="empty">每日记录已在上表展示；只有缺天形成的跨天区间才会列在这里。</p>
        </section>
      </section>
    </main>
  </div>
</template>

<style scoped>
.desktop-earnings-page{width:min(100%,1320px);margin:0 auto;padding:14px 0 56px}.desktop-earnings-head{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:0 4px 16px;border-bottom:1px solid var(--color-border)}.desktop-earnings-head p,.desktop-daily-ledger>header p,.account-overview header p,.account-detail>header p{color:var(--color-accent-strong);font-size:11px;font-weight:850;letter-spacing:.08em}.desktop-earnings-head h1{font-size:28px}.desktop-earnings-head span{display:block;margin-top:4px;color:var(--color-text-muted);font-size:12px}.desktop-account-tabs{display:grid;grid-template-columns:1.35fr repeat(5,1fr);gap:8px;margin:14px 0}.desktop-account-tabs button{min-height:58px;display:grid;align-content:center;gap:3px;padding:9px 12px;border:1px solid var(--color-border);border-radius:10px;text-align:left;background:var(--color-surface)}.desktop-account-tabs button.active{border-color:var(--color-accent);box-shadow:inset 0 0 0 1px var(--color-accent);background:var(--color-accent-soft)}.desktop-account-tabs strong{font-size:13px}.desktop-account-tabs span{color:var(--color-text-muted);font-size:10px}.notice{margin:8px 0;padding:10px 12px;border-radius:8px;color:var(--color-success);background:var(--color-success-soft)}.desktop-daily-ledger,.account-overview,.account-detail,.accounting-rule{border:1px solid var(--color-border);border-radius:14px;background:var(--color-surface);box-shadow:0 7px 20px rgba(17,24,39,.05)}.desktop-daily-ledger{overflow:hidden}.desktop-daily-ledger>header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--color-border)}.desktop-daily-ledger h2,.account-overview h2,.account-detail h2{margin-top:2px;font-size:19px}.desktop-daily-ledger header span{color:var(--color-text-muted);font-size:11px}.daily-actions{display:flex;align-items:center;gap:10px}.daily-actions>div{display:flex;padding:3px;border:1px solid var(--color-border);border-radius:8px;background:var(--color-surface-subtle)}.daily-actions button{min-height:34px;padding:0 12px;border:0;border-radius:6px;background:transparent}.daily-actions>div button.active{color:white;background:var(--color-accent-strong)}.daily-actions>.daily-table-share{display:flex;align-items:center;gap:6px;border:1px solid var(--color-border);background:var(--color-surface)}.daily-actions svg{width:15px}.daily-table-scroll{overflow:auto}.daily-table-scroll table{width:100%;border-collapse:collapse;table-layout:fixed}.daily-table-scroll th,.daily-table-scroll td{height:52px;padding:8px 14px;border-bottom:1px solid var(--color-border);text-align:right;font-size:12px;font-variant-numeric:tabular-nums}.daily-table-scroll thead th{height:40px;color:var(--color-text-muted);background:var(--color-surface-subtle);font-size:11px}.daily-table-scroll th:first-child{text-align:left}.daily-table-scroll tbody th strong,.daily-table-scroll tbody th small{display:block}.daily-table-scroll tbody th small{margin-top:2px;color:var(--color-text-muted);font-size:9px;font-weight:500}.daily-table-scroll tr:last-child>*{border-bottom:0}.daily-table-scroll .positive{color:var(--color-success)}.daily-table-scroll .negative{color:var(--color-danger)}.daily-table-scroll .unknown{color:var(--color-text-muted)}.daily-table-scroll .daily-total{font-weight:850;background:var(--color-surface-subtle)}.daily-table-scroll .summary-row>*{font-weight:800;background:var(--color-accent-soft)}.desktop-account-workspace{display:grid;grid-template-columns:minmax(360px,.78fr) minmax(540px,1.5fr);align-items:start;gap:14px}.account-summary-column{display:grid;gap:14px}.account-overview{overflow:hidden}.account-overview>header,.account-detail>header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid var(--color-border)}.account-overview>header button{min-height:36px;display:flex;align-items:center;gap:6px;padding:0 11px;border:1px solid var(--color-border);border-radius:8px;background:var(--color-surface)}.account-overview>header svg{width:15px}.account-overview>dl{display:grid;grid-template-columns:1fr 1fr}.account-overview>dl div{padding:16px;border-right:1px solid var(--color-border);border-bottom:1px solid var(--color-border)}.account-overview>dl div:nth-child(even){border-right:0}.account-overview>dl div:nth-last-child(-n+2){border-bottom:0}.account-overview dt{color:var(--color-text-muted);font-size:11px}.account-overview dd{margin-top:5px;font-size:20px;font-weight:850}.pending-ledger{display:flex;justify-content:space-between;gap:12px;padding:12px 16px;border-top:1px solid var(--color-border);color:var(--color-warning-strong);font-size:11px;background:var(--color-warning-soft)}.accounting-rule{overflow:hidden}.accounting-rule summary{min-height:64px;display:flex;align-items:center;justify-content:space-between;padding:10px 15px;cursor:pointer;list-style:none}.accounting-rule summary span{display:grid}.accounting-rule summary small{color:var(--color-text-muted)}.accounting-rule summary svg{width:17px}.accounting-rule[open] summary svg{transform:rotate(90deg)}.accounting-rule ol{display:grid;gap:10px;margin:0;padding:14px 32px 17px;border-top:1px solid var(--color-border)}.accounting-rule li span{display:block;color:var(--color-text-muted);font-size:11px}.account-detail{overflow:hidden}.account-detail>header>div:last-child{display:flex;gap:4px;padding:3px;border:1px solid var(--color-border);border-radius:8px;background:var(--color-surface-subtle)}.account-detail>header button{min-height:32px;padding:0 10px;border:0;border-radius:6px;background:transparent}.account-detail>header button.active{background:var(--color-surface);box-shadow:0 1px 4px rgba(17,24,39,.1)}.ledger-list,.interval-list{min-height:320px}.ledger-list article{display:grid;grid-template-columns:82px 1fr auto;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid var(--color-border)}.ledger-list article.void{opacity:.55}.ledger-list .kind{display:grid;place-items:center;min-height:28px;border-radius:6px;color:var(--color-danger);font-size:10px;font-weight:800;background:var(--color-danger-soft)}.ledger-list .kind.transfer{color:var(--color-accent-strong);background:var(--color-accent-soft)}.ledger-list .kind.adjustment{color:var(--color-warning-strong);background:var(--color-warning-soft)}.ledger-list p{margin:3px 0;color:var(--color-text-muted);font-size:11px}.ledger-list small{font-size:9px}.ledger-list article>button{min-height:30px;border:1px solid var(--color-border);border-radius:6px;background:transparent}.interval-list article{padding:15px 16px;border-bottom:1px solid var(--color-border)}.interval-list article header{display:flex;justify-content:space-between}.interval-list article header span{color:var(--color-text-muted);font-size:11px}.interval-list dl{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.interval-list dl div{padding:9px;border-radius:7px;background:var(--color-surface-subtle)}.interval-list dt{color:var(--color-text-muted);font-size:10px}.interval-list dd{margin-top:3px;font-weight:800}.empty{padding:40px 20px;color:var(--color-text-muted);text-align:center}.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
</style>
