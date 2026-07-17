<script setup lang="ts">
import { computed, ref } from "vue";
import InventorySnapshotDialog from "../../components/InventorySnapshotDialog.vue";
import { buildMainlineProjection, type MainlineRequirementKind } from "../../domain/mainline";
import { buildTaskPlans, formatScheduleDueDate, resolvePlanningStartDate } from "../../domain/plans";
import type { AccountId, InventoryBalance } from "../../domain/types";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";

const catalog = useCatalogStore();
const inventory = useInventoryStore();
const settings = useSettingsStore();
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
const accountTone: Record<AccountId, string> = {
  FC: "#176bb2",
  LG1: "#7244aa",
  LG2: "#ed6b00",
  PT: "#d6372d",
  MYT: "#12804d",
};

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
  <main class="workbench-page">
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
        <p>已成型神兽先推进；半成品神兽完成内丹、护符和打书后，才进入神兽专属养成。排期不会早于今天或库存日期，当前基准为 {{ planningStartDate }}。</p>
      </div>
      <div class="workbench-title-actions">
        <span class="workbench-date">库存所属日期：{{ formatLongDate(latestDate) }}</span>
        <button class="workbench-primary" type="button" @click="inventoryDialogOpen = true">
          录入五号库存快照
        </button>
      </div>
    </header>

    <p v-if="saveNotice" class="action-notice" aria-live="polite">{{ saveNotice }}</p>

    <section class="workbench-snapshot-meta" aria-label="最近库存快照">
      <div>
        <strong>最近库存快照：{{ latestDate ? `${formatDate(latestDate)} · ${latestInventoryComplete ? "五号已齐" : "内丹碎片待补录"}` : "尚未建立" }}</strong>
        <small>{{ latestDate ? "五账号库存与主线排期已同步" : "建立快照后自动生成资源缺口和推进建议" }}</small>
      </div>
      <span>{{ latestDate ? `系统按库存所属日期排序；实际录入时间另行保留` : "先录入一份五号总库存，第二份开始计算区间净变化" }}</span>
      <em class="mainline-scroll-hint">左右滑动查看完整推进信息</em>
    </section>

    <section v-if="readyNowProjections.length" class="ready-now-banner" aria-label="当前可完成任务">
      <div class="ready-now-banner-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8.2 12.2 2.4 2.5 5.4-5.5"/></svg>
      </div>
      <div>
        <strong>现在可完成 {{ readyNowProjections.length }} 项</strong>
        <span>{{ readyNowProjections.map((projection) => projection.accountId + " · " + taskLabel(projection.currentTask)).join("　") }}</span>
      </div>
      <RouterLink to="/plans/tasks">去任务维护标记完成</RouterLink>
    </section>

    <div class="mainline-table-scroll">
      <section class="mainline-table" role="table" aria-label="五账号神兽主线推进轨道">
        <div class="mainline-grid mainline-head" role="row">
          <span role="columnheader">账号</span>
          <span role="columnheader">最新库存<small>有效日期</small></span>
          <span role="columnheader">当前库存<small>专用蛋 / 普通蛋 / 银子 / 内丹碎片</small></span>
          <span role="columnheader">库存净变化<small>相对上一快照</small></span>
          <span role="columnheader">主线推进<small>任务与预计完成日</small></span>
          <span role="columnheader">当前任务<small>需求量</small></span>
          <span role="columnheader">资源分配<small>专用蛋优先</small></span>
          <span role="columnheader">缺口</span>
          <span role="columnheader">推荐下一步行动</span>
          <span role="columnheader">明细</span>
        </div>

        <article
          v-for="projection in projections"
          :key="projection.accountId"
          :class="['mainline-grid', 'mainline-row', { 'ready-now-row': canCompleteNow(projection) }]"
          :style="{ '--account-tone': accountTone[projection.accountId] }"
          role="row"
        >
          <div class="mainline-cell" role="cell">
            <span class="account-pill" :class="`account-${projection.accountId.toLowerCase()}`">{{ projection.accountId }}</span>
          </div>

          <div class="mainline-cell snapshot-age" :class="{ stale: isStaleDate(projection.effectiveDate) }" role="cell">
            <span><b>{{ formatDate(projection.effectiveDate) }}</b><small>{{ dateAge(projection.effectiveDate) }}</small></span>
          </div>

          <div class="mainline-cell" role="cell">
            <div class="resource-trio">
              <span><small>专用蛋</small><b>{{ formatNumber(projection.inventory.dedicatedEggs) }}</b></span>
              <span><small>普通蛋</small><b>{{ formatNumber(projection.inventory.regularEggs) }}</b></span>
              <span><small>银子/万</small><b>{{ formatNumber(projection.inventory.silverWan) }}</b></span>
              <span><small>内丹碎片</small><b>{{ projection.inventory.innerShardCount ?? "待补" }}</b></span>
            </div>
          </div>

          <div class="mainline-cell" role="cell">
            <div v-if="projection.delta" class="delta-trio">
              <span><small>专用蛋</small><b :class="deltaTone(projection.delta.dedicatedEggs)">{{ signed(projection.delta.dedicatedEggs) }}</b></span>
              <span><small>普通蛋</small><b :class="deltaTone(projection.delta.regularEggs)">{{ signed(projection.delta.regularEggs) }}</b></span>
              <span><small>银子/万</small><b :class="deltaTone(projection.delta.silverWan)">{{ signed(projection.delta.silverWan) }}</b></span>
              <span><small>内丹碎片</small><b :class="projection.delta.innerShardCount === null ? 'neutral' : deltaTone(projection.delta.innerShardCount)">{{ projection.delta.innerShardCount === null ? "—" : signed(projection.delta.innerShardCount) }}</b></span>
            </div>
            <span v-else class="inventory-baseline-label">{{ latestDate ? "首份基线" : "待录快照" }}</span>
          </div>

          <div class="mainline-cell" role="cell">
            <div class="task-track">
              <div class="task-track-labels">
                <span v-for="(task, taskIndex) in projection.nextTasks" :key="task.id" :class="{ 'ready-now-task': taskIndex === 0 && canCompleteNow(projection) }">
                  <b>{{ taskLabel(task) }}<em v-if="taskIndex === 0 && canCompleteNow(projection)" class="task-ready-badge">现在可完成</em></b>
                  <small>{{ taskIndex === 0 && canCompleteNow(projection) ? "今天可完成" : taskDueLabel(task.dueDate) }}</small>
                </span>
                <span v-for="index in Math.max(0, 3 - projection.nextTasks.length)" :key="`empty-${index}`" class="empty"><b>{{ index === 1 && !projection.nextTasks.length ? "主线已完成" : "—" }}</b></span>
              </div>
              <div class="task-track-line" aria-hidden="true"><i></i><i></i><i></i></div>
              <small class="task-track-finish">{{ mainlineFinishLabel(projection) }}</small>
            </div>
          </div>

          <div class="mainline-cell requirement-cell" role="cell">
            <span><b>{{ requirementTitle(projection.requirementKind, projection.requiredAmount) }}</b><small>{{ requirementCaption(projection.requirementKind) }}</small></span>
          </div>

          <div class="mainline-cell allocation-cell" role="cell">
            <span><b>{{ allocationLines(projection)[0] }}</b><small>{{ allocationLines(projection)[1] }}</small></span>
          </div>

          <div class="mainline-cell shortage-cell" :class="{ none: shortageValue(projection) === 0 }" role="cell">
            {{ shortageValue(projection) ? `${formatNumber(shortageValue(projection))}${shortageUnit(projection)}` : "—" }}
          </div>

          <div class="status-cell" role="cell">
            <span class="status-chip" :class="projection.status">{{ statusLabelFor(projection) }}</span>
            <small>{{ projection.actionHint }}</small>
          </div>

          <div class="mainline-detail-cell" role="cell">
            <RouterLink
              class="mainline-detail-link"
              :to="`/accounts/${projection.accountId}`"
              :aria-label="`查看 ${projection.accountId} 账号明细`"
            >
              <span>明细</span>
              <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m6 3 5 5-5 5" /></svg>
            </RouterLink>
          </div>
        </article>
      </section>
    </div>

    <div class="workbench-bottom-grid">
      <section class="workbench-panel">
        <header>
          <h2>五号最近变化</h2>
          <span>{{ previousDate ? `相对上一快照：${formatDate(previousDate)}` : "需要至少两份快照" }}</span>
        </header>
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
      </section>

      <section class="workbench-panel">
        <header><h2>共用规则（神兽主线库存）</h2></header>
        <ul class="workbench-rules">
          <li><strong>神兽专属养成：</strong>神兽青蛇和神兽龙马（小马）在打书后按饰品 → 进阶1 → 进阶2 → 皮肤推进；小马完成皮肤后另做马强化，普通宠不进入此任务表。</li>
          <li><strong>半成品依赖：</strong>需洗护符的神兽整体后置，并严格按内丹前置（如需）→ 洗护符 → 打书 → 神兽专属养成推进；洗护符金额只作预算，不承诺洗成。</li>
          <li><strong>专用蛋不可出售：</strong>任务消耗时优先使用专用蛋，其次使用普通蛋。</li>
          <li><strong>普通蛋任务优先：</strong>默认保留给神兽任务，只有确实必须立即推进时才考虑出售。</li>
          <li><strong>买卖存在损耗：</strong>买入 {{ formatNumber(settings.taskSettings.eggPriceWan) }} 万/个，紧急出售仅 {{ formatNumber(catalog.data.beastConfig.eggSellPriceWan) }} 万/个；卖后再买每个损失 {{ formatNumber(Math.max(0, settings.taskSettings.eggPriceWan - catalog.data.beastConfig.eggSellPriceWan)) }} 万。</li>
          <li><strong>银子方案保持克制：</strong>系统优先提示积攒银子，卖普通蛋只作为明确标注的紧急兜底。</li>
          <li><strong>库存日期和录入时间分开：</strong>补录周一库存时选择周一，系统另存实际录入时间。</li>
          <li><strong>净变化不是收入：</strong>它是两次完整库存之差，包含期间获得、消耗和买卖的最终结果。</li>
        </ul>
      </section>
    </div>
  </main>
</template>
