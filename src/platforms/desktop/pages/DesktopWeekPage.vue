<script setup lang="ts">
import InventoryWeeklyAnalysis from "../../../components/InventoryWeeklyAnalysis.vue";
import InventoryWeekSwitcher from "../../../components/InventoryWeekSwitcher.vue";
import WeeklyActivityPanel from "../../../components/WeeklyActivityPanel.vue";
import { useWeekPage } from "../../../features/week/useWeekPage";

const {
  currentDate,
  report,
  isCurrentWeek,
  canViewNextWeek,
  activity,
  moveWeek,
  returnToCurrentWeek,
  compactWanLabel,
  valueTone,
  openSupplementSheet,
} = useWeekPage();
</script>

<template>
  <div class="page-wrap desktop-week-page" data-platform-page="desktop" data-testid="week-page">
    <header class="desktop-week-head">
      <div>
        <p>{{ isCurrentWeek ? "PC 本周工作台" : "PC 历史周报" }}</p>
        <h1>本周小结</h1>
        <span>横向比较五个账号，再查看任务、收支和库存变化。</span>
      </div>
      <nav aria-label="本周小结相关操作">
        <RouterLink class="button" to="/earnings">查看实际所得</RouterLink>
        <button class="button primary" type="button" @click="openSupplementSheet">补充记录</button>
      </nav>
    </header>

    <InventoryWeekSwitcher
      :week-start="report.weekStart"
      :week-end="report.weekEnd"
      :is-current-week="isCurrentWeek"
      :can-view-next-week="canViewNextWeek"
      @previous="moveWeek(-7)"
      @next="moveWeek(7)"
      @current="returnToCurrentWeek"
    />

    <section class="desktop-account-comparison" aria-labelledby="desktop-account-comparison-title">
      <header>
        <div><p>五账号横向比较</p><h2 id="desktop-account-comparison-title">本周收支与库存结余</h2></div>
        <span>金额单位：万</span>
      </header>
      <table aria-label="五个账号本周横向比较">
        <thead>
          <tr>
            <th scope="col">账号</th>
            <th scope="col">收入</th>
            <th scope="col">支出</th>
            <th scope="col">库存结余</th>
            <th scope="col">完成任务</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="account in activity.accountSummaries" :key="account.accountId">
            <th scope="row"><strong :data-account="account.accountId">{{ account.accountId }}</strong></th>
            <td>{{ compactWanLabel(account.harvestedSilverWan) }}</td>
            <td>{{ compactWanLabel(account.totalSilverExpenseWan) }}</td>
            <td :class="valueTone(account.inventoryNetChangeWan)">{{ compactWanLabel(account.inventoryNetChangeWan, true) }}</td>
            <td>{{ account.taskCompletions.length }} 项</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="desktop-week-activity" aria-label="本周任务与收支明细">
      <WeeklyActivityPanel :report="report" :current-date="currentDate" />
    </section>

    <details class="desktop-inventory-details" open>
      <summary>
        <strong>库存变化</strong>
        <span>{{ report.recordedDays }} / 7 天有记录</span>
      </summary>
      <InventoryWeeklyAnalysis :report="report" :current-date="currentDate" :show-activity="false" initial-view="summary" />
    </details>
  </div>
</template>

<style scoped>
.desktop-week-page { width: min(100%, 1320px); padding-top: 14px; padding-bottom: 56px; }
.desktop-week-head { min-height: 76px; display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 0 4px 14px; border-bottom: 1px solid var(--color-border); }
.desktop-week-head > div { min-width: 0; }
.desktop-week-head p,.desktop-account-comparison header p { color: var(--color-accent-strong); font-size: 11px; font-weight: 850; letter-spacing: .09em; }
.desktop-week-head h1 { margin-top: 1px; font-size: 28px; line-height: 1.2; }
.desktop-week-head span { display: block; margin-top: 4px; color: var(--color-text-muted); font-size: 12px; }
.desktop-week-head nav { display: flex; gap: 8px; }
.desktop-week-page :deep(.inventory-week-switcher) { margin: 14px 0; }
.desktop-account-comparison { overflow: hidden; margin-bottom: 14px; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface); }
.desktop-account-comparison > header { display: flex; align-items: center; justify-content: space-between; padding: 13px 16px; border-bottom: 1px solid var(--color-border); background: var(--color-surface-subtle); }
.desktop-account-comparison h2 { margin-top: 2px; font-size: 18px; }
.desktop-account-comparison header > span { color: var(--color-text-muted); font-size: 11px; }
.desktop-account-comparison table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.desktop-account-comparison th,.desktop-account-comparison td { height: 48px; padding: 9px 14px; border-bottom: 1px solid var(--color-border); text-align: right; font-variant-numeric: tabular-nums; }
.desktop-account-comparison thead th { height: 40px; color: var(--color-text-muted); background: var(--color-surface-subtle); font-size: 11px; }
.desktop-account-comparison th:first-child { text-align: left; }
.desktop-account-comparison tbody tr:last-child > * { border-bottom: 0; }
.desktop-account-comparison tbody th strong { display: inline-grid; place-items: center; min-width: 48px; min-height: 30px; border: 1px solid var(--color-border-strong); border-radius: 6px; color: var(--color-accent-strong); }
.desktop-account-comparison td { font-size: 13px; font-weight: 760; }
.desktop-account-comparison td.positive { color: var(--color-success); }
.desktop-account-comparison td.negative { color: var(--color-danger); }
.desktop-week-activity :deep(.weekly-activity-panel) { margin: 0; border-radius: 14px; box-shadow: 0 7px 20px rgba(17,24,39,.06); }
.desktop-inventory-details { margin-top: 14px; overflow: hidden; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface); }
.desktop-inventory-details > summary { min-height: 64px; display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; cursor: pointer; list-style: none; }
.desktop-inventory-details > summary::-webkit-details-marker { display: none; }
.desktop-inventory-details > summary strong { font-size: 17px; }
.desktop-inventory-details > summary span { color: var(--color-text-muted); font-size: 12px; }
.desktop-inventory-details[open] > summary { border-bottom: 1px solid var(--color-border); }
.desktop-inventory-details :deep(.inventory-weekly-analysis) { border: 0; border-radius: 0; }
</style>
