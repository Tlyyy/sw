import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useCatalogStore } from "../../stores/catalog";
import { useWorkspaceDraftStore } from "../../stores/workspaceDraft";

export function useSpeciesPage() {
  const catalog = useCatalogStore();
  const draft = useWorkspaceDraftStore();
  const { speciesQuery: query } = storeToRefs(draft);
  const speciesCount = computed(() => new Set(catalog.pets.map((pet) => pet.name)).size);
  const rows = computed(() => [...catalog.pets.reduce((map, pet) => {
    const list = map.get(pet.name) || [];
    list.push(pet);
    map.set(pet.name, list);
    return map;
  }, new Map<string, typeof catalog.pets>()).entries()]
    .map(([name, pets]) => ({
      name,
      pets,
      accounts: [...new Set(pets.map((pet) => pet.accountId))],
      bestTalent: [...pets].sort((a, b) => (b.talent || 0) - (a.talent || 0))[0],
      bestAttack: [...pets].sort((a, b) => b.attack - a.attack)[0],
      bestSpeed: [...pets].sort((a, b) => b.speed - a.speed)[0],
      bestSpirit: [...pets].sort((a, b) => b.spirit - a.spirit)[0],
    }))
    .filter((row) => !query.value
      || row.name.includes(query.value)
      || row.accounts.join(" ").toLowerCase().includes(query.value.toLowerCase()))
    .sort((a, b) => b.pets.length - a.pets.length));
  return { query, speciesCount, rows };
}
