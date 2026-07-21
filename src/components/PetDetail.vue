<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useCatalogStore } from "../stores/catalog";
import type { EvidenceSource, PetView } from "../domain/types";
import { publicAsset } from "../utils/publicAsset";
import AppIcon from "./AppIcon.vue";
import { createPetShareFile } from "./petShare";

const props = defineProps<{ pet: PetView }>();
const catalog = useCatalogStore();
const sharing = ref(false);
const shareNotice = ref("");
let shareNoticeTimer: number | null = null;
const evidence = computed(() => props.pet.evidenceIds
  .map((id) => catalog.evidenceById.get(id))
  .filter((item): item is EvidenceSource => Boolean(item)));
const webPath = (path?: string) => path ? publicAsset(path) : "";

function showShareNotice(message: string) {
  shareNotice.value = message;
  if (shareNoticeTimer !== null) window.clearTimeout(shareNoticeTimer);
  shareNoticeTimer = window.setTimeout(() => {
    shareNotice.value = "";
    shareNoticeTimer = null;
  }, 2_800);
}

function downloadShareImage(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function sharePetDetail() {
  if (sharing.value) return;
  sharing.value = true;

  try {
    const primaryEvidence = evidence.value[0];
    const file = await createPetShareFile(props.pet, primaryEvidence, catalog.data.generatedAt);
    const fileName = file.name;
    const shareData: ShareData = { files: [file], title: `${props.pet.accountId} · ${props.pet.name}宠物档案` };
    const supportsFileShare = typeof navigator.share === "function"
      && typeof navigator.canShare === "function"
      && navigator.canShare(shareData);

    if (supportsFileShare) {
      try {
        await navigator.share(shareData);
        showShareNotice("宠物图片已生成");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    downloadShareImage(file, fileName);
    showShareNotice("宠物图片已下载");
  } catch {
    showShareNotice("图片生成失败，请重试");
  } finally {
    sharing.value = false;
  }
}

onUnmounted(() => {
  if (shareNoticeTimer !== null) window.clearTimeout(shareNoticeTimer);
});
</script>
<template>
  <aside class="detail-panel">
    <header>
      <div class="detail-header-copy"><span>{{ pet.accountId }} · {{ pet.role.primary }}</span><h2>{{ pet.name }}</h2><p>{{ pet.meta }}</p></div>
      <div class="detail-header-actions">
        <strong class="detail-skill-count">{{ pet.skillCount }} 技能</strong>
        <button
          type="button"
          class="pet-detail-share-button"
          :class="{ loading: sharing }"
          :disabled="sharing"
          :aria-busy="sharing"
          :aria-label="`分享 ${pet.accountId} 的 ${pet.name}宠物档案`"
          title="生成宠物分享图片"
          @click="sharePetDetail"
        >
          <AppIcon :name="sharing ? 'refresh' : 'share'" />
          <span>分享</span>
        </button>
      </div>
    </header>
    <div class="detail-shots"><a v-for="shot in evidence" :key="shot!.id" :href="webPath(shot!.sourcePath)" target="_blank"><img :src="webPath(shot!.sourcePath)" :alt="`${pet.name} 截图`" /><span>{{ shot!.capturedAt || shot!.file }}</span></a></div>
    <section><h3>核心判断</h3><p>{{ pet.role.advice }}</p><div class="skill-list"><span v-for="tag in pet.role.tags" :key="tag">{{ tag }}</span></div></section>
    <section class="detail-numbers"><div v-for="group in [{ title:'面板', rows:pet.panel },{ title:'属性点', rows:pet.points },{ title:'资质 / 寿命', rows:pet.aptitudes },{ title:'养成', rows:pet.growth }]" :key="group.title"><h3>{{ group.title }}</h3><p v-for="row in group.rows" :key="row[0]"><span>{{ row[0] }}</span><b>{{ row[1] }}</b></p></div></section>
    <section><h3>完整技能</h3><div class="skill-list"><span v-for="skill in pet.skills.filter(item => item !== '空')" :key="skill">{{ skill }}</span></div></section>
    <p v-if="shareNotice" class="pet-share-notice" role="status">{{ shareNotice }}</p>
  </aside>
</template>

<style scoped>
.detail-header-copy { min-width: 0; }
.detail-header-actions { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; }
.detail-skill-count { white-space: nowrap; font-size: 14px; }
.pet-detail-share-button { min-width: 76px; min-height: 38px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 11px; border: 1px solid color-mix(in srgb, var(--radar-cyan) 42%, var(--radar-line)); border-radius: 7px; color: var(--radar-cyan-strong); background: var(--radar-surface); font-size: 13px; font-weight: 800; }
.pet-detail-share-button:hover,
.pet-detail-share-button:focus-visible { background: var(--radar-cyan-soft); outline: 0; }
.pet-detail-share-button:focus-visible { box-shadow: inset 0 0 0 2px var(--radar-cyan); }
.pet-detail-share-button:disabled { cursor: wait; opacity: .58; }
.pet-detail-share-button :deep(svg) { width: 17px; height: 17px; }
.pet-detail-share-button.loading :deep(svg) { animation: pet-share-spin .75s linear infinite; }
.pet-share-notice { position: fixed; right: 20px; bottom: 24px; z-index: 70; max-width: calc(100vw - 40px); margin: 0; padding: 10px 14px; border: 1px solid color-mix(in srgb, var(--radar-cyan) 36%, var(--radar-line)); border-radius: 8px; color: var(--radar-ink); background: color-mix(in srgb, var(--radar-surface) 94%, var(--radar-cyan-soft)); box-shadow: 0 8px 24px rgba(20, 37, 34, .16); font-size: 13px; font-weight: 750; line-height: 1.35; }

@keyframes pet-share-spin { to { transform: rotate(360deg); } }

@media (max-width: 560px) {
  .detail-header-actions { align-items: flex-end; flex-direction: column; gap: 6px; }
  .detail-skill-count { font-size: 12px; }
  .pet-detail-share-button { min-width: 72px; min-height: 36px; }
  .pet-share-notice { right: 12px; bottom: calc(78px + env(safe-area-inset-bottom)); max-width: calc(100vw - 24px); }
}

@media (prefers-reduced-motion: reduce) {
  .pet-detail-share-button.loading :deep(svg) { animation: none; }
}
</style>
