<script setup lang="ts">
import DataCenterNav from "../../../features/data/DataCenterNav.vue";
import { useDataSourcesPage } from "../../../features/data/useDataSourcesPage";

const page = useDataSourcesPage();
</script>
<template>
  <div class="page-wrap data-center-page desktop-data-sources-page" data-platform-page="desktop">
    <DataCenterNav />
    <section class="page-intro"><div><h2>数据来源与状态</h2><p>静态事实保持只读；这里只管理来源说明、覆盖状态和业务数据重置。</p></div><RouterLink class="button" to="/assets/evidence">查看全部截图证据</RouterLink></section>
    <section class="settings-section"><div class="section-head"><div><h2>数据基线</h2><p>目录经过 Schema 校验，业务页面不能直接修改。</p></div><span>v{{ page.catalog.data.version }}</span></div><div class="data-ledger"><div><strong>{{ page.counts.value.accounts }}</strong><span>账号</span></div><div><strong>{{ page.counts.value.pets }}</strong><span>宠物资产</span></div><div><strong>{{ page.counts.value.petEvidence }}</strong><span>宠物截图</span></div><div><strong>{{ page.counts.value.equipment }}</strong><span>装备</span></div><div><strong>{{ page.counts.value.skills }}</strong><span>技能</span></div><div><strong>{{ page.counts.value.evidence }}</strong><span>全部证据</span></div></div></section>
    <section class="settings-section source-layers"><div class="section-head"><div><h2>资料分层</h2><p>证据、事实、维护记录和计算结果各自只承担一种职责。</p></div></div><article><b>1</b><div><strong>原始截图</strong><p>只读证据，不直接参与页面状态写入。</p></div></article><article><b>2</b><div><strong>校验目录</strong><p>宠物、装备、技能、宝石规则和默认行情。</p></div></article><article><b>3</b><div><strong>本地记录</strong><p>五号库存快照、任务完成日期、银子支出、宝石价格与辅助参数。</p></div></article><article><b>4</b><div><strong>业务计算</strong><p>神兽缺口、库存变化、每周收获、计划、推荐和发布内容从前三层派生。</p></div></article></section>
    <section class="danger-zone"><div><h2>重置全部业务维护数据</h2><p>删除库存快照、任务完成记录和银子支出，恢复宝石行情与辅助参数；宠物、装备、截图和界面偏好不会删除。</p></div><button class="button danger" type="button" @click="page.confirmReset">重置业务数据</button></section>
  </div>
</template>
<style scoped>.desktop-data-sources-page{padding-top:16px;padding-bottom:48px}</style>
