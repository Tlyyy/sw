<script setup lang="ts">
import PlansNav from "../../../features/plans/PlansNav.vue";
import { usePlanParametersPage } from "../../../features/plans/usePlanParametersPage";

const page = usePlanParametersPage();
</script>

<template>
  <div class="page-wrap plan-page plan-parameters-page desktop-plan-parameters-page" data-platform-page="desktop">
    <PlansNav />
    <section class="page-intro"><div><p>PC 参数工作台</p><h2>计划参数</h2><span>集中维护排期起点、周期资源产出和任务成本。</span></div><RouterLink class="button primary" to="/plans/tasks">返回任务维护</RouterLink></section>
    <section class="settings-section planning-parameter-section">
      <div class="section-head"><div><h2>排期与资源规则</h2><p>输入时保留草稿，失焦或确认后参与主线日期、缺口和预算计算。</p></div><button class="button" type="button" @click="page.resetPlanningSettings">恢复默认参数</button></div>
      <div class="planning-parameter-grid">
        <label><span>最早起算日期</span><input v-model="page.startDate.value" type="date" @change="page.saveStartDate"></label>
        <label><span>每周专用蛋</span><input type="number" min="0" step="0.1" :value="page.draft.numeric.weeklyDedicatedEggs" @input="page.setNumericDraft('weeklyDedicatedEggs',$event)" @change="page.saveNumericSetting('weeklyDedicatedEggs')"></label>
        <label><span>每周普通蛋</span><input type="number" min="0" step="0.1" :value="page.draft.numeric.weeklyRegularEggs" @input="page.setNumericDraft('weeklyRegularEggs',$event)" @change="page.saveNumericSetting('weeklyRegularEggs')"></label>
        <label><span>每周银子收入 / 万</span><input type="number" min="0" step="0.1" :value="page.draft.numeric.weeklySilverWan" @input="page.setNumericDraft('weeklySilverWan',$event)" @change="page.saveNumericSetting('weeklySilverWan')"></label>
        <label><span>本周内丹碎片</span><input type="number" min="0" :value="page.draft.numeric.thisWeekInnerShards" @input="page.setNumericDraft('thisWeekInnerShards',$event)" @change="page.saveNumericSetting('thisWeekInnerShards')"></label>
        <label><span>每周内丹碎片</span><input type="number" min="0" :value="page.draft.numeric.weeklyInnerShards" @input="page.setNumericDraft('weeklyInnerShards',$event)" @change="page.saveNumericSetting('weeklyInnerShards')"></label>
        <label><span>普通蛋买入价 / 万</span><input type="number" min="0" step="0.1" :value="page.draft.numeric.eggPriceWan" @input="page.setNumericDraft('eggPriceWan',$event)" @change="page.saveNumericSetting('eggPriceWan')"></label>
        <label class="readonly"><span>普通蛋紧急回收价 / 万</span><input type="number" :value="page.eggSellPriceWan" readonly></label>
      </div>
      <p class="parameter-impact-note">排期按每个账号每周获得 {{ page.settings.taskSettings.weeklyDedicatedEggs }} 个专用蛋、{{ page.settings.taskSettings.weeklyRegularEggs }} 个普通蛋和 {{ page.settings.taskSettings.weeklySilverWan }} 万银子计算；当前卖后再买每个损失 {{ Number(page.eggRoundTripLossWan.value.toFixed(2)) }} 万，普通蛋仍默认保留给神兽任务。</p>
    </section>
    <section class="settings-section task-price-section">
      <div class="section-head"><div><h2>单项成本覆盖</h2><p>只修改预算金额，不改变任务完成状态和任务顺序。</p></div><div class="section-head-actions"><span>{{ page.priceOverrideCount.value }} 项本地覆盖</span><button class="button" type="button" @click="page.resetTaskPrices">恢复默认价格</button></div></div>
      <form class="task-filter-bar compact" aria-label="成本项目筛选" @submit.prevent><label class="task-search-field"><span>搜索项目</span><input v-model="page.query.value" type="search" aria-label="成本项目关键词筛选" placeholder="搜索账号、神兽或动作"></label><label><span>账号</span><select v-model="page.account.value" aria-label="成本项目账号筛选"><option value="ALL">全部账号</option><option v-for="item in page.catalog.data.accounts" :key="item.id" :value="item.id">{{ item.id }}</option></select></label><label><span>用途</span><select v-model="page.taskType.value" aria-label="成本项目用途筛选"><option value="ALL">全部用途</option><option v-for="item in page.availableTaskTypes.value" :key="item.key" :value="item.key">{{ item.label }}</option></select></label><button class="button" type="button" @click="page.clearPriceFilters">清除筛选</button></form>
      <div class="parameter-task-list" role="list" aria-label="任务成本项目"><article v-for="task in page.visiblePriceTasks.value" :key="task.id" role="listitem"><div><strong>{{ task.accountId }} · {{ task.typeLabel }}</strong><span>{{ task.actionLabel }} · {{ task.kind }}<template v-if="task.eggCount"> · {{ task.eggCount }} 个蛋</template></span></div><label><span>预算 / 万</span><input type="number" min="0" :value="page.taskPriceValue(task.id,task.priceWan)" :aria-label="`${task.accountId}${task.actionLabel}价格`" @input="page.setTaskPriceDraft(task.id,$event)" @change="page.saveTaskPrice(task.id,task.priceWan)"></label><span class="parameter-source" :class="{ overridden: page.settings.taskOverrides[task.id]?.priceWan !== undefined }">{{ page.settings.taskOverrides[task.id]?.priceWan !== undefined ? "本地覆盖" : "默认价格" }}</span><button v-if="page.settings.taskOverrides[task.id]?.priceWan !== undefined" class="text-button" type="button" :aria-label="`恢复${task.accountId}${task.actionLabel}默认价格`" @click="page.resetTaskPrice(task.id)">恢复</button><span v-else class="parameter-budget">{{ page.formatWan(task.priceWan) }}</span></article></div>
    </section>
  </div>
</template>

<style scoped>
.desktop-plan-parameters-page{padding-top:10px;padding-bottom:56px}.desktop-plan-parameters-page>.page-intro p{color:var(--color-accent-strong);font-size:11px;font-weight:850}.desktop-plan-parameters-page>.page-intro span{color:var(--color-text-muted);font-size:12px}
</style>
