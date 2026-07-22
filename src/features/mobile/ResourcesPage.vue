<script setup lang="ts">
import AppIcon from "../../components/AppIcon.vue";
import { useCatalogStore } from "../../stores/catalog";

const catalog = useCatalogStore();

const assetLinks = [
  { to: "/assets/pets", title: "宠物资产", copy: "宠物、资质、技能和定位", icon: "account" },
  { to: "/assets/equipment", title: "装备资产", copy: "装备归属与属性资料", icon: "assets" },
  { to: "/assets/skills", title: "技能资料", copy: "技能说明与检索", icon: "publish" },
  { to: "/assets/evidence", title: "截图证据", copy: "原始图片与记录依据", icon: "report" },
] as const;

const analysisLinks = [
  { to: "/analysis/recommendations", title: "推荐分析", copy: "优先级和养成建议" },
  { to: "/analysis/species", title: "同名对比", copy: "同类宠物横向比较" },
  { to: "/analysis/matrix", title: "固定矩阵", copy: "五账号完整对照表" },
] as const;

const planningLinks = [
  { to: "/plans/beasts", title: "神兽主线", copy: "当前阶段与资源缺口" },
  { to: "/plans/timeline", title: "五号概览", copy: "五账号推进时间线" },
  { to: "/plans/gems", title: "宝石计划", copy: "目标段位与周投入" },
  { to: "/plans/parameters", title: "计划参数", copy: "任务价格与计划口径" },
] as const;
</script>

<template>
  <div class="page-wrap mobile-purpose-page resources-page" data-testid="resources-page">
    <header class="resources-intro">
      <p>资料</p>
      <h1>这里只看信息</h1>
      <span>账号、资产、分析和计划资料集中在一起；要新增数据，请去“录入”。</span>
    </header>

    <section class="resource-group accounts-resource-group" aria-labelledby="resource-accounts-title">
      <header><div><p>账号</p><h2 id="resource-accounts-title">五个账号</h2></div><span>查看单号资产、任务与资源</span></header>
      <div class="resource-account-grid">
        <RouterLink v-for="account in catalog.data.accounts" :key="account.id" :to="`/accounts/${account.id}`">
          <strong>{{ account.id }}</strong><span>{{ account.label }}</span><AppIcon name="chevron-right" />
        </RouterLink>
      </div>
    </section>

    <section class="resource-group" aria-labelledby="resource-assets-title">
      <header><div><p>信息</p><h2 id="resource-assets-title">资产资料</h2></div><span>查宠物、装备与原始依据</span></header>
      <div class="resource-link-grid">
        <RouterLink v-for="item in assetLinks" :key="item.to" :to="item.to">
          <span class="resource-link-icon"><AppIcon :name="item.icon" /></span>
          <div><strong>{{ item.title }}</strong><small>{{ item.copy }}</small></div>
          <AppIcon name="chevron-right" />
        </RouterLink>
      </div>
    </section>

    <section class="resource-group" aria-labelledby="resource-analysis-title">
      <header><div><p>判断</p><h2 id="resource-analysis-title">分析与计划</h2></div><span>把资料转成下一步行动</span></header>
      <div class="resource-tool-columns">
        <div>
          <h3>分析工具</h3>
          <RouterLink v-for="item in analysisLinks" :key="item.to" :to="item.to"><span><strong>{{ item.title }}</strong><small>{{ item.copy }}</small></span><AppIcon name="chevron-right" /></RouterLink>
        </div>
        <div>
          <h3>计划工具</h3>
          <RouterLink v-for="item in planningLinks" :key="item.to" :to="item.to"><span><strong>{{ item.title }}</strong><small>{{ item.copy }}</small></span><AppIcon name="chevron-right" /></RouterLink>
        </div>
      </div>
    </section>

    <section class="resource-group resource-source-links" aria-labelledby="resource-source-title">
      <header><div><p>依据</p><h2 id="resource-source-title">数据与来源</h2></div><span>查看库存历史、行情趋势和数据出处</span></header>
      <div>
        <RouterLink to="/data/inventory"><AppIcon name="assets" /><span><strong>库存资料</strong><small>当前库存、周变化与历史记录</small></span><AppIcon name="chevron-right" /></RouterLink>
        <RouterLink to="/data/market"><AppIcon name="analysis" /><span><strong>行情记录与趋势</strong><small>查看价格变化；更新请从“录入”进入</small></span><AppIcon name="chevron-right" /></RouterLink>
        <RouterLink to="/data/sources"><AppIcon name="report" /><span><strong>数据来源</strong><small>静态资料和版本依据</small></span><AppIcon name="chevron-right" /></RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.resources-page { width: min(100%, 1180px); padding-top: 22px; padding-bottom: 48px; }
