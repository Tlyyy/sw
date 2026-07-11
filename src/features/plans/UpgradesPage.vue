<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AccountTimeline from "../../components/AccountTimeline.vue";
import StatStrip from "../../components/StatStrip.vue";
import { useCatalogStore } from "../../stores/catalog";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";
import { buildAccountPlans } from "../../domain/plans";
import { accountGemPlan, formatCurrency, itemTargetCost, itemTargetGap, marketItems } from "../../domain/gems";
import type { AccountId } from "../../domain/types";

const catalog = useCatalogStore();
const settings = useSettingsStore();
const ui = useUiStore();
const selected = ref<AccountId>(ui.accountScope === "ALL" ? ui.recentAccount : ui.accountScope);

watch(() => ui.accountScope, (scope) => { if (scope !== "ALL") selected.value = scope; });

const plans = computed(() => buildAccountPlans(catalog.data, catalog.pets, settings.snapshot()));
const current = computed(() => plans.value.find((item) => item.accountId === selected.value)!);
const gemPlan = computed(() => accountGemPlan(catalog.data, selected.value, settings.gemPriceOverrides));
const market = computed(() => marketItems(catalog.data, settings.gemPriceOverrides));
</script>

<template>
  <div class="page-wrap plan-page">
    <nav class="subnav"><RouterLink to="/plans/upgrades">升级计划</RouterLink><RouterLink to="/plans/beasts">神兽计划</RouterLink><RouterLink to="/plans/timeline">联合时间轴</RouterLink></nav>
    <section class="page-intro">
      <div><h2>宝石升级计划</h2><p>本页只展示计算结果；行情上传和改价统一在数据中心维护。</p></div>
      <RouterLink class="button primary" to="/data/market">维护宝石行情</RouterLink>
    </section>
    <StatStrip :items="[{ value: plans[0]?.accountId, label: '瓶颈号', note: `还需 ${plans[0]?.finishWeek} 周` }, { value: '30', label: '装备', note: '每号 6 件' }, { value: formatCurrency(plans.reduce((sum, plan) => sum + plan.gemRequiredSilver, 0)), label: '宝石总缺口', note: '目标 13 段' }, { value: `${market.filter((item) => item.edited).length}`, label: '行情覆盖', note: '来自数据中心' }]" />
    <section class="timeline-section"><AccountTimeline :plans="plans" :selected="selected" :start-date="settings.taskSettings.startDate" /></section>
    <section class="market-band readonly-market-band">
      <div class="section-head"><div><h2>当前生效行情</h2><p>{{ catalog.data.gemMarketSnapshots.at(-1)?.sourceDate }} · 银币/颗 · 只读</p></div><RouterLink to="/data/market">前往维护 →</RouterLink></div>
      <article v-for="item in market" :key="item.name"><span>{{ item.name }}</span><strong>{{ item.price }}</strong><em>{{ item.edited ? "本地覆盖" : "截图基准" }}</em></article>
    </section>
    <section class="plan-detail">
      <div class="section-head"><div><h2>{{ selected }} 单号计划</h2><p>宝石 {{ formatCurrency(current.gemRequiredSilver) }} + 神兽 {{ formatCurrency(current.beastRequiredSilver) }}，预计还需 {{ current.finishWeek }} 周</p></div><div class="segmented"><button v-for="item in catalog.data.accounts" :key="item.id" :class="{ active: selected === item.id }" @click="selected = item.id">{{ item.id }}</button></div></div>
      <div class="equipment-plan-list"><article v-for="item in gemPlan.items" :key="item.id"><div><span>{{ item.slot }}</span><strong>{{ item.name }}</strong><em>{{ item.gem.name }} {{ item.gem.level }}</em></div><div><span>还差</span><b>{{ itemTargetGap(catalog.data, item).toLocaleString("zh-CN") }} 颗</b></div><div><span>预计成本</span><b>{{ formatCurrency(itemTargetCost(catalog.data, item, settings.gemPriceOverrides)) }}银币</b></div></article></div>
    </section>
  </div>
</template>
