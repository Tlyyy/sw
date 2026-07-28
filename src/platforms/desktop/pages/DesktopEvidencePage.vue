<script setup lang="ts">
import AssetNav from "../../../features/assets/AssetNav.vue";
import { useEvidencePage } from "../../../features/assets/useEvidencePage";

const page = useEvidencePage();
</script>

<template>
  <div class="page-wrap assets-page desktop-evidence-page" data-platform-page="desktop">
    <AssetNav />
    <section class="page-intro"><div><p>PC 证据索引</p><h2>截图证据</h2><span>事实数据与原始图片一一关联；旧目录仅作为兼容路径。</span></div></section>
    <div class="filter-bar"><input v-model="page.query.value" type="search" placeholder="搜索文件、日期或路径"><select v-model="page.account.value"><option value="ALL">全部账号</option><option v-for="item in page.catalog.data.accounts" :key="item.id">{{ item.id }}</option><option value="PUBLIC">公共</option></select><select v-model="page.kind.value"><option value="ALL">全部类型</option><option value="pet">宠物</option><option value="equipment">装备</option><option value="market">行情</option></select><span>{{ page.visible.value.length }} 条</span></div>
    <div class="evidence-list"><article v-for="item in page.visible.value" :key="item.id"><span class="account-code">{{ item.accountId }}</span><div><strong>{{ item.file }}</strong><p>{{ item.sourcePath }}</p></div><span>{{ page.label(item.kind) }} · {{ item.capturedAt || "旧资料" }}</span><a :href="page.source(item.sourcePath)" target="_blank">打开</a></article></div>
  </div>
</template>

<style scoped>
.desktop-evidence-page{padding-top:10px;padding-bottom:56px}.desktop-evidence-page>.page-intro p{color:var(--color-accent-strong);font-size:11px;font-weight:850}.desktop-evidence-page>.page-intro span{color:var(--color-text-muted);font-size:12px}
</style>
