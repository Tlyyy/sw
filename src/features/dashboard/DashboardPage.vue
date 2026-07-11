<script setup lang="ts">
import { computed } from "vue";
import AccountDeck from "../../components/AccountDeck.vue";
import AccountTimeline from "../../components/AccountTimeline.vue";
import { useCatalogStore } from "../../stores/catalog";
import { useSettingsStore } from "../../stores/settings";
import { buildAccountPlans, buildTaskPlans } from "../../domain/plans";
import { formatCurrency } from "../../domain/gems";
import type { EquipmentAsset, PetView } from "../../domain/types";

const catalog = useCatalogStore();
const settings = useSettingsStore();
const planning = computed(() => settings.snapshot());
const plans = computed(() => buildAccountPlans(catalog.data, catalog.pets, planning.value));
const taskPlans = computed(() => buildTaskPlans(catalog.data, catalog.pets, planning.value));
const slowest = computed(() => plans.value[0]);
const taskCount = computed(() => taskPlans.value.flatMap((item) => item.tasks).filter((item) => !item.done).length);
const shardGap = computed(() => taskPlans.value.reduce((sum, item) => sum + item.missingShardCount, 0));
const totalFunds = computed(() => plans.value.reduce((sum, item) => sum + item.totalSilver, 0));
const eggInventory = computed(() => Object.values(planning.value.resources).reduce((sum, item) => sum + item.eggCount, 0));
const shardInventory = computed(() => Object.values(planning.value.resources).reduce((sum, item) => sum + item.innerShardCount, 0));
const eggTotal = computed(() => eggInventory.value + catalog.beastSummary.eggs);
const shardTotal = computed(() => shardInventory.value + shardGap.value);

const actions = computed(() => [
  { rank: "01", title: `${slowest.value?.accountId} 先补宝石资金`, detail: `预计还需 ${slowest.value?.finishWeek} 周，还差 ${formatCurrency(slowest.value?.gemRequiredSilver || 0)} 银币`, to: "/plans/upgrades", tone: "orange" },
  { rank: "02", title: "按周推进神兽任务", detail: `每周 ${settings.taskSettings.weeklyEggs} 蛋、${settings.taskSettings.weeklyInnerShards} 锁片；当前 ${taskCount.value} 项未完成`, to: "/plans/beasts", tone: "blue" },
  { rank: "03", title: "先核对待确认资料", detail: `${catalog.pets.filter((item) => item.recognitionStatus === "pending").length} 组记录含待确认信息`, to: "/assets/pets?status=pending", tone: "green" },
]);

function bestPet(name: string, metric: "spirit" | "attack") {
  return [...catalog.pets.filter((item) => item.name === name)].sort((a, b) => b[metric] - a[metric])[0];
}

const priorityPets = computed(() => [
  { pet: bestPet("祸斗", "spirit"), label: "灵力", metric: "spirit" as const },
  { pet: bestPet("神兽青蛇", "attack"), label: "攻击", metric: "attack" as const },
  { pet: bestPet("雷司", "attack"), label: "攻击", metric: "attack" as const },
].filter((item): item is { pet: PetView; label: string; metric: "spirit" | "attack" } => Boolean(item.pet)));

const slotOrder = ["武器", "衣服", "项链", "头盔", "腰带", "鞋子"];
const equipmentRows = computed(() => catalog.data.equipment
  .filter((item) => item.accountId === slowest.value?.accountId)
  .sort((a, b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot)));

function gemLevel(item: EquipmentAsset) {
  return Number(String(item.gem.level).match(/\d+/)?.[0] || 0);
}

function gemProgress(item: EquipmentAsset) {
  return `${Math.min(100, Math.max(7, (gemLevel(item) / 13) * 100))}%`;
}

function ringProgress(current: number, total: number) {
  return `${Math.min(100, total ? (current / total) * 100 : 0)}%`;
}
</script>

