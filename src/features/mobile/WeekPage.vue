<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AppIcon from "../../components/AppIcon.vue";
import InventoryWeeklyAnalysis from "../../components/InventoryWeeklyAnalysis.vue";
import InventoryWeekSwitcher from "../../components/InventoryWeekSwitcher.vue";
import WeeklyActivityPanel from "../../components/WeeklyActivityPanel.vue";
import { buildInventoryWeekReport, naturalWeekRange } from "../../domain/inventory";
import { buildMobileWeekOverview, type MobileWeekDayOverview } from "../../domain/mobileOverview";
import { buildWeeklyActivitySummary } from "../../domain/weeklyActivity";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";

const inventory = useInventoryStore();
const settings = useSettingsStore();
const ui = useUiStore();
const selectedAnchor = ref(settings.planningAsOfDate);

inventory.hydrate();

const currentDate = computed(() => settings.planningAsOfDate);
const report = computed(() => buildInventoryWeekReport(inventory.snapshots, selectedAnchor.value));
const currentWeek = computed(() => naturalWeekRange(currentDate.value));
const isCurrentWeek = computed(() => report.value.weekStart === currentWeek.value.weekStart);
const canViewNextWeek = computed(() => report.value.weekStart < currentWeek.value.weekStart);
const activity = computed(() => buildWeeklyActivitySummary(
  report.value,
  settings.taskCompletions,
  settings.silverExpenses,
  currentDate.value,
));
const weekDays = computed(() => buildMobileWeekOverview(
  report.value,
  currentDate.value,
  settings.taskCompletions,
  settings.silverExpenses,
));
const dateRangeLabel = computed(() => `${report.value.weekStart} 至 ${report.value.weekEnd}`);
const latestUpdateDate = computed(() => {
  const dates = [
    activity.value.latestInventoryDate,
    ...activity.value.taskCompletions.map((entry) => entry.completedOn),
    ...activity.value.manualExpenses.map((entry) => entry.effectiveDate),
  ].filter((value): value is string => Boolean(value)).sort();
  return dates.length ? dates[dates.length - 1] : null;
});
const baselineLabel = computed(() => {
  const change = report.value.weeklyChange;
  if (!change) return "库存待建立基线";
  return `${shortMonthDay(change.fromEffectiveDate)} → ${shortMonthDay(change.toEffectiveDate)}`;
});
const weekdayLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"] as const;

watch(currentDate, (date, previousDate) => {
  const previousCurrentWeek = naturalWeekRange(previousDate);
  if (report.value.weekStart === previousCurrentWeek.weekStart) selectedAnchor.value = date;
});

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

function moveWeek(days: -7 | 7) {
  if (days > 0 && !canViewNextWeek.value) return;
  selectedAnchor.value = shiftDate(report.value.weekStart, days);
}

function returnToCurrentWeek() {
  selectedAnchor.value = currentDate.value;
}

