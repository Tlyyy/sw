import { computed, markRaw } from "vue";
import { defineStore } from "pinia";
import { catalog } from "../data/catalog";
import { beastTotals, buildPetViews, buildRecommendations } from "../domain/pets";

export const useCatalogStore = defineStore("catalog", () => {
  const data = markRaw(catalog);
  const pets = markRaw(buildPetViews(catalog));
  const recommendations = computed(() => buildRecommendations(pets));
  const beastSummary = computed(() => beastTotals(pets));
  const evidenceById = new Map(data.evidence.map((item) => [item.id, item]));
  const petById = new Map(pets.map((item) => [item.id, item]));
  return { data, pets, recommendations, beastSummary, evidenceById, petById };
});
