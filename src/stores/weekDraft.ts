import { ref } from "vue";
import { defineStore } from "pinia";

export const useWeekDraftStore = defineStore("week-draft", () => {
  const selectedAnchor = ref("");

  function initialize(currentDate: string) {
    if (!selectedAnchor.value) selectedAnchor.value = currentDate;
  }

  return { selectedAnchor, initialize };
});
