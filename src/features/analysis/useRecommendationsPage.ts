import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useCatalogStore } from "../../stores/catalog";
import { useWorkspaceDraftStore } from "../../stores/workspaceDraft";

export function useRecommendationsPage() {
  const catalog = useCatalogStore();
  const draft = useWorkspaceDraftStore();
  const { recommendationQuery: query } = storeToRefs(draft);
  const recommendations = computed(() => catalog.recommendations.map((group) => ({
    ...group,
    rows: group.rows.filter((row) => !query.value || row.searchText.includes(query.value.toLowerCase())),
  })));
  return { query, recommendations };
}
