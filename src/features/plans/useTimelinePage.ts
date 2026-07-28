import { computed } from "vue";
import { buildMainlineProjection } from "../../domain/mainline";
import { buildTaskPlans } from "../../domain/plans";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";

export function useTimelinePage() {
  const catalog = useCatalogStore();
  const inventory = useInventoryStore();
  const settings = useSettingsStore();
  inventory.hydrate();
  const taskPlans = computed(() => buildTaskPlans(
    catalog.data,
    catalog.pets,
    settings.snapshot(inventory.planningResources, inventory.latestSnapshot?.effectiveDate || null),
  ));
  const projections = computed(() => buildMainlineProjection(taskPlans.value, inventory.snapshots, {
    buyWan: settings.taskSettings.eggPriceWan,
    sellWan: catalog.data.beastConfig.eggSellPriceWan,
  }));
  return { projections };
}
