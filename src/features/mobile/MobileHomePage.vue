<script setup lang="ts">
import AppIcon from "../../components/AppIcon.vue";
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
} from "../home/useHomeOverview";

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
  <div class="mobile-home-page" data-testid="mobile-week-home">
    <header class="mobile-week-title">
      <div><h1>本周</h1><span>{{ shortRange(report.weekStart, report.weekEnd) }}</span></div>
      <p>{{ report.recordedDays }} / 7 天有库存</p>
    </header>

    <section class="mobile-week-rhythm" aria-label="本周七天记录进度">
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

    <section class="mobile-today-card" aria-labelledby="mobile-today-heading">
      <header>
        <span class="mobile-today-icon"><AppIcon name="plus" /></span>
        <div>
          <h2 id="mobile-today-heading">{{ todayHeading }}</h2>
          <p>{{ todayDescription }}</p>
        </div>
      </header>
      <RouterLink class="mobile-record-primary" to="/record">
        <AppIcon name="plus" />
        <span>{{ todayOverview?.hasInventory ? "继续记录今天" : "记录今天" }}</span>
      </RouterLink>
      <div class="mobile-task-brief">
        <span class="mobile-task-icon"><AppIcon name="plan" /></span>
        <div>
          <strong>任务</strong>
          <p>按账号查看当前任务并标记完成</p>
        </div>
        <RouterLink to="/plans/tasks">查看任务</RouterLink>
      </div>
    </section>

    <section class="mobile-account-progress" aria-labelledby="mobile-account-progress-title">
      <header>
        <div><p>逐账号查看</p><h2 id="mobile-account-progress-title">各账号本周</h2></div>
        <span>{{ weeklyActivity.latestInventoryDate ? `库存截至 ${shortDay(weeklyActivity.latestInventoryDate)}` : "库存待建立基线" }}</span>
      </header>
      <div class="mobile-account-progress-list">
        <article v-for="row in accountRows" :key="row.accountId" :data-account-id="row.accountId">
          <header>
            <RouterLink class="mobile-account-progress-link" :to="`/accounts/${row.accountId}`" :aria-label="`查看 ${row.accountId} 账号详情`">
              <span :class="`account-pill account-${row.accountId.toLowerCase()}`">{{ row.accountId }}</span>
              <span><strong>{{ accountTaskLabel(row) }}</strong><small>{{ row.projection?.statusLabel || "等待任务状态" }} · {{ row.pendingTaskCount }} 项待办</small></span>
              <AppIcon name="chevron-right" />
            </RouterLink>
          </header>
          <dl>
            <div class="harvest"><dt>本周收获</dt><dd>{{ wanLabel(row.weekly?.harvestedSilverWan ?? null, true) }}</dd></div>
            <div class="expense"><dt>本周支出</dt><dd>{{ wanLabel(row.weekly?.totalSilverExpenseWan ?? null) }}</dd></div>
            <div><dt>完成任务</dt><dd>{{ row.weekly?.taskCompletions.length || 0 }} 项</dd></div>
          </dl>
        </article>
      </div>
    </section>

    <RouterLink class="mobile-weekly-report-card" to="/week" aria-label="查看并生成本周小结">
      <span class="mobile-report-icon"><AppIcon name="report" /></span>
      <div>
        <h2>本周小结</h2>
        <p>五个账号分别展示 · 可随时生成 PNG</p>
      </div>
      <span class="mobile-report-action">生成并分享 <AppIcon name="chevron-right" /></span>
    </RouterLink>
  </div>
</template>

<style scoped>
.mobile-home-page {
  width: min(100%, 560px);
  display: grid;
  gap: 10px;
  margin: 0 auto;
  padding: 10px 14px 24px;
  color: var(--radar-ink);
}

.mobile-week-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 44px;
  padding: 0 4px;
}

