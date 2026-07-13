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
  ["行动推进台", "/"],
  ["宠物资产", "/assets/pets"],
  ["装备资产", "/assets/equipment"],
  ["技能资料", "/assets/skills"],
  ["截图证据", "/assets/evidence"],
  ["神兽主线任务", "/plans/beasts"],
  ["五号主线概览", "/plans/timeline"],
  ["宝石升级参考", "/plans/upgrades"],
  ["推荐分析", "/analysis/recommendations"],
  ["同名宠物对比", "/analysis/species"],
  ["固定矩阵", "/analysis/matrix"],
  ["内容发布", "/publish"],
  ["库存快照", "/data/inventory"],
  ["宝石行情", "/data/market"],
  ["神兽任务维护", "/data/tasks"],
  ["数据来源", "/data/sources"],
  ["界面设置与备份", "/settings"],
] as const;
const results = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return pages.slice(0, 8).map(([label, path]) => ({ label, meta: "页面", path }));
  const pageRows = pages.filter(([label]) => label.toLowerCase().includes(q)).map(([label, path]) => ({ label, meta: "页面", path }));
  const accountRows = catalog.data.accounts.filter((item) => `${item.id} ${item.label} 账号 单号`.toLowerCase().includes(q)).map((item) => ({ label: `${item.id} · 单号下钻`, meta: "账号", path: `/accounts/${item.id}` }));
  const petRows = catalog.pets.filter((item) => item.searchText.includes(q)).slice(0, 8).map((item) => ({ label: `${item.accountId} · ${item.name}`, meta: item.role.primary, path: `/assets/pets?account=${item.accountId}&selected=${encodeURIComponent(item.id)}` }));
  const equipmentRows = catalog.data.equipment.filter((item) => [item.accountId, item.slot, item.name, item.type, item.gem.name, item.gem.level, ...item.attributes, ...item.effects].join(" ").toLowerCase().includes(q)).slice(0, 8).map((item) => ({ label: `${item.accountId} · ${item.name}`, meta: `${item.slot} · ${item.gem.name}`, path: `/assets/equipment?account=${item.accountId}&q=${encodeURIComponent(item.name)}` }));
  const skillRows = catalog.data.skills.filter((item) => `${item.name} ${item.type}`.toLowerCase().includes(q)).slice(0, 6).map((item) => ({ label: item.name, meta: item.type, path: `/assets/skills?q=${encodeURIComponent(item.name)}` }));
  return [...pageRows, ...accountRows, ...petRows, ...equipmentRows, ...skillRows].slice(0, 18);
});
watch(() => ui.commandOpen, async (open) => { if (open) { query.value = ""; await nextTick(); input.value?.focus(); } });
function open(path: string) { router.push(path); ui.commandOpen = false; }
function keyboard(event: KeyboardEvent) {
  if (event.key === "Enter" && results.value[0]) {
    event.preventDefault();
    open(results.value[0].path);
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="ui.commandOpen" class="command-backdrop" @click.self="ui.commandOpen = false">
      <section class="command-dialog" role="dialog" aria-modal="true" aria-label="全局搜索">
        <label class="command-input"><span>⌕</span><input ref="input" v-model="query" placeholder="搜索账号、宠物、装备、技能或页面" @keydown="keyboard" @keydown.esc="ui.commandOpen = false" /></label>
        <div class="command-results">
          <button v-for="item in results" :key="item.path + item.label" @click="open(item.path)"><span>{{ item.label }}</span><small>{{ item.meta }}</small></button>
          <p v-if="!results.length">没有匹配结果</p>
        </div>
        <footer><span>Enter 打开</span><span>Esc 关闭</span></footer>
      </section>
    </div>
  </Teleport>
</template>
