import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { queryChoice, queryText } from "../../app/queryState";
import { useCatalogStore } from "../../stores/catalog";

export const skillTypes = ["兽决", "御兽", "强化技能"] as const;

export function useSkillsPage() {
  const catalog = useCatalogStore();
  const route = useRoute();
  const router = useRouter();
  const type = ref(queryChoice(route.query.type, skillTypes, "兽决"));
  const query = ref(queryText(route.query.q));
  const visible = computed(() => catalog.data.skills.filter((item) => (
    item.type === type.value
    && (!query.value || [item.name, item.type, item.note, item.certainty]
      .join(" ").toLowerCase().includes(query.value.toLowerCase()))
  )));
  const counts = Object.fromEntries(skillTypes.map((item) => [
    item,
    catalog.data.skills.filter((skill) => skill.type === item).length,
  ])) as Record<(typeof skillTypes)[number], number>;

  watch([type, query], () => router.replace({
    query: { type: type.value, ...(query.value ? { q: query.value } : {}) },
  }));
  watch(() => route.query, (value) => {
    type.value = queryChoice(value.type, skillTypes, "兽决");
    query.value = queryText(value.q);
  }, { deep: true });

  function keyboard(event: KeyboardEvent) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = skillTypes.indexOf(type.value);
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? skillTypes.length - 1
        : event.key === "ArrowRight"
          ? (current + 1) % skillTypes.length
          : (current - 1 + skillTypes.length) % skillTypes.length;
    type.value = skillTypes[next];
  }

  return { catalog, types: skillTypes, type, query, visible, counts, keyboard };
}