function shortMonthDay(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function dayNumber(value: string) {
  return Number(value.slice(-2));
}

function dayStateLabel(day: MobileWeekDayOverview) {
  if (day.date === currentDate.value) return "今天";
  if (day.state === "recorded") return "已记";
  if (day.state === "future") return "未来";
  return "未记";
}

function wanLabel(value: number | null, signed = false) {
  if (value === null) return "—";
  const normalized = Number(value.toFixed(2));
  const prefix = signed && normalized > 0 ? "+" : "";
  return `${prefix}${normalized.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}万`;
}

function compactWanLabel(value: number | null, signed = false) {
  if (value === null) return "—";
  const normalized = Number(value.toFixed(2));
  const prefix = signed && normalized > 0 ? "+" : "";
  return `${prefix}${normalized.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

function valueTone(value: number | null) {
  if (value === null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

function openSupplementSheet() {
  ui.openRecordSheet("inventory", {
    sourcePath: "/week",
    returnTo: "/week",
    effectiveDate: activity.value.reportEnd,
  });
}
</script>

<template>
  <div class="page-wrap week-page" data-testid="week-page">
    <header class="week-page-intro">
      <div>
        <p>{{ isCurrentWeek ? "本周" : "历史" }}</p>
        <h1>本周小结</h1>
      </div>
      <nav class="week-page-actions" aria-label="本周小结相关操作">
        <RouterLink class="button earnings-button" to="/earnings">查看实际所得</RouterLink>
        <button class="button" type="button" @click="openSupplementSheet">补充记录</button>
      </nav>
    </header>

    <InventoryWeekSwitcher
      class="week-desktop-switcher"
      :week-start="report.weekStart"
      :week-end="report.weekEnd"
      :is-current-week="isCurrentWeek"
      :can-view-next-week="canViewNextWeek"
      @previous="moveWeek(-7)"
      @next="moveWeek(7)"
      @current="returnToCurrentWeek"
    />

    <section class="week-mobile-report" aria-label="手机端周报">
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

      <ol class="week-day-strip">
        <li
          v-for="day in weekDays"
          :key="day.date"
          :class="[`is-${day.state}`, { 'is-current': day.date === currentDate }]"
        >
          <span>{{ weekdayLabels[day.weekday - 1] }}</span>
          <strong>{{ dayNumber(day.date) }}</strong>
          <i aria-hidden="true"></i>
          <small>{{ dayStateLabel(day) }}</small>
        </li>
      </ol>

      <section class="week-summary-card" aria-labelledby="week-summary-title">
        <header>
          <div>
            <p>{{ latestUpdateDate ? `本周更新于 ${shortMonthDay(latestUpdateDate)}` : "本周暂无已保存记录" }}</p>
            <h2 id="week-summary-title">五个账号本周情况</h2>
          </div>
          <span>{{ baselineLabel }}</span>
        </header>
        <dl class="week-summary-metrics">
          <div>
            <dt>收入</dt>
            <dd :class="valueTone(activity.harvestedSilverWan)">{{ wanLabel(activity.harvestedSilverWan) }}</dd>
          </div>
          <div>
            <dt>支出</dt>
            <dd :class="activity.totalSilverExpenseWan > 0 ? 'negative' : 'neutral'">{{ wanLabel(activity.totalSilverExpenseWan) }}</dd>
          </div>
          <div>
            <dt>结余</dt>
            <dd :class="valueTone(activity.inventoryNetChangeWan)">{{ wanLabel(activity.inventoryNetChangeWan, true) }}</dd>
          </div>
        </dl>
      </section>

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
                <td v-for="account in activity.accountSummaries" :key="account.accountId">
                  {{ compactWanLabel(account.harvestedSilverWan) }}
                </td>
              </tr>
              <tr class="week-account-row">
                <th scope="row">支出/万</th>
                <td v-for="account in activity.accountSummaries" :key="account.accountId">
                  {{ compactWanLabel(account.totalSilverExpenseWan) }}
                </td>
              </tr>
              <tr class="week-account-row">
                <th scope="row">结余/万</th>
                <td
                  v-for="account in activity.accountSummaries"
                  :key="account.accountId"
                  :class="valueTone(account.inventoryNetChangeWan)"
                >
                  {{ compactWanLabel(account.inventoryNetChangeWan, true) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="week-supplement-card">
        <div>
          <h2>补充本周记录</h2>
        </div>
        <button type="button" @click="openSupplementSheet">
          补充记录
        </button>
      </section>

      <details class="week-mobile-full-report">
        <summary>
          <span><strong>完整周核算</strong></span>
          <b>查看</b>
        </summary>
        <WeeklyActivityPanel :report="report" :current-date="currentDate" />
        <RouterLink class="week-earnings-link" to="/earnings">查看实际所得</RouterLink>
      </details>
    </section>

    <div class="week-desktop-report">
      <WeeklyActivityPanel :report="report" :current-date="currentDate" />
    </div>

    <details class="week-inventory-details">
      <summary>
        <span><strong>按账号查看库存变化</strong></span>
        <b>{{ report.recordedDays }} / 7 天库存记录</b>
      </summary>
      <InventoryWeeklyAnalysis :report="report" :current-date="currentDate" :show-activity="false" initial-view="summary" />
    </details>
  </div>
</template>

<style scoped>
.week-page { width: min(100%, 1320px); padding-top: 14px; padding-bottom: 48px; }
.week-page-intro { min-height: 48px; display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 10px; padding: 0 4px 10px; border-bottom: 1px solid var(--color-border); }
.week-page-intro > div { min-width: 0; display: flex; align-items: baseline; gap: 8px; }
.week-page-intro p { color: var(--color-accent-strong); font-size: 11px; font-weight: 850; letter-spacing: .1em; }
.week-page-intro h1 { font-size: 25px; line-height: 1.2; letter-spacing: -.04em; white-space: nowrap; }
.week-page-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.week-page-intro .button { min-height: 44px; display: inline-flex; align-items: center; white-space: nowrap; }
.week-page-intro .earnings-button {
  border-color: color-mix(in srgb, var(--color-accent) 55%, var(--color-border));
  color: var(--color-accent-strong);
  background: color-mix(in srgb, var(--color-accent-soft) 62%, #ffffff);
}

.week-page :deep(.inventory-week-switcher) { margin-bottom: 12px; }
.week-page :deep(.weekly-activity-panel) { margin: 0; border-radius: 14px; box-shadow: 0 7px 20px rgba(17, 24, 39, .06); }
.week-mobile-report { display: none; }

.week-inventory-details { margin-top: 14px; overflow: hidden; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface); }
.week-inventory-details > summary { min-height: 72px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 13px 16px; cursor: pointer; list-style: none; }
.week-inventory-details > summary::-webkit-details-marker { display: none; }
.week-inventory-details > summary > span { display: grid; gap: 2px; }
.week-inventory-details > summary strong { font-size: 17px; }
.week-inventory-details > summary small { color: var(--color-text-muted); font-size: 12px; }
.week-inventory-details > summary > b { color: var(--color-accent-strong); font-size: 12px; white-space: nowrap; }
.week-inventory-details[open] > summary { border-bottom: 1px solid var(--color-border); }
.week-inventory-details :deep(.inventory-weekly-analysis) { border: 0; border-radius: 0; }

@media (max-width: 720px) {
  .week-page {
    --week-accent: #c44d00;
    --week-positive: #006b5a;
    --week-border: rgba(60, 60, 67, .16);
    padding: 8px 12px 112px;
  }
  .week-page-intro,
  .week-desktop-switcher,
  .week-desktop-report {
    display: none;
  }
  .week-mobile-report { display: grid; gap: 10px; }
  .week-mobile-switcher {
    min-height: 64px;
    display: grid;
    grid-template-columns: 44px 1fr 44px;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border: 1px solid var(--week-border);
    border-radius: 13px;
    background: rgba(255, 255, 255, .88);
    box-shadow: 0 4px 14px rgba(17, 24, 39, .04);
  }
  .week-mobile-switcher > button {
    width: 40px;
    height: 44px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid var(--week-border);
    border-radius: 10px;
    color: #344054;
    background: rgba(255, 255, 255, .72);
  }
  .week-mobile-switcher > button:disabled { color: #a6adba; background: #f5f6f8; }
  .week-mobile-switcher :deep(svg) { width: 18px; height: 18px; }
  .week-switcher-previous { transform: rotate(180deg); }
  .week-mobile-switcher > div { min-width: 0; display: grid; justify-items: center; gap: 3px; }
  .week-mobile-switcher strong { color: #1d2939; font-size: 13px; letter-spacing: -.01em; white-space: nowrap; }
  .week-mobile-switcher span,
  .week-mobile-switcher > div > button {
    min-height: 0;
    padding: 0;
    border: 0;
    color: var(--ios-secondary-label);
    font-size: 11px;
    font-weight: 700;
    background: transparent;
  }
  .week-mobile-switcher > div > button { color: var(--week-accent); }

  .week-day-strip {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    margin: 0;
    padding: 8px 3px;
    border: 1px solid var(--week-border);
    border-radius: 13px;
    list-style: none;
    background: rgba(255, 255, 255, .9);
    box-shadow: 0 4px 14px rgba(17, 24, 39, .035);
  }
  .week-day-strip li {
    min-width: 0;
    display: grid;
    justify-items: center;
    gap: 3px;
    padding: 3px 1px;
    border-right: 1px solid rgba(60, 60, 67, .11);
    color: #344054;
  }
  .week-day-strip li:last-child { border-right: 0; }
  .week-day-strip span { font-size: 10px; font-weight: 700; white-space: nowrap; }
  .week-day-strip strong { font-size: 16px; line-height: 1.1; }
  .week-day-strip i {
    width: 8px;
    height: 8px;
    border: 1.5px solid #b0b8c5;
    border-radius: 50%;
    background: var(--color-surface);
  }
  .week-day-strip small { color: #8b95a5; font-size: 9px; font-weight: 700; white-space: nowrap; }
  .week-day-strip .is-recorded i { border-color: var(--week-positive); background: var(--week-positive); }
  .week-day-strip .is-current {
    margin-block: -2px;
    padding-block: 5px;
    border: 1px solid rgba(196, 77, 0, .22);
    border-radius: 10px;
    color: var(--week-accent);
    background: #fff8f2;
  }
  .week-day-strip .is-current i {
    border-color: var(--week-accent);
    box-shadow: inset 0 0 0 2px #fff8f2;
    background: var(--week-accent);
  }
  .week-day-strip .is-current small { color: var(--week-accent); }
  .week-day-strip .is-future { color: #788396; }

  .week-summary-card,
  .week-account-card,
  .week-supplement-card,
  .week-mobile-full-report {
    overflow: hidden;
    border: 1px solid var(--week-border);
    border-radius: 13px;
    background: rgba(255, 255, 255, .92);
    box-shadow: 0 4px 14px rgba(17, 24, 39, .035);
  }
  .week-summary-card { padding: 13px; }
  .week-summary-card > header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 13px;
  }
  .week-summary-card > header > div { min-width: 0; display: grid; gap: 5px; }
  .week-summary-card p { margin: 0; color: var(--ios-secondary-label); font-size: 11px; }
  .week-summary-card h2,
  .week-account-card h2,
  .week-supplement-card h2 { margin: 0; color: #1d2939; font-size: 15px; letter-spacing: -.02em; }
  .week-summary-card > header > span { color: var(--ios-secondary-label); font-size: 10px; font-weight: 650; white-space: nowrap; }
  .week-summary-metrics {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    margin: 0;
    padding: 10px 0;
    border: 1px solid rgba(60, 60, 67, .12);
    border-radius: 10px;
    background: var(--color-surface);
  }
  .week-summary-metrics > div { min-width: 0; display: grid; gap: 6px; padding: 0 12px; border-right: 1px solid rgba(60, 60, 67, .12); }
  .week-summary-metrics > div:last-child { border-right: 0; }
  .week-summary-metrics dt { color: var(--ios-secondary-label); font-size: 10px; font-weight: 650; }
  .week-summary-metrics dd { margin: 0; color: var(--week-accent); font-size: 17px; font-weight: 780; white-space: nowrap; }
  .week-summary-metrics dd.positive,
  .week-account-row .positive { color: var(--week-positive); }
  .week-summary-metrics dd.negative,
  .week-account-row .negative { color: var(--week-accent); }
  .week-summary-metrics dd.neutral,
  .week-account-row .neutral { color: #344054; }

  .week-account-card { padding: 13px; }
  .week-account-card h2 { margin-bottom: 10px; }
  .week-account-table-wrap {
    overflow-x: auto;
    border-top: 1px solid rgba(60, 60, 67, .12);
    overscroll-behavior-inline: contain;
  }
  .week-account-table {
    width: 100%;
    min-width: 328px;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .week-account-head { color: var(--ios-secondary-label); font-size: 9px; font-weight: 650; }
  .week-account-head th {
    height: 31px;
    padding: 0 3px;
    font-weight: inherit;
    text-align: center;
  }
  .week-account-head th:first-child,
  .week-account-row > th {
    width: 54px;
    text-align: left;
  }
  .week-account-row { color: #344054; font-size: 11px; }
  .week-account-row > :is(th, td) {
    height: 39px;
    padding: 0 3px;
    border-top: 1px solid rgba(60, 60, 67, .1);
  }
  .week-account-row > th { color: var(--ios-secondary-label); font-weight: 650; white-space: nowrap; }
  .week-account-row > td { text-align: center; white-space: nowrap; }
  .week-account-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 31px;
    padding: 4px 5px;
    border: 1px solid #5b8fbd;
    border-radius: 4px;
    color: #1f6aa5;
    font-size: 11px;
    text-align: center;
  }
  .week-account-badge[data-account="LG1"] { border-color: #8e79c6; color: #5b3bab; }
  .week-account-badge[data-account="PT"] { border-color: #cc8186; color: #9f2831; }
  .week-account-badge[data-account="LG2"] { border-color: #c79a58; color: #985800; }
  .week-account-badge[data-account="MYT"] { border-color: #78a894; color: #147052; }

  .week-supplement-card {
    min-height: 66px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 11px 12px;
  }
  .week-supplement-card > div { min-width: 0; display: grid; gap: 3px; }
  .week-supplement-card p { margin: 0; overflow: hidden; color: var(--ios-secondary-label); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
  .week-supplement-card > button {
    min-height: 42px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0 12px;
    border: 1px solid var(--week-accent);
    border-radius: 9px;
    color: var(--week-accent);
    font-size: 12px;
    font-weight: 750;
    background: var(--color-surface);
    white-space: nowrap;
  }
  .week-supplement-card :deep(svg) { width: 16px; height: 16px; }

  .week-mobile-full-report { display: block; }
  .week-mobile-full-report > summary,
  .week-inventory-details > summary {
    min-height: 62px;
    align-items: center;
    flex-direction: row;
    gap: 10px;
    padding: 10px 12px;
  }
  .week-mobile-full-report > summary {
    display: flex;
    justify-content: space-between;
    cursor: pointer;
    list-style: none;
  }
  .week-mobile-full-report > summary::-webkit-details-marker { display: none; }
  .week-mobile-full-report > summary > span { display: grid; gap: 2px; }
  .week-mobile-full-report strong { color: #1d2939; font-size: 14px; }
  .week-mobile-full-report small { color: var(--ios-secondary-label); font-size: 10px; }
  .week-mobile-full-report b { color: var(--week-accent); font-size: 11px; }
  .week-mobile-full-report[open] > summary { border-bottom: 1px solid var(--week-border); }
  .week-mobile-full-report :deep(.weekly-activity-panel) { border: 0; border-radius: 0; box-shadow: none; }
  .week-earnings-link {
    min-height: 44px;
    display: grid;
    place-items: center;
    border-top: 1px solid var(--week-border);
    color: var(--week-accent);
    font-size: 12px;
    font-weight: 750;
    text-decoration: none;
  }

  .week-inventory-details { margin-top: 10px; border-color: var(--week-border); border-radius: 13px; }
  .week-inventory-details > summary { align-items: center; flex-direction: row; }
  .week-inventory-details > summary strong { font-size: 14px; }
  .week-inventory-details > summary small { font-size: 10px; }
  .week-inventory-details > summary > b { color: var(--week-accent); font-size: 10px; }
}
</style>
