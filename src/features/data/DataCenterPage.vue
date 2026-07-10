<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import GemMarketUploader from "./GemMarketUploader.vue";
import GemPriceTrendChart from "./GemPriceTrendChart.vue";
import { useCatalogStore } from "../../stores/catalog";
import { useSettingsStore } from "../../stores/settings";
import { buildTaskPlans } from "../../domain/plans";
import { formatWan, marketItems } from "../../domain/gems";
import { buildGemPriceTrend } from "../../domain/gemPriceHistory";

const route = useRoute();
const catalog = useCatalogStore();
const settings = useSettingsStore();
const account = ref("ALL");
const taskType = ref("ALL");

const section = computed(() => String(route.params.section || "market"));
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
const recordNotice = ref("");

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
      <RouterLink to="/data/market">宝石行情</RouterLink>
      <RouterLink to="/data/resources">账号资源</RouterLink>
      <RouterLink to="/data/tasks">神兽任务</RouterLink>
      <RouterLink to="/data/sources">数据来源</RouterLink>
      <RouterLink to="/settings">界面设置</RouterLink>
    </nav>

    <template v-if="section === 'market'">
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

    <template v-else-if="section === 'resources'">
      <section class="page-intro">
        <div><h2>账号资源与产出</h2><p>统一维护起算日期、每周产出以及五个账号的银币、神兽蛋和锁片库存。</p></div>
        <div><button class="button" @click="confirmReset('确认恢复默认排期参数？', settings.resetTaskSettings)">恢复排期参数</button><button class="button" @click="confirmReset('确认恢复五账号默认库存？', settings.resetResources)">恢复默认库存</button></div>
      </section>
      <section class="settings-band data-edit-band">
        <div class="section-head"><div><h2>排期参数</h2><p>修改后立即同步到神兽计划、联合时间轴和今日决策。</p></div></div>
        <label><span>起算日期</span><input type="date" :value="settings.taskSettings.startDate" @input="settings.setTaskSetting('startDate', ($event.target as HTMLInputElement).value)" /></label>
        <label><span>本周拿蛋</span><input type="number" :value="settings.taskSettings.thisWeekEggs" @input="settings.setTaskSetting('thisWeekEggs', Number(($event.target as HTMLInputElement).value))" /></label>
        <label><span>每周拿蛋</span><input type="number" :value="settings.taskSettings.weeklyEggs" @input="settings.setTaskSetting('weeklyEggs', Number(($event.target as HTMLInputElement).value))" /></label>
        <label><span>本周锁片</span><input type="number" :value="settings.taskSettings.thisWeekInnerShards" @input="settings.setTaskSetting('thisWeekInnerShards', Number(($event.target as HTMLInputElement).value))" /></label>
        <label><span>每周锁片</span><input type="number" :value="settings.taskSettings.weeklyInnerShards" @input="settings.setTaskSetting('weeklyInnerShards', Number(($event.target as HTMLInputElement).value))" /></label>
        <label><span>蛋价 / 万</span><input type="number" step="0.1" :value="settings.taskSettings.eggPriceWan" @input="settings.setTaskSetting('eggPriceWan', Number(($event.target as HTMLInputElement).value))" /></label>
      </section>
      <section class="resource-section">
        <div class="section-head"><div><h2>五账号当前库存</h2><p>这是神兽任务和总排期使用的唯一库存来源。</p></div></div>
        <div class="resource-table editable-resource-table">
          <div class="table-head"><span>账号</span><span>银子 / 万</span><span>神兽蛋</span><span>内丹锁片</span><span>预计完成</span></div>
          <div v-for="plan in taskPlans" :key="plan.accountId">
            <b>{{ plan.accountId }}</b>
            <input type="number" :value="plan.resource.silverWan" :aria-label="`${plan.accountId}银子`" @input="settings.setResource(plan.accountId, 'silverWan', Number(($event.target as HTMLInputElement).value))" />
            <input type="number" :value="plan.resource.eggCount" :aria-label="`${plan.accountId}神兽蛋`" @input="settings.setResource(plan.accountId, 'eggCount', Number(($event.target as HTMLInputElement).value))" />
            <input type="number" :value="plan.resource.innerShardCount" :aria-label="`${plan.accountId}内丹锁片`" @input="settings.setResource(plan.accountId, 'innerShardCount', Number(($event.target as HTMLInputElement).value))" />
            <strong>{{ plan.finishDate }}</strong>
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
      <section class="settings-section source-layers"><div class="section-head"><div><h2>资料分层</h2><p>证据、事实、覆盖值和计算结果各自只承担一种职责。</p></div></div><article><b>1</b><div><strong>原始截图</strong><p>只读证据，不直接参与页面状态写入。</p></div></article><article><b>2</b><div><strong>校验目录</strong><p>宠物、装备、技能、宝石规则和默认行情。</p></div></article><article><b>3</b><div><strong>本地覆盖</strong><p>宝石价格、账号资源、排期参数与任务状态。</p></div></article><article><b>4</b><div><strong>业务计算</strong><p>计划、时间轴、推荐和发布内容从前三层派生。</p></div></article></section>
      <section class="danger-zone"><div><h2>重置全部业务维护数据</h2><p>恢复宝石行情、清空行情历史、排期参数、账号库存和任务状态；宠物、装备、截图和界面偏好不会删除。</p></div><button class="button danger" @click="confirmReset('确认重置全部业务维护数据并清空行情历史？此操作不会删除原始资料。', settings.resetAllPlanningData)">重置业务数据</button></section>
    </template>
  </div>
</template>
