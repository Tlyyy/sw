<script setup lang="ts">
import AppIcon from "../../components/AppIcon.vue";
import { useUiStore } from "../../stores/ui";
import {
  accountTaskLabel,
  dayAriaLabel,
  dayNumber,
  dayStateLabel,
  shortDay,
  shortRange,
  useHomeOverview,
  wanLabel,
  weekdayLabels,
} from "./useHomeOverview";

const ui = useUiStore();
const {
  accountRows,
  report,
  today,
  todayDescription,
  todayHeading,
  todayOverview,
  weekDays,
  weeklyActivity,
} = useHomeOverview();
</script>

<template>
  <div class="desktop-home-page" data-testid="desktop-week-home">
    <header class="desktop-home-head">
      <div class="desktop-home-title">
        <p>账号工作台</p>
        <div><h1>本周</h1><span>{{ shortRange(report.weekStart, report.weekEnd) }}</span></div>
        <small>先看每个账号，再决定去录入、完成任务或生成小结。</small>
      </div>
      <dl class="desktop-home-meta">
        <div><dt>库存日期</dt><dd>{{ weeklyActivity.latestInventoryDate ? shortDay(weeklyActivity.latestInventoryDate) : "待录入" }}</dd></div>
        <div><dt>本周库存记录</dt><dd>{{ report.recordedDays }} / 7 天</dd></div>
      </dl>
    </header>

    <section class="desktop-week-rhythm" aria-label="本周七天记录进度">
      <article
        v-for="day in weekDays"
        :key="day.date"
        :class="[day.state, { today: day.date === today }]"
        :aria-label="dayAriaLabel(day)"
        :aria-current="day.date === today ? 'date' : undefined"
      >
        <span>{{ weekdayLabels[day.weekday - 1] }}</span>
        <strong>{{ dayNumber(day.date) }}</strong>
        <i aria-hidden="true"></i>
        <small>{{ day.date === today ? "今天" : dayStateLabel(day.state) }}</small>
      </article>
    </section>

    <section class="desktop-account-board" aria-labelledby="desktop-account-board-title" data-testid="account-overview">
      <header>
        <div><p>逐账号查看</p><h2 id="desktop-account-board-title">五个账号本周情况</h2></div>
        <span>不显示跨账号合计</span>
      </header>
      <div class="desktop-account-table" role="table" aria-label="五个账号本周情况">
        <div class="desktop-account-table-head" role="row">
          <span role="columnheader">账号</span>
          <span role="columnheader">当前任务</span>
          <span role="columnheader">当前银子</span>
          <span role="columnheader">本周收获</span>
          <span role="columnheader">本周支出</span>
          <span role="columnheader">任务</span>
          <span role="columnheader">查看</span>
        </div>
        <article
          v-for="row in accountRows"
          :key="row.accountId"
          :class="{ active: ui.recentAccount === row.accountId }"
          :data-account-id="row.accountId"
          role="row"
        >
          <div class="desktop-account-identity" role="rowheader">
            <RouterLink
              :to="`/accounts/${row.accountId}`"
              :aria-label="`查看 ${row.accountId} 账号详情`"
              @click="ui.recentAccount = row.accountId"
            >
              <strong :class="`account-pill account-${row.accountId.toLowerCase()}`">{{ row.accountId }}</strong>
              <small>{{ row.projection?.statusLabel || "等待状态" }}</small>
            </RouterLink>
          </div>
          <span class="desktop-account-task" data-label="当前任务" role="cell">
            <b>{{ accountTaskLabel(row) }}</b>
            <small>{{ row.pendingTaskCount }} 项待完成</small>
          </span>
          <span class="desktop-account-silver" data-label="当前银子" role="cell">
            <b>{{ wanLabel(row.weekly?.currentSilverWan ?? null) }}</b>
            <small>{{ weeklyActivity.latestInventoryDate ? `截至 ${shortDay(weeklyActivity.latestInventoryDate)}` : "待录库存" }}</small>
          </span>
          <span class="desktop-account-harvest" data-label="本周收获" role="cell">
            <b>{{ wanLabel(row.weekly?.harvestedSilverWan ?? null, true) }}</b>
            <RouterLink
              class="desktop-account-earnings"
              :to="{ path: '/earnings', query: { account: row.accountId } }"
              :aria-label="`查看 ${row.accountId} 实际所得`"
              @click="ui.recentAccount = row.accountId"
            >查看实际所得</RouterLink>
          </span>
          <span class="desktop-account-expense" data-label="本周支出" role="cell">
            <b>{{ wanLabel(row.weekly?.totalSilverExpenseWan ?? null) }}</b>
            <small>任务与其他支出</small>
          </span>
          <span class="desktop-account-completion" data-label="任务" role="cell">
            <b>{{ row.weekly?.taskCompletions.length || 0 }} 项完成</b>
            <small>{{ row.pendingTaskCount }} 项待办</small>
          </span>
          <span class="desktop-account-action" role="cell">
            <RouterLink
              class="desktop-account-detail"
              :to="`/accounts/${row.accountId}`"
              :aria-label="`进入 ${row.accountId} 账号`"
              @click="ui.recentAccount = row.accountId"
            >详情 <AppIcon name="chevron-right" /></RouterLink>
          </span>
        </article>
      </div>
    </section>

    <aside class="desktop-home-actions" aria-label="今天的操作">
      <section class="desktop-today-card">
        <header>
          <span><AppIcon name="plus" /></span>
          <div><p>今天</p><h2>{{ todayHeading }}</h2><small>{{ todayDescription }}</small></div>
        </header>
        <RouterLink class="desktop-record-primary" to="/record">
          <AppIcon name="plus" />
          <span>{{ todayOverview?.hasInventory ? "继续记录今天" : "记录今天" }}</span>
        </RouterLink>
        <div class="desktop-today-links">
          <RouterLink to="/plans/tasks"><span><AppIcon name="plan" /></span><b>任务</b><small>按账号标记完成</small><AppIcon name="chevron-right" /></RouterLink>
          <RouterLink to="/record"><span><AppIcon name="account" /></span><b>收支</b><small>选择账号记录</small><AppIcon name="chevron-right" /></RouterLink>
        </div>
      </section>

      <RouterLink class="desktop-week-report-card" to="/week" aria-label="查看并生成本周小结">
        <span class="desktop-report-icon"><AppIcon name="report" /></span>
        <div><p>分享</p><h2>本周小结</h2><small>五个账号分别展示，可生成 PNG</small></div>
        <strong>查看并分享 <AppIcon name="chevron-right" /></strong>
      </RouterLink>
    </aside>
  </div>
