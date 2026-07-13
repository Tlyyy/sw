<script setup lang="ts">
import { computed, ref, watch } from "vue";
import StatStrip from "../../components/StatStrip.vue";
import { useCatalogStore } from "../../stores/catalog";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";
import { accountGemPlan, formatCurrency, itemTargetCost, itemTargetGap, marketItems } from "../../domain/gems";
import type { AccountId } from "../../domain/types";

const catalog = useCatalogStore();
const settings = useSettingsStore();
const ui = useUiStore();
const selected = ref<AccountId>(ui.recentAccount);

watch(selected, (accountId) => { ui.recentAccount = accountId; });

const gemPlan = computed(() => accountGemPlan(catalog.data, selected.value, settings.gemPriceOverrides));
const allGemPlans = computed(() => catalog.data.accounts.map((item) => ({ accountId: item.id, ...accountGemPlan(catalog.data, item.id, settings.gemPriceOverrides) })));
const totalGap = computed(() => allGemPlans.value.reduce((sum, plan) => sum + plan.gap, 0));
const totalCost = computed(() => allGemPlans.value.reduce((sum, plan) => sum + plan.cost, 0));
const market = computed(() => marketItems(catalog.data, settings.gemPriceOverrides));
</script>

<template>
  <div class="page-wrap plan-page">
    <nav class="subnav"><RouterLink to="/plans/beasts">神兽主线</RouterLink><RouterLink to="/plans/timeline">五号概览</RouterLink><RouterLink to="/plans/upgrades">宝石参考</RouterLink></nav>
    <section class="page-intro">
      <div><h2>宝石升级参考</h2><p>神兽主线完成前暂不把宝石纳入行动优先级；现有装备、行情和 13 段测算仍完整保留。</p></div>
      <RouterLink class="button primary" to="/data/market">维护宝石行情</RouterLink>
    </section>
    <StatStrip :items="[{ value: '主线后', label: '当前优先级', note: '暂不进入行动推进台' }, { value: `${catalog.data.equipment.length}`, label: '装备', note: '五号装备总数' }, { value: totalGap.toLocaleString('zh-CN'), label: '宝石颗数缺口', note: `按当前行情约 ${formatCurrency(totalCost)}` }, { value: `${market.filter((item) => item.edited).length}`, label: '行情覆盖', note: '来自数据中心' }]" />
    <section class="market-band readonly-market-band">
      <div class="section-head"><div><h2>当前生效行情</h2><p>{{ catalog.data.gemMarketSnapshots.at(-1)?.sourceDate }} · 银币/颗 · 只读</p></div><RouterLink to="/data/market">前往维护 →</RouterLink></div>
      <article v-for="item in market" :key="item.name"><span>{{ item.name }}</span><strong>{{ item.price }}</strong><em>{{ item.edited ? "本地覆盖" : "截图基准" }}</em></article>
    </section>
    <section class="plan-detail">
      <div class="section-head"><div><h2>{{ selected }} 单号宝石明细</h2><p>共缺 {{ gemPlan.gap.toLocaleString('zh-CN') }} 颗，按当前行情约 {{ formatCurrency(gemPlan.cost) }} 银币；仅作主线后的备查计划。</p></div><div class="segmented"><button v-for="item in catalog.data.accounts" :key="item.id" :class="{ active: selected === item.id }" @click="selected = item.id">{{ item.id }}</button></div></div>
      <div class="equipment-plan-list"><article v-for="item in gemPlan.items" :key="item.id"><div><span>{{ item.slot }}</span><strong>{{ item.name }}</strong><em>{{ item.gem.name }} {{ item.gem.level }}</em></div><div><span>还差</span><b>{{ itemTargetGap(catalog.data, item).toLocaleString("zh-CN") }} 颗</b></div><div><span>预计成本</span><b>{{ formatCurrency(itemTargetCost(catalog.data, item, settings.gemPriceOverrides)) }}银币</b></div></article></div>
    </section>
  </div>
</template>
