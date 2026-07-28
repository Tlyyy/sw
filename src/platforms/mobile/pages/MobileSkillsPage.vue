<script setup lang="ts">
import AssetNav from "../../../features/assets/AssetNav.vue";
import { useSkillsPage } from "../../../features/assets/useSkillsPage";

const page = useSkillsPage();
</script>

<template>
  <div class="page-wrap assets-page mobile-skills-page" data-platform-page="mobile">
    <AssetNav />
    <header><small>资产库</small><h1>技能资料</h1><p>{{ page.visible.value.length }} 个匹配技能</p></header>
    <div class="mobile-skill-toolbar"><div role="tablist" @keydown="page.keyboard"><button v-for="item in page.types" :key="item" :class="{active:page.type.value===item}" role="tab" :aria-selected="page.type.value===item" @click="page.type.value=item">{{ item }} <span>{{ page.counts[item] }}</span></button></div><input v-model="page.query.value" type="search" placeholder="搜索技能名称或备注"></div>
    <section class="skill-grid" aria-label="技能列表"><article v-for="(skill,index) in page.visible.value" :key="skill.name"><img :src="skill.icon" alt="" loading="lazy"><div><strong>{{ skill.name }}</strong><span>{{ skill.type }} · {{ skill.certainty }}</span><p>{{ skill.note }}</p></div><em>{{ index+1 }}</em></article></section>
  </div>
</template>

<style scoped>
.mobile-skills-page{width:100%;padding:6px 12px 112px}.mobile-skills-page>header{padding:12px 2px}.mobile-skills-page>header small{color:#c44d00;font-size:11px;font-weight:800}.mobile-skills-page>header h1{font-size:24px}.mobile-skills-page>header p{color:#697386;font-size:11px}.mobile-skill-toolbar{position:sticky;z-index:30;top:calc(var(--ios-mobile-header-height,68px) + env(safe-area-inset-top));display:grid;gap:7px;margin-bottom:10px;padding:8px;border:1px solid rgba(60,60,67,.15);border-radius:12px;background:rgba(255,255,255,.95)}.mobile-skill-toolbar>div{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:3px;border-radius:9px;background:#eff1f4}.mobile-skill-toolbar button{min-height:38px;border:0;border-radius:7px;font-size:11px;background:transparent}.mobile-skill-toolbar button.active{color:#c44d00;background:white;box-shadow:0 1px 4px rgba(17,24,39,.1)}.mobile-skill-toolbar input{min-height:44px}.mobile-skills-page .skill-grid{grid-template-columns:1fr}.mobile-skills-page .skill-grid article{min-height:74px}
</style>
