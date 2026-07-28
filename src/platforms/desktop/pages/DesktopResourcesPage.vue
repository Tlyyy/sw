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
  <div class="page-wrap desktop-resources-page" data-platform-page="desktop" data-testid="resources-page">
    <header class="desktop-resources-head">
      <div>
        <p>PC 资料工作区</p>
        <h1>账号与资料</h1>
        <span>按账号、资产、分析和数据来源集中进入完整资料。</span>
      </div>
      <RouterLink class="button primary" to="/data/inventory">打开库存资料</RouterLink>
    </header>

    <section class="desktop-account-strip" aria-labelledby="desktop-resource-accounts">
      <header><div><p>账号入口</p><h2 id="desktop-resource-accounts">五个账号</h2></div><span>最近查看：{{ ui.recentAccount }}</span></header>
      <div>
        <RouterLink
          v-for="account in catalog.data.accounts"
          :key="account.id"
          :to="`/accounts/${account.id}`"
          :class="{ current: ui.recentAccount === account.id }"
          @click="selectAccount(account.id)"
        >
          <strong>{{ account.id }}</strong>
          <span>{{ account.label === account.id ? "账号详情" : account.label }}</span>
          <AppIcon name="chevron-right" />
        </RouterLink>
      </div>
    </section>

    <main class="desktop-resource-workspace">
      <section class="desktop-resource-panel asset-panel" aria-labelledby="desktop-assets-title">
        <header><div><p>核心资料</p><h2 id="desktop-assets-title">资产资料</h2></div><span>{{ assetLinks.length }} 个入口</span></header>
        <div class="desktop-resource-cards">
          <RouterLink v-for="item in assetLinks" :key="item.to" :to="item.to">
            <span class="desktop-resource-icon"><AppIcon :name="item.icon" /></span>
            <div><strong>{{ item.title }}</strong><small>{{ item.copy }}</small></div>
            <AppIcon name="chevron-right" />
          </RouterLink>
        </div>
      </section>

      <section class="desktop-resource-panel tools-panel" aria-labelledby="desktop-tools-title">
        <header><div><p>决策工具</p><h2 id="desktop-tools-title">分析与计划</h2></div><span>{{ analysisLinks.length + planningLinks.length }} 个入口</span></header>
        <div class="desktop-tool-columns">
          <div>
            <h3>分析</h3>
            <RouterLink v-for="item in analysisLinks" :key="item.to" :to="item.to"><span><strong>{{ item.title }}</strong><small>{{ item.copy }}</small></span><AppIcon name="chevron-right" /></RouterLink>
          </div>
          <div>
            <h3>计划</h3>
            <RouterLink v-for="item in planningLinks" :key="item.to" :to="item.to"><span><strong>{{ item.title }}</strong><small>{{ item.copy }}</small></span><AppIcon name="chevron-right" /></RouterLink>
          </div>
        </div>
      </section>

      <section class="desktop-resource-panel data-panel" aria-labelledby="desktop-data-title">
        <header><div><p>数据依据</p><h2 id="desktop-data-title">库存、行情与来源</h2></div></header>
        <div class="desktop-row-links">
          <RouterLink v-for="item in dataLinks" :key="item.to" :to="item.to">
            <span class="desktop-resource-icon"><AppIcon :name="item.icon" /></span>
            <span><strong>{{ item.title }}</strong><small>{{ item.copy }}</small></span>
            <AppIcon name="chevron-right" />
          </RouterLink>
        </div>
      </section>

      <section class="desktop-resource-panel manage-panel" aria-labelledby="desktop-manage-title">
        <header><div><p>系统工具</p><h2 id="desktop-manage-title">发布与设置</h2></div></header>
        <div class="desktop-row-links">
          <RouterLink v-for="item in managementLinks" :key="item.to" :to="item.to">
            <span class="desktop-resource-icon"><AppIcon :name="item.icon" /></span>
            <span><strong>{{ item.title }}</strong><small>{{ item.copy }}</small></span>
            <AppIcon name="chevron-right" />
          </RouterLink>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.desktop-resources-page { width:min(100%,1320px); padding-top:14px; padding-bottom:56px; }