.mobile-week-title > div { min-width: 0; display: flex; align-items: baseline; gap: 9px; }
.mobile-week-title h1 { font-size: 27px; line-height: 1.1; letter-spacing: -.045em; }
.mobile-week-title > div span { overflow: hidden; color: var(--radar-muted); font-size: 12px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.mobile-week-title > p { color: var(--radar-cyan-strong); font-size: 11px; font-weight: 800; white-space: nowrap; }

.mobile-week-rhythm {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid var(--radar-line);
  border-radius: 15px;
  background: #ffffff;
  box-shadow: 0 7px 20px rgba(17, 24, 39, .07);
}

.mobile-week-rhythm article {
  min-width: 0;
  min-height: 78px;
  display: grid;
  grid-template-rows: auto auto 18px auto;
  place-items: center;
  align-content: center;
  gap: 2px;
  padding: 6px 2px;
  border-right: 1px solid var(--radar-line);
  color: var(--radar-muted);
}

.mobile-week-rhythm article:last-child { border-right: 0; }
.mobile-week-rhythm article > span { color: var(--radar-ink); font-size: 11px; font-weight: 800; white-space: nowrap; }
.mobile-week-rhythm article > strong { color: var(--radar-ink); font-size: 17px; line-height: 1.15; font-variant-numeric: tabular-nums; }
.mobile-week-rhythm article > i { width: 12px; height: 12px; border: 2px solid #b9c0c8; border-radius: 50%; background: #ffffff; }
.mobile-week-rhythm article > small { overflow: hidden; max-width: 100%; font-size: 9px; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.mobile-week-rhythm article.recorded > i { border-color: var(--radar-success); background: var(--radar-success); box-shadow: inset 0 0 0 3px #ffffff; }
.mobile-week-rhythm article.recorded > small { color: var(--radar-success); }
.mobile-week-rhythm article.missed > i { border-color: #d49b58; }
.mobile-week-rhythm article.missed > small { color: #9a5a00; }
.mobile-week-rhythm article.future { color: #8b95a3; background: #fbfbfa; }
.mobile-week-rhythm article.today {
  position: relative;
  z-index: 1;
  border: 1px solid color-mix(in srgb, var(--brand-orange) 48%, #ffffff);
  border-radius: 13px;
  color: var(--brand-orange-dark);
  background: var(--brand-orange-soft);
}
.mobile-week-rhythm article.today > :is(span, strong, small) { color: var(--brand-orange-dark); }
.mobile-week-rhythm article.today > i { border-color: var(--brand-orange); background: var(--brand-orange); box-shadow: inset 0 0 0 3px #ffffff; }

.mobile-today-card,
.mobile-account-progress,
.mobile-weekly-report-card {
  border: 1px solid var(--radar-line);
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 7px 20px rgba(17, 24, 39, .07);
}

.mobile-today-card { padding: 13px; }
.mobile-today-card > header { display: flex; align-items: center; gap: 12px; }
.mobile-today-icon,
.mobile-report-icon {
  flex: 0 0 42px;
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--brand-orange);
  background: var(--brand-orange-soft);
}
.mobile-today-icon :deep(svg), .mobile-report-icon :deep(svg) { width: 21px; height: 21px; }
.mobile-today-card h2 { font-size: 19px; line-height: 1.3; letter-spacing: -.025em; }
.mobile-today-card header p { margin-top: 2px; color: var(--radar-muted); font-size: 13px; line-height: 1.4; }

.mobile-record-primary {
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 13px;
  border: 1px solid #aa4800;
  border-radius: 11px;
  color: #ffffff;
  background: var(--brand-orange);
  box-shadow: 0 8px 18px rgba(199, 93, 5, .2);
  font-size: 17px;
  font-weight: 850;
}
.mobile-record-primary :deep(svg) { width: 23px; height: 23px; }

.mobile-task-brief {
  min-height: 48px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  margin-top: 12px;
  padding-top: 11px;
  border-top: 1px solid var(--radar-line);
}
.mobile-task-icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; color: var(--radar-cyan-strong); background: var(--radar-cyan-soft); }
.mobile-task-icon :deep(svg) { width: 18px; height: 18px; }
.mobile-task-brief div { min-width: 0; }
.mobile-task-brief strong { display: block; font-size: 13px; }
.mobile-task-brief p { color: var(--radar-muted); font-size: 11px; }
.mobile-task-brief > a { min-height: 44px; display: inline-flex; align-items: center; color: var(--radar-cyan-strong); font-size: 12px; font-weight: 800; white-space: nowrap; }

.mobile-account-progress { overflow: hidden; }
.mobile-account-progress > header { min-height: 56px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 13px; border-bottom: 1px solid var(--radar-line); background: var(--radar-surface-2); }
.mobile-account-progress > header p { color: var(--radar-cyan-strong); font-size: 10px; font-weight: 850; letter-spacing: .08em; }
.mobile-account-progress > header h2 { margin-top: 1px; font-size: 17px; }
.mobile-account-progress > header > span { color: var(--radar-muted); font-size: 10px; font-weight: 750; white-space: nowrap; }
.mobile-account-progress-list { display: grid; }
.mobile-account-progress-list > article { padding: 10px 12px 9px; border-bottom: 1px solid var(--radar-line); }
.mobile-account-progress-list > article:last-child { border-bottom: 0; }
.mobile-account-progress-list article > header { min-height: 44px; }
.mobile-account-progress-link { min-height: 44px; display: grid; grid-template-columns: 48px minmax(0, 1fr) 24px; align-items: center; gap: 9px; }
.mobile-account-progress-link > .account-pill { min-height: 36px; display: grid; place-items: center; padding-inline: 6px; }
.mobile-account-progress-link > span:nth-child(2) { min-width: 0; display: grid; gap: 1px; }
.mobile-account-progress-link strong { overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.mobile-account-progress-link small { overflow: hidden; color: var(--radar-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.mobile-account-progress-link > :deep(svg) { width: 17px; height: 17px; color: var(--radar-muted); }
.mobile-account-progress-list dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 5px 0 0 57px; }
.mobile-account-progress-list dl > div { min-width: 0; padding: 0 9px; border-left: 1px solid var(--radar-line); }
.mobile-account-progress-list dl > div:first-child { padding-left: 0; border-left: 0; }
.mobile-account-progress-list dt { color: var(--radar-muted); font-size: 10px; font-weight: 750; }
.mobile-account-progress-list dd { overflow: hidden; margin: 1px 0 0; color: var(--radar-ink); font-size: 13px; font-weight: 850; text-overflow: ellipsis; white-space: nowrap; }
.mobile-account-progress-list .harvest dd { color: var(--radar-success); }
.mobile-account-progress-list .expense dd { color: #9a5a00; }

.mobile-weekly-report-card {
  min-height: 118px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 11px 12px;
  padding: 14px;
}
.mobile-report-icon { color: var(--radar-cyan-strong); background: var(--radar-cyan-soft); }
.mobile-weekly-report-card h2 { font-size: 19px; }
.mobile-weekly-report-card p { margin-top: 2px; color: var(--radar-muted); font-size: 12px; }
.mobile-report-action {
  grid-column: 1 / -1;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid color-mix(in srgb, var(--radar-cyan) 55%, var(--radar-line));
  border-radius: 10px;
  color: var(--radar-cyan-strong);
  background: color-mix(in srgb, var(--radar-cyan-soft) 55%, #ffffff);
  font-size: 14px;
  font-weight: 850;
}
.mobile-report-action :deep(svg) { width: 17px; height: 17px; }

@media (max-width: 380px) {
  .mobile-home-page { padding-inline: 10px; }
  .mobile-week-title > div span { font-size: 10px; }
  .mobile-week-rhythm article { min-height: 74px; }
  .mobile-week-rhythm article > span { font-size: 10px; }
  .mobile-week-rhythm article > strong { font-size: 18px; }
  .mobile-account-progress-list dl { margin-left: 0; }
}
</style>
