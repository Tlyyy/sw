import { computed, onScopeDispose, watch } from "vue";
import { storeToRefs } from "pinia";
import { generatePublishContent, publishImagePaths } from "../../domain/publish";
import { useCatalogStore } from "../../stores/catalog";
import { usePublishStore } from "../../stores/publish";
import { useWorkspaceDraftStore } from "../../stores/workspaceDraft";

export function usePublishPage() {
  const catalog = useCatalogStore();
  const publish = usePublishStore();
  const draft = useWorkspaceDraftStore();
  const {
    publishQuery: query,
    publishAccount: account,
    publishSelectedOnly: selectedOnly,
    publishStatus: status,
  } = storeToRefs(draft);
  let statusTimer: number | undefined;
  publish.hydrate();
  const visible = computed(() => catalog.pets.filter((pet) => (
    (account.value === "ALL" || pet.accountId === account.value)
    && (!selectedOnly.value || publish.selectedIds.includes(pet.id))
    && (!query.value || pet.searchText.includes(query.value.toLowerCase()))
  )));
  const selected = computed(() => publish.selectedIds
    .map((id) => catalog.petById.get(id))
    .filter(Boolean) as typeof catalog.pets);
  const generatedOutput = computed(() => generatePublishContent(catalog.data, selected.value, publish.options));
  const images = computed(() => publishImagePaths(catalog.data, selected.value, publish.options.allShots));
  watch(generatedOutput, (value) => publish.syncGenerated(value), { immediate: true });
  function showStatus(message: string) {
    status.value = message;
    if (statusTimer !== undefined) window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      status.value = "";
      statusTimer = undefined;
    }, 1_800);
  }
  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      showStatus(`${label}已复制`);
    } catch {
      showStatus("复制失败，请手动选择文本");
    }
  }
  function regenerateDraft() {
    publish.regenerate(generatedOutput.value);
    showStatus("正文已重新生成");
  }
  onScopeDispose(() => {
    if (statusTimer !== undefined) window.clearTimeout(statusTimer);
  });
  return {
    catalog,
    publish,
    query,
    account,
    selectedOnly,
    status,
    visible,
    selected,
    images,
    copy,
    regenerateDraft,
  };
}
