<script setup lang="ts">
import DataCenterNav from "../../../features/data/DataCenterNav.vue";
import { useDataSourcesPage } from "../../../features/data/useDataSourcesPage";

const page = useDataSourcesPage();
const layers = [
  ["1", "原始截图", "只读证据，不写入业务状态"],
  ["2", "校验目录", "宠物、装备、技能、规则和默认行情"],
  ["3", "本地记录", "库存、任务、支出、行情与参数"],
  ["4", "业务计算", "缺口、周报、计划、推荐和发布"],
];
</script>
<template>
  <div class="page-wrap mobile-data-sources-page" data-platform-page="mobile">
    <DataCenterNav />
    <header><small>只读基线</small><h1>数据来源</h1><p>看清数据从哪里来，以及哪些内容只保存在本机。</p></header>
    <section class="mobile-source-counts"><div><strong>{{ page.counts.value.accounts }}</strong><span>账号</span></div><div><strong>{{ page.counts.value.pets }}</strong><span>宠物</span></div><div><strong>{{ page.counts.value.equipment }}</strong><span>装备</span></div><div><strong>{{ page.counts.value.skills }}</strong><span>技能</span></div><div><strong>{{ page.counts.value.evidence }}</strong><span>证据</span></div></section>
    <section class="mobile-source-layers"><header><div><h2>资料分层</h2><p>Catalog v{{ page.catalog.data.version }}</p></div><RouterLink to="/assets/evidence">查看证据</RouterLink></header><article v-for="layer in layers" :key="layer[0]"><b>{{ layer[0] }}</b><div><strong>{{ layer[1] }}</strong><p>{{ layer[2] }}</p></div></article></section>
    <section class="mobile-danger-card"><div><h2>重置业务维护数据</h2><p>会删除库存、任务完成和支出记录，但不删除原始资料与界面偏好。</p></div><button type="button" @click="page.confirmReset">重置业务数据</button></section>
  </div>
</template>
<style scoped>
.mobile-data-sources-page{width:100%;padding:6px 12px 112px}.mobile-data-sources-page>header{padding:12px 2px}.mobile-data-sources-page>header small{color:#c44d00;font-size:11px;font-weight:850}.mobile-data-sources-page>header h1{font-size:25px}.mobile-data-sources-page>header p{color:#697386;font-size:12px}.mobile-source-counts{display:grid;grid-template-columns:repeat(5,1fr);margin-bottom:10px;border:1px solid rgba(60,60,67,.15);border-radius:12px;background:#fff}.mobile-source-counts div{display:grid;place-items:center;gap:3px;padding:11px 4px;border-right:1px solid rgba(60,60,67,.1)}.mobile-source-counts div:last-child{border:0}.mobile-source-counts strong{font-size:18px}.mobile-source-counts span{color:#697386;font-size:9px}.mobile-source-layers{overflow:hidden;border:1px solid rgba(60,60,67,.15);border-radius:12px;background:#fff}.mobile-source-layers>header{display:flex;align-items:center;justify-content:space-between;padding:11px 12px;background:#faf8f5}.mobile-source-layers h2{font-size:16px}.mobile-source-layers header p,.mobile-source-layers article p{color:#697386;font-size:10px}.mobile-source-layers header a{color:#a9430c;font-size:12px;font-weight:800}.mobile-source-layers article{display:grid;grid-template-columns:30px 1fr;align-items:center;gap:10px;padding:11px 12px;border-top:1px solid rgba(60,60,67,.1)}.mobile-source-layers article>b{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;color:#fff;background:#b54b12;font-size:12px}.mobile-source-layers article strong{font-size:13px}.mobile-danger-card{display:grid;gap:12px;margin-top:10px;padding:14px;border:1px solid #e2b8ae;border-radius:12px;background:#fff7f5}.mobile-danger-card h2{font-size:16px}.mobile-danger-card p{margin-top:4px;color:#7e5c55;font-size:11px}.mobile-danger-card button{min-height:44px;border:1px solid #c64b32;border-radius:9px;color:#a52f1c;background:#fff;font-weight:850}
.mobile-source-counts span,
.mobile-source-layers header p,
.mobile-source-layers article p { font-size: 11px; }
</style>
