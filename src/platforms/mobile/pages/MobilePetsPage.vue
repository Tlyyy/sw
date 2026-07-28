<script setup lang="ts">
import AppIcon from "../../../components/AppIcon.vue";
import PetDetail from "../../../components/PetDetail.vue";
import PetRow from "../../../components/PetRow.vue";
import AssetNav from "../../../features/assets/AssetNav.vue";
import { usePetsPage } from "../../../features/assets/usePetsPage";

const page = usePetsPage();
</script>

<template>
  <div class="page-wrap assets-page mobile-pets-page" :class="{ 'has-pet-batch-selection': page.selectedPets.value.length }" data-platform-page="mobile">
    <AssetNav />
    <header class="mobile-asset-head"><div><small>资产库</small><h1>宠物资产</h1></div><button type="button" :disabled="page.batchSharing.value || !page.visible.value.length" @click="page.toggleVisibleSelection">{{ page.allVisibleSelected.value ? "取消当前" : "全选当前" }}</button></header>
    <div class="mobile-pet-filters">
      <input v-model="page.query.value" type="search" placeholder="在宠物、技能、面板和资质中筛选">
      <div><select v-model="page.account.value" aria-label="账号范围"><option value="ALL">全部账号</option><option v-for="item in page.catalog.data.accounts" :key="item.id">{{ item.id }}</option></select><select v-model="page.role.value" aria-label="宠物定位"><option value="ALL">全部定位</option><option v-for="item in page.roles.value" :key="item">{{ item }}</option></select><select v-model="page.status.value" aria-label="确认状态"><option value="ALL">全部状态</option><option value="confirmed">已确认</option><option value="pending">待确认</option></select></div>
      <span>{{ page.visible.value.length }} / {{ page.catalog.pets.length }} 只</span>
    </div>
    <div class="mobile-pet-flow">
      <section v-if="!page.selectedId.value" class="pet-list" aria-label="宠物列表"><PetRow v-for="pet in page.visible.value" :key="pet.id" :pet="pet" :selected="false" selectable actionable :checked="page.publish.selectedIds.includes(pet.id)" @select="page.select" @toggle="page.togglePetSelection" /><div v-if="!page.visible.value.length" class="empty-state">没有匹配的宠物资产</div></section>
      <section v-else-if="page.selected.value" class="mobile-pet-detail"><header><button type="button" @click="page.select('')">← 返回列表</button><strong>{{ page.selected.value.accountId }} · {{ page.selected.value.name }}</strong></header><PetDetail :pet="page.selected.value" /></section>
    </div>
    <aside v-if="page.selectedPets.value.length" class="pet-batch-share-bar" aria-label="批量分享宠物">
      <div class="pet-batch-summary"><strong>{{ page.selectedPets.value.length }} 只宠物</strong><span role="status" aria-live="polite">{{ page.batchNotice.value || (page.batchSharing.value ? page.batchActionLabel.value : "已选") }}</span></div>
      <button class="pet-batch-clear" type="button" :disabled="page.batchSharing.value" @click="page.publish.clear()">清空</button>
      <button class="pet-batch-share-button" :class="{ loading: page.batchSharing.value }" type="button" :disabled="page.batchSharing.value" :aria-busy="page.batchSharing.value" :aria-label="page.batchSharing.value ? page.batchActionLabel.value : `批量分享 ${page.selectedPets.value.length} 只宠物`" @click="page.shareSelectedPets"><AppIcon :name="page.batchSharing.value ? 'refresh' : 'share'" /><span>{{ page.batchActionLabel.value }}</span></button>
    </aside>
  </div>
</template>

<style scoped>
.mobile-pets-page{width:100%;padding:6px 12px 112px}.mobile-asset-head{display:flex;align-items:end;justify-content:space-between;padding:12px 2px}.mobile-asset-head small{color:#c44d00;font-size:11px;font-weight:800}.mobile-asset-head h1{font-size:24px}.mobile-asset-head button{min-height:42px;padding:0 12px;border:1px solid rgba(60,60,67,.15);border-radius:10px;color:#c44d00;background:white}.mobile-pet-filters{display:grid;gap:7px;margin-bottom:10px;padding:10px;border:1px solid rgba(60,60,67,.15);border-radius:12px;background:white}.mobile-pet-filters input{min-height:44px}.mobile-pet-filters>div{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.mobile-pet-filters select{min-width:0;min-height:42px}.mobile-pet-filters>span{color:#697386;font-size:11px;text-align:right}.mobile-pet-flow{display:grid;gap:10px}.mobile-pet-flow>.pet-list,.mobile-pet-detail{overflow:hidden;border:1px solid rgba(60,60,67,.15);border-radius:12px;background:white}.mobile-pet-detail>summary{min-height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;list-style:none}.mobile-pet-detail>summary span{color:#697386;font-size:11px}.mobile-pet-detail :deep(.detail-panel){border:0;border-top:1px solid rgba(60,60,67,.1);border-radius:0}.has-pet-batch-selection{padding-bottom:160px}.pet-batch-share-bar{position:fixed;z-index:46;right:8px;bottom:calc(70px + env(safe-area-inset-bottom));left:8px;min-height:62px;display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:6px;padding:8px 9px;border:1px solid #c44d00;border-radius:11px;background:rgba(255,255,255,.96);box-shadow:0 12px 32px rgba(17,24,39,.2);backdrop-filter:blur(16px)}.pet-batch-summary{min-width:0;display:grid}.pet-batch-summary strong{font-size:12px}.pet-batch-summary span{overflow:hidden;color:#697386;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.pet-batch-clear{min-height:44px;padding:0 8px;border:0;background:transparent}.pet-batch-share-button{min-height:44px;display:flex;align-items:center;gap:6px;padding:0 10px;border:0;border-radius:9px;color:white;background:#c44d00}.pet-batch-share-button svg{width:16px}
.mobile-pet-detail>header{min-height:52px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 12px;border-bottom:1px solid rgba(60,60,67,.1)}.mobile-pet-detail>header button{min-height:40px;padding:0;border:0;color:#c44d00;font-size:12px;background:transparent}.mobile-pet-detail>header strong{overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.mobile-pet-detail :deep(.detail-panel){border-top:0}
</style>
