<script setup lang="ts">
import PlansNav from "../../../features/plans/PlansNav.vue";
import { useBeastsPage } from "../../../features/plans/useBeastsPage";

const page = useBeastsPage();
</script>

<template>
  <div class="page-wrap plan-page mobile-beasts-page" data-platform-page="mobile">
    <PlansNav />
    <header><small>主线任务</small><h1>神兽推进</h1><p>先看账号状态，再处理当前筛选下的任务。</p></header>
    <section class="mobile-beast-status"><RouterLink v-for="item in page.projections.value" :key="item.accountId" :to="`/accounts/${item.accountId}`"><b>{{ item.accountId }}</b><div><strong>{{ item.statusLabel }}</strong><span>{{ item.inventory.dedicatedEggs }} 专用 / {{ item.inventory.regularEggs }} 普通蛋</span></div><em>{{ item.inventory.silverWan }} 万</em></RouterLink></section>
    <form class="mobile-beast-filters" aria-label="神兽任务筛选" @submit.prevent><label><span>账号</span><select v-model="page.account.value" aria-label="神兽任务账号筛选"><option value="ALL">全部账号</option><option v-for="item in page.catalog.data.accounts" :key="item.id" :value="item.id">{{ item.id }}</option></select></label><label><span>用途</span><select v-model="page.type.value" aria-label="神兽任务用途筛选"><option value="ALL">全部用途</option><option v-for="item in page.availableTaskTypes.value" :key="item.key" :value="item.key">{{ item.label }}</option></select></label></form>
    <section class="mobile-beast-tasks"><header><h2>任务清单</h2><RouterLink to="/plans/tasks">维护状态</RouterLink></header><article v-for="task in page.tasks.value" :key="task.id" :class="{ done: task.done }"><i></i><div><strong>{{ task.accountId }} · {{ task.typeLabel }}</strong><span>{{ task.actionLabel }} · {{ task.kind }}</span></div><b>{{ task.done ? "已完成" : task.shardCount ? `${task.shardCount}片` : task.eggCount ? `${task.eggCount}蛋` : page.formatWan(task.priceWan) }}</b></article><p v-if="!page.tasks.value.length">当前筛选没有任务。</p></section>
    <RouterLink class="mobile-inventory-action" to="/data/inventory">查看与录入五号库存</RouterLink>
  </div>
</template>

<style scoped>
.mobile-beasts-page{width:100%;padding:6px 12px 112px}.mobile-beasts-page>header{padding:12px 2px}.mobile-beasts-page>header small{color:#c44d00;font-size:11px;font-weight:850}.mobile-beasts-page>header h1{font-size:25px}.mobile-beasts-page>header p{color:#697386;font-size:12px}.mobile-beast-status{overflow:hidden;border:1px solid rgba(60,60,67,.15);border-radius:12px;background:#fff}.mobile-beast-status>a{min-height:61px;display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:8px;padding:9px 11px;border-bottom:1px solid rgba(60,60,67,.1)}.mobile-beast-status>a:last-child{border:0}.mobile-beast-status>a>b{color:#a9430c}.mobile-beast-status div{display:grid;gap:3px}.mobile-beast-status strong{font-size:13px}.mobile-beast-status span{font-size:10px;color:#697386}.mobile-beast-status em{font-size:11px;font-style:normal;font-weight:800}.mobile-beast-filters{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}.mobile-beast-filters label{display:grid;gap:4px}.mobile-beast-filters span{font-size:10px;color:#697386}.mobile-beast-filters select{min-height:44px}.mobile-beast-tasks{overflow:hidden;border:1px solid rgba(60,60,67,.15);border-radius:12px;background:#fff}.mobile-beast-tasks>header{min-height:52px;display:flex;align-items:center;justify-content:space-between;padding:9px 11px;background:#faf8f5}.mobile-beast-tasks h2{font-size:16px}.mobile-beast-tasks header a{color:#a9430c;font-size:12px;font-weight:800}.mobile-beast-tasks article{min-height:62px;display:grid;grid-template-columns:8px minmax(0,1fr) auto;align-items:center;gap:9px;padding:9px 11px;border-top:1px solid rgba(60,60,67,.1)}.mobile-beast-tasks article>i{width:7px;height:7px;border-radius:50%;background:#e88a2d}.mobile-beast-tasks article.done{opacity:.55}.mobile-beast-tasks article.done>i{background:#27836a}.mobile-beast-tasks article>div{display:grid;gap:3px}.mobile-beast-tasks article strong,.mobile-beast-tasks article>b{font-size:12px}.mobile-beast-tasks article span{color:#697386;font-size:10px}.mobile-beast-tasks>p{padding:24px;text-align:center;color:#697386;font-size:12px}.mobile-inventory-action{display:flex;align-items:center;justify-content:center;min-height:46px;margin-top:10px;border:1px solid rgba(60,60,67,.15);border-radius:11px;background:#fff;font-size:13px;font-weight:800}
.mobile-beast-status span,
.mobile-beast-filters span,
.mobile-beast-tasks article span { font-size: 11px; }
</style>
