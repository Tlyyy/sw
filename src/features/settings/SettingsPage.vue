<script setup lang="ts">
import { ref } from "vue";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";
import { usePublishStore } from "../../stores/publish";
import { useUiStore } from "../../stores/ui";
import { useAuthStore } from "../../stores/auth";
import { createWorkspaceBackup, parseWorkspaceBackup } from "../../persistence/state";
import DataCenterNav from "../data/DataCenterNav.vue";

const catalog = useCatalogStore();
const inventory = useInventoryStore();
const settings = useSettingsStore();
const publish = usePublishStore();
const ui = useUiStore();
const auth = useAuthStore();
const backupInput = ref<HTMLInputElement>();
const backupNotice = ref("");

function confirmAction(message: string, action: () => void) {
  if (confirm(message)) action();
}

function exportWorkspace() {
  const payload = createWorkspaceBackup({
    inventory: inventory.exportState(),
    settings: settings.exportState(),
    publish: publish.exportState(),
    ui: ui.exportState(),
  });
  const content = JSON.stringify(payload, null, 2);
  const url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `项目台账-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  backupNotice.value = `已导出完整备份（${inventory.snapshots.length} 份库存快照）`;
}

async function importWorkspace(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!confirm("恢复备份会覆盖本机库存、行情、任务、发布草稿和界面偏好，确认继续？")) {
    input.value = "";
    return;
  }
  try {
    const raw = JSON.parse(await file.text());
    if (raw?.format === "sw-workspace-backup") {
      const marketNames = catalog.data.gemMarketSnapshots.at(-1)?.items.map((item) => item.name) || [];
      const backup = parseWorkspaceBackup(raw, catalog.data.beastConfig.taskDefaultSettings, marketNames);
      // Every partition is parsed before any store is changed.
      const previous = {
        inventory: inventory.exportState(), settings: settings.exportState(),
        publish: publish.exportState(), ui: ui.exportState(),
      };
      try {
        inventory.replaceState(backup.inventory);
        settings.replaceState(backup.settings);
        publish.replaceState(backup.publish);
        ui.replaceState(backup.ui);
      } catch (cause) {
        // Replace operations receive already validated payloads. This rollback
        // protects against an unexpected runtime failure during application.
        try { inventory.replaceState(previous.inventory); } catch { /* best-effort rollback */ }
        try { settings.replaceState(previous.settings); } catch { /* best-effort rollback */ }
        try { publish.replaceState(previous.publish); } catch { /* best-effort rollback */ }
        try { ui.replaceState(previous.ui); } catch { /* best-effort rollback */ }
        throw cause;
      }
      backupNotice.value = `已恢复完整备份（${inventory.snapshots.length} 份库存快照）`;
    } else {
      // Continue accepting the older inventory-only export format.
      inventory.replaceState(raw);
      backupNotice.value = `已恢复旧版库存备份（${inventory.snapshots.length} 份快照）`;
    }
  } catch (error) {
    backupNotice.value = error instanceof Error ? `恢复失败：${error.message}` : "恢复失败：备份文件无效";
  } finally {
    input.value = "";
  }
}
</script>

<template>
  <div class="page-wrap settings-page">
    <DataCenterNav />
    <section class="page-intro"><div><h2>界面、草稿与本地备份</h2><p>系统只在当前浏览器保存数据；这里管理界面偏好、发布草稿和完整业务数据备份。</p></div></section>
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
      <div><h2>完整业务备份</h2><p>包含库存、行情与历史、神兽任务、发布草稿和界面偏好；不包含登录状态和静态基础资料。恢复前会完整校验，任一分区无效都不会覆盖现有数据。</p></div>
      <strong aria-live="polite">{{ backupNotice || `${inventory.snapshots.length} 份库存快照及其他本地状态保存在本机` }}</strong>
      <div><button class="button" type="button" @click="exportWorkspace">导出完整 JSON</button><button class="button" type="button" @click="backupInput?.click()">恢复备份</button><input ref="backupInput" hidden type="file" accept="application/json,.json" @change="importWorkspace" /></div>
    </section>
    <section class="danger-zone"><div><h2>界面偏好</h2><p>恢复最近账号、矩阵密度和字段显示默认值，不影响数据中心。</p></div><button class="button" @click="confirmAction('确认恢复默认界面偏好？', ui.resetPreferences)">恢复界面默认值</button><button class="button" @click="auth.logout">退出登录</button></section>
  </div>
</template>
