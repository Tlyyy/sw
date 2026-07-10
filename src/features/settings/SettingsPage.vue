<script setup lang="ts">
import { useCatalogStore } from "../../stores/catalog";
import { usePublishStore } from "../../stores/publish";
import { useUiStore } from "../../stores/ui";
import { useAuthStore } from "../../stores/auth";

const catalog = useCatalogStore();
const publish = usePublishStore();
const ui = useUiStore();
const auth = useAuthStore();

function confirmAction(message: string, action: () => void) {
  if (confirm(message)) action();
}
</script>

<template>
  <div class="page-wrap settings-page">
    <nav class="subnav data-center-nav" aria-label="数据中心分区">
      <RouterLink to="/data/market">宝石行情</RouterLink>
      <RouterLink to="/data/resources">账号资源</RouterLink>
      <RouterLink to="/data/tasks">神兽任务</RouterLink>
      <RouterLink to="/data/sources">数据来源</RouterLink>
      <RouterLink to="/settings">界面设置</RouterLink>
    </nav>
    <section class="page-intro"><div><h2>界面与工作偏好</h2><p>这里只调整显示方式和临时工作状态，不再维护任何业务数据。</p></div></section>
    <section class="settings-section">
      <div class="section-head"><div><h2>默认工作范围</h2><p>影响导航中的账号范围和账号页面默认选择。</p></div></div>
      <div class="settings-grid ui-settings-grid">
        <label><span>账号范围</span><select v-model="ui.accountScope" aria-label="默认账号范围"><option value="ALL">全部账号</option><option v-for="item in catalog.data.accounts" :key="item.id" :value="item.id">{{ item.id }}</option></select></label>
        <label><span>最近账号</span><select v-model="ui.recentAccount" aria-label="最近账号"><option v-for="item in catalog.data.accounts" :key="item.id" :value="item.id">{{ item.id }}</option></select></label>
        <label><span>矩阵密度</span><select v-model="ui.matrixDensity" aria-label="矩阵密度"><option value="compact">紧凑</option><option value="comfortable">舒展</option></select></label>
      </div>
    </section>
    <section class="settings-section">
      <div class="section-head"><div><h2>矩阵显示字段</h2><p>控制固定矩阵默认展示哪些信息。</p></div></div>
      <div class="preference-options"><label><input v-model="ui.matrixDisplay.stats" type="checkbox" />属性</label><label><input v-model="ui.matrixDisplay.aptitudes" type="checkbox" />资质</label><label><input v-model="ui.matrixDisplay.skills" type="checkbox" />技能</label></div>
    </section>
    <section class="settings-section workspace-state-section">
      <div><h2>临时工作状态</h2><p>发布素材选择属于工作草稿，不影响宠物和装备原始数据。</p></div>
      <strong>{{ publish.selectedIds.length }} 组宠物已加入发布清单</strong>
      <button class="button" @click="confirmAction('确认清空发布页已选宠物？', publish.clear)">清空发布选择</button>
    </section>
    <section class="danger-zone"><div><h2>界面偏好</h2><p>恢复账号范围、矩阵密度和字段显示默认值，不影响数据中心。</p></div><button class="button" @click="confirmAction('确认恢复默认界面偏好？', ui.resetPreferences)">恢复界面默认值</button><button class="button" @click="auth.logout">退出登录</button></section>
  </div>
</template>