</template>

<style scoped>
.desktop-home-page {
  width: min(100%, 1380px);
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(330px, .72fr);
  grid-template-areas:
    "head head"
    "rhythm rhythm"
    "accounts actions";
  gap: 16px;
  margin: 0 auto;
  padding: 22px clamp(18px, 2vw, 32px) 56px;
  color: var(--radar-ink);
}

.desktop-home-head {
  grid-area: head;
  min-height: 84px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28px;
  padding: 0 4px 14px;
  border-bottom: 1px solid var(--radar-line);
}
.desktop-home-title > p,
.desktop-account-board > header p,
.desktop-today-card header p,
.desktop-week-report-card p { color: var(--radar-cyan-strong); font-size: 11px; font-weight: 850; letter-spacing: .09em; }
.desktop-home-title > div { display: flex; align-items: baseline; gap: 12px; }
.desktop-home-title h1 { font-size: 32px; line-height: 1.15; letter-spacing: -.045em; }
.desktop-home-title > div span { color: var(--radar-muted); font-size: 14px; font-weight: 750; }
.desktop-home-title > small { display: block; margin-top: 4px; color: var(--radar-muted); font-size: 12px; }
.desktop-home-meta { display: grid; grid-template-columns: repeat(2, minmax(130px, 1fr)); margin: 0; overflow: hidden; border: 1px solid var(--radar-line); border-radius: 12px; background: #ffffff; }
.desktop-home-meta > div { min-width: 0; padding: 10px 14px; border-left: 1px solid var(--radar-line); }
.desktop-home-meta > div:first-child { border-left: 0; }
.desktop-home-meta dt { color: var(--radar-muted); font-size: 10px; font-weight: 750; }
.desktop-home-meta dd { margin: 2px 0 0; color: var(--radar-ink); font-size: 14px; font-weight: 850; white-space: nowrap; }

.desktop-week-rhythm {
  grid-area: rhythm;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid var(--radar-line);
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(17, 24, 39, .055);
}
.desktop-week-rhythm article { min-width: 0; min-height: 76px; display: grid; grid-template-columns: auto auto 16px auto; align-items: center; justify-content: center; gap: 8px; padding: 10px; border-right: 1px solid var(--radar-line); color: var(--radar-muted); }
.desktop-week-rhythm article:last-child { border-right: 0; }
.desktop-week-rhythm article > span { color: var(--radar-ink); font-size: 12px; font-weight: 800; }
.desktop-week-rhythm article > strong { color: var(--radar-ink); font-size: 18px; font-variant-numeric: tabular-nums; }
.desktop-week-rhythm article > i { width: 13px; height: 13px; border: 2px solid #b9c0c8; border-radius: 50%; background: #ffffff; }
.desktop-week-rhythm article > small { font-size: 10px; font-weight: 800; white-space: nowrap; }
.desktop-week-rhythm article.recorded > i { border-color: var(--radar-success); background: var(--radar-success); box-shadow: inset 0 0 0 3px #ffffff; }
.desktop-week-rhythm article.recorded > small { color: var(--radar-success); }
.desktop-week-rhythm article.missed > small { color: #9a5a00; }
.desktop-week-rhythm article.future { background: #fbfbfa; }
.desktop-week-rhythm article.today { position: relative; z-index: 1; border: 1px solid color-mix(in srgb, var(--brand-orange) 48%, #ffffff); border-radius: 12px; background: var(--brand-orange-soft); }
.desktop-week-rhythm article.today > :is(span, strong, small) { color: var(--brand-orange-dark); }
.desktop-week-rhythm article.today > i { border-color: var(--brand-orange); background: var(--brand-orange); box-shadow: inset 0 0 0 3px #ffffff; }

.desktop-account-board,
.desktop-today-card,
.desktop-week-report-card {
  border: 1px solid var(--radar-line);
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(17, 24, 39, .06);
}
.desktop-account-board { grid-area: accounts; min-width: 0; overflow: hidden; }
.desktop-account-board > header { min-height: 70px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 12px 16px; border-bottom: 1px solid var(--radar-line); background: var(--radar-surface-2); }
.desktop-account-board > header h2 { margin-top: 1px; font-size: 20px; }
.desktop-account-board > header > span { color: var(--radar-muted); font-size: 11px; font-weight: 750; }
.desktop-account-table { min-width: 0; }
.desktop-account-table-head,
.desktop-account-table > article { display: grid; grid-template-columns: 82px minmax(160px, 1.45fr) minmax(95px, .7fr) repeat(3, minmax(92px, .72fr)) 76px; align-items: center; column-gap: 12px; padding-inline: 14px; }
.desktop-account-table-head { min-height: 36px; border-bottom: 1px solid var(--radar-line); color: var(--radar-muted); background: #fbfcfb; font-size: 10px; font-weight: 800; }
.desktop-account-table > article { min-height: 82px; border-bottom: 1px solid var(--radar-line); transition: background 160ms ease, box-shadow 160ms ease; }
.desktop-account-table > article:last-child { border-bottom: 0; }
.desktop-account-table > article:hover,
.desktop-account-table > article.active { background: color-mix(in srgb, var(--radar-cyan-soft) 52%, #ffffff); }
.desktop-account-table > article.active { box-shadow: inset 3px 0 var(--radar-cyan); }
.desktop-account-identity { align-self: stretch; min-width: 0; }
.desktop-account-identity > a { height: 100%; display: grid; align-content: center; justify-items: start; gap: 3px; }
.desktop-account-identity .account-pill { min-width: 46px; min-height: 30px; display: grid; place-items: center; }
.desktop-account-identity small,
.desktop-account-table article > span small { overflow: hidden; color: var(--radar-muted); font-size: 10px; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.desktop-account-table article > span { min-width: 0; display: grid; gap: 2px; }
.desktop-account-table article > span b { overflow: hidden; color: var(--radar-ink); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.desktop-account-harvest b { color: var(--radar-success) !important; }
.desktop-account-earnings {
  width: fit-content;
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  color: var(--radar-cyan-strong);
  font-size: 11px;
  font-weight: 800;
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--radar-cyan) 45%, transparent);
  text-underline-offset: 2px;
}
.desktop-account-earnings:hover { text-decoration-color: currentColor; }
.desktop-account-expense b { color: #9a5a00 !important; }
.desktop-account-action { min-width: 0; }
.desktop-account-detail { min-height: 40px; display: inline-flex; align-items: center; justify-content: flex-end; gap: 2px; color: var(--radar-cyan-strong); font-size: 12px; font-weight: 850; }
.desktop-account-detail :deep(svg) { width: 15px; height: 15px; }

.desktop-home-actions { grid-area: actions; min-width: 0; display: grid; align-content: start; gap: 16px; }
.desktop-today-card { padding: 16px; }
.desktop-today-card > header { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 12px; }
.desktop-today-card > header > span,
.desktop-report-icon { width: 46px; height: 46px; display: grid; place-items: center; border-radius: 50%; color: var(--brand-orange); background: var(--brand-orange-soft); }
.desktop-today-card > header > span :deep(svg),
.desktop-report-icon :deep(svg) { width: 22px; height: 22px; }
.desktop-today-card h2,
.desktop-week-report-card h2 { margin-top: 1px; font-size: 20px; line-height: 1.3; }
.desktop-today-card header small,
.desktop-week-report-card small { display: block; margin-top: 2px; color: var(--radar-muted); font-size: 12px; line-height: 1.45; }
.desktop-record-primary { min-height: 50px; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 16px; border: 1px solid #a84600; border-radius: 10px; color: #ffffff; background: var(--brand-orange); box-shadow: 0 8px 18px rgba(199, 93, 5, .18); font-size: 15px; font-weight: 850; }
.desktop-record-primary :deep(svg) { width: 20px; height: 20px; }
.desktop-today-links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
.desktop-today-links > a { min-width: 0; min-height: 86px; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; grid-template-rows: auto auto; align-content: center; gap: 1px 7px; padding: 10px; border: 1px solid var(--radar-line); border-radius: 10px; background: var(--radar-surface-2); }
.desktop-today-links > a > span { grid-row: 1 / 3; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 8px; color: var(--radar-cyan-strong); background: var(--radar-cyan-soft); }
.desktop-today-links > a > span :deep(svg) { width: 16px; height: 16px; }
.desktop-today-links b { font-size: 13px; }
.desktop-today-links small { overflow: hidden; color: var(--radar-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.desktop-today-links > a > :deep(svg) { grid-column: 3; grid-row: 1 / 3; align-self: center; width: 15px; height: 15px; color: var(--radar-muted); }
.desktop-week-report-card { min-height: 150px; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 12px; padding: 16px; }
.desktop-report-icon { color: var(--radar-cyan-strong); background: var(--radar-cyan-soft); }
.desktop-week-report-card > strong { grid-column: 1 / -1; min-height: 44px; display: flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid color-mix(in srgb, var(--radar-cyan) 50%, var(--radar-line)); border-radius: 9px; color: var(--radar-cyan-strong); background: color-mix(in srgb, var(--radar-cyan-soft) 58%, #ffffff); font-size: 13px; }
.desktop-week-report-card > strong :deep(svg) { width: 16px; height: 16px; }

@media (max-width: 1180px) {
  .desktop-home-page { grid-template-columns: minmax(0, 1fr) 310px; }
  .desktop-account-table-head,
  .desktop-account-table > article { grid-template-columns: 76px minmax(145px, 1.35fr) repeat(3, minmax(86px, .72fr)) 70px; column-gap: 9px; padding-inline: 11px; }
  .desktop-account-table-head > span:nth-child(3),
  .desktop-account-silver { display: none !important; }
}
</style>
