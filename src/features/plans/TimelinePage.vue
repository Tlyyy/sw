<script setup lang="ts">
import { computed } from "vue";
import AccountTimeline from "../../components/AccountTimeline.vue";
import { useCatalogStore } from "../../stores/catalog";
import { useSettingsStore } from "../../stores/settings";
import { buildAccountPlans, buildTaskPlans } from "../../domain/plans";
import { formatCurrency } from "../../domain/gems";
const catalog=useCatalogStore();const settings=useSettingsStore();const plans=computed(()=>buildAccountPlans(catalog.data,catalog.pets,settings.snapshot()));const beast=computed(()=>buildTaskPlans(catalog.data,catalog.pets,settings.snapshot()));
</script>
<template><div class="page-wrap plan-page"><nav class="subnav"><RouterLink to="/plans/upgrades">升级计划</RouterLink><RouterLink to="/plans/beasts">神兽计划</RouterLink><RouterLink to="/plans/timeline">联合时间轴</RouterLink></nav><section class="page-intro"><div><h2>联合完成时间轴</h2><p>宝石资金决定剩余周数，神兽任务日期和锁片作为独立约束并列核对。</p></div></section><AccountTimeline :plans="plans" :start-date="settings.taskSettings.startDate"/><section class="timeline-ledger"><div class="table-head"><span>账号</span><span>宝石资金</span><span>神兽资金</span><span>锁片</span><span>神兽日期</span><span>预计还需</span></div><RouterLink v-for="plan in plans" :key="plan.accountId" :to="`/accounts/${plan.accountId}`"><b>{{plan.accountId}}</b><span>{{formatCurrency(plan.gemRequiredSilver)}}</span><span>{{formatCurrency(plan.beastRequiredSilver)}}</span><span>{{plan.missingShardCount||'-'}}</span><span>{{beast.find(i=>i.accountId===plan.accountId)?.finishDate}}</span><strong>{{plan.finishWeek}} 周</strong></RouterLink></section></div></template>
