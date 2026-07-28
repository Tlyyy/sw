<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "../../../components/AppIcon.vue";
import type { AccountOverview } from "../../../domain/mobileOverview";
import {
  accountTaskLabel,
  shortDay,
  useHomeOverview,
} from "../../../features/home/useHomeOverview";

const {
  accountRows,
  today,
  todayOverview,
} = useHomeOverview();

const pendingTaskCount = computed(() => accountRows.value.reduce(
  (total, row) => total + row.pendingTaskCount,
  0,
));
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
  .sort((left, right) => {
    const leftComplete = left.pendingTaskCount === 0;
    const rightComplete = right.pendingTaskCount === 0;
    if (leftComplete !== rightComplete) return Number(leftComplete) - Number(rightComplete);

    const leftPriority = left.projection ? projectionPriority[left.projection.status] : 5;
    const rightPriority = right.projection ? projectionPriority[right.projection.status] : 5;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;

    const leftDueDate = left.projection?.currentTask?.dueDate || "9999-12-31";
    const rightDueDate = right.projection?.currentTask?.dueDate || "9999-12-31";
    return leftDueDate.localeCompare(rightDueDate);
  }));

function priorityStatusLabel(row: AccountOverview) {
  if (!row.pendingTaskCount) return "已完成";
  if (!row.projection) return "待同步";

  const silverShortage = Number(row.projection.allocation.silverShortageWan.toFixed(2));
  if (silverShortage > 0) {
    return `缺 ${silverShortage.toLocaleString("zh-CN", { maximumFractionDigits: 2 })} 万`;
  }
  return row.projection.statusLabel;
}

</script>

<template>
  <main class="today-workbench" data-testid="mobile-week-home">
    <section class="today-progress-card" aria-labelledby="today-progress">
      <header class="card-heading">
        <div>
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
        </article>
        <article class="progress-metric">
          <span>今日动态</span>
          <strong>{{ todayActivityCount }} 条</strong>
        </article>
        <article class="progress-metric">
          <span>待处理</span>
          <strong>{{ pendingTaskCount }} 项</strong>
        </article>
      </div>

      <div class="priority-section">
        <header class="priority-heading">
          <div>
            <h3>优先处理账号</h3>
          </div>
          <RouterLink to="/plans/tasks">
            任务列表
            <AppIcon name="chevron-right" />
          </RouterLink>
        </header>

        <div class="priority-list">
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
            </span>
            <span
              class="priority-meta"
              :class="row.projection ? `priority-status-${row.projection.status}` : ''"
            >
              <strong>{{ priorityStatusLabel(row) }}</strong>
            </span>
            <AppIcon name="chevron-right" />
          </RouterLink>
        </div>
      </div>
    </section>

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

.today-progress-card {
  overflow: hidden;
  border: 1px solid rgba(60, 60, 67, 0.15);
  border-radius: 17px;
  background: var(--color-surface);
  box-shadow: 0 8px 24px rgba(28, 28, 30, 0.055);
}

.card-heading {
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 15px 9px;
}

.card-heading h2 {
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

.priority-section {
  margin-top: 14px;
  padding-bottom: 12px;
  border-top: 1px solid rgba(60, 60, 67, 0.11);
}

.priority-heading {
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 14px 6px;
}

.priority-heading h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 720;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.priority-heading > a {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--ios-tint) 16%, transparent);
  border-radius: 999px;
  color: var(--ios-tint);
  background: var(--ios-tint-soft);
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
  transition:
    transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    background-color 180ms ease;
  -webkit-tap-highlight-color: transparent;
}

.priority-heading > a:active {
  transform: scale(0.96);
  background: color-mix(in srgb, var(--ios-tint) 15%, transparent);
}

.priority-heading > a :deep(svg) {
  width: 13px;
  height: 13px;
}

.priority-list {
  margin: 0 12px;
  overflow: hidden;
  border: 1px solid var(--ios-separator);
  border-radius: 14px;
  background: var(--ios-secondary-system-background);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--color-glass-highlight) 60%, transparent),
    0 5px 14px rgba(28, 28, 30, 0.035);
}

.priority-account-row {
  min-height: 58px;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto 12px;
  align-items: center;
  column-gap: 10px;
  padding: 8px 10px;
  color: var(--ios-primary-label);
  background: var(--ios-secondary-system-background);
  transition:
    transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    background-color 180ms ease;
  -webkit-tap-highlight-color: transparent;
}

.priority-account-row + .priority-account-row {
  border-top: 1px solid var(--ios-separator);
}

.priority-account-row:active {
  z-index: 1;
  transform: scale(0.992);
  background: var(--ios-tertiary-system-background);
}

.account-badge {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, currentColor 38%, transparent);
  border-radius: 10px;
  color: #2b67a1;
  background: color-mix(in srgb, currentColor 8%, var(--ios-secondary-system-background));
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--color-glass-highlight) 70%, transparent);
  font-size: 14px;
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
  display: inline-flex;
  align-items: center;
  text-align: right;
  white-space: nowrap;
}

.priority-meta strong {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  padding: 0 9px;
  border: 1px solid color-mix(in srgb, var(--ios-secondary-label) 14%, transparent);
  border-radius: 999px;
  color: var(--ios-secondary-label);
  background: var(--ios-tertiary-system-background);
  font-size: 11px;
  font-weight: 650;
  line-height: 1;
}

.priority-meta.priority-status-ready strong,
.priority-meta.priority-status-buyable strong {
  border-color: color-mix(in srgb, #08735c 18%, transparent);
  color: #08735c;
  background: color-mix(in srgb, #08735c 9%, var(--ios-secondary-system-background));
}

.priority-meta.priority-status-caution strong {
  border-color: color-mix(in srgb, #b84f00 20%, transparent);
  color: #b84f00;
  background: color-mix(in srgb, #b84f00 9%, var(--ios-secondary-system-background));
}

.priority-meta.priority-status-blocked strong {
  border-color: color-mix(in srgb, #c53030 20%, transparent);
  color: #b4232b;
  background: color-mix(in srgb, #ff3b30 8%, var(--ios-secondary-system-background));
}

.priority-meta.priority-status-stale strong {
  color: var(--ios-secondary-label);
}

.priority-account-row > :deep(svg) {
  width: 12px;
  height: 12px;
  color: var(--ios-tertiary-label);
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

}
</style>
