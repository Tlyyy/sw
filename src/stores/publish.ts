import { computed, reactive, ref, watch } from "vue";
import { defineStore } from "pinia";
import { publishDefaults, type PublishOptions } from "../domain/publish";
import { parsePublishState, type PublishState } from "../persistence/state";

export const publishStorageKey = "sw.app.publish.v2";
export const legacyPublishStorageKey = "sw.app.publish.v1";
const defaultOptions = (): PublishOptions => ({ mode: "sale", format: "markdown", ...publishDefaults.sale, includeStats: true, includeSkills: true, includeNotes: true, allShots: true });

export const usePublishStore = defineStore("publish", () => {
  const selectedIds = ref<string[]>([]);
  const options = reactive<PublishOptions>(defaultOptions());
  const draft = ref("");
  const generatedSource = ref("");
  const hydrated = ref(false);
  const hasManualEdits = computed(() => draft.value !== generatedSource.value);
  function setState(value: PublishState) {
    selectedIds.value = [...value.selectedIds];
    Object.keys(options).forEach((key) => delete (options as Partial<PublishOptions>)[key as keyof PublishOptions]);
    Object.assign(options, value.options);
    draft.value = value.draft;
    generatedSource.value = value.generatedSource;
  }
  function exportState(): PublishState {
    return { version: 2, selectedIds: [...selectedIds.value], options: { ...options }, draft: draft.value, generatedSource: generatedSource.value };
  }
  function replaceState(value: unknown) {
    setState(parsePublishState(value, defaultOptions()));
    if (!hydrated.value) hydrated.value = true;
    persist();
  }
  function hydrate() {
    if (hydrated.value) return;
    try {
      const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(publishStorageKey) || localStorage.getItem(legacyPublishStorageKey);
      if (raw) setState(parsePublishState(raw, defaultOptions()));
    } catch { /* defaults */ }
    hydrated.value = true;
    persist();
  }
  function persist() {
    if (!hydrated.value || typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(publishStorageKey, JSON.stringify(exportState()));
    } catch {
      // Keep the draft available in memory if storage is blocked or full.
    }
  }
  function toggle(id: string) { selectedIds.value = selectedIds.value.includes(id) ? selectedIds.value.filter((item) => item !== id) : [...selectedIds.value, id]; }
  function select(ids: string[]) { selectedIds.value = [...new Set(ids)]; }
  function clear() { selectedIds.value = []; }
  function setMode(mode: "sale" | "record") { options.mode = mode; Object.assign(options, publishDefaults[mode]); }
  function syncGenerated(value: string) {
    if (hasManualEdits.value) return;
    draft.value = value;
    generatedSource.value = value;
  }
  function regenerate(value: string) {
    draft.value = value;
    generatedSource.value = value;
  }
  watch([selectedIds, options, draft, generatedSource], persist, { deep: true });
  return {
    selectedIds,
    options,
    draft,
    hasManualEdits,
    hydrate,
    exportState,
    replaceState,
    toggle,
    select,
    clear,
    setMode,
    syncGenerated,
    regenerate,
  };
});
