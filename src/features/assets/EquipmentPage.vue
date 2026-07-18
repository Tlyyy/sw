<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCatalogStore } from "../../stores/catalog";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";
import { itemTargetCost, itemTargetGap, formatCurrency } from "../../domain/gems";
import { publicAsset } from "../../utils/publicAsset";
import { queryChoice, queryText } from "../../app/queryState";
import { accountIds, type AccountScope } from "../../domain/types";

const catalog = useCatalogStore(); const settings = useSettingsStore(); const ui = useUiStore(); const route = useRoute(); const router = useRouter();
const accountChoices = ["ALL", ...accountIds] as const;
const account = ref<AccountScope>(queryChoice(route.query.account, accountChoices, ui.accountScope)); const query = ref(queryText(route.query.q));
const visible = computed(() => catalog.data.equipment.filter((item) => (account.value === "ALL" || item.accountId === account.value) && (!query.value || [item.accountId,item.slot,item.name,item.type,item.gem.name,item.gem.level,...item.attributes,...item.effects].join(" ").toLowerCase().includes(query.value.toLowerCase()))));
watch([account,query],()=>router.replace({query:{...(account.value!=="ALL"?{account:account.value}:{}),...(query.value?{q:query.value}:{})}}));
watch(() => route.query, (value) => {
  account.value = queryChoice(value.account, accountChoices, ui.accountScope);
  query.value = queryText(value.q);
}, { deep: true });
watch(() => ui.accountScope, (scope) => { account.value = scope; });
const source = (id:string) => { const evidence=catalog.evidenceById.get(id); return evidence ? publicAsset(evidence.sourcePath) : ""; };
</script>
<template>
  <div class="page-wrap assets-page">
    <nav class="subnav"><RouterLink to="/assets/pets">宠物</RouterLink><RouterLink to="/assets/equipment">装备</RouterLink><RouterLink to="/assets/skills">技能</RouterLink><RouterLink to="/assets/evidence">截图证据</RouterLink></nav>
    <section class="page-intro"><div><h2>装备资产</h2><p>五账号 {{ catalog.data.equipment.length }} 件装备，用同一口径查看属性、宝石投入和 13 段缺口。</p></div><RouterLink class="button primary" to="/plans/upgrades">进入升级计划</RouterLink></section>
    <div class="filter-bar"><input v-model="query" type="search" placeholder="搜索装备、部位、属性或宝石"/><select v-model="account"><option value="ALL">全部账号</option><option v-for="item in catalog.data.accounts" :key="item.id">{{item.id}}</option></select><span>{{visible.length}} / {{ catalog.data.equipment.length }}</span></div>
    <div class="equipment-table">
      <div class="table-head"><span>账号 / 部位</span><span>装备</span><span>属性与特效</span><span>宝石进度</span><span>到 13 段</span><span>证据</span></div>
      <article v-for="item in visible" :key="item.id">
        <div data-label="账号 / 部位" role="group" :aria-label="`账号和部位：${item.accountId}，${item.slot}`"><b>{{item.accountId}}</b><span>{{item.slot}}</span></div>
        <div data-label="装备" role="group" :aria-label="`装备：${item.name}`"><strong>{{item.name}}</strong><span>{{item.type}} · 耐久 {{item.durability}}</span></div>
        <div data-label="属性与特效" role="group" aria-label="属性与特效"><span>{{[...item.attributes,...item.effects].join(' · ')}}</span></div>
        <div data-label="宝石进度" role="group" :aria-label="`宝石进度：${item.gem.name} ${item.gem.level}`"><strong>{{item.gem.name}} {{item.gem.level}}</strong><span>{{item.gem.effect}}</span></div>
        <div data-label="到 13 段" role="group" aria-label="到 13 段"><strong>{{formatCurrency(itemTargetCost(catalog.data,item,settings.gemPriceOverrides))}}银币</strong><span>还差 {{itemTargetGap(catalog.data,item).toLocaleString('zh-CN')}} 颗</span></div>
        <a data-label="证据" :aria-label="`证据：打开${item.name}截图`" :href="source(item.evidenceId)" target="_blank">打开截图</a>
      </article>
    </div>
  </div>
</template>
