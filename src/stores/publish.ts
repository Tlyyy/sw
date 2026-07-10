import { reactive, ref, watch } from "vue";
import { defineStore } from "pinia";
import { publishDefaults, type PublishOptions } from "../domain/publish";

const storageKey = "sw.app.publish.v1";

export const usePublishStore = defineStore("publish", () => {
  const selectedIds = ref<string[]>([]);
  const options = reactive<PublishOptions>({ mode: "sale", format: "markdown", ...publishDefaults.sale, includeStats: true, includeSkills: true, includeNotes: true, allShots: true });
  const hydrated = ref(false);
  function hydrate() {
    if (hydrated.value) return;
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (value?.selectedIds) selectedIds.value = value.selectedIds;
      if (value?.options) Object.assign(options, value.options);
    } catch { /* defaults */ }
    hydrated.value = true;
  }
  function persist() { if (hydrated.value) localStorage.setItem(storageKey, JSON.stringify({ selectedIds: selectedIds.value, options })); }
  function toggle(id: string) { selectedIds.value = selectedIds.value.includes(id) ? selectedIds.value.filter((item) => item !== id) : [...selectedIds.value, id]; }
  function select(ids: string[]) { selectedIds.value = [...new Set(ids)]; }
  function clear() { selectedIds.value = []; }
  function setMode(mode: "sale" | "record") { options.mode = mode; Object.assign(options, publishDefaults[mode]); }
  watch([selectedIds, options], persist, { deep: true });
  return { selectedIds, options, hydrate, toggle, select, clear, setMode };
});
