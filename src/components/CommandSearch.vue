<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { commandPages } from "../app/navigation";
import { useCatalogStore } from "../stores/catalog";
import { useUiStore } from "../stores/ui";
import AppIcon from "./AppIcon.vue";

const ui = useUiStore();
const catalog = useCatalogStore();
const router = useRouter();
const query = ref("");
const input = ref<HTMLInputElement>();
const dialog = ref<HTMLElement>();
const resultButtons = ref<HTMLButtonElement[]>([]);
const closeButton = ref<HTMLButtonElement>();
let previousFocus: HTMLElement | null = null;
let previousBodyOverflow = "";
let backgroundShell: HTMLElement | null = null;
let backgroundWasInert = false;

function restoreBackground() {
  if (backgroundShell && !backgroundWasInert) backgroundShell.removeAttribute("inert");
  backgroundShell = null;
  backgroundWasInert = false;
}

const results = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return commandPages.slice(0, 8).map(([label, path]) => ({ label, meta: "页面", path }));
  const pageRows = commandPages.filter(([label]) => label.toLowerCase().includes(q)).map(([label, path]) => ({ label, meta: "页面", path }));
  const accountRows = catalog.data.accounts.filter((item) => `${item.id} ${item.label} 账号 详情 单号`.toLowerCase().includes(q)).map((item) => ({ label: `${item.id} · 账号详情`, meta: "账号", path: `/accounts/${item.id}` }));
  const petRows = catalog.pets.filter((item) => item.searchText.includes(q)).slice(0, 8).map((item) => ({ label: `${item.accountId} · ${item.name}`, meta: item.role.primary, path: `/assets/pets?account=${item.accountId}&selected=${encodeURIComponent(item.id)}` }));
  const equipmentRows = catalog.data.equipment.filter((item) => [item.accountId, item.slot, item.name, item.type, item.gem.name, item.gem.level, ...item.attributes, ...item.effects].join(" ").toLowerCase().includes(q)).slice(0, 8).map((item) => ({ label: `${item.accountId} · ${item.name}`, meta: `${item.slot} · ${item.gem.name}`, path: `/assets/equipment?account=${item.accountId}&q=${encodeURIComponent(item.name)}` }));
  const skillRows = catalog.data.skills.filter((item) => `${item.name} ${item.type}`.toLowerCase().includes(q)).slice(0, 6).map((item) => ({ label: item.name, meta: item.type, path: `/assets/skills?type=${encodeURIComponent(item.type)}&q=${encodeURIComponent(item.name)}` }));
  return [...pageRows, ...accountRows, ...petRows, ...equipmentRows, ...skillRows].slice(0, 18);
});

watch(() => ui.commandOpen, async (open) => {
  if (open) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    backgroundShell = document.querySelector<HTMLElement>(".orbit-shell");
    backgroundWasInert = backgroundShell?.hasAttribute("inert") || false;
    backgroundShell?.setAttribute("inert", "");
    query.value = "";
    await nextTick();
    input.value?.focus();
    return;
  }

  document.body.style.overflow = previousBodyOverflow;
  restoreBackground();
  await nextTick();
  previousFocus?.focus();
  previousFocus = null;
});

watch(results, async () => {
  await nextTick();
  resultButtons.value = resultButtons.value.slice(0, results.value.length);
});

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow;
  restoreBackground();
});

function close() {
  ui.commandOpen = false;
}

function open(path: string) {
  void router.push(path);
  close();
}

function focusResult(index: number) {
  const count = resultButtons.value.length;
  if (!count) return;
  resultButtons.value[Math.max(0, Math.min(index, count - 1))]?.focus();
}

function keyboard(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
    return;
  }

  const focusables = [input.value, ...resultButtons.value, closeButton.value].filter(Boolean) as HTMLElement[];
  if (event.key === "Tab" && focusables.length) {
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
    return;
  }

  const currentIndex = resultButtons.value.findIndex((button) => button === document.activeElement);
  if (event.key === "ArrowDown") {
    event.preventDefault();
    focusResult(currentIndex < 0 ? 0 : (currentIndex + 1) % resultButtons.value.length);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    if (currentIndex <= 0) input.value?.focus();
    else focusResult(currentIndex - 1);
  } else if (event.key === "Home" && currentIndex >= 0) {
    event.preventDefault();
    focusResult(0);
  } else if (event.key === "End" && currentIndex >= 0) {
    event.preventDefault();
    focusResult(resultButtons.value.length - 1);
  } else if (event.key === "Enter" && document.activeElement === input.value && results.value[0]) {
    event.preventDefault();
    open(results.value[0].path);
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="ui.commandOpen" class="command-backdrop" @mousedown.self="close">
      <section ref="dialog" class="command-dialog" role="dialog" aria-modal="true" aria-labelledby="command-search-title" @keydown="keyboard">
        <h2 id="command-search-title" class="visually-hidden">全局搜索</h2>
        <label class="command-input" for="command-search-input">
          <AppIcon name="search" aria-hidden="true" />
          <input id="command-search-input" ref="input" v-model="query" type="search" autocomplete="off" aria-controls="command-search-results" placeholder="搜索账号、宠物、装备、技能或页面" />
        </label>
        <div id="command-search-results" class="command-results" aria-live="polite">
          <button
            v-for="(item, index) in results"
            :key="item.path + item.label"
            :ref="(element) => { if (element) resultButtons[index] = element as HTMLButtonElement; }"
            type="button"
            @click="open(item.path)"
          ><span>{{ item.label }}</span><small>{{ item.meta }}</small></button>
          <p v-if="!results.length">没有匹配结果</p>
        </div>
        <footer>
          <span>↑↓ 选择 · Enter 打开</span>
          <button ref="closeButton" type="button" class="command-close" @click="close">关闭</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
