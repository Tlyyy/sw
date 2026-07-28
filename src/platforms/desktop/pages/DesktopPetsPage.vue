<script setup lang="ts">
import AppIcon from "../../../components/AppIcon.vue";
import PetDetail from "../../../components/PetDetail.vue";
import PetRow from "../../../components/PetRow.vue";
import AssetNav from "../../../features/assets/AssetNav.vue";
import { usePetsPage } from "../../../features/assets/usePetsPage";

const page = usePetsPage();
</script>

<template>
  <div class="page-wrap assets-page desktop-pets-page" :class="{ 'has-pet-batch-selection': page.selectedPets.value.length }" data-platform-page="desktop">
    <AssetNav />
    <section class="page-intro">
      <div><p>PC 宠物资料库</p><h2>宠物资产</h2><span>{{ page.catalog.pets.length }} 组宠物，左侧筛选选择，右侧持续查看详情。</span></div>
      <div class="pet-page-actions"><span v-if="page.selectedPets.value.length" class="pet-selected-count">已选 {{ page.selectedPets.value.length }} 只</span><button class="button" type="button" :disabled="page.batchSharing.value || !page.visible.value.length" @click="page.toggleVisibleSelection">{{ page.allVisibleSelected.value ? "取消当前" : "全选当前" }}</button></div>
    </section>
    <div class="filter-bar"><input v-model="page.query.value" type="search" placeholder="在宠物、技能、面板和资质中筛选"><select v-model="page.account.value" aria-label="账号范围"><option value="ALL">全部账号</option><option v-for="item in page.catalog.data.accounts" :key="item.id">{{ item.id }}</option></select><select v-model="page.role.value"><option value="ALL">全部定位</option><option v-for="item in page.roles.value" :key="item">{{ item }}</option></select><select v-model="page.status.value"><option value="ALL">全部状态</option><option value="confirmed">已确认</option><option value="pending">待确认</option></select><span>{{ page.visible.value.length }} / {{ page.catalog.pets.length }}</span></div>
    <div class="asset-split"><div class="pet-list"><PetRow v-for="pet in page.visible.value" :key="pet.id" :pet="pet" :selected="page.selected.value?.id === pet.id" selectable actionable :checked="page.publish.selectedIds.includes(pet.id)" @select="page.select" @toggle="page.togglePetSelection" /><div v-if="!page.visible.value.length" class="empty-state">没有匹配的宠物资产</div></div><PetDetail v-if="page.selected.value" :pet="page.selected.value" /></div>
    <aside v-if="page.selectedPets.value.length" class="pet-batch-share-bar" aria-label="批量分享宠物">
      <div class="pet-batch-summary"><strong>{{ page.selectedPets.value.length }} 只宠物</strong><span role="status" aria-live="polite">{{ page.batchNotice.value || (page.batchSharing.value ? page.batchActionLabel.value : "已选") }}</span></div>
      <button class="pet-batch-clear" type="button" :disabled="page.batchSharing.value" @click="page.publish.clear()">清空</button>
      <button class="pet-batch-share-button" :class="{ loading: page.batchSharing.value }" type="button" :disabled="page.batchSharing.value" :aria-busy="page.batchSharing.value" :aria-label="page.batchSharing.value ? page.batchActionLabel.value : `批量分享 ${page.selectedPets.value.length} 只宠物`" @click="page.shareSelectedPets"><AppIcon :name="page.batchSharing.value ? 'refresh' : 'share'" /><span>{{ page.batchActionLabel.value }}</span></button>
    </aside>
  </div>
</template>

<style scoped>
.desktop-pets-page{padding-top:10px;padding-bottom:56px}.desktop-pets-page>.page-intro>div:first-child>p{color:var(--color-accent-strong);font-size:11px;font-weight:850;letter-spacing:.08em}.desktop-pets-page>.page-intro>div:first-child>span{color:var(--color-text-muted);font-size:12px}.pet-page-actions{display:flex;align-items:center;gap:10px}.pet-selected-count{color:var(--color-accent-strong);font-size:13px;font-weight:800}.has-pet-batch-selection{padding-bottom:138px}.pet-batch-share-bar{position:fixed;z-index:46;right:24px;bottom:24px;width:min(510px,calc(100vw - 48px));min-height:66px;display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--color-accent);border-radius:11px;background:var(--color-surface);box-shadow:0 14px 40px rgba(3,18,31,.2)}.pet-batch-summary{min-width:0;display:grid}.pet-batch-summary span{color:var(--color-text-muted);font-size:12px}.pet-batch-clear{min-height:42px;border:0;background:transparent}.pet-batch-share-button{min-height:44px;display:flex;align-items:center;gap:7px;padding:0 13px;border:0;border-radius:8px;color:white;background:var(--color-accent)}.pet-batch-share-button svg{width:17px}
</style>
