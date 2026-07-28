import { computed, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { queryChoice, queryText } from "../../app/queryState";
import { createPetBatchShareFile } from "../../components/petShare";
import { accountIds, type AccountScope } from "../../domain/types";
import { useCatalogStore } from "../../stores/catalog";
import { usePublishStore } from "../../stores/publish";
import { useUiStore } from "../../stores/ui";

export function usePetsPage() {
  const catalog = useCatalogStore();
  const publish = usePublishStore();
  const ui = useUiStore();
  const route = useRoute();
  const router = useRouter();
  const roles = computed(() => [...new Set(catalog.pets.map((item) => item.role.primary))].sort());
  const accountChoices = ["ALL", ...accountIds] as const;
  const statusChoices = ["ALL", "confirmed", "pending"] as const;
  const query = ref(queryText(route.query.q));
  const account = ref<AccountScope>(queryChoice(route.query.account, accountChoices, ui.accountScope));
  const role = ref(queryChoice(route.query.role, ["ALL", ...roles.value], "ALL"));
  const status = ref(queryChoice(route.query.status, statusChoices, "ALL"));
  const selectedId = ref(queryText(route.query.selected));
  const visible = computed(() => catalog.pets.filter((pet) => (
    (account.value === "ALL" || pet.accountId === account.value)
    && (role.value === "ALL" || pet.role.primary === role.value)
    && (status.value === "ALL" || pet.recognitionStatus === status.value)
    && (!query.value || pet.searchText.includes(query.value.toLowerCase()))
  )));
  const selected = computed(() => catalog.petById.get(selectedId.value) || visible.value[0]);
  const selectedPets = computed(() => publish.selectedIds
    .map((id) => catalog.petById.get(id))
    .filter((pet): pet is NonNullable<typeof pet> => Boolean(pet)));
  const allVisibleSelected = computed(() => visible.value.length > 0
    && visible.value.every((pet) => publish.selectedIds.includes(pet.id)));
  const batchSharing = ref(false);
  const batchProgress = ref(0);
  const batchTotal = ref(0);
  const batchNotice = ref("");
  let batchNoticeTimer: number | null = null;
  const batchActionLabel = computed(() => batchSharing.value
    ? `生成 ${batchProgress.value}/${batchTotal.value}`
    : `分享 ${selectedPets.value.length} 只`);

  function sync() {
    void router.replace({
      query: {
        ...(query.value ? { q: query.value } : {}),
        ...(account.value !== "ALL" ? { account: account.value } : {}),
        ...(role.value !== "ALL" ? { role: role.value } : {}),
        ...(status.value !== "ALL" ? { status: status.value } : {}),
        ...(selectedId.value ? { selected: selectedId.value } : {}),
      },
    });
  }
  watch([query, account, role, status, selectedId], sync);
  watch(() => route.query, (value) => {
    query.value = queryText(value.q);
    account.value = queryChoice(value.account, accountChoices, ui.accountScope);
    role.value = queryChoice(value.role, ["ALL", ...roles.value], "ALL");
    status.value = queryChoice(value.status, statusChoices, "ALL");
    selectedId.value = queryText(value.selected);
  }, { deep: true });
  watch(() => ui.accountScope, (scope) => {
    account.value = scope;
  });

  function select(id: string) {
    selectedId.value = id;
  }
  function showBatchNotice(message: string) {
    batchNotice.value = message;
    if (batchNoticeTimer !== null) {
      window.clearTimeout(batchNoticeTimer);
      batchNoticeTimer = null;
    }
    if (!message) return;
    batchNoticeTimer = window.setTimeout(() => {
      batchNotice.value = "";
      batchNoticeTimer = null;
    }, 3_600);
  }
  function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
  function toggleVisibleSelection() {
    if (batchSharing.value) return;
    const visibleIds = new Set(visible.value.map((pet) => pet.id));
    publish.select(allVisibleSelected.value
      ? publish.selectedIds.filter((id) => !visibleIds.has(id))
      : [...publish.selectedIds, ...visibleIds]);
  }
  function togglePetSelection(id: string) {
    if (!batchSharing.value) publish.toggle(id);
  }
  async function shareSelectedPets() {
    const pets = [...selectedPets.value];
    if (!pets.length || batchSharing.value) return;
    batchSharing.value = true;
    batchProgress.value = 0;
    batchTotal.value = pets.length;
    showBatchNotice("");
    try {
      const file = await createPetBatchShareFile(
        pets,
        catalog.evidenceById,
        catalog.data.generatedAt,
        (current, total) => {
          batchProgress.value = current;
          batchTotal.value = total;
        },
      );
      const shareData: ShareData = { files: [file], title: `${pets.length} 只宠物合集` };
      const supportsFileShare = typeof navigator.share === "function"
        && typeof navigator.canShare === "function"
        && navigator.canShare(shareData);
      if (supportsFileShare) {
        try {
          await navigator.share(shareData);
          showBatchNotice("已生成 1 张合集图");
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      downloadBlob(file, file.name);
      showBatchNotice("宠物合集图已下载");
    } catch {
      showBatchNotice("合集图生成失败，请重试");
    } finally {
      batchSharing.value = false;
      batchProgress.value = 0;
      batchTotal.value = 0;
    }
  }

  onUnmounted(() => {
    if (batchNoticeTimer !== null) window.clearTimeout(batchNoticeTimer);
  });

  return {
    catalog,
    publish,
    roles,
    query,
    account,
    role,
    status,
    selectedId,
    visible,
    selected,
    selectedPets,
    allVisibleSelected,
    batchSharing,
    batchNotice,
    batchActionLabel,
    select,
    toggleVisibleSelection,
    togglePetSelection,
    shareSelectedPets,
  };
}
