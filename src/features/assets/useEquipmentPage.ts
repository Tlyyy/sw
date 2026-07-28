import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { queryChoice, queryText } from "../../app/queryState";
import { formatCurrency, itemTargetCost, itemTargetGap } from "../../domain/gems";
import { accountIds, type AccountScope } from "../../domain/types";
import { useCatalogStore } from "../../stores/catalog";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";
import { publicAsset } from "../../utils/publicAsset";

export function useEquipmentPage() {
  const catalog = useCatalogStore();
  const settings = useSettingsStore();
  const ui = useUiStore();
  const route = useRoute();
  const router = useRouter();
  const accountChoices = ["ALL", ...accountIds] as const;
  const account = ref<AccountScope>(queryChoice(route.query.account, accountChoices, ui.accountScope));
  const query = ref(queryText(route.query.q));
  const visible = computed(() => catalog.data.equipment.filter((item) => (
    (account.value === "ALL" || item.accountId === account.value)
    && (!query.value || [
      item.accountId,
      item.slot,
      item.name,
      item.type,
      item.gem.name,
      item.gem.level,
      ...item.attributes,
      ...item.effects,
    ].join(" ").toLowerCase().includes(query.value.toLowerCase()))
  )));

  watch([account, query], () => router.replace({
    query: {
      ...(account.value !== "ALL" ? { account: account.value } : {}),
      ...(query.value ? { q: query.value } : {}),
    },
  }));
  watch(() => route.query, (value) => {
    account.value = queryChoice(value.account, accountChoices, ui.accountScope);
    query.value = queryText(value.q);
  }, { deep: true });
  watch(() => ui.accountScope, (scope) => {
    account.value = scope;
  });

  function source(id: string) {
    const evidence = catalog.evidenceById.get(id);
    return evidence ? publicAsset(evidence.sourcePath) : "";
  }
  function targetCost(item: (typeof catalog.data.equipment)[number]) {
    return formatCurrency(itemTargetCost(catalog.data, item, settings.gemPriceOverrides));
  }
  function targetGap(item: (typeof catalog.data.equipment)[number]) {
    return itemTargetGap(catalog.data, item).toLocaleString("zh-CN");
  }

  return { catalog, account, query, visible, source, targetCost, targetGap };
}
