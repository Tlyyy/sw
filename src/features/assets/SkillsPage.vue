<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCatalogStore } from "../../stores/catalog";
import { queryChoice, queryText } from "../../app/queryState";
const catalog=useCatalogStore();const route=useRoute();const router=useRouter();
const types=["兽决","御兽","强化技能"] as const;const type=ref(queryChoice(route.query.type,types,"兽决"));const query=ref(queryText(route.query.q));
const visible=computed(()=>catalog.data.skills.filter(item=>item.type===type.value&&(!query.value||[item.name,item.type,item.note,item.certainty].join(' ').toLowerCase().includes(query.value.toLowerCase()))));
const counts=Object.fromEntries(types.map(t=>[t,catalog.data.skills.filter(s=>s.type===t).length]));
watch([type,query],()=>router.replace({query:{type:type.value,...(query.value?{q:query.value}:{})}}));
watch(() => route.query, (value) => {
  type.value = queryChoice(value.type, types, "兽决");
  query.value = queryText(value.q);
}, { deep: true });
function keyboard(event:KeyboardEvent){if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;event.preventDefault();const current=types.indexOf(type.value as typeof types[number]);const next=event.key==='Home'?0:event.key==='End'?types.length-1:event.key==='ArrowRight'?(current+1)%types.length:(current-1+types.length)%types.length;type.value=types[next];}
</script>
<template><div class="page-wrap assets-page"><nav class="subnav"><RouterLink to="/assets/pets">宠物</RouterLink><RouterLink to="/assets/equipment">装备</RouterLink><RouterLink to="/assets/skills">技能</RouterLink><RouterLink to="/assets/evidence">截图证据</RouterLink></nav><section class="page-intro"><div><h2>技能资料</h2><p>{{ catalog.data.skills.length }} 个已确认图标，技能分类与搜索规则统一进入资产库。</p></div></section><div class="skill-toolbar"><div class="segmented" role="tablist" @keydown="keyboard"><button v-for="item in types" :key="item" :class="{active:type===item}" role="tab" :aria-selected="type===item" @click="type=item">{{item}} <span>{{counts[item]}}</span></button></div><input v-model="query" type="search" placeholder="搜索技能名称或备注"/></div><div class="skill-grid"><article v-for="(skill,index) in visible" :key="skill.name"><img :src="skill.icon" alt="" loading="lazy"/><div><strong>{{skill.name}}</strong><span>{{skill.type}} · {{skill.certainty}}</span><p>{{skill.note}}</p></div><em>{{index+1}}</em></article></div></div></template>
