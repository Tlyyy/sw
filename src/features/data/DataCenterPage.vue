<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import InventorySnapshotDialog from "../../components/InventorySnapshotDialog.vue";
import GemMarketUploader from "./GemMarketUploader.vue";
import GemPriceTrendChart from "./GemPriceTrendChart.vue";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";
import { buildTaskPlans } from "../../domain/plans";
import { formatWan, marketItems } from "../../domain/gems";
import { buildGemPriceTrend } from "../../domain/gemPriceHistory";
import type { AccountId, InventoryBalance, InventorySnapshotInput } from "../../domain/types";

const route = useRoute();
const catalog = useCatalogStore();
const inventory = useInventoryStore();
const settings = useSettingsStore();
const account = ref("ALL");
const taskType = ref("ALL");
const inventoryDialogOpen = ref(false);
const inventoryNotice = ref("");
const inventoryAccountOrder: AccountId[] = ["FC", "LG1", "LG2", "PT", "MYT"];

inventory.hydrate();

const section = computed(() => String(route.params.section || "inventory"));
const isInventorySection = computed(() => section.value === "inventory" || section.value === "resources");
const market = computed(() => marketItems(catalog.data, settings.gemPriceOverrides));
const taskPlans = computed(() => buildTaskPlans(catalog.data, catalog.pets, settings.snapshot()));
const tasks = computed(() => taskPlans.value.flatMap((plan) => plan.tasks).filter((task) =>
  (account.value === "ALL" || task.accountId === account.value)
  && (taskType.value === "ALL" || task.typeKey === taskType.value),
));
const pendingTasks = computed(() => tasks.value.filter((task) => !task.done));
const baseMarketSnapshot = computed(() => catalog.data.gemMarketSnapshots.at(-1)!);
const marketNames = computed(() => baseMarketSnapshot.value.items.map((item) => item.name));
const priceTrend = computed(() => buildGemPriceTrend(baseMarketSnapshot.value, settings.gemPriceHistory));
const latestInventoryRows = computed(() => inventoryAccountOrder.map((accountId) => {
  const balance = inventory.latestSnapshot?.accounts[accountId] || emptyBalance();
  return {
    accountId,
    balance,
    delta: inventory.latestDeltas?.[accountId] || null,
  };
}));
const latestInventoryIntervalDays = computed(() => inventory.latestDeltas?.FC.intervalDays || 0);
const inventoryHistory = computed(() => [...inventory.snapshots].reverse());
const recordNotice = ref("");

function emptyBalance(): InventoryBalance {
  return { dedicatedEggs: 0, regularEggs: 0, silverWan: 0 };
}

function todayDate() {
  return new Date().toLocaleDateString("en-CA");
}

function signedValue(value: number, unit = "") {
  if (value === 0) return `0${unit}`;
  return `${value > 0 ? "+" : ""}${Number.isInteger(value) ? value : value.toFixed(2)}${unit}`;
}

function deltaTone(value: number) {
  return value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
}

function saveInventorySnapshot(draft: InventorySnapshotInput) {
  const updating = inventory.snapshots.some((item) => item.effectiveDate === draft.effectiveDate);
  inventory.saveSnapshot(draft);
  inventoryDialogOpen.value = false;
  inventoryNotice.value = `${updating ? "已更新" : "已保存"} ${draft.effectiveDate} 的五号库存快照`;
}

function removeInventorySnapshot(effectiveDate: string) {
  confirmReset(`确认删除 ${effectiveDate} 的五号库存快照？`, () => {
    inventory.removeSnapshot(effectiveDate);
    inventoryNotice.value = `已删除 ${effectiveDate} 的库存快照`;
  });
}

function resetAllBusinessData() {
  settings.resetAllPlanningData();
  inventory.clear();
  inventoryNotice.value = "业务维护数据已恢复为初始状态";
}

function applyRecognizedPrices(prices: Array<{ name: string; price: number }>) {
  prices.forEach((item) => settings.setGemPrice(item.name, item.price));
  settings.recordGemPrices("screenshot", prices);
  recordNotice.value = "截图价格已应用并记入行情历史";
}

function recordCurrentPrices() {
  settings.recordGemPrices("manual", market.value.map(({ name, price }) => ({ name, price })));
  recordNotice.value = "当前六项价格已记录";
}

function formatHistoryTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function confirmReset(message: string, action: () => void) {
  if (confirm(message)) action();
}
</script>

