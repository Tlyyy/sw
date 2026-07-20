<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppIcon from "../../components/AppIcon.vue";
import PetRow from "../../components/PetRow.vue";
import PetDetail from "../../components/PetDetail.vue";
import { createPetBatchShareFile } from "../../components/petShare";
import { useCatalogStore } from "../../stores/catalog";
import { usePublishStore } from "../../stores/publish";
import { useUiStore } from "../../stores/ui";
import { queryChoice, queryText } from "../../app/queryState";
import { accountIds, type AccountScope } from "../../domain/types";

const catalog = useCatalogStore(); const publish = usePublishStore(); const ui = useUiStore(); const route = useRoute(); const router = useRouter();
const roles = computed(() => [...new Set(catalog.pets.map((item) => item.role.primary))].sort());
const accountChoices = ["ALL", ...accountIds] as const;
const statusChoices = ["ALL", "confirmed", "pending"] as const;
const query = ref(queryText(route.query.q));
const account = ref<AccountScope>(queryChoice(route.query.account, accountChoices, ui.accountScope));
const role = ref(queryChoice(route.query.role, ["ALL", ...roles.value], "ALL"));
const status = ref(queryChoice(route.query.status, statusChoices, "ALL"));
const selectedId = ref(queryText(route.query.selected));
const visible = computed(() => catalog.pets.filter((pet) => (account.value === "ALL" || pet.accountId === account.value) && (role.value === "ALL" || pet.role.primary === role.value) && (status.value === "ALL" || pet.recognitionStatus === status.value) && (!query.value || pet.searchText.includes(query.value.toLowerCase()))));
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

function sync() { router.replace({ query: { ...(query.value ? {q:query.value}:{}), ...(account.value !== "ALL" ? {account:account.value}:{}), ...(role.value !== "ALL" ? {role:role.value}:{}), ...(status.value !== "ALL" ? {status:status.value}:{}), ...(selectedId.value ? {selected:selectedId.value}:{}) } }); }
watch([query,account,role,status,selectedId], sync);
watch(() => route.query, (value) => {
  query.value = queryText(value.q);
  account.value = queryChoice(value.account, accountChoices, ui.accountScope);
  role.value = queryChoice(value.role, ["ALL", ...roles.value], "ALL");
  status.value = queryChoice(value.status, statusChoices, "ALL");
  selectedId.value = queryText(value.selected);
}, { deep: true });
watch(() => ui.accountScope, (scope) => { account.value = scope; });
function select(id:string){selectedId.value=id;}

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
</script>

<template>
  <div class="page-wrap assets-page" :class="{ 'has-pet-batch-selection': selectedPets.length }">
    <nav class="subnav"><RouterLink to="/assets/pets">宠物</RouterLink><RouterLink to="/assets/equipment">装备</RouterLink><RouterLink to="/assets/skills">技能</RouterLink><RouterLink to="/assets/evidence">截图证据</RouterLink></nav>
    <section class="page-intro">
      <div><h2>宠物资产</h2><p>{{ catalog.pets.length }} 组宠物的统一事实目录；筛选保存在 URL，详情不再重复铺满页面。</p></div>
      <div class="pet-page-actions">
        <span v-if="selectedPets.length" class="pet-selected-count">已选 {{ selectedPets.length }} 只</span>
        <button class="button" type="button" :disabled="batchSharing || !visible.length" @click="toggleVisibleSelection">
          {{ allVisibleSelected ? "取消当前" : "全选当前" }}
        </button>
      </div>
    </section>
    <div class="filter-bar"><input v-model="query" type="search" placeholder="在宠物、技能、面板和资质中筛选" /><select v-model="account" aria-label="账号范围"><option value="ALL">全部账号</option><option v-for="item in catalog.data.accounts" :key="item.id">{{item.id}}</option></select><select v-model="role"><option value="ALL">全部定位</option><option v-for="item in roles" :key="item">{{item}}</option></select><select v-model="status"><option value="ALL">全部状态</option><option value="confirmed">已确认</option><option value="pending">待确认</option></select><span>{{ visible.length }} / {{ catalog.pets.length }}</span></div>
    <div class="asset-split"><div class="pet-list"><PetRow v-for="pet in visible" :key="pet.id" :pet="pet" :selected="selected?.id === pet.id" selectable actionable :checked="publish.selectedIds.includes(pet.id)" @select="select" @toggle="togglePetSelection" /><div v-if="!visible.length" class="empty-state">没有匹配的宠物资产</div></div><PetDetail v-if="selected" :pet="selected" /></div>
    <aside v-if="selectedPets.length" class="pet-batch-share-bar" aria-label="批量分享宠物">
      <div class="pet-batch-summary">
        <strong>{{ selectedPets.length }} 只宠物</strong>
        <span role="status" aria-live="polite">{{ batchNotice || (batchSharing ? batchActionLabel : "已选") }}</span>
      </div>
      <button class="pet-batch-clear" type="button" :disabled="batchSharing" @click="publish.clear()">清空</button>
      <button
        class="pet-batch-share-button"
        :class="{ loading: batchSharing }"
        type="button"
        :disabled="batchSharing"
        :aria-busy="batchSharing"
        :aria-label="batchSharing ? batchActionLabel : `批量分享 ${selectedPets.length} 只宠物`"
        @click="shareSelectedPets"
      >
        <AppIcon :name="batchSharing ? 'refresh' : 'share'" />
        <span>{{ batchActionLabel }}</span>
      </button>
    </aside>
  </div>
