import { computed, watch } from "vue";
import { storeToRefs } from "pinia";
import {
  buildInventoryWeekReport,
  canRecordInventoryDate,
  naturalWeekRange,
} from "../../domain/inventory";
import type { InventorySnapshotInput } from "../../domain/types";
import {
  useDataWorkspaceDraftStore,
  type InventoryWorkspaceView,
} from "../../stores/dataWorkspaceDraft";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";

export const inventoryViewOptions: Array<{ key: InventoryWorkspaceView; label: string }> = [
  { key: "current", label: "当前库存" },
  { key: "weekly", label: "周报分析" },
  { key: "records", label: "记录管理" },
];

export function useDataInventoryPage() {
  const inventory = useInventoryStore();
  const settings = useSettingsStore();
  const draft = useDataWorkspaceDraftStore();
  inventory.hydrate();
  const {
    inventoryView: activeView,
    inventoryAnchor: selectedAnchor,
    inventoryDialogOpen,
    inventoryDialogDate,
    inventoryNotice,
  } = storeToRefs(draft);
  const currentDate = computed(() => settings.planningAsOfDate);
  if (!selectedAnchor.value) selectedAnchor.value = currentDate.value;
  const report = computed(() => buildInventoryWeekReport(inventory.snapshots, selectedAnchor.value));
  const currentWeek = computed(() => naturalWeekRange(currentDate.value));
  const isCurrentWeek = computed(() => report.value.weekStart === currentWeek.value.weekStart);
  const canViewNextWeek = computed(() => report.value.weekStart < currentWeek.value.weekStart);

  watch(currentDate, (date) => {
    selectedAnchor.value = date;
  });

  function viewDescription(view: InventoryWorkspaceView) {
    if (view === "current") return inventory.latestSnapshot?.effectiveDate || "尚未建立基线";
    if (view === "weekly") return `${report.value.recordedDays} / 7 天有记录`;
    return `${inventory.snapshots.length} 份历史快照`;
  }
  function activeViewTitle() {
    return activeView.value === "weekly" ? "周报分析" : "记录管理";
  }
  function activeViewCopy() {
    return activeView.value === "weekly"
      ? "这里只做比较、折算与分享；记录维护统一放在“记录管理”。"
      : "补录、修改和删除都在这里；未来日期只展示，不提供操作。";
  }
  function shiftDate(value: string, days: number) {
    const [year, month, day] = value.split("-").map(Number);
    const shifted = new Date(Date.UTC(year, month - 1, day + days));
    return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
  }
  function moveWeek(days: -7 | 7) {
    if (days > 0 && !canViewNextWeek.value) return;
    selectedAnchor.value = shiftDate(report.value.weekStart, days);
  }
  function returnToCurrentWeek() {
    selectedAnchor.value = currentDate.value;
  }
  function openInventoryDialog(date = currentDate.value) {
    if (!canRecordInventoryDate(date, currentDate.value)) return;
    inventoryDialogDate.value = date;
    inventoryDialogOpen.value = true;
  }
  function closeInventoryDialog() {
    inventoryDialogOpen.value = false;
  }
  function saveInventorySnapshot(snapshot: InventorySnapshotInput) {
    const updating = inventory.snapshots.some((item) => item.effectiveDate === snapshot.effectiveDate);
    inventory.saveSnapshot(snapshot);
    inventoryDialogOpen.value = false;
    inventoryNotice.value = `${updating ? "已更新" : "已保存"} ${snapshot.effectiveDate} 的五号库存快照`;
  }
  function removeInventorySnapshot(effectiveDate: string) {
    if (!confirm(`确认删除 ${effectiveDate} 的五号库存快照？`)) return;
    inventory.removeSnapshot(effectiveDate);
    inventoryNotice.value = `已删除 ${effectiveDate} 的库存快照`;
  }

  return {
    inventory,
    activeView,
    inventoryDialogOpen,
    inventoryDialogDate,
    inventoryNotice,
    currentDate,
    report,
    isCurrentWeek,
    canViewNextWeek,
    viewOptions: inventoryViewOptions,
    viewDescription,
    activeViewTitle,
    activeViewCopy,
    moveWeek,
    returnToCurrentWeek,
    openInventoryDialog,
    closeInventoryDialog,
    saveInventorySnapshot,
    removeInventorySnapshot,
  };
}