<template>
  <div class="page-wrap data-center-page">
    <nav class="subnav data-center-nav" aria-label="数据中心分区">
      <RouterLink to="/data/inventory">库存快照</RouterLink>
      <RouterLink to="/data/tasks">神兽任务</RouterLink>
      <RouterLink to="/data/market">宝石行情</RouterLink>
      <RouterLink to="/data/sources">数据来源</RouterLink>
      <RouterLink to="/settings">界面设置</RouterLink>
    </nav>

    <InventorySnapshotDialog
      :open="inventoryDialogOpen"
      :initial-date="todayDate()"
      :snapshots="inventory.snapshots"
      @close="inventoryDialogOpen = false"
      @save="saveInventorySnapshot"
    />

    <template v-if="isInventorySection">
      <section class="page-intro ledger-page-head">
        <div>
          <h2>五号库存台账</h2>
          <p>不用先选账号。每次在同一张表录入五个号的实际库存，系统按库存所属日期计算净变化。</p>
        </div>
        <button class="button primary" type="button" @click="inventoryDialogOpen = true">录入五号快照</button>
      </section>
      <p v-if="inventoryNotice" class="action-notice" role="status" aria-live="polite">{{ inventoryNotice }}</p>

      <section v-if="inventory.latestSnapshot" class="settings-section latest-inventory-ledger">
        <div class="section-head">
          <div>
            <h2>最近完整快照 · {{ inventory.latestSnapshot.effectiveDate }}</h2>
            <p>实际录入于 {{ formatHistoryTime(inventory.latestSnapshot.recordedAt) }} · 五号均已记录</p>
          </div>
          <span>五号已齐</span>
        </div>
        <div class="inventory-overview-grid" role="list" aria-label="五账号最新库存及净变化">
          <article v-for="row in latestInventoryRows" :key="row.accountId" class="inventory-account-cell" role="listitem">
            <header>
              <strong :class="`account-pill account-${row.accountId.toLowerCase()}`">{{ row.accountId }}</strong>
              <small>{{ row.delta ? `较前次 · ${row.delta.intervalDays}天` : "首份基线" }}</small>
            </header>
            <div class="inventory-values">
              <span><small>专用蛋</small><strong>{{ row.balance.dedicatedEggs }}</strong></span>
              <span><small>普通蛋</small><strong>{{ row.balance.regularEggs }}</strong></span>
              <span><small>银子 / 万</small><strong>{{ row.balance.silverWan.toLocaleString() }}</strong></span>
            </div>
            <div v-if="row.delta" class="inventory-delta delta-trio" aria-label="相对前次净变化">
              <span><small>专</small><b :class="deltaTone(row.delta.dedicatedEggs)">{{ signedValue(row.delta.dedicatedEggs) }}</b></span>
              <span><small>普</small><b :class="deltaTone(row.delta.regularEggs)">{{ signedValue(row.delta.regularEggs) }}</b></span>
              <span><small>银</small><b :class="deltaTone(row.delta.silverWan)">{{ signedValue(row.delta.silverWan, '万') }}</b></span>
            </div>
            <div v-else class="inventory-delta">等待下一份快照计算变化</div>
          </article>
        </div>
        <p class="trend-empty-note">净变化表示{{ latestInventoryIntervalDays ? `相隔 ${latestInventoryIntervalDays} 天的` : "两次" }}库存差额，包含期间获得、消耗和买卖后的最终结果。</p>
      </section>

      <section v-else class="empty-state inventory-empty-state">
        <div>
          <h2>先记录五个号现在有多少</h2>
          <p>第一份快照只建立基线，不计算进账。第二次录入后才会显示与前次相比的变化。</p>
        </div>
        <button class="button primary" type="button" @click="inventoryDialogOpen = true">建立库存基线</button>
      </section>

      <section class="settings-section inventory-history-section">
        <div class="section-head">
          <div><h2>历史批次</h2><p>按库存所属日期倒序排列；补录过去日期后会自动插入正确位置。</p></div>
          <span>{{ inventory.snapshots.length }} 批</span>
        </div>
        <div v-if="inventoryHistory.length" class="snapshot-history-table" role="table" aria-label="库存快照历史批次">
          <div class="snapshot-history-head" role="row">
            <span role="columnheader">库存日期</span>
            <span role="columnheader">实际录入</span>
            <span v-for="accountId in inventoryAccountOrder" :key="accountId" role="columnheader">{{ accountId }}</span>
            <span role="columnheader">操作</span>
          </div>
          <div v-for="snapshot in inventoryHistory" :key="snapshot.effectiveDate" class="snapshot-history-row" role="row">
            <strong role="cell">{{ snapshot.effectiveDate }}</strong>
            <span role="cell">{{ formatHistoryTime(snapshot.recordedAt) }}</span>
            <span v-for="accountId in inventoryAccountOrder" :key="accountId" role="cell">
              专{{ snapshot.accounts[accountId].dedicatedEggs }} · 普{{ snapshot.accounts[accountId].regularEggs }} · 银{{ snapshot.accounts[accountId].silverWan.toLocaleString() }}万
            </span>
            <span role="cell"><button class="text-button danger-text" type="button" :aria-label="`删除${snapshot.effectiveDate}库存快照`" @click="removeInventorySnapshot(snapshot.effectiveDate)">删除</button></span>
          </div>
        </div>
        <p v-else class="empty-state">尚无历史快照。</p>
      </section>

      <section class="settings-section secondary-settings-panel">
        <div class="section-head">
          <div><h2>神兽计划辅助参数</h2><p>蛋价、起算日期与锁片参数不属于库存收入，放在次要区域维护。</p></div>
          <span>次要设置</span>
        </div>
        <div class="settings-band data-edit-band compact-settings-band">
          <label><span>起算日期</span><input type="date" :value="settings.taskSettings.startDate" @input="settings.setTaskSetting('startDate', ($event.target as HTMLInputElement).value)" /></label>
          <label><span>本周锁片</span><input type="number" min="0" :value="settings.taskSettings.thisWeekInnerShards" @input="settings.setTaskSetting('thisWeekInnerShards', Number(($event.target as HTMLInputElement).value))" /></label>
          <label><span>每周锁片</span><input type="number" min="0" :value="settings.taskSettings.weeklyInnerShards" @input="settings.setTaskSetting('weeklyInnerShards', Number(($event.target as HTMLInputElement).value))" /></label>
          <label><span>普通蛋价 / 万</span><input type="number" min="0" step="0.1" :value="settings.taskSettings.eggPriceWan" @input="settings.setTaskSetting('eggPriceWan', Number(($event.target as HTMLInputElement).value))" /></label>
          <button class="button secondary" type="button" @click="confirmReset('确认恢复默认神兽计划辅助参数？', settings.resetTaskSettings)">恢复默认参数</button>
        </div>
      </section>
    </template>

    <template v-else-if="section === 'market'">
      <section class="page-intro">
        <div><h2>宝石行情维护</h2><p>上传、识别、校正和手动改价只在这里进行，计划页面只读取结果。</p></div>
        <button class="button" @click="confirmReset('确认恢复六项宝石的截图基准价？', settings.resetGemPrices)">恢复截图价</button>
      </section>
      <GemMarketUploader :items="market" @apply="applyRecognizedPrices" />
      <section class="data-maintenance-section">
        <div class="section-head"><div><h2>当前生效价格</h2><p>{{ catalog.data.gemMarketSnapshots.at(-1)?.sourceDate }} · 银币/颗</p></div><div class="market-record-actions"><span v-if="recordNotice" aria-live="polite">{{ recordNotice }}</span><strong>{{ market.filter((item) => item.edited).length }} 项覆盖</strong><button class="button" type="button" @click="recordCurrentPrices">记录当前价格</button></div></div>
        <div class="data-maintenance-table market-maintenance">
          <div class="table-head"><span>宝石</span><span>截图基准</span><span>当前价格</span><span>状态</span></div>
          <label v-for="item in market" :key="item.name">
            <strong>{{ item.name }}</strong>
            <span>{{ item.basePrice }}</span>
            <input type="number" :value="item.price" :aria-label="`${item.name}当前价格`" @input="settings.setGemPrice(item.name, Number(($event.target as HTMLInputElement).value))" />
            <em :class="{ edited: item.edited }">{{ item.edited ? "已覆盖" : "截图价" }}</em>
          </label>
        </div>
      </section>
      <section class="gem-trend-section">
        <div class="section-head">
          <div><h2>宝石价格趋势</h2><p>每次确认截图会自动记录；手动修改后可主动记录一条快照。</p></div>
          <strong>{{ settings.gemPriceHistory.length }} 条历史记录</strong>
        </div>
        <GemPriceTrendChart :points="priceTrend" :names="marketNames" />
        <p v-if="priceTrend.length === 1" class="trend-empty-note">记录第二次行情后，这里会形成可比较的价格曲线。</p>
        <div class="gem-history-table" aria-label="宝石行情历史记录">
          <div class="table-head"><span>记录时间</span><span>来源</span><span v-for="name in marketNames" :key="name">{{ name }}</span><span>操作</span></div>
          <div v-for="point in [...priceTrend].reverse()" :key="point.id" class="gem-history-row">
            <strong>{{ point.source === "baseline" ? baseMarketSnapshot.sourceDate : formatHistoryTime(point.capturedAt) }}</strong>
            <em :class="`source-${point.source}`">{{ point.source === "baseline" ? "截图基准" : point.source === "screenshot" ? "截图识别" : "手动记录" }}</em>
            <span v-for="name in marketNames" :key="name">{{ point.items.find((item) => item.name === name)?.price ?? "—" }}</span>
            <button v-if="point.source !== 'baseline'" type="button" class="text-button danger-text" :aria-label="`删除${formatHistoryTime(point.capturedAt)}行情记录`" @click="settings.removeGemPriceHistory(point.id)">删除</button>
            <span v-else>—</span>
          </div>
        </div>
      </section>
    </template>

    <template v-else-if="section === 'tasks'">
      <section class="page-intro">
        <div><h2>神兽任务维护</h2><p>任务完成状态和单项价格统一在这里修改，神兽计划页面只负责查看排期。</p></div>
        <button class="button" @click="confirmReset('确认清除全部任务完成状态和价格覆盖？', settings.resetTaskOverrides)">恢复任务状态</button>
      </section>
      <section class="task-maintenance-summary">
        <div><strong>{{ pendingTasks.length }}</strong><span>当前筛选未完成</span></div>
        <div><strong>{{ tasks.length }}</strong><span>当前筛选任务</span></div>
        <div><strong>{{ Object.keys(settings.taskOverrides).length }}</strong><span>本地任务修改</span></div>
        <div class="inline-filters"><select v-model="account"><option value="ALL">全部账号</option><option v-for="item in catalog.data.accounts" :key="item.id">{{ item.id }}</option></select><select v-model="taskType"><option value="ALL">全部类型</option><option value="snake1">1蛇</option><option value="snake2">2蛇</option><option value="horse">马</option></select></div>
      </section>
      <div class="task-list data-task-list">
        <label v-for="task in tasks" :key="task.id" :class="{ done: task.done }">
          <input type="checkbox" :checked="task.done" :aria-label="`${task.accountId}${task.typeLabel}${task.actionLabel}完成状态`" @change="settings.setTaskDone(task.id, ($event.target as HTMLInputElement).checked)" />
          <span><b>{{ task.accountId }} · {{ task.typeLabel }}</b><em>{{ task.actionLabel }} · {{ task.kind }}</em></span>
          <input v-if="task.resourceType === 'wan'" type="number" :value="task.priceWan" :aria-label="`${task.accountId}${task.actionLabel}价格`" @change="settings.setTaskPrice(task.id, Number(($event.target as HTMLInputElement).value))" />
          <span v-else>锁片任务</span>
          <strong>{{ task.done ? "已完成" : task.resourceType === "innerShard" ? `${task.shardCount}片` : formatWan(task.priceWan) }}</strong>
          <small>{{ task.dueDate }}</small>
        </label>
      </div>
    </template>

    <template v-else>
      <section class="page-intro"><div><h2>数据来源与状态</h2><p>静态事实保持只读；这里只管理来源说明、覆盖状态和业务数据重置。</p></div><RouterLink class="button" to="/assets/evidence">查看全部截图证据</RouterLink></section>
      <section class="settings-section">
        <div class="section-head"><div><h2>数据基线</h2><p>目录经过 Schema 校验，业务页面不能直接修改。</p></div><span>v{{ catalog.data.version }}</span></div>
        <div class="data-ledger"><div><strong>{{ catalog.data.accounts.length }}</strong><span>账号</span></div><div><strong>{{ catalog.pets.length }}</strong><span>宠物资产</span></div><div><strong>{{ catalog.data.evidence.filter((item) => item.kind === 'pet').length }}</strong><span>宠物截图</span></div><div><strong>{{ catalog.data.equipment.length }}</strong><span>装备</span></div><div><strong>{{ catalog.data.skills.length }}</strong><span>技能</span></div><div><strong>{{ catalog.data.evidence.length }}</strong><span>全部证据</span></div></div>
      </section>
      <section class="settings-section source-layers"><div class="section-head"><div><h2>资料分层</h2><p>证据、事实、维护记录和计算结果各自只承担一种职责。</p></div></div><article><b>1</b><div><strong>原始截图</strong><p>只读证据，不直接参与页面状态写入。</p></div></article><article><b>2</b><div><strong>校验目录</strong><p>宠物、装备、技能、宝石规则和默认行情。</p></div></article><article><b>3</b><div><strong>本地记录</strong><p>五号库存快照、宝石价格、辅助参数与任务状态。</p></div></article><article><b>4</b><div><strong>业务计算</strong><p>神兽缺口、库存变化、计划、推荐和发布内容从前三层派生。</p></div></article></section>
      <section class="danger-zone"><div><h2>重置全部业务维护数据</h2><p>删除库存快照，恢复宝石行情、辅助参数和任务状态；宠物、装备、截图和界面偏好不会删除。</p></div><button class="button danger" @click="confirmReset('确认重置全部业务维护数据并删除库存快照？此操作不会删除原始资料。', resetAllBusinessData)">重置业务数据</button></section>
    </template>
  </div>
</template>
