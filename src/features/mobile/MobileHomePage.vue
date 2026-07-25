<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import AppIcon from "../../components/AppIcon.vue";
import type { AccountOverview } from "../../domain/mobileOverview";
import { useUiStore } from "../../stores/ui";
import {
  accountTaskLabel,
  shortDay,
  useHomeOverview,
  wanLabel,
} from "../home/useHomeOverview";

const router = useRouter();
const ui = useUiStore();
const {
  accountRows,
  today,
  todayDescription,
  todayOverview,
  weeklyActivity,
} = useHomeOverview();

const pendingTaskCount = computed(() => accountRows.value.reduce(
  (total, row) => total + row.pendingTaskCount,
  0,
));
const pendingAccountCount = computed(() => accountRows.value.filter(
  (row) => row.pendingTaskCount > 0,
).length);
const todayActivityCount = computed(() => (
  (todayOverview.value?.taskCompletionCount || 0)
  + (todayOverview.value?.expenseCount || 0)
));

const projectionPriority = {
  ready: 0,
  buyable: 1,
  caution: 2,
  blocked: 3,
  stale: 4,
} as const;

const priorityAccounts = computed(() => [...accountRows.value]
  .filter((row) => row.pendingTaskCount > 0)
  .sort((left, right) => {
    if (todayOverview.value?.hasInventory) {
      const leftPriority = left.projection ? projectionPriority[left.projection.status] : 5;
      const rightPriority = right.projection ? projectionPriority[right.projection.status] : 5;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    }
    return right.pendingTaskCount - left.pendingTaskCount;
  })
  .slice(0, 2));

const weekBalance = computed(() => {
  if (weeklyActivity.value.harvestedSilverWan === null) return null;
  return weeklyActivity.value.harvestedSilverWan
    - weeklyActivity.value.totalSilverExpenseWan;
});

const inventoryProgressDetail = computed(() => {
  if (!todayOverview.value?.hasInventory) return "五个账号一次补齐";
  if (weeklyActivity.value.inventoryNetChangeWan === null) return "库存基线已更新";
  return `较上次 ${wanLabel(weeklyActivity.value.inventoryNetChangeWan, true)}`;
});

const todayActivityDetail = computed(() => (
  `任务 ${todayOverview.value?.taskCompletionCount || 0} · 支出 ${todayOverview.value?.expenseCount || 0}`
));

const nextAction = computed(() => {
  if (!todayOverview.value?.hasInventory) {
    return {
      kind: "inventory" as const,
      eyebrow: "下一步：补库存",
      heading: "今天还没有记录库存",
      description: todayOverview.value?.taskCompletionCount || todayOverview.value?.expenseCount
        ? "已有其他动态，再补一份库存就完整了"
        : "先记录今日库存，再处理任务",
      label: "记录今日库存",
      icon: "plus",
    };
  }

  if (pendingTaskCount.value > 0) {
    return {
      kind: "tasks" as const,
      eyebrow: "下一步：处理任务",
      heading: "今天库存已经记录",
      description: `库存已完整，还有 ${pendingTaskCount.value} 项任务待处理`,
      label: "查看待处理任务",
      icon: "plan",
    };
  }

  return {
    kind: "week" as const,
    eyebrow: "下一步：看周报",
    heading: "今天的记录已完成",
    description: todayDescription.value,
    label: "查看本周小结",
    icon: "report",
  };
});

function runNextAction() {
  if (nextAction.value.kind === "inventory") {
    ui.openRecordSheet("inventory");
    return;
  }
  void router.push(nextAction.value.kind === "tasks" ? "/plans/tasks" : "/week");
}

function priorityHint(row: AccountOverview) {
  if (!row.projection) return "任务状态待同步";
  if (!todayOverview.value?.hasInventory) return "补库存后确认资源是否齐全";
  return row.projection.actionHint;
}
</script>

