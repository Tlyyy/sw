<script setup lang="ts">
import AssetNav from "../../../features/assets/AssetNav.vue";
import { useEquipmentPage } from "../../../features/assets/useEquipmentPage";

const page = useEquipmentPage();
</script>

<template>
  <div class="page-wrap assets-page mobile-equipment-page" data-platform-page="mobile">
    <AssetNav />
    <header class="mobile-asset-head"><div><small>资产库</small><h1>装备资产</h1></div><RouterLink to="/plans/gems">宝石计划</RouterLink></header>
    <div class="mobile-equipment-filter"><input v-model="page.query.value" type="search" placeholder="搜索装备、部位、属性或宝石"><select v-model="page.account.value" aria-label="装备账号"><option value="ALL">全部账号</option><option v-for="item in page.catalog.data.accounts" :key="item.id">{{ item.id }}</option></select><span>{{ page.visible.value.length }} / {{ page.catalog.data.equipment.length }} 件</span></div>
    <section class="mobile-equipment-list" aria-label="装备列表">
      <article v-for="item in page.visible.value" :key="item.id">
        <header><div><b>{{ item.accountId }}</b><span>{{ item.slot }}</span></div><a :aria-label="`证据：打开${item.name}截图`" :href="page.source(item.evidenceId)" target="_blank">截图</a></header>
        <h2>{{ item.name }}</h2><p>{{ item.type }} · 耐久 {{ item.durability }}</p>
        <dl><div><dt>属性与特效</dt><dd>{{ [...item.attributes,...item.effects].join(" · ") }}</dd></div><div><dt>宝石</dt><dd>{{ item.gem.name }} {{ item.gem.level }} · {{ item.gem.effect }}</dd></div><div><dt>到 13 段</dt><dd>{{ page.targetCost(item) }} 银币 · 还差 {{ page.targetGap(item) }} 颗</dd></div></dl>
      </article>
    </section>
  </div>
</template>

<style scoped>
.mobile-equipment-page{width:100%;padding:6px 12px 112px}.mobile-asset-head{display:flex;align-items:end;justify-content:space-between;padding:12px 2px}.mobile-asset-head small{color:#c44d00;font-size:11px;font-weight:800}.mobile-asset-head h1{font-size:24px}.mobile-asset-head>a{min-height:42px;display:grid;place-items:center;padding:0 12px;border:1px solid rgba(60,60,67,.15);border-radius:10px;color:#c44d00;font-size:12px;font-weight:750;text-decoration:none;background:white}.mobile-equipment-filter{display:grid;grid-template-columns:1fr 112px;gap:7px;margin-bottom:10px;padding:10px;border:1px solid rgba(60,60,67,.15);border-radius:12px;background:white}.mobile-equipment-filter input,.mobile-equipment-filter select{min-width:0;min-height:44px}.mobile-equipment-filter span{grid-column:1/-1;color:#697386;font-size:11px;text-align:right}.mobile-equipment-list{display:grid;gap:9px}.mobile-equipment-list>article{padding:12px;border:1px solid rgba(60,60,67,.15);border-radius:12px;background:white}.mobile-equipment-list header{display:flex;justify-content:space-between}.mobile-equipment-list header div{display:flex;gap:7px;align-items:center}.mobile-equipment-list header b{padding:3px 6px;border-radius:5px;color:#185a91;background:#edf6ff}.mobile-equipment-list header span,.mobile-equipment-list header a{color:#697386;font-size:11px}.mobile-equipment-list h2{margin-top:8px;font-size:17px}.mobile-equipment-list>article>p{color:#697386;font-size:11px}.mobile-equipment-list dl{display:grid;gap:7px;margin-top:10px}.mobile-equipment-list dl div{padding:8px;border-radius:8px;background:#f6f7f9}.mobile-equipment-list dt{color:#8b95a5;font-size:11px}.mobile-equipment-list dd{margin-top:3px;font-size:12px}
</style>