</template>

<style scoped>
.pet-page-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.pet-selected-count { color: var(--radar-cyan-strong); font-size: 13px; font-weight: 800; white-space: nowrap; }
.pet-page-actions .button:disabled { cursor: not-allowed; opacity: .48; }
.has-pet-batch-selection { padding-bottom: 138px; }
.pet-batch-share-bar { position: fixed; z-index: 46; right: 24px; bottom: 24px; width: min(510px, calc(100vw - 48px)); min-height: 66px; display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--radar-cyan) 40%, var(--radar-line)); border-radius: 11px; color: var(--radar-ink); background: color-mix(in srgb, var(--radar-surface) 95%, var(--radar-cyan-soft)); box-shadow: 0 14px 40px rgba(3, 18, 31, .2); backdrop-filter: blur(14px); }
.pet-batch-summary { min-width: 0; display: grid; gap: 3px; }
.pet-batch-summary strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.pet-batch-summary span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--radar-muted); font-size: 12px; }
.pet-batch-clear { min-width: 48px; min-height: 42px; padding: 0 9px; border: 0; border-radius: 7px; color: var(--radar-muted); background: transparent; font-size: 13px; font-weight: 800; }
.pet-batch-clear:hover,
.pet-batch-clear:focus-visible { color: var(--radar-ink); background: var(--radar-cyan-soft); outline: 0; }
.pet-batch-share-button { min-width: 122px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 0 13px; border: 1px solid var(--radar-cyan); border-radius: 8px; color: #ffffff; background: var(--radar-cyan); font-size: 13px; font-weight: 850; }
.pet-batch-share-button:hover,
.pet-batch-share-button:focus-visible { background: var(--radar-cyan-strong); outline: 0; }
.pet-batch-share-button:focus-visible { box-shadow: 0 0 0 3px color-mix(in srgb, var(--radar-cyan) 28%, transparent); }
.pet-batch-share-button:disabled,
.pet-batch-clear:disabled { cursor: wait; opacity: .62; }
.pet-batch-share-button :deep(svg) { width: 17px; height: 17px; }
.pet-batch-share-button.loading :deep(svg) { animation: pet-batch-share-spin .75s linear infinite; }

@keyframes pet-batch-share-spin { to { transform: rotate(360deg); } }

@media (max-width: 720px) {
  .has-pet-batch-selection { padding-bottom: 152px; }
  .pet-page-actions { width: 100%; justify-content: space-between; }
  .pet-batch-share-bar { right: 8px; bottom: calc(70px + env(safe-area-inset-bottom)); left: 8px; width: auto; min-height: 60px; gap: 6px; padding: 8px 9px; border-radius: 9px; }
  .pet-batch-clear { min-width: 46px; min-height: 44px; padding-inline: 7px; }
  .pet-batch-share-button { min-width: 112px; min-height: 44px; padding-inline: 10px; }
}

@media (max-width: 360px) {
  .pet-batch-summary span { display: none; }
  .pet-batch-share-button { min-width: 104px; }
}

@media (prefers-reduced-motion: reduce) {
  .pet-batch-share-button.loading :deep(svg) { animation: none; }
}
</style>
