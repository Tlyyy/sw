import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { queryChoice } from "../../app/queryState";
import { matrixAccountIds, matrixGroups, matrixRow } from "../../domain/matrix";
import type { PetView } from "../../domain/types";
import { useCatalogStore } from "../../stores/catalog";
import { useUiStore } from "../../stores/ui";

type ComparableMetric = "attack" | "speed" | "spirit" | "hp";

export const matrixGroupCopy: Record<string, { short: string; description: string }> = {
  "日常": { short: "日常", description: "祸斗、雷司与九头鸟的五号配置" },
  "PK：神兽蛇 / 小马": { short: "神兽蛇 / 小马", description: "剑气蛇、法蛇、隐攻蛇与小马" },
  "PK：法系 / 特殊 / 物理": { short: "法系 / 特殊 / 物理", description: "跨账号核对法系、特殊与物理位置" },
  "PK：速度": { short: "速度", description: "速度位置的五号横向比较" },
};

export function useMatrixPage() {
  const catalog = useCatalogStore();
  const ui = useUiStore();
  const route = useRoute();
  const router = useRouter();
  const group = ref(queryChoice(route.query.group, matrixGroups, matrixGroups[0]));
  const rows = computed(() => matrixRow(catalog.pets, group.value));
  const totalSlots = computed(() => rows.value.length * matrixAccountIds.length);
  const filledCount = computed(() => rows.value.reduce((sum, row) => sum + row.accounts.filter(Boolean).length, 0));
  const missingCount = computed(() => totalSlots.value - filledCount.value);
  const coverageRate = computed(() => totalSlots.value ? Math.round((filledCount.value / totalSlots.value) * 100) : 0);
  const visibleFieldCount = computed(() => Object.values(ui.matrixDisplay).filter(Boolean).length);
  const groupIndex = computed(() => matrixGroups.indexOf(group.value));
  watch(group, (value) => void router.replace({ query: { ...route.query, group: value } }));
  watch(() => route.query.group, (value) => {
    group.value = queryChoice(value, matrixGroups, matrixGroups[0]);
  });
  function groupRowCount(value: string) {
    return matrixRow(catalog.pets, value).length;
  }
  function statsFor(pet: PetView) {
    return [
      { key: "attack" as const, label: "攻击", value: pet.attack },
      { key: "speed" as const, label: "速度", value: pet.speed },
      { key: "spirit" as const, label: "灵力", value: pet.spirit },
      { key: "hp" as const, label: "气血", value: pet.hp },
    ];
  }
  function aptitudesFor(pet: PetView) {
    return [
      { label: "攻资", value: pet.attackApt },
      { label: "防资", value: pet.defenseApt },
      { label: "体资", value: pet.staminaApt },
      { label: "法资", value: pet.magicApt },
      { label: "速资", value: pet.speedApt },
    ];
  }
  function visibleSkills(pet: PetView) {
    return pet.skills.filter((skill) => skill !== "空").slice(0, 5);
  }
  function isBest(rowPets: Array<PetView | undefined>, pet: PetView, metric: ComparableMetric) {
    const values = rowPets.filter((item): item is PetView => Boolean(item)).map((item) => item[metric]);
    return values.length > 1 && pet[metric] === Math.max(...values);
  }
  return {
    catalog,
    ui,
    group,
    groups: matrixGroups,
    accounts: matrixAccountIds,
    rows,
    totalSlots,
    filledCount,
    missingCount,
    coverageRate,
    visibleFieldCount,
    groupIndex,
    groupCopy: matrixGroupCopy,
    groupRowCount,
    statsFor,
    aptitudesFor,
    visibleSkills,
    isBest,
  };
}
