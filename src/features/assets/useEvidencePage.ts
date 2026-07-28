import { computed, watch } from "vue";
import { storeToRefs } from "pinia";
import { useAssetDraftStore } from "../../stores/assetDraft";
import { useCatalogStore } from "../../stores/catalog";
import { useUiStore } from "../../stores/ui";
import { publicAsset } from "../../utils/publicAsset";

export function useEvidencePage() {
  const catalog = useCatalogStore();
  const ui = useUiStore();
  const draft = useAssetDraftStore();
  draft.initialize(ui.accountScope);
  const { evidenceQuery: query, evidenceAccount: account, evidenceKind: kind } = storeToRefs(draft);
  const visible = computed(() => catalog.data.evidence.filter((item) => (
    (kind.value === "ALL" || item.kind === kind.value)
    && (account.value === "ALL" || item.accountId === account.value)
    && (!query.value || [
      item.accountId,
      item.kind,
      item.capturedAt,
      item.file,
      item.sourcePath,
    ].join(" ").toLowerCase().includes(query.value.toLowerCase()))
  )));
  watch(() => ui.accountScope, (scope) => {
    account.value = scope;
  });

  function label(value: string) {
    return ({ pet: "宠物", equipment: "装备", market: "行情" } as Record<string, string>)[value] || value;
  }

  return {
    catalog,
    query,
    account,
    kind,
    visible,
    label,
    source: publicAsset,
  };
}
