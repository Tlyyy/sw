<script setup lang="ts">
import { computed, ref } from "vue";
import AppIcon from "../../components/AppIcon.vue";
import InventorySnapshotDialog from "../../components/InventorySnapshotDialog.vue";
import { buildMainlineProjection, type MainlineRequirementKind } from "../../domain/mainline";
import { buildTaskPlans, formatScheduleDueDate, resolvePlanningStartDate } from "../../domain/plans";
import type { AccountId, InventoryBalance } from "../../domain/types";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";

const catalog = useCatalogStore();
const inventory = useInventoryStore();
const settings = useSettingsStore();
const ui = useUiStore();
const inventoryDialogOpen = ref(false);
const saveNotice = ref("");

inventory.hydrate();

const inventoryEffectiveDate = computed(() => inventory.latestSnapshot?.effectiveDate || null);
const planningStartDate = computed(() => resolvePlanningStartDate(
  settings.taskSettings.startDate,
  inventoryEffectiveDate.value,
  settings.planningAsOfDate,
));
const taskPlans = computed(() => buildTaskPlans(
  catalog.data,
  catalog.pets,
  settings.snapshot(inventory.planningResources, inventoryEffectiveDate.value),
));
const projections = computed(() => buildMainlineProjection(
  taskPlans.value,
  inventory.snapshots,
  {
    buyWan: settings.taskSettings.eggPriceWan,
    sellWan: catalog.data.beastConfig.eggSellPriceWan,
  },
));
const latestDate = computed(() => inventory.latestSnapshot?.effectiveDate || null);
const previousDate = computed(() => inventory.previousSnapshot?.effectiveDate || null);
const latestInventoryComplete = computed(() => inventory.latestSnapshot
  ? Object.values(inventory.latestSnapshot.accounts).every((balance) => balance.innerShardCount !== null)
  : false);
const today = computed(() => settings.planningAsOfDate);
const readyNowProjections = computed(() => projections.value.filter((projection) => canCompleteNow(projection)));
const selectedAccount = computed<AccountId>({
  get: () => ui.recentAccount,
  set: (value) => { ui.recentAccount = value; },
});
const selectedProjection = computed(() => (
  projections.value.find((projection) => projection.accountId === selectedAccount.value)
  ?? projections.value[0]
));
const accountTone: Record<AccountId, string> = {
  FC: "var(--radar-account-fc)",
  LG1: "var(--radar-account-lg1)",
  LG2: "var(--radar-account-lg2)",
  PT: "var(--radar-account-pt)",
  MYT: "var(--radar-account-myt)",
};

function selectAccount(accountId: AccountId) {
  selectedAccount.value = accountId;
}

function saveInventorySnapshot(draft: { effectiveDate: string; accounts: Record<AccountId, InventoryBalance> }) {
  const updating = inventory.snapshots.some((item) => item.effectiveDate === draft.effectiveDate);
  inventory.saveSnapshot(draft);
  inventoryDialogOpen.value = false;
  saveNotice.value = `${updating ? "已更新" : "已保存"} ${draft.effectiveDate} 的五号库存快照`;
}

function formatNumber(value: number, maximumFractionDigits = 2) {
  return value.toLocaleString("zh-CN", { maximumFractionDigits });
}

function formatDate(value: string | null) {
  if (!value) return "未录入";
  const [, month, day] = value.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function dateAge(value: string | null) {
  if (!value) return "沿用初始值";
  const start = Date.parse(`${value}T00:00:00`);
  const end = Date.parse(`${today.value}T00:00:00`);
  const days = Math.max(0, Math.round((end - start) / 86_400_000));
  if (days === 0) return "今天";
  if (days === 1) return "昨天";
  return `${days} 天前`;
}

function formatLongDate(value: string | null) {
  if (!value) return "待录入";
  const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "long", timeZone: "Asia/Shanghai" })
    .format(new Date(`${value}T00:00:00+08:00`));
  return `${value}（${weekday}）`;
}

function isStaleDate(value: string | null) {
  if (!value) return true;
  const start = Date.parse(`${value}T00:00:00`);
  const end = Date.parse(`${today.value}T00:00:00`);
  return end - start > 8 * 86_400_000;
}

