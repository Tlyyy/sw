<script setup lang="ts">
import { computed, watchEffect } from "vue";
import { useRoute } from "vue-router";
import StatStrip from "../../components/StatStrip.vue";
import PetRow from "../../components/PetRow.vue";
import { useCatalogStore } from "../../stores/catalog";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";
import { buildAccountPlans, buildTaskPlans } from "../../domain/plans";
import { accountGemPlan, formatCurrency } from "../../domain/gems";
import type { AccountId } from "../../domain/types";

const route = useRoute(); const catalog = useCatalogStore(); const settings = useSettingsStore(); const ui = useUiStore();
const accountId = computed(() => String(route.params.accountId || "LG2") as AccountId);
watchEffect(() => { ui.recentAccount = accountId.value; ui.accountScope = accountId.value; });
const pets = computed(() => catalog.pets.filter((item) => item.accountId === accountId.value));
const equipment = computed(() => catalog.data.equipment.filter((item) => item.accountId === accountId.value));
const plan = computed(() => buildAccountPlans(catalog.data, catalog.pets, settings.snapshot()).find((item) => item.accountId === accountId.value)!);
const beastPlan = computed(() => buildTaskPlans(catalog.data, catalog.pets, settings.snapshot()).find((item) => item.accountId === accountId.value)!);
const gemPlan = computed(() => accountGemPlan(catalog.data, accountId.value, settings.gemPriceOverrides));
const topPets = computed(() => [...pets.value].sort((a,b) => (b.talent || 0) - (a.talent || 0) || b.attack - a.attack).slice(0,4));
</script>

<template>
  <div class="page-wrap account-page">
    <section class="page-intro"><div><h2>{{ accountId }} 账号</h2><p>把宠物、装备、神兽任务和完成时间放进同一个账号上下文。</p></div><div class="account-switch"><RouterLink v-for="account in catalog.data.accounts" :key="account.id" :to="`/accounts/${account.id}`" :class="{ active: account.id === accountId }">{{ account.id }}</RouterLink></div></section>
    <StatStrip :items="[{value:pets.length,label:'宠物资产',note:`神兽 ${pets.filter(p=>p.role.tags.includes('神兽')).length}`},{value:equipment.length,label:'装备',note:`宝石还差 ${gemPlan.gap.toLocaleString('zh-CN')} 颗`},{value:formatCurrency(plan.totalSilver),label:'还需银币',note:`宝石 ${formatCurrency(plan.gemRequiredSilver)}`},{value:`${plan.finishWeek} 周`,label:'预计还需',note:plan.finishDate}]" />
    <section class="split-workspace">
      <div><div class="section-head"><div><h2>优先宠物</h2><p>按天资和输出面板优先展示</p></div><RouterLink :to="`/assets/pets?account=${accountId}`">全部宠物 →</RouterLink></div><div class="pet-list"><PetRow v-for="pet in topPets" :key="pet.id" :pet="pet" /></div></div>
      <div><div class="section-head"><div><h2>任务与资源</h2><p>库存抵扣后还需 {{ formatCurrency(plan.beastRequiredSilver) }} 银币</p></div><RouterLink to="/plans/beasts">打开计划 →</RouterLink></div><div class="resource-line"><span>银子 <b>{{ beastPlan.resource.silverWan }}万</b></span><span>神兽蛋 <b>{{ beastPlan.resource.eggCount }}</b></span><span>锁片 <b>{{ beastPlan.resource.innerShardCount }}</b></span></div><div class="task-mini-list"><div v-for="task in beastPlan.tasks.slice(0,6)" :key="task.id"><i :class="{done:task.done}"></i><span>{{ task.typeLabel }} · {{ task.actionLabel }}</span><b>{{ task.done ? '已完成' : task.dueDate }}</b></div></div></div>
    </section>
    <section><div class="section-head"><div><h2>六件装备</h2><p>到 13 段还需 {{ formatCurrency(gemPlan.cost) }} 银币</p></div><RouterLink :to="`/assets/equipment?account=${accountId}`">查看截图与属性 →</RouterLink></div><div class="equipment-strip"><article v-for="item in equipment" :key="item.id"><span>{{ item.slot }}</span><strong>{{ item.name }}</strong><em>{{ item.gem.name }} {{ item.gem.level }}</em></article></div></section>
  </div>
</template>
