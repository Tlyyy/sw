<script setup lang="ts">
import { computed, ref } from "vue";
import { appName } from "../../app/brand";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";
import { usePublishStore } from "../../stores/publish";
import { useUiStore } from "../../stores/ui";
import { minimumPasswordLength, useAuthStore } from "../../stores/auth";
import { useSyncStore } from "../../stores/sync";
import { createWorkspaceBackup, parseWorkspaceBackup } from "../../persistence/state";
import DataCenterNav from "../data/DataCenterNav.vue";

const catalog = useCatalogStore();
const inventory = useInventoryStore();
const settings = useSettingsStore();
const publish = usePublishStore();
const ui = useUiStore();
const auth = useAuthStore();
const cloudSync = useSyncStore();
const backupInput = ref<HTMLInputElement>();
const backupNotice = ref("");
const nextPassword = ref("");
const confirmPassword = ref("");
const passwordNotice = ref("");
const lastSyncText = computed(() => cloudSync.lastSyncedAt
  ? `上次完成：${new Date(cloudSync.lastSyncedAt).toLocaleString("zh-CN", { hour12: false })}`
  : "尚未完成首次云同步");

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
  anchor.download = `${appName}-${new Date().toISOString().slice(0, 10)}.json`;
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

async function rotatePassword() {
  passwordNotice.value = "";
  if (nextPassword.value !== confirmPassword.value) {
    passwordNotice.value = "两次输入的新密码不一致。";
    return;
  }
  if (await auth.changePassword(nextPassword.value)) {
    nextPassword.value = "";
    confirmPassword.value = "";
    passwordNotice.value = "密码已轮换，云端密文已使用新密码重新加密。其他设备需要用新密码登录。";
  }
}
</script>

<template>
  <div class="page-wrap settings-page">
    <DataCenterNav />
    <section class="page-intro"><div><h2>界面、同步与备份</h2><p>数据会先保存在当前浏览器，联网时再自动加密同步到云端。</p></div></section>
    <section class="settings-section workspace-state-section cloud-sync-section" :class="`is-${cloudSync.statusTone}`">
      <div>
        <h2>自动云同步</h2>
        <p>库存、行情与任务、发布草稿和界面偏好会自动同步；云端只保存由访问密码加密后的内容。</p>
        <p v-if="cloudSync.errorMessage" class="cloud-sync-message" role="alert">{{ cloudSync.errorMessage }}</p>
        <p v-else-if="cloudSync.conflictMessage" class="cloud-sync-message" role="status">{{ cloudSync.conflictMessage }}</p>
        <p v-else-if="cloudSync.status === 'offline'" class="cloud-sync-message" role="status">已自动保存在本机；网络恢复或返回前台后会自动重连。</p>
      </div>
      <strong aria-live="polite"><span class="cloud-sync-dot" aria-hidden="true"></span>{{ cloudSync.statusLabel }}<small>{{ lastSyncText }}</small></strong>
      <div v-if="cloudSync.hasConflict" class="cloud-sync-actions">
        <button class="button" type="button" @click="cloudSync.useRemoteVersion">使用云端</button>
        <button class="button" type="button" @click="cloudSync.keepLocalVersion">用本机覆盖</button>
      </div>
      <button v-else class="button" type="button" :disabled="cloudSync.isBusy" @click="cloudSync.retry">{{ cloudSync.isBusy ? "同步中…" : "立即检查" }}</button>
    </section>
    <section class="settings-section password-rotation-section" :class="{ 'is-required': cloudSync.passwordRotationRequired }">
      <div class="section-head"><div>
        <h2>{{ cloudSync.passwordRotationRequired ? "必须更换访问密码" : "更换访问密码" }}</h2>
        <p v-if="cloudSync.passwordRotationRequired">旧版本的密码校验值曾进入公开代码历史。请改用一条从未在其他地方使用过的新密码，完成后云端数据会原地重新加密。</p>
        <p v-else>密码只在浏览器内派生加密密钥；更换后，其他设备必须输入新密码。</p>
      </div></div>
      <form class="password-rotation-form" @submit.prevent="rotatePassword">
        <label><span>新密码（至少 {{ minimumPasswordLength }} 个字符）</span><input v-model="nextPassword" type="password" autocomplete="new-password" :minlength="minimumPasswordLength" required /></label>
        <label><span>再次输入新密码</span><input v-model="confirmPassword" type="password" autocomplete="new-password" :minlength="minimumPasswordLength" required /></label>
        <button class="button primary" type="submit" :disabled="auth.changingPassword || cloudSync.status !== 'synced'">{{ auth.changingPassword ? "正在重新加密…" : "更换并重新加密" }}</button>
      </form>
      <p v-if="auth.passwordChangeError || passwordNotice" class="password-rotation-message" role="status">{{ auth.passwordChangeError || passwordNotice }}</p>
      <p v-else-if="cloudSync.status !== 'synced'" class="password-rotation-message">请先等待上方显示“云端已同步”。密码轮换必须联网且无待同步修改。</p>
    </section>
    <section class="settings-section">
      <div class="section-head"><div><h2>默认账号与对比表显示</h2><p>行动推进台始终同时展示五个账号；默认账号只影响“账号详情”的默认入口。</p></div></div>
      <div class="settings-grid ui-settings-grid">
        <label><span>默认账号</span><select v-model="ui.recentAccount" aria-label="默认账号"><option v-for="item in catalog.data.accounts" :key="item.id" :value="item.id">{{ item.id }}</option></select></label>
        <label><span>对比表密度</span><select v-model="ui.matrixDensity" aria-label="对比表密度"><option value="compact">紧凑</option><option value="comfortable">舒展</option></select></label>
      </div>
    </section>
    <section class="settings-section">
      <div class="section-head"><div><h2>宠物对比表显示内容</h2><p>控制宠物对比表默认展示哪些信息。</p></div></div>
      <div class="preference-options"><label><input v-model="ui.matrixDisplay.stats" type="checkbox" />属性</label><label><input v-model="ui.matrixDisplay.aptitudes" type="checkbox" />资质</label><label><input v-model="ui.matrixDisplay.skills" type="checkbox" />技能</label></div>
    </section>
    <section class="settings-section workspace-state-section">
      <div><h2>临时工作状态</h2><p>发布素材选择属于工作草稿，不影响宠物和装备原始数据。</p></div>
      <strong>{{ publish.selectedIds.length }} 组宠物已加入发布清单</strong>
      <button class="button" @click="confirmAction('确认清空发布页已选宠物？', publish.clear)">清空发布选择</button>
    </section>
    <section class="settings-section workspace-state-section">
      <div><h2>完整业务备份</h2><p>包含库存、行情与历史、任务完成日期、银子支出、发布草稿和界面偏好；不包含登录状态和静态基础资料。恢复后会自动同步，任一分区无效都不会覆盖现有数据。</p></div>
      <strong aria-live="polite">{{ backupNotice || `${inventory.snapshots.length} 份库存快照已保存在本机` }}</strong>
      <div><button class="button" type="button" @click="exportWorkspace">导出完整 JSON</button><button class="button" type="button" @click="backupInput?.click()">恢复备份</button><input ref="backupInput" hidden type="file" accept="application/json,.json" @change="importWorkspace" /></div>
    </section>
    <section class="danger-zone"><div><h2>界面偏好</h2><p>恢复默认账号、对比表密度和显示内容，不影响数据中心。</p></div><button class="button" @click="confirmAction('确认恢复默认界面偏好？', ui.resetPreferences)">恢复界面默认值</button><button class="button" @click="auth.logout">退出登录</button></section>
  </div>
</template>