function signed(value: number, suffix = "") {
  const amount = formatNumber(value);
  return `${value > 0 ? "+" : ""}${amount}${suffix}`;
}

function deltaTone(value: number) {
  return value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
}

function taskLabel(task: ReturnType<typeof buildTaskPlans>[number]["tasks"][number] | null) {
  return task ? `${task.typeLabel} · ${task.actionLabel}` : "主线已完成";
}

function taskDueLabel(value: string | null) {
  return formatScheduleDueDate(value, planningStartDate.value);
}

function canCompleteNow(projection: ReturnType<typeof buildMainlineProjection>[number]) {
  const task = projection.currentTask;
  return Boolean(
    task
    && projection.status === "ready"
    && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)
    && task.dueDate <= today.value,
  );
}

function mainlineFinishLabel(projection: ReturnType<typeof buildMainlineProjection>[number]) {
  if (!projection.currentTask) return "整条主线已完成";
  const finish = taskDueLabel(projection.finishDate);
  return finish.startsWith("预计 ") ? `整条主线${finish}` : `整条主线：${finish}`;
}

function requirementTitle(kind: MainlineRequirementKind, amount: number) {
  if (kind === "eggs") return `${formatNumber(amount)} 个蛋`;
  if (kind === "silver") return `${formatNumber(amount)} 万`;
  if (kind === "shards") return `${formatNumber(amount)} 片`;
  if (kind === "estimate") return `${formatNumber(amount)} 万`;
  return "—";
}

function requirementCaption(kind: MainlineRequirementKind) {
  if (kind === "eggs") return "专用蛋优先";
  if (kind === "silver") return "银子任务";
  if (kind === "shards") return "内丹碎片";
  if (kind === "estimate") return "仅预算参考";
  return "没有待办";
}

function shortageValue(projection: ReturnType<typeof buildMainlineProjection>[number]) {
  if (projection.requirementKind === "eggs") return projection.allocation.eggShortage;
  if (projection.requirementKind === "silver") return projection.allocation.silverShortageWan;
  if (projection.requirementKind === "shards") return projection.allocation.shardShortage;
  return 0;
}

function shortageUnit(projection: ReturnType<typeof buildMainlineProjection>[number]) {
  if (projection.requirementKind === "eggs") return "个蛋";
  if (projection.requirementKind === "silver") return "万";
  if (projection.requirementKind === "shards") return "片";
  return "";
}

function fundingShortageWan(projection: ReturnType<typeof buildMainlineProjection>[number]) {
  if (projection.requirementKind === "eggs" || projection.requirementKind === "silver") {
    return projection.allocation.silverShortageWan;
  }
  return 0;
}

function fundingShortageValue(projection: ReturnType<typeof buildMainlineProjection>[number]) {
  if (projection.requirementKind === "eggs" && projection.allocation.eggShortage && !projection.allocation.purchaseCostWan) {
    return "待计算";
  }
  if (projection.requirementKind === "estimate") return "待确认";
  return `${formatNumber(fundingShortageWan(projection))}万`;
}

function fundingShortagePending(projection: ReturnType<typeof buildMainlineProjection>[number]) {
  return projection.requirementKind === "estimate"
    || (projection.requirementKind === "eggs" && !!projection.allocation.eggShortage && !projection.allocation.purchaseCostWan);
}

function accountFundingShortageText(projection: ReturnType<typeof buildMainlineProjection>[number]) {
  if (fundingShortagePending(projection)) return "金额待算";
  if (fundingShortageWan(projection)) return `差 ${fundingShortageValue(projection)}`;
  return "资金够用";
}

function fundingShortageCaption(projection: ReturnType<typeof buildMainlineProjection>[number]) {
  if (projection.requirementKind === "eggs" && projection.allocation.eggShortage && !projection.allocation.purchaseCostWan) {
    return "先维护普通蛋价格";
  }
  if (fundingShortageWan(projection)) {
    return projection.requirementKind === "eggs" ? "买齐当前缺口还需" : "完成当前任务还需";
  }
  if (projection.requirementKind === "estimate") return "成本待任务完成后确认";
  return "当前资金够用";
}

