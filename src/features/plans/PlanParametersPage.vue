<script setup lang="ts">
import { computed, ref } from "vue";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";
import { buildTaskPlans, taskDisplayTypeOptions } from "../../domain/plans";
import { formatWan } from "../../domain/gems";
import PlansNav from "./PlansNav.vue";

const catalog = useCatalogStore();
const inventory = useInventoryStore();
const settings = useSettingsStore();
const account = ref("ALL");
const taskType = ref("ALL");
const query = ref("");
const eggSellPriceWan = catalog.data.beastConfig.eggSellPriceWan;

inventory.hydrate();

const taskPlans = computed(() => buildTaskPlans(
  catalog.data,
  catalog.pets,
  settings.snapshot(inventory.planningResources, inventory.latestSnapshot?.effectiveDate || null),
));
const allTasks = computed(() => taskPlans.value.flatMap((plan) => plan.tasks));
const priceTasks = computed(() => allTasks.value.filter((task) => task.resourceType === "wan"));
const availableTaskTypes = computed(() => taskDisplayTypeOptions.filter((item) => priceTasks.value.some((task) => task.displayTypeKey === item.key)));
const visiblePriceTasks = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  return priceTasks.value.filter((task) =>
    (account.value === "ALL" || task.accountId === account.value)
    && (taskType.value === "ALL" || task.displayTypeKey === taskType.value)
    && (!keyword || [task.accountId, task.typeLabel, task.actionLabel, task.kind].join(" ").toLowerCase().includes(keyword)),
  );
});
const priceOverrideCount = computed(() => Object.values(settings.taskOverrides).filter((item) => item.priceWan !== undefined).length);
const eggRoundTripLossWan = computed(() => Math.max(0, settings.taskSettings.eggPriceWan - eggSellPriceWan));

function setNumericSetting(field: "thisWeekEggs" | "weeklyEggs" | "thisWeekInnerShards" | "weeklyInnerShards" | "eggPriceWan", event: Event) {
  settings.setTaskSetting(field, Number((event.target as HTMLInputElement).value));
}

function clearPriceFilters() {
  account.value = "ALL";
  taskType.value = "ALL";
  query.value = "";
}

function resetPlanningSettings() {
  if (confirm("确认恢复默认排期与资源参数？任务完成状态和单项价格不会改变。")) settings.resetTaskSettings();
}

function resetTaskPrices() {
  if (confirm("确认清除全部单项价格覆盖？任务完成状态和排期参数不会改变。")) settings.resetTaskPriceOverrides();
}
</script>

<template>
  <div class="page-wrap plan-page plan-parameters-page">
    <PlansNav />
    <section class="page-intro">
      <div>
        <h2>计划参数</h2>
        <p>集中维护排期起点、周期资源产出和任务成本。修改会立即参与主线日期、资源缺口和预算计算。</p>
      </div>
      <RouterLink class="button primary" to="/plans/tasks">返回任务维护</RouterLink>
    </section>

    <section class="settings-section planning-parameter-section">
      <div class="section-head">
        <div><h2>排期与资源规则</h2><p>排期从最早起算日、今天和最近库存日期中的较晚日期继续。</p></div>
        <button class="button" type="button" @click="resetPlanningSettings">恢复默认参数</button>
      </div>
      <div class="planning-parameter-grid">
        <label><span>最早起算日期</span><input type="date" :value="settings.taskSettings.startDate" @change="settings.setTaskSetting('startDate', ($event.target as HTMLInputElement).value)" /></label>
        <label><span>本周可得蛋</span><input type="number" min="0" step="0.1" :value="settings.taskSettings.thisWeekEggs" @change="setNumericSetting('thisWeekEggs', $event)" /></label>
        <label><span>每周可得蛋</span><input type="number" min="0" step="0.1" :value="settings.taskSettings.weeklyEggs" @change="setNumericSetting('weeklyEggs', $event)" /></label>
        <label><span>本周内丹碎片</span><input type="number" min="0" :value="settings.taskSettings.thisWeekInnerShards" @change="setNumericSetting('thisWeekInnerShards', $event)" /></label>
        <label><span>每周内丹碎片</span><input type="number" min="0" :value="settings.taskSettings.weeklyInnerShards" @change="setNumericSetting('weeklyInnerShards', $event)" /></label>
        <label><span>普通蛋买入价 / 万</span><input type="number" min="0" step="0.1" :value="settings.taskSettings.eggPriceWan" @change="setNumericSetting('eggPriceWan', $event)" /></label>
        <label class="readonly"><span>普通蛋紧急回收价 / 万</span><input type="number" :value="eggSellPriceWan" readonly /></label>
      </div>
      <p class="parameter-impact-note">当前卖后再买每个损失 {{ Number(eggRoundTripLossWan.toFixed(2)) }} 万；普通蛋仍默认保留给神兽任务。</p>
    </section>

    <section class="settings-section task-price-section">
      <div class="section-head">
        <div><h2>单项成本覆盖</h2><p>只修改预算金额，不改变任务完成状态和任务顺序。</p></div>
        <div class="section-head-actions"><span>{{ priceOverrideCount }} 项本地覆盖</span><button class="button" type="button" @click="resetTaskPrices">恢复默认价格</button></div>
      </div>
      <form class="task-filter-bar compact" aria-label="成本项目筛选" @submit.prevent>
        <label class="task-search-field"><span>搜索项目</span><input v-model="query" type="search" aria-label="成本项目关键词筛选" placeholder="搜索账号、神兽或动作" /></label>
        <label><span>账号</span><select v-model="account" aria-label="成本项目账号筛选"><option value="ALL">全部账号</option><option v-for="item in catalog.data.accounts" :key="item.id" :value="item.id">{{ item.id }}</option></select></label>
        <label><span>用途</span><select v-model="taskType" aria-label="成本项目用途筛选"><option value="ALL">全部用途</option><option v-for="item in availableTaskTypes" :key="item.key" :value="item.key">{{ item.label }}</option></select></label>
        <button class="button" type="button" @click="clearPriceFilters">清除筛选</button>
      </form>
      <div class="parameter-task-list" role="list" aria-label="任务成本项目">
        <article v-for="task in visiblePriceTasks" :key="task.id" role="listitem">
          <div><strong>{{ task.accountId }} · {{ task.typeLabel }}</strong><span>{{ task.actionLabel }} · {{ task.kind }}<template v-if="task.eggCount"> · {{ task.eggCount }} 个蛋</template></span></div>
          <label><span>预算 / 万</span><input type="number" min="0" :value="task.priceWan" :aria-label="`${task.accountId}${task.actionLabel}价格`" @change="settings.setTaskPrice(task.id, Number(($event.target as HTMLInputElement).value))" /></label>
          <span class="parameter-source" :class="{ overridden: settings.taskOverrides[task.id]?.priceWan !== undefined }">{{ settings.taskOverrides[task.id]?.priceWan !== undefined ? "本地覆盖" : "默认价格" }}</span>
          <button v-if="settings.taskOverrides[task.id]?.priceWan !== undefined" class="text-button" type="button" :aria-label="`恢复${task.accountId}${task.actionLabel}默认价格`" @click="settings.resetTaskPrice(task.id)">恢复</button>
          <span v-else class="parameter-budget">{{ formatWan(task.priceWan) }}</span>
        </article>
      </div>
    </section>
  </div>
</template>
