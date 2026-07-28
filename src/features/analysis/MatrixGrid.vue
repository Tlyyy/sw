<script setup lang="ts">
import type { useMatrixPage } from "./useMatrixPage";
defineProps<{ page: ReturnType<typeof useMatrixPage> }>();
</script>
<template>
  <div class="matrix-scroll" role="tabpanel" :aria-labelledby="`matrix-group-${page.groupIndex.value}`" :aria-label="`${page.group.value}五账号固定矩阵`" tabindex="0">
    <table class="matrix-table" :class="page.ui.matrixDensity">
      <caption>当前分类：{{ page.group.value }}；显示 {{ page.visibleFieldCount.value }} 类信息；{{ page.filledCount.value }} / {{ page.totalSlots.value }} 个位置已匹配。</caption>
      <thead><tr><th class="matrix-position-head" scope="col">位置</th><th v-for="account in page.accounts" :key="account" scope="col"><b :class="`account-${account.toLowerCase()}`">{{ account }}</b><small>账号</small></th></tr></thead>
      <tbody><tr v-for="row in page.rows.value" :key="row.column.key"><th scope="row"><strong>{{ row.column.label }}</strong><span>{{ page.groupCopy[page.group.value].short }}</span></th><td v-for="(pet,index) in row.accounts" :key="page.accounts[index]" :class="{ empty: !pet }"><template v-if="pet"><RouterLink class="matrix-pet-head" :to="`/assets/pets?selected=${encodeURIComponent(pet.id)}`"><span><strong>{{ pet.name }}</strong><em :class="`tone-${pet.role.tone || 'default'}`">{{ pet.role.primary }}</em></span><small>查看详情 ›</small></RouterLink><dl v-if="page.ui.matrixDisplay.stats" class="matrix-stat-grid"><div v-for="stat in page.statsFor(pet)" :key="stat.key" :class="{ best: page.isBest(row.accounts,pet,stat.key) }"><dt>{{ stat.label }}</dt><dd>{{ stat.value }}</dd><small v-if="page.isBest(row.accounts,pet,stat.key)">最高</small></div></dl><dl v-if="page.ui.matrixDisplay.aptitudes" class="matrix-apt"><div v-for="item in page.aptitudesFor(pet)" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div></dl><div v-if="page.ui.matrixDisplay.skills" class="matrix-skills" aria-label="前五个技能"><span v-for="skill in page.visibleSkills(pet)" :key="skill">{{ skill }}</span><small v-if="!page.visibleSkills(pet).length">暂无技能记录</small></div></template><div v-else class="matrix-empty"><strong>未匹配</strong><span>当前规则下没有对应宠物</span></div></td></tr></tbody>
    </table>
  </div>
</template>
