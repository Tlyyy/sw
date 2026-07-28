<script setup lang="ts">
import AppIcon from "../../../components/AppIcon.vue";
import { useResourcesPage } from "../../../features/resources/useResourcesPage";

const {
  catalog,
  ui,
  assetLinks,
  analysisLinks,
  planningLinks,
  dataLinks,
  managementLinks,
  selectAccount,
} = useResourcesPage();
</script>

<template>
  <div class="page-wrap mobile-purpose-page resources-page" data-platform-page="mobile" data-testid="resources-page">
    <header class="resources-intro">
      <div><p>资料</p><h1>账号与资料</h1></div>
      <span>先找账号，再逐级查看资料</span>
    </header>

    <section class="resource-group accounts-resource-group" aria-labelledby="resource-accounts-title">
      <header><div><p>账号</p><h2 id="resource-accounts-title">五个账号</h2></div><span>查看单号资产、任务与资源</span></header>
      <div class="resource-account-grid">
        <RouterLink v-for="account in catalog.data.accounts" :key="account.id" :to="`/accounts/${account.id}`" :class="{ current: ui.recentAccount === account.id }" @click="selectAccount(account.id)">
          <strong>{{ account.id }}</strong>
        </RouterLink>
      </div>
    </section>

    <section class="resource-group" aria-labelledby="resource-assets-title">
      <header><div><p>信息</p><h2 id="resource-assets-title">资产资料</h2></div><span>查宠物、装备与原始依据</span></header>
      <div class="resource-list">
        <RouterLink v-for="item in assetLinks" :key="item.to" :to="item.to">
          <span class="resource-link-icon"><AppIcon :name="item.icon" /></span>
          <span><strong>{{ item.title }}</strong><small>{{ item.copy }}</small></span>
          <AppIcon name="chevron-right" />
        </RouterLink>
      </div>
    </section>

    <section class="resource-group" aria-labelledby="resource-analysis-title">
      <header><div><p>判断</p><h2 id="resource-analysis-title">分析与计划</h2></div><span>把资料转成下一步行动</span></header>
      <div class="resource-subgroup">
        <h3>分析工具</h3>
        <RouterLink v-for="item in analysisLinks" :key="item.to" :to="item.to"><span><strong>{{ item.title }}</strong><small>{{ item.copy }}</small></span><AppIcon name="chevron-right" /></RouterLink>
        <h3>计划工具</h3>
        <RouterLink v-for="item in planningLinks" :key="item.to" :to="item.to"><span><strong>{{ item.title }}</strong><small>{{ item.copy }}</small></span><AppIcon name="chevron-right" /></RouterLink>
      </div>
    </section>

    <section class="resource-group" aria-labelledby="resource-source-title">
      <header><div><p>依据</p><h2 id="resource-source-title">数据与来源</h2></div><span>库存、行情和版本出处</span></header>
      <div class="resource-list">
        <RouterLink v-for="item in dataLinks" :key="item.to" :to="item.to">
          <span class="resource-link-icon"><AppIcon :name="item.icon" /></span>
          <span><strong>{{ item.title }}</strong><small>{{ item.copy }}</small></span>
          <AppIcon name="chevron-right" />
        </RouterLink>
      </div>
    </section>

    <section class="resource-group" aria-labelledby="resource-management-title">
      <header><div><p>更多</p><h2 id="resource-management-title">发布与设置</h2></div><span>低频工具集中在这里</span></header>
      <div class="resource-list">
        <RouterLink v-for="item in managementLinks" :key="item.to" :to="item.to">
          <span class="resource-link-icon"><AppIcon :name="item.icon" /></span>
          <span><strong>{{ item.title }}</strong><small>{{ item.copy }}</small></span>
          <AppIcon name="chevron-right" />
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.resources-page { width:100%; padding:10px 10px 116px; }
.resources-intro { min-height:54px; display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; padding:0 4px 10px; border-bottom:1px solid var(--color-border); }
.resources-intro > div { display:flex; align-items:baseline; gap:8px; }
.resources-intro p,.resource-group > header p { color:var(--color-accent-strong); font-size:11px; font-weight:850; letter-spacing:.08em; }
.resources-intro h1 { font-size:24px; line-height:1.2; white-space:nowrap; }
.resources-intro > span { color:var(--color-text-muted); font-size:11px; font-weight:700; text-align:right; }
.resource-group { overflow:hidden; margin-top:12px; border:1px solid var(--color-border); border-radius:16px; background:var(--color-surface); box-shadow:0 7px 20px rgba(17,24,39,.05); }
.resource-group > header { display:grid; gap:2px; padding:12px 14px; border-bottom:1px solid var(--color-border); background:var(--color-surface-subtle); }
.resource-group > header h2 { margin-top:1px; font-size:18px; }
.resource-group > header > span { color:var(--color-text-muted); font-size:11px; }
.resource-account-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); }
.resource-account-grid > a { min-width:0; min-height:68px; display:grid; place-items:center; padding:8px 3px; border-right:1px solid var(--color-border); color:var(--color-text); text-decoration:none; }
.resource-account-grid > a:last-child { border-right:0; }
.resource-account-grid > a.current { color:var(--color-accent-strong); background:var(--color-accent-soft); box-shadow:inset 0 -3px var(--color-accent); }
.resource-account-grid strong { font-size:15px; }
.resource-list a,.resource-subgroup a { min-height:72px; display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:10px; padding:10px 14px; border-bottom:1px solid var(--color-border); color:var(--color-text); text-decoration:none; }
.resource-list a:last-child,.resource-subgroup a:last-child { border-bottom:0; }
.resource-list a > span:nth-child(2),.resource-subgroup a > span:first-child { min-width:0; display:grid; gap:3px; }
.resource-list strong,.resource-subgroup strong { font-size:15px; }
.resource-list small,.resource-subgroup small { color:var(--color-text-muted); font-size:12px; line-height:1.35; }
.resource-link-icon { width:40px; height:40px; display:grid; place-items:center; border-radius:11px; color:var(--color-accent-strong); background:var(--color-accent-soft); }
.resource-link-icon :deep(svg) { width:20px; height:20px; }
.resource-list a > :deep(svg:last-child),.resource-subgroup a > :deep(svg:last-child) { width:16px; height:16px; color:var(--color-text-muted); }
.resource-subgroup h3 { padding:10px 14px; border-bottom:1px solid var(--color-border); color:var(--color-text-muted); background:var(--color-surface-subtle); font-size:12px; }
.resource-subgroup h3:not(:first-child) { border-top:7px solid var(--color-background); }
</style>
