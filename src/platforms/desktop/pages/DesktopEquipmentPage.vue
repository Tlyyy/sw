<script setup lang="ts">
import AssetNav from "../../../features/assets/AssetNav.vue";
import { useEquipmentPage } from "../../../features/assets/useEquipmentPage";

const page = useEquipmentPage();
</script>

<template>
  <div class="page-wrap assets-page desktop-equipment-page" data-platform-page="desktop">
    <AssetNav />
    <section class="page-intro"><div><p>PC 装备台账</p><h2>装备资产</h2><span>五账号 {{ page.catalog.data.equipment.length }} 件装备，横向核对属性、宝石与证据。</span></div><RouterLink class="button primary" to="/plans/gems">进入宝石计划</RouterLink></section>
    <div class="filter-bar"><input v-model="page.query.value" type="search" placeholder="搜索装备、部位、属性或宝石"><select v-model="page.account.value"><option value="ALL">全部账号</option><option v-for="item in page.catalog.data.accounts" :key="item.id">{{ item.id }}</option></select><span>{{ page.visible.value.length }} / {{ page.catalog.data.equipment.length }}</span></div>
    <div class="equipment-table">
      <div class="table-head"><span>账号 / 部位</span><span>装备</span><span>属性与特效</span><span>宝石进度</span><span>到 13 段</span><span>证据</span></div>
      <article v-for="item in page.visible.value" :key="item.id">
        <div data-label="账号 / 部位" role="group" :aria-label="`账号和部位：${item.accountId}，${item.slot}`"><b>{{ item.accountId }}</b><span>{{ item.slot }}</span></div>
        <div data-label="装备" role="group" :aria-label="`装备：${item.name}`"><strong>{{ item.name }}</strong><span>{{ item.type }} · 耐久 {{ item.durability }}</span></div>
        <div data-label="属性与特效" role="group" aria-label="属性与特效"><span>{{ [...item.attributes,...item.effects].join(" · ") }}</span></div>
        <div data-label="宝石进度" role="group" :aria-label="`宝石进度：${item.gem.name} ${item.gem.level}`"><strong>{{ item.gem.name }} {{ item.gem.level }}</strong><span>{{ item.gem.effect }}</span></div>
        <div data-label="到 13 段" role="group" aria-label="到 13 段"><strong>{{ page.targetCost(item) }}银币</strong><span>还差 {{ page.targetGap(item) }} 颗</span></div>
        <a data-label="证据" :aria-label="`证据：打开${item.name}截图`" :href="page.source(item.evidenceId)" target="_blank">打开截图</a>
      </article>
    </div>
  </div>
</template>

<style scoped>
.desktop-equipment-page{padding-top:10px;padding-bottom:56px}.desktop-equipment-page>.page-intro>div>p{color:var(--color-accent-strong);font-size:11px;font-weight:850}.desktop-equipment-page>.page-intro>div>span{color:var(--color-text-muted);font-size:12px}
</style>
