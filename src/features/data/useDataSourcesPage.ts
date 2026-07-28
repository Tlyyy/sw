import { computed } from "vue";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";

export function useDataSourcesPage() {
  const catalog = useCatalogStore();
  const inventory = useInventoryStore();
  const settings = useSettingsStore();
  inventory.hydrate();
  const counts = computed(() => ({
    accounts: catalog.data.accounts.length,
    pets: catalog.pets.length,
    petEvidence: catalog.data.evidence.filter((item) => item.kind === "pet").length,
    equipment: catalog.data.equipment.length,
    skills: catalog.data.skills.length,
    evidence: catalog.data.evidence.length,
  }));
  function resetAllBusinessData() {
    settings.resetAllPlanningData();
    inventory.clear();
  }
  function confirmReset() {
    if (confirm("确认重置全部业务维护数据并删除库存、任务完成和银子支出记录？此操作不会删除原始资料。")) {
      resetAllBusinessData();
    }
  }
  return { catalog, counts, confirmReset };
}
