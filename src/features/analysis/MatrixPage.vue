<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCatalogStore } from "../../stores/catalog";
import { useUiStore } from "../../stores/ui";
import { matrixAccountIds, matrixGroups, matrixRow } from "../../domain/matrix";
import type { PetView } from "../../domain/types";
import { queryChoice } from "../../app/queryState";

type ComparableMetric = "attack" | "speed" | "spirit" | "hp";

const catalog = useCatalogStore();
const ui = useUiStore();
const route = useRoute();
const router = useRouter();
const routeGroup = queryChoice(route.query.group, matrixGroups, matrixGroups[0]);
const group = ref(routeGroup);
const accounts = matrixAccountIds;

const rows = computed(() => matrixRow(catalog.pets, group.value));
const totalSlots = computed(() => rows.value.length * accounts.length);
const filledCount = computed(() => rows.value.reduce((sum, row) => sum + row.accounts.filter(Boolean).length, 0));
const missingCount = computed(() => totalSlots.value - filledCount.value);
const coverageRate = computed(() => totalSlots.value ? Math.round((filledCount.value / totalSlots.value) * 100) : 0);
const visibleFieldCount = computed(() => Object.values(ui.matrixDisplay).filter(Boolean).length);
const groupIndex = computed(() => matrixGroups.indexOf(group.value));

const groupCopy: Record<string, { short: string; description: string }> = {
  "日常": { short: "日常", description: "祸斗、雷司与九头鸟的五号配置" },
  "PK：神兽蛇 / 小马": { short: "神兽蛇 / 小马", description: "剑气蛇、追影蛇、法蛇与小马" },
  "PK：法系 / 特殊 / 物理": { short: "法系 / 特殊 / 物理", description: "跨账号核对法系、特殊与物理位置" },
  "PK：速度": { short: "速度", description: "速度位置的五号横向比较" },
};

watch(group, (value) => {
  void router.replace({ query: { ...route.query, group: value } });
});
watch(() => route.query.group, (value) => {
  group.value = queryChoice(value, matrixGroups, matrixGroups[0]);
});

function groupRowCount(value: string) {
  return matrixRow(catalog.pets, value).length;
}

function statsFor(pet: PetView) {
  return [
    { key: "attack" as const, label: "攻击", value: pet.attack },
    { key: "speed" as const, label: "速度", value: pet.speed },
    { key: "spirit" as const, label: "灵力", value: pet.spirit },
    { key: "hp" as const, label: "气血", value: pet.hp },
  ];
}

function aptitudesFor(pet: PetView) {
  return [
    { label: "攻资", value: pet.attackApt },
    { label: "防资", value: pet.defenseApt },
    { label: "体资", value: pet.staminaApt },
    { label: "法资", value: pet.magicApt },
    { label: "速资", value: pet.speedApt },
  ];
}

function visibleSkills(pet: PetView) {
  return pet.skills.filter((skill) => skill !== "空").slice(0, 5);
}

function isBest(rowPets: Array<PetView | undefined>, pet: PetView, metric: ComparableMetric) {
  const values = rowPets.filter((item): item is PetView => Boolean(item)).map((item) => item[metric]);
  return values.length > 1 && pet[metric] === Math.max(...values);
}
</script>

