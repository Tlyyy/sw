<script setup lang="ts">
import PetRow from "../../../components/PetRow.vue";
import AnalysisNav from "../../../features/analysis/AnalysisNav.vue";
import { useRecommendationsPage } from "../../../features/analysis/useRecommendationsPage";
const page = useRecommendationsPage();
</script>
<template><div class="page-wrap analysis-page desktop-recommendations-page" data-platform-page="desktop"><AnalysisNav /><section class="page-intro"><div><h2>四类优先候选</h2><p>推荐只负责缩小查看范围，不替代账号和队伍判断。</p></div><input v-model="page.query.value" class="page-search" type="search" placeholder="筛选账号、宠物或技能"></section><section class="recommendation-board"><article v-for="group in page.recommendations.value" :key="group.key"><div class="section-head"><div><h2>{{ group.title }}</h2><p>按 {{ group.metric }} 从高到低</p></div><span>{{ group.rows.length }} 条</span></div><div class="pet-list"><PetRow v-for="pet in group.rows" :key="pet.id" :pet="pet" actionable @select="$router.push(`/assets/pets?selected=${encodeURIComponent(pet.id)}`)" /></div></article></section></div></template>