<template>
  <main class="today-workbench" data-testid="mobile-week-home">
    <section class="next-step-card" aria-labelledby="today-next-step">
      <p class="section-kicker">{{ nextAction.eyebrow }}</p>
      <h1 id="today-next-step">{{ nextAction.heading }}</h1>
      <p class="next-step-description">{{ nextAction.description }}</p>
      <button class="next-step-action" type="button" @click="runNextAction">
        <AppIcon :name="nextAction.icon" />
        <span>{{ nextAction.label }}</span>
      </button>
    </section>

    <section class="today-progress-card" aria-labelledby="today-progress">
      <header class="card-heading">
        <div>
          <p>今日状态</p>
          <h2 id="today-progress">今日进度</h2>
        </div>
        <span>{{ shortDay(today) }}</span>
      </header>

      <div class="today-progress-grid">
        <article class="progress-metric inventory-metric">
          <span>今日库存</span>
          <strong :class="{ complete: todayOverview?.hasInventory }">
            {{ todayOverview?.hasInventory ? "已记录" : "待记录" }}
          </strong>
          <small>{{ inventoryProgressDetail }}</small>
        </article>
        <article class="progress-metric">
          <span>今日动态</span>
          <strong>{{ todayActivityCount }} 条</strong>
          <small>{{ todayActivityDetail }}</small>
        </article>
        <article class="progress-metric">
          <span>待处理</span>
          <strong>{{ pendingTaskCount }} 项</strong>
          <small>{{ pendingAccountCount }} 个账号</small>
        </article>
      </div>

      <div class="priority-section">
        <header class="priority-heading">
          <div>
            <h3>优先处理账号</h3>
            <p>{{ todayOverview?.hasInventory ? "按当前资源可执行性排序" : "先看任务最多的账号" }}</p>
          </div>
          <RouterLink to="/plans/tasks">
            查看全部
            <AppIcon name="chevron-right" />
          </RouterLink>
        </header>

        <div v-if="priorityAccounts.length" class="priority-list">
          <RouterLink
            v-for="row in priorityAccounts"
            :key="row.accountId"
            class="priority-account-row"
            :to="{ path: '/plans/tasks', query: { account: row.accountId } }"
            :data-account-id="row.accountId"
          >
            <span
              class="account-badge"
              :class="`account-${row.accountId.toLowerCase()}`"
            >
              {{ row.accountId }}
            </span>
            <span class="priority-copy">
              <strong>{{ accountTaskLabel(row) }}</strong>
              <small>{{ priorityHint(row) }}</small>
            </span>
            <span
              class="priority-meta"
              :class="row.projection ? `status-${row.projection.status}` : ''"
            >
              <strong>{{ row.pendingTaskCount }} 项</strong>
              <small>{{ row.projection?.statusLabel || "待同步" }}</small>
            </span>
            <AppIcon name="chevron-right" />
          </RouterLink>
        </div>

        <div v-else class="priority-empty">
          <span class="complete-mark">✓</span>
          <div>
            <strong>五个账号主线都已完成</strong>
            <small>今天没有需要推进的主线任务</small>
          </div>
        </div>
      </div>
    </section>

    <RouterLink class="week-pulse-card" to="/week" aria-labelledby="week-pulse">
      <header>
        <div>
          <p>截至今天</p>
          <h2 id="week-pulse">本周脉搏</h2>
        </div>
        <span>
          查看周报
          <AppIcon name="chevron-right" />
        </span>
      </header>
      <div class="week-metrics">
        <span>
          <small>收入</small>
          <strong>{{ wanLabel(weeklyActivity.harvestedSilverWan) }}</strong>
        </span>
        <span>
          <small>支出</small>
          <strong>{{ wanLabel(weeklyActivity.totalSilverExpenseWan) }}</strong>
        </span>
        <span>
          <small>结余</small>
          <strong
            :class="{
              negative: (weekBalance ?? 0) < 0,
              positive: (weekBalance ?? 0) > 0,
            }"
          >
            {{ wanLabel(weekBalance, true) }}
          </strong>
        </span>
      </div>
    </RouterLink>
  </main>
</template>

<style scoped>
.today-workbench {
  width: min(100%, 560px);
  display: grid;
  gap: 12px;
  margin: 0 auto;
  padding: 14px 14px 28px;
  color: #1c1c1e;
}

.next-step-card,
.today-progress-card,
.week-pulse-card {
  overflow: hidden;
  border: 1px solid rgba(60, 60, 67, 0.15);
  border-radius: 17px;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(28, 28, 30, 0.055);
}

.next-step-card {
  padding: 17px 16px 16px;
}

.section-kicker {
  margin: 0;
  color: #5f636d;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.01em;
}

.next-step-card h1 {
  margin: 13px 0 0;
  font-size: 22px;
  line-height: 1.18;
  letter-spacing: -0.035em;
}

.next-step-description {
  margin: 5px 0 0;
  color: #6e6e73;
  font-size: 13px;
  line-height: 1.45;
}