.desktop-resources-head { min-height:76px; display:flex; align-items:center; justify-content:space-between; gap:24px; padding:0 4px 14px; border-bottom:1px solid var(--color-border); }
.desktop-resources-head p,.desktop-resource-panel header p,.desktop-account-strip header p { color:var(--color-accent-strong); font-size:11px; font-weight:850; letter-spacing:.09em; }
.desktop-resources-head h1 { margin-top:1px; font-size:28px; }
.desktop-resources-head span { display:block; margin-top:4px; color:var(--color-text-muted); font-size:12px; }
.desktop-account-strip,.desktop-resource-panel { overflow:hidden; border:1px solid var(--color-border); border-radius:14px; background:var(--color-surface); box-shadow:0 7px 20px rgba(17,24,39,.05); }
.desktop-account-strip { margin:16px 0; }
.desktop-account-strip > header,.desktop-resource-panel > header { min-height:58px; display:flex; align-items:center; justify-content:space-between; gap:14px; padding:10px 15px; border-bottom:1px solid var(--color-border); background:var(--color-surface-subtle); }
.desktop-account-strip h2,.desktop-resource-panel h2 { margin-top:1px; font-size:18px; }
.desktop-account-strip header > span,.desktop-resource-panel header > span { color:var(--color-text-muted); font-size:11px; }
.desktop-account-strip > div { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); }
.desktop-account-strip a { min-width:0; min-height:78px; display:grid; grid-template-columns:minmax(0,1fr) auto; align-content:center; gap:2px 8px; padding:11px 15px; border-right:1px solid var(--color-border); color:var(--color-text); text-decoration:none; }
.desktop-account-strip a:last-child { border-right:0; }
.desktop-account-strip a.current { color:var(--color-accent-strong); background:var(--color-accent-soft); box-shadow:inset 0 -3px var(--color-accent); }
.desktop-account-strip a strong { font-size:18px; }
.desktop-account-strip a span { overflow:hidden; color:var(--color-text-muted); font-size:11px; text-overflow:ellipsis; white-space:nowrap; }
.desktop-account-strip a :deep(svg) { grid-column:2; grid-row:1/3; align-self:center; width:17px; color:var(--color-text-muted); }
.desktop-resource-workspace { display:grid; grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr); gap:14px; }
.asset-panel,.tools-panel { grid-column:span 1; }
.data-panel { grid-column:1; }
.manage-panel { grid-column:2; }
.desktop-resource-cards { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); }
.desktop-resource-cards a { min-width:0; min-height:106px; display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:11px; padding:14px; border-right:1px solid var(--color-border); border-bottom:1px solid var(--color-border); color:var(--color-text); text-decoration:none; }
.desktop-resource-cards a:nth-child(2n) { border-right:0; }
.desktop-resource-cards a:nth-last-child(-n+2) { border-bottom:0; }
.desktop-resource-icon { width:42px; height:42px; display:grid; place-items:center; border-radius:11px; color:var(--color-accent-strong); background:var(--color-accent-soft); }
.desktop-resource-icon :deep(svg) { width:20px; height:20px; }
.desktop-resource-cards div,.desktop-row-links a > span:nth-child(2),.desktop-tool-columns a > span { min-width:0; display:grid; gap:3px; }
.desktop-resource-cards strong,.desktop-row-links strong,.desktop-tool-columns strong { font-size:14px; }
.desktop-resource-cards small,.desktop-row-links small,.desktop-tool-columns small { color:var(--color-text-muted); font-size:11px; line-height:1.35; }
.desktop-resource-cards a > :deep(svg:last-child),.desktop-row-links a > :deep(svg:last-child),.desktop-tool-columns a > :deep(svg:last-child) { width:16px; color:var(--color-text-muted); }
.desktop-tool-columns { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); }
.desktop-tool-columns > div + div { border-left:1px solid var(--color-border); }
.desktop-tool-columns h3 { padding:10px 14px; border-bottom:1px solid var(--color-border); color:var(--color-text-muted); background:var(--color-surface-subtle); font-size:12px; }
.desktop-tool-columns a { min-height:60px; display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:8px; padding:9px 14px; border-bottom:1px solid var(--color-border); color:var(--color-text); text-decoration:none; }
.desktop-tool-columns a:last-child { border-bottom:0; }
.desktop-row-links { display:grid; }
.desktop-row-links a { min-height:72px; display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:10px; padding:10px 14px; border-bottom:1px solid var(--color-border); color:var(--color-text); text-decoration:none; }
.desktop-row-links a:last-child { border-bottom:0; }
@media (max-width:1100px) {
  .desktop-resource-workspace { grid-template-columns:1fr; }
  .asset-panel,.tools-panel,.data-panel,.manage-panel { grid-column:1; }
}
</style>
