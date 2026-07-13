<script setup lang="ts">
import { ref } from "vue";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { usePublishStore } from "../../stores/publish";
import { useUiStore } from "../../stores/ui";
import { useAuthStore } from "../../stores/auth";

const catalog = useCatalogStore();
const inventory = useInventoryStore();
const publish = usePublishStore();
const ui = useUiStore();
const auth = useAuthStore();
const backupInput = ref<HTMLInputElement>();
const backupNotice = ref("");

function confirmAction(message: string, action: () => void) {
  if (confirm(message)) action();
}

function exportInventory() {
  const content = inventory.exportData();
  const url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `幻唐志-库存快照-${inventory.latestSnapshot?.effectiveDate || new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  backupNotice.value = `已导出 ${inventory.snapshots.length} 份库存快照`;
}

async function importInventory(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!confirm(`恢复备份会覆盖本机现有的 ${inventory.snapshots.length} 份库存快照，确认继续？`)) {
    input.value = "";
    return;
  }
  try {
    inventory.importData(await file.text());
    backupNotice.value = `已恢复 ${inventory.snapshots.length} 份库存快照`;
  } catch (error) {
    backupNotice.value = error instanceof Error ? `恢复失败：${error.message}` : "恢复失败：备份文件无效";
  } finally {
    input.value = "";
  }
}
</script>

<template>
  <div class="page-wrap settings-page">
    <nav class="subnav data-center-nav" aria-label="数据中心分区">
      <RouterLink to="/data/inventory">库存快照</RouterLink>
      <RouterLink to="/data/tasks">神兽任务</RouterLink>
      <RouterLink to="/data/market">宝石行情</RouterLink>
      <RouterLink to="/data/sources">数据来源</RouterLink>
      <RouterLink to="/settings">界面设置</RouterLink>
    </nav>
    <section class="page-intro"><div><h2>界面、草稿与本地备份</h2><p>系统只在当前浏览器保存数据；这里管理单号下钻偏好、发布草稿和库存快照备份。</p></div></section>
    <section class="settings-section">
      <div class="section-head"><div><h2>单号下钻与矩阵偏好</h2><p>行动推进台始终同时展示五个账号；最近账号只影响“单号下钻”的默认入口。</p></div></div>
      <div class="settings-grid ui-settings-grid">
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
    <section class="settings-section workspace-state-section">
      <div><h2>库存快照备份</h2><p>导出包含全部五账号库存快照和实际库存日期；恢复时会校验文件结构并覆盖本机快照。</p></div>
      <strong aria-live="polite">{{ backupNotice || `${inventory.snapshots.length} 份快照保存在本机` }}</strong>
      <div><button class="button" type="button" @click="exportInventory">导出 JSON</button><button class="button" type="button" @click="backupInput?.click()">恢复备份</button><input ref="backupInput" hidden type="file" accept="application/json,.json" @change="importInventory" /></div>
    </section>
    <section class="danger-zone"><div><h2>界面偏好</h2><p>恢复最近账号、矩阵密度和字段显示默认值，不影响数据中心。</p></div><button class="button" @click="confirmAction('确认恢复默认界面偏好？', ui.resetPreferences)">恢复界面默认值</button><button class="button" @click="auth.logout">退出登录</button></section>
  </div>
</template>