<template>
  <div class="page-wrap analysis-page matrix-page">
    <nav class="subnav" aria-label="分析页面">
      <RouterLink to="/analysis/recommendations">推荐分析</RouterLink>
      <RouterLink to="/analysis/species">同名对比</RouterLink>
      <RouterLink to="/analysis/matrix">固定矩阵</RouterLink>
    </nav>

    <section class="page-intro matrix-intro">
      <div>
        <h1>五账号固定矩阵</h1>
        <p>按相同位置横向比较五个账号。高亮每行面板最高值，并把未匹配位置明确标出。</p>
        <small class="matrix-data-date">数据日期 {{ catalog.data.generatedAt.slice(0, 10) }}</small>
      </div>
      <div class="matrix-coverage" aria-label="当前分组覆盖率">
        <strong>{{ coverageRate }}%</strong>
        <span>{{ filledCount }} / {{ totalSlots }} 个位置已匹配</span>
      </div>
    </section>

    <section class="matrix-summary" aria-live="polite" aria-label="当前矩阵摘要">
      <article><span>当前分类</span><strong>{{ groupCopy[group].short }}</strong><small>{{ groupCopy[group].description }}</small></article>
      <article><span>位置类型</span><strong>{{ rows.length }}</strong><small>全部矩阵共 15 个位置</small></article>
      <article><span>已匹配</span><strong>{{ filledCount }}</strong><small>按当前分类规则命中</small></article>
      <article :class="{ warning: missingCount }"><span>未匹配</span><strong>{{ missingCount }}</strong><small>{{ missingCount ? "需要核对资产或角色标签" : "当前分类五号齐全" }}</small></article>
    </section>

    <section class="matrix-control-panel" aria-label="固定矩阵筛选">
      <div class="matrix-group-tabs" role="tablist" aria-label="阵容分类">
        <button
          v-for="(item, index) in matrixGroups"
          :id="`matrix-group-${index}`"
          :key="item"
          type="button"
          role="tab"
          :aria-selected="group === item"
          :tabindex="group === item ? 0 : -1"
          :class="{ active: group === item }"
          @click="group = item"
        >
          <span>{{ item }}</span>
          <small aria-hidden="true">{{ groupRowCount(item) }} 个位置</small>
        </button>
      </div>

      <fieldset class="matrix-options">
        <legend>显示内容</legend>
        <label><input v-model="ui.matrixDisplay.stats" type="checkbox" /><span>属性</span></label>
        <label><input v-model="ui.matrixDisplay.aptitudes" type="checkbox" /><span>资质</span></label>
        <label><input v-model="ui.matrixDisplay.skills" type="checkbox" /><span>技能</span></label>
        <label class="matrix-density-field">
          <span>显示密度</span>
          <select v-model="ui.matrixDensity" aria-label="矩阵显示密度">
            <option value="compact">紧凑</option>
            <option value="comfortable">舒展</option>
          </select>
        </label>
      </fieldset>
    </section>

    <p class="matrix-scroll-hint">可左右滚动；账号表头和位置列会保持可见。</p>
    <div
      class="matrix-scroll"
      role="tabpanel"
      :aria-labelledby="`matrix-group-${groupIndex}`"
      :aria-label="`${group}五账号固定矩阵`"
      tabindex="0"
    >
      <table class="matrix-table" :class="ui.matrixDensity">
        <caption>当前分类：{{ group }}；显示 {{ visibleFieldCount }} 类信息；{{ filledCount }} / {{ totalSlots }} 个位置已匹配。</caption>
        <thead>
          <tr>
            <th class="matrix-position-head" scope="col">位置</th>
            <th v-for="account in accounts" :key="account" scope="col">
              <b :class="`account-${account.toLowerCase()}`">{{ account }}</b>
              <small>账号</small>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.column.key">
            <th scope="row">
              <strong>{{ row.column.label }}</strong>
              <span>{{ groupCopy[group].short }}</span>
            </th>
            <td v-for="(pet, index) in row.accounts" :key="accounts[index]" :class="{ empty: !pet }">
              <template v-if="pet">
                <RouterLink class="matrix-pet-head" :to="`/assets/pets?selected=${encodeURIComponent(pet.id)}`">
                  <span><strong>{{ pet.name }}</strong><em :class="`tone-${pet.role.tone || 'default'}`">{{ pet.role.primary }}</em></span>
                  <small>查看详情 ›</small>
                </RouterLink>

                <dl v-if="ui.matrixDisplay.stats" class="matrix-stat-grid">
                  <div v-for="stat in statsFor(pet)" :key="stat.key" :class="{ best: isBest(row.accounts, pet, stat.key) }">
                    <dt>{{ stat.label }}</dt><dd>{{ stat.value }}</dd>
                    <small v-if="isBest(row.accounts, pet, stat.key)">最高</small>
                  </div>
                </dl>

                <dl v-if="ui.matrixDisplay.aptitudes" class="matrix-apt">
                  <div v-for="item in aptitudesFor(pet)" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
                </dl>

                <div v-if="ui.matrixDisplay.skills" class="matrix-skills" aria-label="前五个技能">
                  <span v-for="skill in visibleSkills(pet)" :key="skill">{{ skill }}</span>
                  <small v-if="!visibleSkills(pet).length">暂无技能记录</small>
                </div>
              </template>
              <div v-else class="matrix-empty">
                <strong>未匹配</strong>
                <span>当前规则下没有对应宠物</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
