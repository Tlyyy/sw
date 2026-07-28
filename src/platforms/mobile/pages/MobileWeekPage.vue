<script setup lang="ts">
import AppIcon from "../../../components/AppIcon.vue";
import InventoryWeeklyAnalysis from "../../../components/InventoryWeeklyAnalysis.vue";
import WeeklyActivityPanel from "../../../components/WeeklyActivityPanel.vue";
import { useWeekPage } from "../../../features/week/useWeekPage";

const {
  currentDate,
  report,
  isCurrentWeek,
  canViewNextWeek,
  activity,
  weekDays,
  dateRangeLabel,
  weekdayLabels,
  moveWeek,
  returnToCurrentWeek,
  dayNumber,
  dayStateLabel,
  compactWanLabel,
  valueTone,
} = useWeekPage();
</script>

<template>
  <div class="page-wrap week-page mobile-week-page" data-platform-page="mobile" data-testid="week-page">
    <div class="week-mobile-switcher">
      <button type="button" aria-label="查看上一周" @click="moveWeek(-7)">
        <AppIcon class="week-switcher-previous" name="chevron-right" />
      </button>
      <div>
        <strong>{{ dateRangeLabel }}</strong>
        <span v-if="isCurrentWeek">本周</span>
        <button v-else type="button" @click="returnToCurrentWeek">回到本周</button>
      </div>
      <button type="button" aria-label="查看下一周" :disabled="!canViewNextWeek" @click="moveWeek(7)">
        <AppIcon name="chevron-right" />
      </button>
    </div>

    <section class="week-mobile-report" aria-label="手机端周报">
      <ol class="week-day-strip">
        <li v-for="day in weekDays" :key="day.date" :class="[`is-${day.state}`, { 'is-current': day.date === currentDate }]">
          <span>{{ weekdayLabels[day.weekday - 1] }}</span>
          <strong>{{ dayNumber(day.date) }}</strong>
          <i aria-hidden="true"></i>
          <small>{{ dayStateLabel(day) }}</small>
        </li>
      </ol>

      <section class="week-account-card" aria-labelledby="week-account-title">
        <h2 id="week-account-title">按账号本周结果</h2>
        <div class="week-account-table-wrap">
          <table class="week-account-table" aria-label="五个账号的本周收入、支出与结余，金额单位为万">
            <thead class="week-account-head">
              <tr>
                <th scope="col">指标</th>
                <th v-for="account in activity.accountSummaries" :key="account.accountId" scope="col">
                  <strong class="week-account-badge" :data-account="account.accountId">{{ account.accountId }}</strong>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr class="week-account-row">
                <th scope="row">收入/万</th>
                <td v-for="account in activity.accountSummaries" :key="account.accountId">{{ compactWanLabel(account.harvestedSilverWan) }}</td>
              </tr>
              <tr class="week-account-row">
                <th scope="row">支出/万</th>
                <td v-for="account in activity.accountSummaries" :key="account.accountId">{{ compactWanLabel(account.totalSilverExpenseWan) }}</td>
              </tr>
              <tr class="week-account-row">
                <th scope="row">结余/万</th>
                <td v-for="account in activity.accountSummaries" :key="account.accountId" :class="valueTone(account.inventoryNetChangeWan)">
                  {{ compactWanLabel(account.inventoryNetChangeWan, true) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>

    <div class="week-detail-group" aria-label="周报详细数据">
      <details class="week-mobile-full-report">
        <summary>
          <strong>收支与任务明细</strong>
          <span class="week-detail-summary-side" aria-hidden="true"><AppIcon class="week-detail-chevron" name="chevron-right" /></span>
        </summary>
        <WeeklyActivityPanel :report="report" :current-date="currentDate" compact />
        <RouterLink class="week-earnings-link" to="/earnings">查看实际所得</RouterLink>
      </details>
      <details class="week-inventory-details">
        <summary>
          <strong>库存变化</strong>
          <span class="week-detail-summary-side"><b>{{ report.recordedDays }} / 7 天</b><AppIcon class="week-detail-chevron" name="chevron-right" aria-hidden="true" /></span>
        </summary>
        <InventoryWeeklyAnalysis :report="report" :current-date="currentDate" :show-activity="false" initial-view="summary" />
      </details>
    </div>
  </div>
</template>

<style scoped>
.week-page { --week-accent:#c44d00; --week-positive:#006b5a; --week-border:rgba(60,60,67,.16); width:100%; padding:8px 12px 112px; }
.week-mobile-report { display:grid; gap:10px; }
.week-mobile-switcher { position:sticky; z-index:50; top:calc(var(--ios-mobile-header-height,68px) + env(safe-area-inset-top)); min-height:64px; display:grid; grid-template-columns:44px 1fr 44px; align-items:center; gap:8px; margin-bottom:10px; padding:8px 10px; border:1px solid var(--week-border); border-radius:13px; background:rgba(255,255,255,.94); box-shadow:0 6px 18px rgba(17,24,39,.09); backdrop-filter:blur(18px) saturate(150%); }
.week-mobile-switcher > button { width:40px; height:44px; display:grid; place-items:center; padding:0; border:1px solid var(--week-border); border-radius:10px; color:#344054; background:rgba(255,255,255,.72); }
.week-mobile-switcher > button:disabled { color:#a6adba; background:#f5f6f8; }
.week-mobile-switcher :deep(svg) { width:18px; height:18px; }
.week-switcher-previous { transform:rotate(180deg); }
.week-mobile-switcher > div { min-width:0; display:grid; justify-items:center; gap:3px; }
.week-mobile-switcher strong { color:#1d2939; font-size:13px; white-space:nowrap; }
.week-mobile-switcher span,.week-mobile-switcher > div > button { min-height:0; padding:0; border:0; color:var(--ios-secondary-label); font-size:11px; font-weight:700; background:transparent; }
.week-mobile-switcher > div > button { color:var(--week-accent); }
.week-day-strip { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); margin:0; padding:8px 3px; border:1px solid var(--week-border); border-radius:13px; list-style:none; background:rgba(255,255,255,.9); box-shadow:0 4px 14px rgba(17,24,39,.035); }
.week-day-strip li { min-width:0; display:grid; justify-items:center; gap:3px; padding:3px 1px; border-right:1px solid rgba(60,60,67,.11); color:#344054; }
.week-day-strip li:last-child { border-right:0; }
.week-day-strip span { font-size:10px; font-weight:700; white-space:nowrap; }
.week-day-strip strong { font-size:16px; line-height:1.1; }
.week-day-strip i { width:8px; height:8px; border:1.5px solid #b0b8c5; border-radius:50%; background:white; }
.week-day-strip small { color:#8b95a5; font-size:9px; font-weight:700; white-space:nowrap; }
.week-day-strip .is-recorded i { border-color:var(--week-positive); background:var(--week-positive); }
.week-day-strip .is-current { margin-block:-2px; padding-block:5px; border:1px solid rgba(196,77,0,.22); border-radius:10px; color:var(--week-accent); background:#fff8f2; }
.week-day-strip .is-current i { border-color:var(--week-accent); box-shadow:inset 0 0 0 2px #fff8f2; background:var(--week-accent); }
.week-day-strip .is-current small { color:var(--week-accent); }
.week-day-strip .is-future { color:#788396; }
.week-account-card { overflow:hidden; padding:13px; border:1px solid var(--week-border); border-radius:13px; background:rgba(255,255,255,.92); box-shadow:0 4px 14px rgba(17,24,39,.035); }
.week-account-card h2 { margin:0 0 10px; color:#1d2939; font-size:15px; }
.week-account-table-wrap { overflow-x:auto; border-top:1px solid rgba(60,60,67,.12); }
.week-account-table { width:100%; min-width:328px; border-collapse:collapse; table-layout:fixed; }
.week-account-head { color:var(--ios-secondary-label); font-size:9px; font-weight:650; }
.week-account-head th { height:31px; padding:0 3px; text-align:center; }
.week-account-head th:first-child,.week-account-row > th { width:54px; text-align:left; }
.week-account-row { color:#344054; font-size:11px; }
.week-account-row > :is(th,td) { height:39px; padding:0 3px; border-top:1px solid rgba(60,60,67,.1); }
.week-account-row > th { color:var(--ios-secondary-label); font-weight:650; white-space:nowrap; }
.week-account-row > td { text-align:center; white-space:nowrap; }
.week-account-row .positive { color:var(--week-positive); }
.week-account-row .negative { color:var(--week-accent); }
.week-account-badge { display:inline-flex; align-items:center; justify-content:center; min-width:31px; padding:4px 5px; border:1px solid #5b8fbd; border-radius:4px; color:#1f6aa5; font-size:11px; }
.week-account-badge[data-account="LG1"] { border-color:#8e79c6; color:#5b3bab; }
.week-account-badge[data-account="PT"] { border-color:#cc8186; color:#9f2831; }
.week-account-badge[data-account="LG2"] { border-color:#c79a58; color:#985800; }
.week-account-badge[data-account="MYT"] { border-color:#78a894; color:#147052; }
.week-detail-group { display:block; margin-top:10px; overflow:hidden; border:1px solid var(--week-border); border-radius:13px; background:rgba(255,255,255,.92); box-shadow:0 4px 14px rgba(17,24,39,.035); }
.week-detail-group > details { margin:0; overflow:visible; border:0; border-radius:0; background:transparent; }
.week-detail-group > details + details { border-top:1px solid var(--week-border); }
.week-detail-group > details > summary { min-height:56px; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:0 14px; cursor:pointer; list-style:none; }
.week-detail-group > details > summary::-webkit-details-marker { display:none; }
.week-detail-group > details > summary strong { color:#1d2939; font-size:14px; }
.week-detail-summary-side { display:inline-flex; align-items:center; gap:6px; color:var(--ios-secondary-label); }
.week-detail-summary-side b { font-size:12px; font-weight:650; }
.week-detail-chevron { width:16px; height:16px; transition:transform .18s ease; }
.week-detail-group > details[open] > summary { border-bottom:1px solid var(--week-border); }
.week-detail-group > details[open] > summary .week-detail-chevron { transform:rotate(90deg); }
.week-mobile-full-report :deep(.weekly-activity-panel) { margin:0; border:0; border-radius:0; box-shadow:none; }
.week-inventory-details :deep(.inventory-weekly-analysis) { border:0; border-radius:0; }
.week-earnings-link { min-height:44px; display:grid; place-items:center; border-top:1px solid var(--week-border); color:var(--week-accent); font-size:12px; font-weight:750; text-decoration:none; }
</style>
