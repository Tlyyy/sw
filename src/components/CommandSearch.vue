<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useCatalogStore } from "../stores/catalog";
import { useUiStore } from "../stores/ui";

const ui = useUiStore();
const catalog = useCatalogStore();
const router = useRouter();
const query = ref("");
const input = ref<HTMLInputElement>();
const pages = [
  ["今日决策", "/"], ["宠物资产", "/assets/pets"], ["装备资产", "/assets/equipment"], ["技能资料", "/assets/skills"], ["升级计划", "/plans/upgrades"], ["神兽计划", "/plans/beasts"], ["固定矩阵", "/analysis/matrix"], ["内容发布", "/publish"], ["数据中心", "/data/market"], ["界面设置", "/settings"],
];
const results = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return pages.slice(0, 7).map(([label, path]) => ({ label, meta: "页面", path }));
  const pageRows = pages.filter(([label]) => label.toLowerCase().includes(q)).map(([label, path]) => ({ label, meta: "页面", path }));
  const accountRows = catalog.data.accounts.filter((item) => item.label.toLowerCase().includes(q)).map((item) => ({ label: `${item.label} 账号`, meta: "账号", path: `/accounts/${item.id}` }));
  const petRows = catalog.pets.filter((item) => item.searchText.includes(q)).slice(0, 8).map((item) => ({ label: `${item.accountId} · ${item.name}`, meta: item.role.primary, path: `/assets/pets?account=${item.accountId}&selected=${encodeURIComponent(item.id)}` }));
  const skillRows = catalog.data.skills.filter((item) => `${item.name} ${item.type}`.toLowerCase().includes(q)).slice(0, 6).map((item) => ({ label: item.name, meta: item.type, path: `/assets/skills?q=${encodeURIComponent(item.name)}` }));
  return [...pageRows, ...accountRows, ...petRows, ...skillRows].slice(0, 14);
});
watch(() => ui.commandOpen, async (open) => { if (open) { query.value = ""; await nextTick(); input.value?.focus(); } });
function open(path: string) { router.push(path); ui.commandOpen = false; }
</script>

<template>
  <Teleport to="body">
    <div v-if="ui.commandOpen" class="command-backdrop" @click.self="ui.commandOpen = false">
      <section class="command-dialog" role="dialog" aria-modal="true" aria-label="全局搜索">
        <label class="command-input"><span>⌕</span><input ref="input" v-model="query" placeholder="搜索账号、宠物、装备、技能或页面" @keydown.esc="ui.commandOpen = false" /></label>
        <div class="command-results">
          <button v-for="item in results" :key="item.path + item.label" @click="open(item.path)"><span>{{ item.label }}</span><small>{{ item.meta }}</small></button>
          <p v-if="!results.length">没有匹配结果</p>
        </div>
        <footer><span>Enter 打开</span><span>Esc 关闭</span></footer>
      </section>
    </div>
  </Teleport>
</template>
