<script setup lang="ts">
import PlansNav from "../../../features/plans/PlansNav.vue";
import { useTimelinePage } from "../../../features/plans/useTimelinePage";

const page = useTimelinePage();
</script>
<template>
  <div class="page-wrap plan-page mobile-timeline-page" data-platform-page="mobile">
    <PlansNav />
    <header><small>五号总览</small><h1>主线状态</h1><p>每张卡片只保留当前任务、资源和下一步。</p></header>
    <section class="mobile-timeline-list"><RouterLink v-for="item in page.projections.value" :key="item.accountId" :to="`/accounts/${item.accountId}`"><header><b>{{ item.accountId }}</b><strong>{{ item.statusLabel }}</strong></header><div><span>当前任务</span><b>{{ item.currentTask ? `${item.currentTask.typeLabel} · ${item.currentTask.actionLabel}` : "主线已完成" }}</b></div><dl><div><dt>专用 / 普通蛋</dt><dd>{{ item.inventory.dedicatedEggs }} / {{ item.inventory.regularEggs }}</dd></div><div><dt>银子</dt><dd>{{ item.inventory.silverWan }} 万</dd></div><div><dt>内丹碎片</dt><dd>{{ item.inventory.innerShardCount ?? "待补录" }}</dd></div></dl><footer><span>下一步</span><strong>{{ item.actionHint }}</strong></footer></RouterLink></section>
  </div>
</template>
<style scoped>
.mobile-timeline-page{width:100%;padding:6px 12px 112px}.mobile-timeline-page>header{padding:12px 2px}.mobile-timeline-page>header small{color:#c44d00;font-size:11px;font-weight:850}.mobile-timeline-page>header h1{font-size:25px}.mobile-timeline-page>header p{color:#697386;font-size:12px}.mobile-timeline-list{display:grid;gap:9px}.mobile-timeline-list>a{overflow:hidden;border:1px solid rgba(60,60,67,.15);border-radius:12px;background:#fff}.mobile-timeline-list>a>header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#faf8f5}.mobile-timeline-list>a>header>b{color:#a9430c}.mobile-timeline-list>a>header>strong{font-size:12px}.mobile-timeline-list>a>div{display:grid;gap:4px;padding:11px 12px}.mobile-timeline-list span,.mobile-timeline-list dt{color:#697386;font-size:10px}.mobile-timeline-list>a>div>b{font-size:14px}.mobile-timeline-list dl{display:grid;grid-template-columns:repeat(3,1fr);margin:0;padding:0 12px 11px}.mobile-timeline-list dl>div{display:grid;gap:3px}.mobile-timeline-list dd{margin:0;font-size:12px;font-weight:800}.mobile-timeline-list footer{display:grid;grid-template-columns:52px 1fr;align-items:center;gap:7px;padding:9px 12px;border-top:1px solid rgba(60,60,67,.1);background:#fff9f4}.mobile-timeline-list footer strong{color:#8d3a0f;font-size:12px}
.mobile-timeline-list span,
.mobile-timeline-list dt { font-size: 11px; }
</style>
