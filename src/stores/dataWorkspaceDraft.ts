import { ref } from "vue";
import { defineStore } from "pinia";

export type InventoryWorkspaceView = "current" | "weekly" | "records";

export const useDataWorkspaceDraftStore = defineStore("data-workspace-draft", () => {
  const inventoryView = ref<InventoryWorkspaceView>("current");
  const inventoryAnchor = ref("");
  const inventoryDialogOpen = ref(false);
  const inventoryDialogDate = ref("");
  const inventoryNotice = ref("");

  return {
    inventoryView,
    inventoryAnchor,
    inventoryDialogOpen,
    inventoryDialogDate,
    inventoryNotice,
  };
});
