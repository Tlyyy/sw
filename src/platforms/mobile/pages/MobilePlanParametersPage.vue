<script setup lang="ts">
import PlansNav from "../../../features/plans/PlansNav.vue";
import { usePlanParametersPage } from "../../../features/plans/usePlanParametersPage";

const page = usePlanParametersPage();
</script>

<template>
  <div class="page-wrap plan-page plan-parameters-page mobile-plan-parameters-page" data-platform-page="mobile">
    <PlansNav />
    <header><small>规划工具</small><h1>计划参数</h1><p>修改后立即影响五个账号的排期与预算。</p></header>
    <section class="mobile-parameter-card">
      <div class="mobile-section-title"><div><h2>排期与资源</h2><p>输入草稿切端不丢失</p></div><button type="button" @click="page.resetPlanningSettings">恢复默认</button></div>
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
      <p class="parameter-impact-note">每号每周 {{ page.settings.taskSettings.weeklyDedicatedEggs }} 专用蛋、{{ page.settings.taskSettings.weeklyRegularEggs }} 普通蛋、{{ page.settings.taskSettings.weeklySilverWan }} 万银子；普通蛋仍优先留给任务。</p>
    </section>
    <section class="mobile-price-card">
      <div class="mobile-section-title"><div><h2>单项成本</h2><p>{{ page.priceOverrideCount.value }} 项本地覆盖</p></div><button type="button" @click="page.resetTaskPrices">恢复价格</button></div>
      <form class="task-filter-bar compact" aria-label="成本项目筛选" @submit.prevent><label class="task-search-field"><span>搜索项目</span><input v-model="page.query.value" type="search" aria-label="成本项目关键词筛选" placeholder="搜索账号、神兽或动作"></label><label><span>账号</span><select v-model="page.account.value" aria-label="成本项目账号筛选"><option value="ALL">全部账号</option><option v-for="item in page.catalog.data.accounts" :key="item.id" :value="item.id">{{ item.id }}</option></select></label><label><span>用途</span><select v-model="page.taskType.value" aria-label="成本项目用途筛选"><option value="ALL">全部用途</option><option v-for="item in page.availableTaskTypes.value" :key="item.key" :value="item.key">{{ item.label }}</option></select></label><button type="button" @click="page.clearPriceFilters">清除</button></form>
      <div class="parameter-task-list" role="list" aria-label="任务成本项目"><article v-for="task in page.visiblePriceTasks.value" :key="task.id" role="listitem"><div><strong>{{ task.accountId }} · {{ task.typeLabel }}</strong><span>{{ task.actionLabel }} · {{ task.kind }}</span></div><label><span>预算 / 万</span><input type="number" min="0" :value="page.taskPriceValue(task.id,task.priceWan)" :aria-label="`${task.accountId}${task.actionLabel}价格`" @input="page.setTaskPriceDraft(task.id,$event)" @change="page.saveTaskPrice(task.id,task.priceWan)"></label><button v-if="page.settings.taskOverrides[task.id]?.priceWan !== undefined" type="button" :aria-label="`恢复${task.accountId}${task.actionLabel}默认价格`" @click="page.resetTaskPrice(task.id)">恢复</button><span v-else>{{ page.formatWan(task.priceWan) }}</span></article></div>
    </section>
  </div>
</template>

<style scoped>
.mobile-plan-parameters-page{width:100%;padding:6px 12px 112px}.mobile-plan-parameters-page>header{padding:12px 2px}.mobile-plan-parameters-page>header small{color:#c44d00;font-size:11px;font-weight:800}.mobile-plan-parameters-page>header h1{font-size:24px}.mobile-plan-parameters-page>header p,.mobile-section-title p{color:#697386;font-size:11px}.mobile-parameter-card,.mobile-price-card{overflow:hidden;margin-bottom:10px;border:1px solid rgba(60,60,67,.15);border-radius:12px;background:white}.mobile-section-title{min-height:62px;display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid rgba(60,60,67,.1)}.mobile-section-title h2{font-size:16px}.mobile-section-title button{min-height:40px;border:0;color:#c44d00;background:transparent}.mobile-plan-parameters-page .planning-parameter-grid{grid-template-columns:1fr 1fr;padding:10px}.mobile-plan-parameters-page .planning-parameter-grid label:first-child{grid-column:1/-1}.mobile-plan-parameters-page .planning-parameter-grid input{min-height:44px}.mobile-plan-parameters-page .parameter-impact-note{margin:0;padding:10px 12px;border-top:1px solid rgba(60,60,67,.1);font-size:11px}.mobile-price-card .task-filter-bar{grid-template-columns:1fr 1fr;padding:10px}.mobile-price-card .task-search-field{grid-column:1/-1}.mobile-price-card .task-filter-bar button{min-height:44px}.mobile-price-card .parameter-task-list article{grid-template-columns:minmax(0,1fr) 112px auto}.mobile-price-card .parameter-task-list input{min-height:42px}
</style>
