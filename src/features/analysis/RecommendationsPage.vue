<script setup lang="ts">
import { computed, ref } from "vue";
import PetRow from "../../components/PetRow.vue";
import { useCatalogStore } from "../../stores/catalog";
const catalog=useCatalogStore();const query=ref('');const recommendations=computed(()=>catalog.recommendations.map(group=>({...group,rows:group.rows.filter(row=>!query.value||row.searchText.includes(query.value.toLowerCase()))})));
</script>
<template><div class="page-wrap analysis-page"><nav class="subnav"><RouterLink to="/analysis/recommendations">推荐分析</RouterLink><RouterLink to="/analysis/species">同名对比</RouterLink><RouterLink to="/analysis/matrix">固定矩阵</RouterLink></nav><section class="page-intro"><div><h2>四类优先候选</h2><p>推荐只负责缩小查看范围，不替代账号和队伍判断。</p></div><input v-model="query" class="page-search" type="search" placeholder="筛选账号、宠物或技能"/></section><section class="recommendation-board"><article v-for="group in recommendations" :key="group.key"><div class="section-head"><div><h2>{{group.title}}</h2><p>按 {{group.metric}} 从高到低</p></div><span>{{group.rows.length}} 条</span></div><div class="pet-list"><PetRow v-for="pet in group.rows" :key="pet.id" :pet="pet" actionable @select="$router.push(`/assets/pets?selected=${encodeURIComponent(pet.id)}`)"/></div></article></section></div></template>