function allocationLines(projection: ReturnType<typeof buildMainlineProjection>[number]) {
  if (projection.requirementKind === "eggs") {
    return [
      `专用蛋 ${formatNumber(projection.allocation.dedicatedUsed)}`,
      `普通蛋 ${formatNumber(projection.allocation.regularUsed)}`,
    ];
  }
  if (projection.requirementKind === "silver") {
    return [
      `银子 ${formatNumber(projection.allocation.silverUsed)}万`,
      projection.allocation.regularEggsToSell
        ? `普通蛋默认保留（应急 ${projection.allocation.regularEggsToSell} 个）`
        : "普通蛋默认保留",
    ];
  }
  if (projection.requirementKind === "shards") {
    return [`内丹碎片 ${formatNumber(projection.allocation.shardsUsed)}`, "独立资源"];
  }
  if (projection.requirementKind === "estimate") {
    return [`预算 ${formatNumber(projection.requiredAmount)}万`, "实际成本待定"];
  }
  return ["无需分配", "主线已清空"];
}

function statusLabelFor(projection: ReturnType<typeof buildMainlineProjection>[number]) {
  if (projection.status === "stale") return "待补库存";
  if (canCompleteNow(projection)) return "现在可完成";
  if (projection.status === "ready") return "可推进";
  if (projection.status === "buyable" && projection.requirementKind === "eggs") return "银子可补齐";
  return projection.statusLabel;
}
</script>