.next-step-action {
  width: 100%;
  min-height: 50px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  margin-top: 17px;
  border: 0;
  border-radius: 11px;
  color: #ffffff;
  background: #d45c00;
  box-shadow: 0 8px 18px rgba(179, 74, 0, 0.2);
  font: inherit;
  font-size: 16px;
  font-weight: 760;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.next-step-action:active {
  transform: scale(0.985);
  background: #bd5000;
}

.next-step-action :deep(svg) {
  width: 21px;
  height: 21px;
  stroke-width: 2;
}

.card-heading {
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 15px 9px;
}

.card-heading p,
.week-pulse-card header p {
  margin: 0 0 2px;
  color: #8a8a91;
  font-size: 10px;
  font-weight: 650;
  line-height: 1.2;
}

.card-heading h2,
.week-pulse-card h2 {
  margin: 0;
  font-size: 17px;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.card-heading > span {
  color: #6e6e73;
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
}

.today-progress-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0 12px;
  padding: 10px 0 12px;
  border: 1px solid rgba(60, 60, 67, 0.12);
  border-radius: 12px;
  background: rgba(248, 248, 250, 0.76);
}

.progress-metric {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 8px;
  text-align: center;
}

.progress-metric + .progress-metric {
  border-left: 1px solid rgba(60, 60, 67, 0.12);
}

.progress-metric > span {
  color: #7c7c83;
  font-size: 10px;
  font-weight: 650;
}

.progress-metric > strong {
  max-width: 100%;
  margin-top: 5px;
  overflow: hidden;
  color: #1c1c1e;
  font-size: 16px;
  line-height: 1.15;
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inventory-metric > strong {
  color: #c65300;
}

.inventory-metric > strong.complete {
  color: #08735c;
}

.progress-metric > small {
  max-width: 100%;
  margin-top: 4px;
  overflow: hidden;
  color: #8a8a91;
  font-size: 9px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.priority-section {
  margin-top: 13px;
  border-top: 1px solid rgba(60, 60, 67, 0.11);
}

.priority-heading {
  min-height: 55px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 14px 7px;
}

.priority-heading h3 {
  margin: 0;
  font-size: 14px;
  line-height: 1.2;
  letter-spacing: -0.015em;
}

.priority-heading p {
  margin: 3px 0 0;
  color: #8a8a91;
  font-size: 9px;
  line-height: 1.2;
}

.priority-heading > a {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: #c65300;
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
}

.priority-heading > a :deep(svg) {
  width: 13px;
  height: 13px;
}

.priority-list {
  padding: 0 10px 7px;
}

.priority-account-row {
  min-height: 61px;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto 14px;
  align-items: center;
  column-gap: 9px;
  padding: 7px 4px;
  border-top: 1px solid rgba(60, 60, 67, 0.09);
  color: #1c1c1e;
  -webkit-tap-highlight-color: transparent;
}

.priority-account-row:active {
  border-radius: 9px;
  background: rgba(60, 60, 67, 0.055);
}

.account-badge {
  width: 42px;
  min-height: 37px;
  display: grid;
  place-items: center;
  border: 1px solid currentColor;
  border-radius: 4px;
  color: #2b67a1;
  background: #ffffff;
  font-size: 15px;
  font-weight: 760;
  line-height: 1;
}

.account-badge.account-lg1 { color: #5d42a5; }
.account-badge.account-pt { color: #a7272e; }
.account-badge.account-lg2 { color: #9a5e00; }
.account-badge.account-myt { color: #14734d; }

.priority-copy {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.priority-copy strong,
.priority-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.priority-copy strong {
  font-size: 12px;
  font-weight: 680;
  line-height: 1.2;
}

.priority-copy small {
  color: #7c7c83;
  font-size: 9px;
  line-height: 1.25;
}

.priority-meta {
  display: grid;
  gap: 3px;
  text-align: right;
  white-space: nowrap;
}

.priority-meta strong {
  font-size: 11px;
  line-height: 1;
}

.priority-meta small {
  color: #7c7c83;
  font-size: 10px;
  font-weight: 650;
  line-height: 1;
}

.priority-meta.status-ready small { color: #08735c; }
.priority-meta.status-buyable small { color: #14734d; }
.priority-meta.status-caution small { color: #b84f00; }
.priority-meta.status-blocked small { color: #a7272e; }
.priority-meta.status-stale small { color: #6e6e73; }

.priority-account-row > :deep(svg) {
  width: 14px;
  height: 14px;
  color: #a2a2a8;
}

.priority-empty {
  min-height: 70px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 10px 8px;
  padding: 10px 6px;
  border-top: 1px solid rgba(60, 60, 67, 0.09);
}

.complete-mark {
  width: 32px;
  height: 32px;
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  color: #08735c;
  background: rgba(8, 115, 92, 0.1);
  font-size: 15px;
  font-weight: 760;
}

.priority-empty div {
  display: grid;
  gap: 3px;
}

.priority-empty strong {
  font-size: 12px;
}

.priority-empty small {
  color: #7c7c83;
  font-size: 10px;
}

.week-pulse-card {
  display: block;
  color: #1c1c1e;
  -webkit-tap-highlight-color: transparent;
}

.week-pulse-card:active {
  transform: scale(0.993);
}

.week-pulse-card > header {
  min-height: 53px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px 8px;
  border-bottom: 1px solid rgba(60, 60, 67, 0.09);
}

.week-pulse-card header > span {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: #6e6e73;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.week-pulse-card header :deep(svg) {
  width: 13px;
  height: 13px;
}

.week-metrics {
  min-height: 57px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: center;
  padding: 6px 0 9px;
}

.week-metrics > span {
  min-width: 0;
  display: grid;
  gap: 3px;
  padding: 0 14px;
}

.week-metrics > span + span {
  border-left: 1px solid rgba(60, 60, 67, 0.1);
}

.week-metrics small {
  color: #6e6e73;
  font-size: 9px;
}

.week-metrics strong {
  overflow: hidden;
  font-size: 13px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.week-metrics strong.negative {
  color: #c65300;
}

.week-metrics strong.positive {
  color: #08735c;
}

@media (max-width: 380px) {
  .today-workbench {
    padding-inline: 10px;
  }

  .today-progress-grid {
    margin-inline: 10px;
  }

  .progress-metric {
    padding-inline: 5px;
  }

  .progress-metric > strong {
    font-size: 15px;
  }

  .week-metrics > span {
    padding-inline: 10px;
  }
}
</style>