<template>
  <div class="orbit-dashboard-page">
    <AccountDeck :plans="plans" :selected="slowest?.accountId" :total-funds="totalFunds" />

    <section class="orbit-command-canvas">
      <div class="orbit-decision-panel">
        <div class="decision-summary">
          <h1>今日决策</h1>
          <strong>{{ slowest?.accountId }}</strong>
          <b>预计还需 {{ slowest?.finishWeek }} 周</b>
          <span aria-hidden="true"></span>
          <RouterLink to="/plans/timeline">查看联合时间轴 <i>›</i></RouterLink>
        </div>

        <div class="decision-instrument" aria-label="总资金与资源缺口">
          <div class="instrument-face">
            <div class="instrument-ticks"></div>
            <div class="instrument-center">
              <strong>{{ formatCurrency(totalFunds) }}</strong>
              <span>五号总资金</span>
            </div>
          </div>
          <div class="instrument-foot left"><strong>{{ catalog.beastSummary.eggs }}</strong><span>还差神兽蛋</span><small>{{ catalog.beastSummary.confirmedWan }} 万确认差价</small></div>
          <div class="instrument-foot right"><strong>{{ shardGap }}</strong><span>还差锁片</span><small>{{ taskCount }} 项未完成</small></div>
        </div>
      </div>

      <section class="orbit-action-panel">
        <h2>本周行动</h2>
        <RouterLink v-for="item in actions" :key="item.rank" :to="item.to" class="orbit-action-row" :class="item.tone">
          <b>{{ item.rank }}</b>
          <span><strong>{{ item.title }}</strong><small>{{ item.detail }}</small></span>
          <i>›</i>
        </RouterLink>
      </section>

      <section class="orbit-account-panel">
        <h2>账号状态</h2>
        <div class="orbit-account-table">
          <div class="table-head"><span>账号</span><span>宝石</span><span>神兽</span><span>碎片</span><span>完成</span></div>
          <RouterLink v-for="plan in plans" :key="plan.accountId" :to="`/accounts/${plan.accountId}`">
            <b :class="`account-${plan.accountId.toLowerCase()}`">{{ plan.accountId }}</b>
            <span>{{ formatCurrency(plan.gemRequiredSilver) }}</span>
            <span>{{ formatCurrency(plan.beastRequiredSilver) }}</span>
            <span>{{ plan.missingShardCount || "—" }}</span>
            <strong>还需 {{ plan.finishWeek }} 周</strong>
          </RouterLink>
        </div>
      </section>

      <section class="orbit-timeline-panel">
        <h2>五账号完成时间轴</h2>
        <AccountTimeline :plans="plans" :selected="slowest?.accountId" :start-date="settings.taskSettings.startDate" />
      </section>

      <section class="orbit-data-band">
        <article class="orbit-pet-ledger">
          <header><h2>核心宠物</h2><RouterLink to="/analysis/recommendations">查看分析 ›</RouterLink></header>
          <div class="orbit-pet-head"><span>排名</span><span>宠物名</span><span>角色定位</span><span>主属性</span><span>技能数</span><span>账号</span></div>
          <RouterLink v-for="(item, index) in priorityPets" :key="item.pet.id" :to="`/assets/pets?selected=${encodeURIComponent(item.pet.id)}`" class="orbit-pet-row">
            <b>0{{ index + 1 }}</b>
            <strong>{{ item.pet.name }}</strong>
            <span>{{ item.pet.role.primary }}</span>
            <span>{{ item.label }} {{ item.pet[item.metric] }}</span>
            <span>{{ item.pet.skillCount }} 技能</span>
            <em>{{ item.pet.accountId }}</em>
          </RouterLink>
        </article>

        <article class="orbit-equipment-meter">
          <header><h2>六件装备</h2><RouterLink to="/assets/equipment">查看详情 ›</RouterLink></header>
          <div class="equipment-meter-grid">
            <div v-for="item in equipmentRows" :key="item.id">
              <strong>{{ item.slot }}</strong>
              <span>{{ item.type }}</span>
              <i><b :style="{ height: gemProgress(item) }"></b></i>
              <em>{{ gemLevel(item) }} 级</em>
              <small>{{ item.gem.name }}</small>
            </div>
          </div>
        </article>

        <article class="orbit-beast-gauges">
          <header><h2>神兽任务</h2><RouterLink to="/plans/beasts">查看任务 ›</RouterLink></header>
          <div class="beast-gauge-grid">
            <div class="mini-ring" :style="{ '--ring-progress': ringProgress(eggInventory, eggTotal) }">
              <span><b>{{ eggInventory }}</b><em>/ {{ eggTotal }}</em></span>
              <strong>神兽蛋</strong><small>缺口 {{ catalog.beastSummary.eggs }}</small>
            </div>
            <div class="mini-ring blue" :style="{ '--ring-progress': ringProgress(shardInventory, shardTotal) }">
              <span><b>{{ shardInventory }}</b><em>/ {{ shardTotal }}</em></span>
              <strong>锁片</strong><small>缺口 {{ shardGap }}</small>
            </div>
            <div class="remaining-count"><span>当前剩余</span><strong>{{ taskCount }}</strong><b>项未完成</b></div>
          </div>
        </article>
      </section>
    </section>
  </div>
</template>
