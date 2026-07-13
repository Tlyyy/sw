<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import PetRow from "../../components/PetRow.vue";
import PetDetail from "../../components/PetDetail.vue";
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
</script>

<template>
  <div class="page-wrap assets-page">
    <nav class="subnav"><RouterLink to="/assets/pets">宠物</RouterLink><RouterLink to="/assets/equipment">装备</RouterLink><RouterLink to="/assets/skills">技能</RouterLink><RouterLink to="/assets/evidence">截图证据</RouterLink></nav>
    <section class="page-intro"><div><h2>宠物资产</h2><p>{{ catalog.pets.length }} 组宠物的统一事实目录；筛选保存在 URL，详情不再重复铺满页面。</p></div><button class="button" @click="publish.select(visible.map(item=>item.id))">当前 {{ visible.length }} 组加入发布</button></section>
    <div class="filter-bar"><input v-model="query" type="search" placeholder="在宠物、技能、面板和资质中筛选" /><select v-model="account" aria-label="账号范围"><option value="ALL">全部账号</option><option v-for="item in catalog.data.accounts" :key="item.id">{{item.id}}</option></select><select v-model="role"><option value="ALL">全部定位</option><option v-for="item in roles" :key="item">{{item}}</option></select><select v-model="status"><option value="ALL">全部状态</option><option value="confirmed">已确认</option><option value="pending">待确认</option></select><span>{{ visible.length }} / {{ catalog.pets.length }}</span></div>
    <div class="asset-split"><div class="pet-list"><PetRow v-for="pet in visible" :key="pet.id" :pet="pet" :selected="selected?.id === pet.id" selectable actionable :checked="publish.selectedIds.includes(pet.id)" @select="select" @toggle="publish.toggle" /><div v-if="!visible.length" class="empty-state">没有匹配的宠物资产</div></div><PetDetail v-if="selected" :pet="selected" /></div>
  </div>
</template>
