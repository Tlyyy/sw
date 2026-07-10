<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useCatalogStore } from "../../stores/catalog";
import { useUiStore } from "../../stores/ui";
import { publicAsset } from "../../utils/publicAsset";
const catalog=useCatalogStore();const ui=useUiStore();const kind=ref('ALL');const account=ref(ui.accountScope);const query=ref('');
watch(() => ui.accountScope, (scope) => { account.value = scope; });
const visible=computed(()=>catalog.data.evidence.filter(item=>(kind.value==='ALL'||item.kind===kind.value)&&(account.value==='ALL'||item.accountId===account.value)&&(!query.value||[item.accountId,item.kind,item.capturedAt,item.file,item.sourcePath].join(' ').toLowerCase().includes(query.value.toLowerCase()))));
const label=(value:string)=>({pet:'宠物',equipment:'装备',market:'行情'}[value]||value);
const source=(path:string)=>publicAsset(path);
</script>
<template><div class="page-wrap assets-page"><nav class="subnav"><RouterLink to="/assets/pets">宠物</RouterLink><RouterLink to="/assets/equipment">装备</RouterLink><RouterLink to="/assets/skills">技能</RouterLink><RouterLink to="/assets/evidence">截图证据</RouterLink></nav><section class="page-intro"><div><h2>截图证据</h2><p>事实数据与原始图片一一关联；旧目录仅作为兼容路径。</p></div></section><div class="filter-bar"><input v-model="query" type="search" placeholder="搜索文件、日期或路径"/><select v-model="account"><option value="ALL">全部账号</option><option v-for="item in catalog.data.accounts" :key="item.id">{{item.id}}</option><option value="PUBLIC">公共</option></select><select v-model="kind"><option value="ALL">全部类型</option><option value="pet">宠物</option><option value="equipment">装备</option><option value="market">行情</option></select><span>{{visible.length}} 条</span></div><div class="evidence-list"><article v-for="item in visible" :key="item.id"><span class="account-code">{{item.accountId}}</span><div><strong>{{item.file}}</strong><p>{{item.sourcePath}}</p></div><span>{{label(item.kind)}} · {{item.capturedAt||'旧资料'}}</span><a :href="source(item.sourcePath)" target="_blank">打开</a></article></div></div></template>
