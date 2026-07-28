<script setup lang="ts">
import AssetNav from "../../../features/assets/AssetNav.vue";
import { useSkillsPage } from "../../../features/assets/useSkillsPage";

const page = useSkillsPage();
</script>

<template>
  <div class="page-wrap assets-page desktop-skills-page" data-platform-page="desktop">
    <AssetNav />
    <section class="page-intro"><div><p>PC 技能索引</p><h2>技能资料</h2><span>{{ page.catalog.data.skills.length }} 个已确认图标，按分类和关键词快速检索。</span></div></section>
    <div class="skill-toolbar"><div class="segmented" role="tablist" @keydown="page.keyboard"><button v-for="item in page.types" :key="item" :class="{active:page.type.value===item}" role="tab" :aria-selected="page.type.value===item" @click="page.type.value=item">{{ item }} <span>{{ page.counts[item] }}</span></button></div><input v-model="page.query.value" type="search" placeholder="搜索技能名称或备注"></div>
    <div class="skill-grid"><article v-for="(skill,index) in page.visible.value" :key="skill.name"><img :src="skill.icon" alt="" loading="lazy"><div><strong>{{ skill.name }}</strong><span>{{ skill.type }} · {{ skill.certainty }}</span><p>{{ skill.note }}</p></div><em>{{ index+1 }}</em></article></div>
  </div>
</template>

<style scoped>
.desktop-skills-page{padding-top:10px;padding-bottom:56px}.desktop-skills-page>.page-intro p{color:var(--color-accent-strong);font-size:11px;font-weight:850}.desktop-skills-page>.page-intro span{color:var(--color-text-muted);font-size:12px}
</style>