.resources-intro { display: grid; gap: 4px; margin-bottom: 14px; padding-bottom: 16px; border-bottom: 1px solid var(--radar-line); }
.resources-intro > p { color: var(--radar-cyan-strong); font-size: 12px; font-weight: 850; letter-spacing: .12em; }
.resources-intro h1 { font-size: 32px; line-height: 1.2; letter-spacing: -.04em; }
.resources-intro > span { color: var(--radar-muted); font-size: 14px; }

.resource-group { overflow: hidden; margin-top: 12px; border: 1px solid var(--radar-line); border-radius: 14px; background: #ffffff; box-shadow: 0 7px 20px rgba(17, 24, 39, .05); }
.resource-group > header { min-height: 70px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 12px 16px; border-bottom: 1px solid var(--radar-line); }
.resource-group > header p { color: var(--radar-cyan-strong); font-size: 11px; font-weight: 850; letter-spacing: .08em; }
.resource-group > header h2 { font-size: 19px; }
.resource-group > header > span { color: var(--radar-muted); font-size: 12px; }

.resource-account-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); }
.resource-account-grid > a { min-width: 0; min-height: 72px; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-content: center; gap: 1px 8px; padding: 11px 14px; border-right: 1px solid var(--radar-line); }
.resource-account-grid > a:last-child { border-right: 0; }
.resource-account-grid strong { font-size: 17px; }
.resource-account-grid span { overflow: hidden; color: var(--radar-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.resource-account-grid :deep(svg) { grid-column: 2; grid-row: 1 / 3; align-self: center; width: 17px; height: 17px; color: var(--radar-muted); }

.resource-link-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.resource-link-grid > a { min-width: 0; min-height: 96px; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 14px; border-right: 1px solid var(--radar-line); }
.resource-link-grid > a:last-child { border-right: 0; }
.resource-link-icon { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 10px; color: var(--radar-cyan-strong); background: var(--radar-cyan-soft); }
.resource-link-icon :deep(svg) { width: 19px; height: 19px; }
.resource-link-grid > a > :deep(svg) { width: 16px; height: 16px; color: var(--radar-muted); }
.resource-link-grid div, .resource-tool-columns a > span, .resource-source-links a > span { min-width: 0; display: grid; gap: 2px; }
.resource-link-grid strong, .resource-tool-columns strong, .resource-source-links strong { font-size: 14px; }
.resource-link-grid small, .resource-tool-columns small, .resource-source-links small { color: var(--radar-muted); font-size: 11px; line-height: 1.4; }

.resource-tool-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.resource-tool-columns > div + div { border-left: 1px solid var(--radar-line); }
.resource-tool-columns h3 { padding: 11px 15px; border-bottom: 1px solid var(--radar-line); color: var(--radar-muted); font-size: 12px; }
.resource-tool-columns a { min-height: 58px; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 9px 15px; border-bottom: 1px solid var(--radar-line); }
.resource-tool-columns a:last-child { border-bottom: 0; }
.resource-tool-columns a > :deep(svg) { width: 16px; height: 16px; color: var(--radar-muted); }

.resource-source-links > div { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.resource-source-links a { min-width: 0; min-height: 78px; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 12px 15px; border-right: 1px solid var(--radar-line); }
.resource-source-links a:last-child { border-right: 0; }
.resource-source-links a > :deep(svg) { width: 18px; height: 18px; color: var(--radar-cyan-strong); }
.resource-source-links a > :deep(svg:last-child) { width: 15px; height: 15px; color: var(--radar-muted); }

@media (max-width: 720px) {
  .resources-page { padding: 18px 10px 28px; }
  .resources-intro { padding-inline: 4px; }
  .resources-intro h1 { font-size: 30px; }
  .resource-group > header { align-items: flex-start; flex-direction: column; gap: 2px; min-height: 0; }
  .resource-account-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .resource-account-grid > a { min-height: 68px; display: grid; place-items: center; padding: 8px 3px; text-align: center; }
  .resource-account-grid :deep(svg), .resource-account-grid span { display: none; }
  .resource-link-grid { grid-template-columns: 1fr; }
  .resource-link-grid > a { min-height: 70px; border-right: 0; border-bottom: 1px solid var(--radar-line); }
  .resource-link-grid > a:last-child { border-bottom: 0; }
  .resource-tool-columns { grid-template-columns: 1fr; }
  .resource-tool-columns > div + div { border-top: 1px solid var(--radar-line); border-left: 0; }
  .resource-source-links > div { grid-template-columns: 1fr; }
  .resource-source-links a { min-height: 70px; border-right: 0; border-bottom: 1px solid var(--radar-line); }
  .resource-source-links a:last-child { border-bottom: 0; }
}
</style>
