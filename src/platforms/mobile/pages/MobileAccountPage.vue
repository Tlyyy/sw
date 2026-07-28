<script setup lang="ts">
import PetRow from "../../../components/PetRow.vue";
import { useAccountPage } from "../../../features/accounts/useAccountPage";

const page = useAccountPage();
</script>

<template>
  <div class="page-wrap account-page mobile-account-page" data-platform-page="mobile">
    <header class="mobile-account-head">
      <div><small>账号详情</small><h1>{{ page.accountId.value }}</h1><p>{{ page.projection.value.statusLabel }} · {{ page.projection.value.actionHint }}</p></div>
      <nav aria-label="切换账号"><RouterLink v-for="account in page.catalog.data.accounts" :key="account.id" :to="`/accounts/${account.id}`" :class="{ active: account.id === page.accountId.value }">{{ account.id }}</RouterLink></nav>
    </header>
    <section class="mobile-account-metrics" aria-label="当前资源">
      <div><span>银子</span><strong>{{ page.projection.value.inventory.silverWan }} 万</strong></div>
      <div><span>专用蛋</span><strong>{{ page.projection.value.inventory.dedicatedEggs }}</strong></div>
      <div><span>普通蛋</span><strong>{{ page.projection.value.inventory.regularEggs }}</strong></div>
      <div><span>碎片</span><strong>{{ page.projection.value.inventory.innerShardCount ?? "待补" }}</strong></div>
    </section>
    <section class="split-workspace">
      <div class="mobile-mainline-card">
        <div class="section-head"><div><h2>主线任务与资源</h2><p>{{ page.mainlineFinishLabel() }}</p></div><RouterLink to="/data/inventory">更新库存 →</RouterLink></div>
        <div class="task-mini-list"><div v-for="task in page.visibleTasks.value" :key="task.id"><i :class="{done:task.done}"></i><span class="task-mini-copy"><span>{{ task.typeLabel }} · {{ task.actionLabel }}</span><small>{{ page.taskDueLabel(task) }} · {{ page.taskAmount(task) }}</small></span><b>{{ page.taskState(task) }}</b></div></div>
      </div>
      <div class="mobile-pet-card">
        <div class="section-head"><div><h2>优先宠物</h2><p>天资与面板优先</p></div><RouterLink :to="`/assets/pets?account=${page.accountId.value}`">查看全部 →</RouterLink></div>
        <div class="pet-list"><PetRow v-for="pet in page.topPets.value" :key="pet.id" :pet="pet" /></div>
      </div>
    </section>
    <details class="mobile-equipment-card">
      <summary><strong>六件装备</strong><span>到 13 段约 {{ page.formatCurrency(page.gemPlan.value.cost) }} <b>›</b></span></summary>
      <div class="equipment-strip"><article v-for="item in page.equipment.value" :key="item.id"><span>{{ item.slot }}</span><strong>{{ item.name }}</strong><em>{{ item.gem.name }} {{ item.gem.level }}</em></article></div>
      <RouterLink :to="`/assets/equipment?account=${page.accountId.value}`">查看截图与属性</RouterLink>
    </details>
  </div>
</template>

<style scoped>
.mobile-account-page{width:100%;padding:8px 12px 112px}.mobile-account-head{padding:4px 2px 12px}.mobile-account-head small{color:#c44d00;font-size:11px;font-weight:800}.mobile-account-head h1{font-size:28px}.mobile-account-head p{color:#697386;font-size:12px}.mobile-account-head nav{display:flex;gap:6px;overflow-x:auto;margin-top:11px}.mobile-account-head nav a{min-width:58px;min-height:42px;display:grid;place-items:center;border:1px solid rgba(60,60,67,.15);border-radius:10px;color:#344054;font-size:12px;font-weight:750;text-decoration:none;background:white}.mobile-account-head nav a.active{border-color:#c44d00;color:#c44d00;background:#fff7f0}.mobile-account-metrics{display:grid;grid-template-columns:repeat(4,1fr);overflow:hidden;margin-bottom:10px;border:1px solid rgba(60,60,67,.15);border-radius:12px;background:white}.mobile-account-metrics div{padding:11px 5px;border-right:1px solid rgba(60,60,67,.1);text-align:center}.mobile-account-metrics div:last-child{border:0}.mobile-account-metrics span{display:block;color:#8b95a5;font-size:11px}.mobile-account-metrics strong{display:block;margin-top:3px;font-size:13px}.mobile-account-page .split-workspace{display:flex;flex-direction:column;gap:10px}.mobile-account-page .split-workspace>div,.mobile-equipment-card{overflow:hidden;border:1px solid rgba(60,60,67,.15);border-radius:12px;background:white}.mobile-account-page .section-head{padding:12px}.mobile-mainline-card{order:1}.mobile-pet-card{order:2}.mobile-equipment-card{margin-top:10px}.mobile-equipment-card summary{min-height:54px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;list-style:none}.mobile-equipment-card summary span{color:#697386;font-size:11px}.mobile-equipment-card>.equipment-strip{padding:0 10px 10px}.mobile-equipment-card>a{min-height:44px;display:grid;place-items:center;border-top:1px solid rgba(60,60,67,.1);color:#c44d00;font-size:12px;font-weight:750;text-decoration:none}
</style>
