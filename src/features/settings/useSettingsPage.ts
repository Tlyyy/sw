import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { appName } from "../../app/brand";
import {
  appearancePreference,
  setAppearancePreference,
  type AppearancePreference,
} from "../../app/appearance";
import { createWorkspaceBackup, parseWorkspaceBackup } from "../../persistence/state";
import { useAccountingStore } from "../../stores/accounting";
import { minimumPasswordLength, useAuthStore } from "../../stores/auth";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { usePublishStore } from "../../stores/publish";
import { useSettingsStore } from "../../stores/settings";
import { useSyncStore } from "../../stores/sync";
import { useUiStore } from "../../stores/ui";
import { useWorkspaceDraftStore } from "../../stores/workspaceDraft";

export const appearanceOptions: Array<{ value: AppearancePreference; label: string }> = [
  { value: "system", label: "自动" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
];

export function useSettingsPage() {
  const catalog = useCatalogStore();
  const inventory = useInventoryStore();
  const accounting = useAccountingStore();
  const settings = useSettingsStore();
  const publish = usePublishStore();
  const ui = useUiStore();
  const auth = useAuthStore();
  const cloudSync = useSyncStore();
  const draft = useWorkspaceDraftStore();
  const backupInput = ref<HTMLInputElement>();
  const {
    nextPassword,
    confirmPassword,
    backupNotice,
    passwordNotice,
  } = storeToRefs(draft);
  const lastSyncText = computed(() => cloudSync.lastSyncedAt
    ? `上次完成：${new Date(cloudSync.lastSyncedAt).toLocaleString("zh-CN", { hour12: false })}`
    : "尚未完成首次云同步");
  function confirmAction(message: string, action: () => void) {
    if (confirm(message)) action();
  }
  function exportWorkspace() {
    const payload = createWorkspaceBackup({
      inventory: inventory.exportState(),
      accounting: accounting.exportState(),
      settings: settings.exportState(),
      publish: publish.exportState(),
      ui: ui.exportState(),
    });
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${appName}-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    backupNotice.value = `已导出完整备份（${inventory.snapshots.length} 份库存快照、${accounting.entries.length} 笔核算流水）`;
  }
  async function importWorkspace(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!confirm("恢复备份会覆盖本机库存、实际所得流水、行情、任务、发布草稿和界面偏好，确认继续？")) {
      input.value = "";
      return;
    }
    try {
      const raw = JSON.parse(await file.text());
      if (raw?.format === "sw-workspace-backup") {
        const marketNames = catalog.data.gemMarketSnapshots.at(-1)?.items.map((item) => item.name) || [];
        const backup = parseWorkspaceBackup(raw, catalog.data.beastConfig.taskDefaultSettings, marketNames);
        const previous = {
          inventory: inventory.exportState(),
          accounting: accounting.exportState(),
          settings: settings.exportState(),
          publish: publish.exportState(),
          ui: ui.exportState(),
        };
        try {
          inventory.replaceState(backup.inventory);
          accounting.replaceState(backup.accounting);
          settings.replaceState(backup.settings);
          publish.replaceState(backup.publish);
          ui.replaceState(backup.ui);
        } catch (cause) {
          try { inventory.replaceState(previous.inventory); } catch { /* best effort */ }
          try { accounting.replaceState(previous.accounting); } catch { /* best effort */ }
          try { settings.replaceState(previous.settings); } catch { /* best effort */ }
          try { publish.replaceState(previous.publish); } catch { /* best effort */ }
          try { ui.replaceState(previous.ui); } catch { /* best effort */ }
          throw cause;
        }
        backupNotice.value = `已恢复完整备份（${inventory.snapshots.length} 份库存快照、${accounting.entries.length} 笔核算流水）`;
      } else {
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
  function setBackupInput(element: unknown) {
    backupInput.value = element instanceof HTMLInputElement ? element : undefined;
  }
  return {
    catalog,
    inventory,
    publish,
    ui,
    auth,
    cloudSync,
    backupInput,
    nextPassword,
    confirmPassword,
    backupNotice,
    passwordNotice,
    lastSyncText,
    appearancePreference,
    appearanceOptions,
    minimumPasswordLength,
    setAppearancePreference,
    confirmAction,
    exportWorkspace,
    importWorkspace,
    rotatePassword,
    setBackupInput,
  };
}