<template>
  <main class="workbench-page radar-workbench">
    <InventorySnapshotDialog
      :open="inventoryDialogOpen"
      :initial-date="today"
      :snapshots="inventory.snapshots"
      @close="inventoryDialogOpen = false"
      @save="saveInventorySnapshot"
    />

    <header class="workbench-titlebar">
      <div>
        <h1>五条主线推进轨道</h1>
        <p>聚焦当前账号的资源、缺口和下一步，同时保留五号主线的完整推进视野。</p>
      </div>
      <div class="workbench-title-actions">
        <span class="workbench-date">库存所属日期：{{ formatLongDate(latestDate) }}</span>
      </div>
    </header>

    <p v-if="saveNotice" class="action-notice" aria-live="polite">{{ saveNotice }}</p>

    <section class="workbench-snapshot-meta radar-status-strip" aria-label="最近库存快照">
      <div>
        <span class="radar-live-dot" aria-hidden="true"></span>
        <strong>{{ latestDate ? "规划数据已同步" : "等待首份库存" }}</strong>
      </div>
      <span>库存：{{ latestDate ? formatDate(latestDate) : "待录入" }}</span>
      <span>排期基准：{{ planningStartDate }}</span>
      <span>可立即完成：{{ readyNowProjections.length }} 项</span>
      <span :class="{ warning: !latestInventoryComplete }">{{ latestInventoryComplete ? "五号资料完整" : "内丹碎片待补录" }}</span>
    </section>

    <div class="radar-command-grid">
      <aside class="radar-account-rail" aria-label="五号账号总览">
        <header>
          <div>
            <span>五号总览</span>
            <strong>选择关注账号</strong>
          </div>
          <small>库存：{{ latestDate || "待录入" }}</small>
        </header>

        <button
          v-for="projection in projections"
          :key="projection.accountId"
          type="button"
          class="radar-account-item"
          :class="{ active: projection.accountId === selectedAccount, stale: isStaleDate(projection.effectiveDate) }"
          :style="{ '--account-tone': accountTone[projection.accountId] }"
          :aria-pressed="projection.accountId === selectedAccount"
          @click="selectAccount(projection.accountId)"
        >
          <span class="radar-account-code">{{ projection.accountId }}</span>
          <span class="radar-account-copy">
            <b>{{ taskLabel(projection.currentTask) }}</b>
          </span>
          <span class="radar-account-gap">
            <small>{{ projection.requirementKind === "eggs" ? "蛋 / 资金缺口" : "资源缺口" }}</small>
            <strong>{{ shortageValue(projection) ? formatNumber(shortageValue(projection)) + shortageUnit(projection) : "无" }}</strong>
            <em v-if="projection.requirementKind === 'eggs' && projection.allocation.eggShortage">
              {{ accountFundingShortageText(projection) }}
            </em>
          </span>
          <i aria-hidden="true"></i>
        </button>
      </aside>

      <section v-if="selectedProjection" class="radar-focus-panel" aria-label="当前账号决策">
        <header class="radar-focus-header">
          <div>
            <span>当前账号</span>
            <h2 :style="{ '--account-tone': accountTone[selectedProjection.accountId] }">
              <b>{{ selectedProjection.accountId }}</b>
              <small>{{ taskLabel(selectedProjection.currentTask) }}</small>
            </h2>
          </div>
          <span class="radar-focus-date">更新于 {{ formatDate(selectedProjection.effectiveDate) }}</span>
        </header>

        <div class="radar-decision-hero">
          <div class="radar-decision-copy">
            <span>今日决策</span>
            <h3>{{ statusLabelFor(selectedProjection) }}</h3>
            <p>{{ selectedProjection.actionHint }}</p>
          </div>
          <div
            class="radar-funding-gap"
            :class="{
              clear: !fundingShortageWan(selectedProjection) && !fundingShortagePending(selectedProjection),
              pending: fundingShortagePending(selectedProjection),
            }"
            aria-live="polite"
          >
            <small>资金缺口</small>
            <strong>{{ fundingShortageValue(selectedProjection) }}</strong>
            <span>{{ fundingShortageCaption(selectedProjection) }}</span>
          </div>
          <button class="workbench-primary" type="button" @click="inventoryDialogOpen = true">
            <span>录入五号库存快照</span>
            <AppIcon name="chevron-right" />
          </button>
        </div>

        <section class="radar-resource-overview" aria-label="当前账号资源概览">
          <header>
            <h3>资源概览</h3>
            <span>当前任务：{{ requirementTitle(selectedProjection.requirementKind, selectedProjection.requiredAmount) }}</span>
          </header>
          <div>
            <span><small>专用蛋</small><b>{{ formatNumber(selectedProjection.inventory.dedicatedEggs) }}</b></span>
            <span><small>普通蛋</small><b>{{ formatNumber(selectedProjection.inventory.regularEggs) }}</b></span>
            <span><small>银子 / 万</small><b>{{ formatNumber(selectedProjection.inventory.silverWan) }}</b></span>
            <span><small>内丹碎片</small><b>{{ selectedProjection.inventory.innerShardCount ?? "待补" }}</b></span>
            <span class="gap"><small>资源缺口</small><b>{{ shortageValue(selectedProjection) ? formatNumber(shortageValue(selectedProjection)) + shortageUnit(selectedProjection) : "0" }}</b></span>
          </div>
        </section>

        <section class="radar-focus-track" aria-label="当前账号主线推进">
          <header>
            <div>
              <h3>主线推进</h3>
              <span>当前 → 下一步 → 再下一步</span>
            </div>
            <small>{{ mainlineFinishLabel(selectedProjection) }}</small>
          </header>
          <div class="task-track">
            <div class="task-track-labels">
              <span
                v-for="(task, taskIndex) in selectedProjection.nextTasks"
                :key="task.id"
                :class="{ 'ready-now-task': taskIndex === 0 && canCompleteNow(selectedProjection) }"
              >
                <b>{{ taskLabel(task) }}</b>
                <small>{{ taskIndex === 0 && canCompleteNow(selectedProjection) ? "今天可完成" : taskDueLabel(task.dueDate) }}</small>
              </span>
              <span v-for="index in Math.max(0, 3 - selectedProjection.nextTasks.length)" :key="`focus-empty-${index}`" class="empty">
                <b>{{ index === 1 && !selectedProjection.nextTasks.length ? "主线已完成" : "—" }}</b>
              </span>
            </div>
            <div class="task-track-line" aria-hidden="true"><i></i><i></i><i></i></div>
          </div>
        </section>
      </section>

      <aside v-if="selectedProjection" class="radar-action-rail" aria-label="下一步行动">
        <header>
          <div>
            <h2>下一步行动</h2>
            <span>按优先级执行</span>
          </div>
          <b>{{ selectedProjection.accountId }}</b>
        </header>

        <button class="radar-action-card primary" type="button" @click="inventoryDialogOpen = true">
          <span class="radar-action-index">P1</span>
          <span>
            <strong>立即录入</strong>
            <small>更新五号库存，刷新缺口与行动建议。</small>
          </span>
          <AppIcon name="chevron-right" />
        </button>

        <RouterLink class="radar-action-card" :to="`/accounts/${selectedProjection.accountId}`">
          <span class="radar-action-index">P2</span>
          <span>
            <strong>查看账号明细</strong>
            <small>核对宠物、装备与资源资料。</small>
          </span>
          <AppIcon name="chevron-right" />
        </RouterLink>

        <RouterLink class="radar-action-card" to="/plans/tasks">
          <span class="radar-action-index">P3</span>
          <span>
            <strong>维护任务状态</strong>
            <small>完成后标记进度，重算后续排期。</small>
          </span>
          <AppIcon name="chevron-right" />
        </RouterLink>

        <section v-if="readyNowProjections.length" class="ready-now-banner" aria-label="当前可完成任务">
          <div>
            <strong>现在可完成 {{ readyNowProjections.length }} 项</strong>
            <span>{{ readyNowProjections.map((projection) => projection.accountId + " · " + taskLabel(projection.currentTask)).join("　") }}</span>
          </div>
          <RouterLink to="/plans/tasks">去任务维护标记完成</RouterLink>
        </section>
      </aside>

      <section class="radar-timeline-panel">
        <header>
          <div>
            <h2>五号主线推进轨道</h2>
            <p>完整保留五个账号的当前任务、后续节点、资源分配和预计完成状态。</p>
          </div>
          <span>{{ latestDate ? `库存基准 ${formatDate(latestDate)}` : "尚未建立库存基准" }}</span>
        </header>

        <div class="mainline-table-scroll">
          <section class="mainline-table" role="table" aria-label="五账号神兽主线推进轨道">
            <div class="mainline-grid mainline-head" role="row">
              <span role="columnheader">账号</span>
              <span role="columnheader">当前 → 下一步 → 再下一步</span>
              <span role="columnheader">资源分配与行动提示</span>
              <span role="columnheader">状态 / 缺口</span>
              <span role="columnheader">明细</span>
            </div>

            <article
              v-for="projection in projections"
              :key="projection.accountId"
              :class="['mainline-grid', 'mainline-row', { 'ready-now-row': canCompleteNow(projection), active: projection.accountId === selectedAccount }]"
              :style="{ '--account-tone': accountTone[projection.accountId] }"
              role="row"
              @click="selectAccount(projection.accountId)"
            >
              <div class="mainline-cell radar-row-account" role="cell">
                <span class="account-pill" :class="`account-${projection.accountId.toLowerCase()}`">{{ projection.accountId }}</span>
                <span>
                  <b>{{ formatDate(projection.effectiveDate) }}</b>
                  <small>{{ dateAge(projection.effectiveDate) }}</small>
                </span>
              </div>

              <div class="mainline-cell" role="cell">
                <div class="task-track">
                  <div class="task-track-labels">
                    <span
                      v-for="(task, taskIndex) in projection.nextTasks"
                      :key="task.id"
                      :class="{ 'ready-now-task': taskIndex === 0 && canCompleteNow(projection) }"
                    >
                      <b>
                        {{ taskLabel(task) }}
                        <em v-if="taskIndex === 0 && canCompleteNow(projection)" class="task-ready-badge">现在可完成</em>
                      </b>
                      <small>{{ taskIndex === 0 && canCompleteNow(projection) ? "今天可完成" : taskDueLabel(task.dueDate) }}</small>
                    </span>
                    <span v-for="index in Math.max(0, 3 - projection.nextTasks.length)" :key="`empty-${index}`" class="empty">
                      <b>{{ index === 1 && !projection.nextTasks.length ? "主线已完成" : "—" }}</b>
                    </span>
                  </div>
                  <div class="task-track-line" aria-hidden="true"><i></i><i></i><i></i></div>
                  <small class="task-track-finish">{{ mainlineFinishLabel(projection) }}</small>
                </div>
              </div>

              <div class="mainline-cell radar-row-resource" role="cell">
                <span><b>{{ allocationLines(projection)[0] }}</b><small>{{ allocationLines(projection)[1] }}</small></span>
                <em>{{ projection.actionHint }}</em>
              </div>

              <div class="status-cell" role="cell">
                <span class="status-chip" :class="projection.status">{{ statusLabelFor(projection) }}</span>
                <small>
                  {{ shortageValue(projection) ? `缺 ${formatNumber(shortageValue(projection))}${shortageUnit(projection)}` : requirementCaption(projection.requirementKind) }}
                </small>
              </div>

              <div class="mainline-detail-cell" role="cell">
                <RouterLink
                  class="mainline-detail-link"
                  :to="`/accounts/${projection.accountId}`"
                  :aria-label="`查看 ${projection.accountId} 账号明细`"
                  @click.stop
                >
                  <span>明细</span>
                  <AppIcon name="chevron-right" />
                </RouterLink>
              </div>
            </article>
          </section>
        </div>
      </section>
    </div>

    <div class="workbench-bottom-grid radar-lower-grid">
      <section class="workbench-panel">
        <header>
          <h2>五号最近变化</h2>
          <span>{{ previousDate ? `相对上一快照：${formatDate(previousDate)}` : "需要至少两份快照" }}</span>
        </header>
        <div class="radar-ledger-scroll">
          <table class="changes-ledger">
            <thead><tr><th>账号</th><th>专用蛋净变化</th><th>普通蛋净变化</th><th>银子净变化 / 万</th><th>内丹碎片净变化</th><th>说明</th></tr></thead>
            <tbody>
              <tr v-for="projection in projections" :key="projection.accountId">
                <td><strong :style="{ color: accountTone[projection.accountId] }">{{ projection.accountId }}</strong></td>
                <td :class="projection.delta ? deltaTone(projection.delta.dedicatedEggs) : ''">{{ projection.delta ? signed(projection.delta.dedicatedEggs) : "—" }}</td>
                <td :class="projection.delta ? deltaTone(projection.delta.regularEggs) : ''">{{ projection.delta ? signed(projection.delta.regularEggs) : "—" }}</td>
                <td :class="projection.delta ? deltaTone(projection.delta.silverWan) : ''">{{ projection.delta ? signed(projection.delta.silverWan) : "—" }}</td>
                <td :class="projection.delta?.innerShardCount === null || !projection.delta ? '' : deltaTone(projection.delta.innerShardCount)">{{ projection.delta?.innerShardCount === null || !projection.delta ? "—" : signed(projection.delta.innerShardCount) }}</td>
                <td>{{ projection.delta ? `间隔 ${projection.delta.intervalDays} 天` : "尚无对比区间" }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="workbench-panel">
        <header><h2>共用规则（神兽主线库存）</h2></header>
        <ul class="workbench-rules">
          <li><strong>神兽专属养成：</strong>神兽青蛇和神兽龙马（小马）在打书后按饰品 → 进阶1 → 进阶2 → 皮肤推进；小马完成皮肤后另做马强化，普通宠不进入此任务表。</li>
          <li><strong>半成品依赖：</strong>按内丹前置（如需）→ 洗护符 → 打书 → 神兽专属养成推进。</li>
          <li><strong>专用蛋不可出售：</strong>任务消耗时优先使用专用蛋，其次使用普通蛋。</li>
          <li><strong>普通蛋任务优先：</strong>默认保留给神兽任务，只有确实必须立即推进时才考虑出售。</li>
          <li><strong>库存日期和录入时间分开：</strong>补录周一库存时选择周一，系统另存实际录入时间。</li>
          <li><strong>净变化不是收入：</strong>它是两次完整库存之差，包含期间获得、消耗和买卖的最终结果。</li>
        </ul>
      </section>
    </div>
  </main>
</template>
