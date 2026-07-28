<script setup lang="ts">
import PetRow from "../../../components/PetRow.vue";
import StatStrip from "../../../components/StatStrip.vue";
import { useAccountPage } from "../../../features/accounts/useAccountPage";

const page = useAccountPage();
</script>

<template>
  <div class="page-wrap account-page desktop-account-page" data-platform-page="desktop">
    <section class="page-intro">
      <div><p>PC 账号工作台</p><h2>{{ page.accountId.value }} 账号详情</h2><span>排期基准 {{ page.planningStartDate.value }}，横向查看任务、库存与资产。</span></div>
      <div class="account-switch"><RouterLink v-for="account in page.catalog.data.accounts" :key="account.id" :to="`/accounts/${account.id}`" :class="{ active: account.id === page.accountId.value }">{{ account.id }}</RouterLink></div>
    </section>
    <StatStrip :items="[{value:page.projection.value.inventory.dedicatedEggs,label:'专用蛋',note:'任务时优先消耗'},{value:page.projection.value.inventory.regularEggs,label:'普通蛋',note:'优先留作任务，仅紧急出售'},{value:`${page.projection.value.inventory.silverWan}万`,label:'银子',note:page.projection.value.effectiveDate ? `${page.projection.value.effectiveDate} 库存` : '待录库存快照'},{value:page.projection.value.statusLabel,label:'当前状态',note:page.projection.value.actionHint}]" />
    <section class="split-workspace">
      <div>
        <div class="section-head"><div><h2>优先宠物</h2><p>按天资和输出面板优先展示</p></div><RouterLink :to="`/assets/pets?account=${page.accountId.value}`">全部宠物 →</RouterLink></div>
        <div class="pet-list"><PetRow v-for="pet in page.topPets.value" :key="pet.id" :pet="pet" /></div>
      </div>
      <div>
        <div class="section-head"><div><h2>主线任务与资源</h2><p>{{ page.projection.value.actionHint }}</p><small class="account-mainline-finish">{{ page.mainlineFinishLabel() }}</small></div><RouterLink to="/data/inventory">更新库存 →</RouterLink></div>
        <div class="resource-line"><span>专用蛋 <b>{{ page.projection.value.inventory.dedicatedEggs }}</b></span><span>普通蛋 <b>{{ page.projection.value.inventory.regularEggs }}</b></span><span>内丹碎片 <b>{{ page.projection.value.inventory.innerShardCount ?? "待补录" }}</b></span></div>
        <div class="task-mini-list"><div v-for="task in page.visibleTasks.value" :key="task.id"><i :class="{done:task.done}"></i><span class="task-mini-copy"><span>{{ task.typeLabel }} · {{ task.actionLabel }} · {{ page.taskAmount(task) }}</span><small>{{ page.taskDueLabel(task) }}</small></span><b>{{ page.taskState(task) }}</b></div></div>
      </div>
    </section>
    <section class="desktop-equipment-section">
      <div class="section-head"><div><h2>六件装备 · 次级参考</h2><p>神兽主线后再处理；当前到 13 段测算约 {{ page.formatCurrency(page.gemPlan.value.cost) }} 银币</p></div><RouterLink :to="`/assets/equipment?account=${page.accountId.value}`">查看截图与属性 →</RouterLink></div>
      <div class="equipment-strip"><article v-for="item in page.equipment.value" :key="item.id"><span>{{ item.slot }}</span><strong>{{ item.name }}</strong><em>{{ item.gem.name }} {{ item.gem.level }}</em></article></div>
    </section>
  </div>
</template>

<style scoped>
.desktop-account-page{padding-top:14px;padding-bottom:56px}.desktop-account-page>.page-intro{align-items:flex-end}.desktop-account-page>.page-intro>div:first-child>p{color:var(--color-accent-strong);font-size:11px;font-weight:850;letter-spacing:.08em}.desktop-account-page>.page-intro>div:first-child>span{display:block;margin-top:4px;color:var(--color-text-muted);font-size:12px}.desktop-equipment-section{margin-top:16px}
</style>
