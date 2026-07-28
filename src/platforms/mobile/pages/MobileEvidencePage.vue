<script setup lang="ts">
import AssetNav from "../../../features/assets/AssetNav.vue";
import { useEvidencePage } from "../../../features/assets/useEvidencePage";

const page = useEvidencePage();
</script>

<template>
  <div class="page-wrap assets-page mobile-evidence-page" data-platform-page="mobile">
    <AssetNav />
    <header><small>资产库</small><h1>截图证据</h1><p>{{ page.visible.value.length }} 条原始资料</p></header>
    <div class="mobile-evidence-filter"><input v-model="page.query.value" type="search" placeholder="搜索文件、日期或路径"><div><select v-model="page.account.value" aria-label="证据账号"><option value="ALL">全部账号</option><option v-for="item in page.catalog.data.accounts" :key="item.id">{{ item.id }}</option><option value="PUBLIC">公共</option></select><select v-model="page.kind.value" aria-label="证据类型"><option value="ALL">全部类型</option><option value="pet">宠物</option><option value="equipment">装备</option><option value="market">行情</option></select></div></div>
    <section class="mobile-evidence-list" aria-label="截图证据列表"><article v-for="item in page.visible.value" :key="item.id"><header><span class="account-code">{{ item.accountId }}</span><b>{{ page.label(item.kind) }}</b><time>{{ item.capturedAt || "旧资料" }}</time></header><strong>{{ item.file }}</strong><p>{{ item.sourcePath }}</p><a :href="page.source(item.sourcePath)" target="_blank">打开原图</a></article></section>
  </div>
</template>

<style scoped>
.mobile-evidence-page{width:100%;padding:6px 12px 112px}.mobile-evidence-page>header{padding:12px 2px}.mobile-evidence-page>header small{color:#c44d00;font-size:11px;font-weight:800}.mobile-evidence-page>header h1{font-size:24px}.mobile-evidence-page>header p{color:#697386;font-size:11px}.mobile-evidence-filter{display:grid;gap:7px;margin-bottom:10px;padding:10px;border:1px solid rgba(60,60,67,.15);border-radius:12px;background:white}.mobile-evidence-filter input{min-height:44px}.mobile-evidence-filter>div{display:grid;grid-template-columns:1fr 1fr;gap:7px}.mobile-evidence-filter select{min-width:0;min-height:42px}.mobile-evidence-list{display:grid;gap:8px}.mobile-evidence-list article{padding:12px;border:1px solid rgba(60,60,67,.15);border-radius:12px;background:white}.mobile-evidence-list header{display:flex;align-items:center;gap:7px}.mobile-evidence-list header b,.mobile-evidence-list header time{color:#697386;font-size:11px}.mobile-evidence-list header time{margin-left:auto}.mobile-evidence-list article>strong{display:block;margin-top:9px;font-size:13px;overflow-wrap:anywhere}.mobile-evidence-list article>p{margin-top:3px;color:#8b95a5;font-size:11px;overflow-wrap:anywhere}.mobile-evidence-list article>a{min-height:42px;display:grid;place-items:center;margin-top:9px;border-radius:8px;color:#c44d00;font-size:12px;font-weight:750;text-decoration:none;background:#fff7f0}
</style>
