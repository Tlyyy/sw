<script setup lang="ts">
import { computed } from "vue";
import { useCatalogStore } from "../stores/catalog";
import type { PetView } from "../domain/types";
import { publicAsset } from "../utils/publicAsset";
const props = defineProps<{ pet: PetView }>();
const catalog = useCatalogStore();
const evidence = computed(() => props.pet.evidenceIds.map((id) => catalog.evidenceById.get(id)).filter(Boolean));
const webPath = (path?: string) => path ? publicAsset(path) : "";
</script>
<template>
  <aside class="detail-panel">
    <header><div><span>{{ pet.accountId }} · {{ pet.role.primary }}</span><h2>{{ pet.name }}</h2><p>{{ pet.meta }}</p></div><strong>{{ pet.skillCount }} 技能</strong></header>
    <div class="detail-shots"><a v-for="shot in evidence" :key="shot!.id" :href="webPath(shot!.sourcePath)" target="_blank"><img :src="webPath(shot!.sourcePath)" :alt="`${pet.name} 截图`" /><span>{{ shot!.capturedAt || shot!.file }}</span></a></div>
    <section><h3>核心判断</h3><p>{{ pet.role.advice }}</p><div class="skill-list"><span v-for="tag in pet.role.tags" :key="tag">{{ tag }}</span></div></section>
    <section class="detail-numbers"><div v-for="group in [{ title:'面板', rows:pet.panel },{ title:'属性点', rows:pet.points },{ title:'资质 / 寿命', rows:pet.aptitudes },{ title:'养成', rows:pet.growth }]" :key="group.title"><h3>{{ group.title }}</h3><p v-for="row in group.rows" :key="row[0]"><span>{{ row[0] }}</span><b>{{ row[1] }}</b></p></div></section>
    <section><h3>完整技能</h3><div class="skill-list"><span v-for="skill in pet.skills.filter(item => item !== '空')" :key="skill">{{ skill.replace(/^小/, '低级') }}</span></div></section>
  </aside>
</template>
