<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onBeforeUpdate,
  ref,
  watch,
} from "vue";
import { useRouter } from "vue-router";
import { commandPages } from "../app/navigation";
import { useVisualViewport } from "../composables/useVisualViewport";
import { useCatalogStore } from "../stores/catalog";
import { useUiStore } from "../stores/ui";
import AppIcon from "./AppIcon.vue";

type SearchKind = "page" | "account" | "pet" | "equipment" | "skill";

interface SearchResult {
  kind: SearchKind;
  icon: string;
  label: string;
  detail: string;
  meta: string;
  path: string;
  score: number;
}

interface SearchGroup {
  key: string;
  label: string;
  items: Array<SearchResult & { resultIndex: number }>;
}

const RECENT_SEARCH_KEY = "sw.command-search.recent";
const kindOrder: SearchKind[] = ["account", "pet", "equipment", "skill", "page"];
const kindLabels: Record<SearchKind, string> = {
  page: "页面",
  account: "账号",
  pet: "宠物",
  equipment: "装备",
  skill: "技能",
};

const quickResults: SearchResult[] = [
  { kind: "page", icon: "home", label: "今日", detail: "首页与本周节奏", meta: "常用", path: "/", score: 0 },
  { kind: "page", icon: "plus", label: "录入", detail: "库存、支出与行情", meta: "常用", path: "/record", score: 0 },
  { kind: "page", icon: "plan", label: "任务", detail: "按账号处理待办", meta: "常用", path: "/plans/tasks", score: 0 },
  { kind: "page", icon: "report", label: "周报", detail: "查看本周收支", meta: "常用", path: "/week", score: 0 },
  { kind: "page", icon: "assets", label: "资料", detail: "宠物、装备与技能", meta: "常用", path: "/resources", score: 0 },
  { kind: "page", icon: "analysis", label: "核算", detail: "实际所得核算", meta: "常用", path: "/earnings", score: 0 },
];

const ui = useUiStore();
const catalog = useCatalogStore();
const router = useRouter();
const query = ref("");
const input = ref<HTMLInputElement>();
const dialog = ref<HTMLElement>();
const resultButtons = ref<HTMLButtonElement[]>([]);
const recentQueries = ref(readRecentQueries());
const { keyboardOpen, visualViewportStyle } = useVisualViewport("command-search");
let previousFocus: HTMLElement | null = null;
let previousBodyOverflow = "";
let backgroundShell: HTMLElement | null = null;
let backgroundWasInert = false;

function readRecentQueries() {
  try {
    const value = JSON.parse(window.localStorage.getItem(RECENT_SEARCH_KEY) || "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 4)
      : [];
  } catch {
    return [];
  }
}

function persistRecentQueries() {
  try {
    window.localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(recentQueries.value));
  } catch {
    // Search still works when storage is unavailable.
  }
}

function rememberQuery() {
  const value = query.value.trim();
  if (!value) return;
  recentQueries.value = [value, ...recentQueries.value.filter((item) => item !== value)].slice(0, 4);
  persistRecentQueries();
}

function clearRecentQueries() {
  recentQueries.value = [];
  persistRecentQueries();
}

function restoreBackground() {
  if (backgroundShell && !backgroundWasInert) backgroundShell.removeAttribute("inert");
  backgroundShell = null;
  backgroundWasInert = false;
}

function routeIcon(path: string) {
  if (path === "/") return "home";
  if (path === "/record") return "plus";
  if (path.includes("/plans/")) return "plan";
  if (path.includes("/assets/") || path === "/resources") return "assets";
  if (path.includes("/week")) return "report";
  if (path.includes("/earnings") || path.includes("/analysis/")) return "analysis";
  if (path.includes("/settings") || path.includes("/data/")) return "settings";
  if (path.includes("/publish")) return "publish";
  return "search";
}

function routeDetail(path: string) {
  if (path === "/") return "首页与本周节奏";
  if (path === "/record") return "库存、支出与行情";
  if (path === "/plans/tasks") return "按账号处理待办";
  if (path === "/week") return "本周收入、支出与结余";
  if (path === "/resources") return "资料总览";
  if (path.startsWith("/assets/")) return "资产资料";
  if (path.startsWith("/plans/")) return "计划工具";
  if (path.startsWith("/analysis/")) return "分析工具";
  if (path.startsWith("/data/")) return "数据中心";
  return "页面";
}

function matchScore(value: string, q: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === q) return 0;
  if (normalized.split(/[\s·/，、_-]+/).includes(q)) return 1;
  if (normalized.startsWith(q)) return 2;
  return normalized.includes(q) ? 3 : Number.POSITIVE_INFINITY;
}

function rankedResult(
  result: Omit<SearchResult, "score">,
  searchText: string,
  q: string,
) {
  const score = matchScore(searchText, q);
  return Number.isFinite(score) ? { ...result, score } : null;
}

const normalizedQuery = computed(() => query.value.trim().toLowerCase());
const hasQuery = computed(() => normalizedQuery.value.length > 0);

const results = computed<SearchResult[]>(() => {
  const q = normalizedQuery.value;
  if (!q) return quickResults;

  const pageRows = commandPages
    .map(([label, path]) => rankedResult({
      kind: "page",
      icon: routeIcon(path),
      label,
      detail: routeDetail(path),
      meta: "页面",
      path,
    }, label, q))
    .filter((item): item is SearchResult => item !== null)
    .slice(0, 8);

  const accountRows = catalog.data.accounts
    .map((item) => rankedResult({
      kind: "account",
      icon: "account",
      label: `${item.id} · 账号详情`,
      detail: item.label || "账号详情",
      meta: "账号",
      path: `/accounts/${item.id}`,
    }, `${item.id} ${item.label} 账号 详情 单号`, q))
    .filter((item): item is SearchResult => item !== null)
    .slice(0, 5);

  const petRows = catalog.pets
    .map((item) => rankedResult({
      kind: "pet",
      icon: "assets",
      label: `${item.accountId} · ${item.name}`,
      detail: item.role.primary,
      meta: "宠物",
      path: `/assets/pets?account=${item.accountId}&selected=${encodeURIComponent(item.id)}`,
    }, item.searchText, q))
    .filter((item): item is SearchResult => item !== null)
    .slice(0, 6);

  const equipmentRows = catalog.data.equipment
    .map((item) => rankedResult({
      kind: "equipment",
      icon: "assets",
      label: `${item.accountId} · ${item.name}`,
      detail: `${item.slot} · ${item.gem.name}`,
      meta: "装备",
      path: `/assets/equipment?account=${item.accountId}&q=${encodeURIComponent(item.name)}`,
    }, [
      item.accountId,
      item.slot,
      item.name,
      item.type,
      item.gem.name,
      item.gem.level,
      ...item.attributes,
      ...item.effects,
    ].join(" "), q))
    .filter((item): item is SearchResult => item !== null)
    .slice(0, 6);

  const skillRows = catalog.data.skills
    .map((item) => rankedResult({
      kind: "skill",
      icon: "analysis",
      label: item.name,
      detail: item.type,
      meta: "技能",
      path: `/assets/skills?type=${encodeURIComponent(item.type)}&q=${encodeURIComponent(item.name)}`,
    }, `${item.name} ${item.type}`, q))
    .filter((item): item is SearchResult => item !== null)
    .slice(0, 6);

  return [...accountRows, ...petRows, ...equipmentRows, ...skillRows, ...pageRows]
    .sort((left, right) => (
      left.score - right.score
      || kindOrder.indexOf(left.kind) - kindOrder.indexOf(right.kind)
      || left.label.localeCompare(right.label, "zh-CN")
    ))
    .slice(0, 24);
});

const resultGroups = computed<SearchGroup[]>(() => {
  if (!hasQuery.value) {
    return [{
      key: "quick",
      label: "快速前往",
      items: results.value.map((item, resultIndex) => ({ ...item, resultIndex })),
    }];
  }

  const grouped = kindOrder
    .map((kind) => {
      const items = results.value.filter((item) => item.kind === kind);
      return {
        kind,
        score: Math.min(...items.map((item) => item.score)),
        items,
      };
    })
    .filter((group) => group.items.length > 0)
    .sort((left, right) => left.score - right.score || kindOrder.indexOf(left.kind) - kindOrder.indexOf(right.kind));

  let resultIndex = 0;
  return grouped.map((group) => ({
    key: group.kind,
    label: kindLabels[group.kind],
    items: group.items.map((item) => ({ ...item, resultIndex: resultIndex++ })),
  }));
});

const firstResult = computed(() => resultGroups.value[0]?.items[0]);
const statusText = computed(() => {
  if (!hasQuery.value) return "页面、账号和资产，一次查找";
  if (!results.value.length) return "没有匹配内容";
  return `${results.value.length} 个匹配结果`;
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

onBeforeUpdate(() => {
  resultButtons.value = [];
});

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow;
  restoreBackground();
});

function close() {
  ui.commandOpen = false;
}

function open(path: string) {
  rememberQuery();
  void router.push(path);
  close();
}

function useSuggestion(value: string) {
  query.value = value;
  void nextTick(() => input.value?.focus());
}

function clearQuery() {
  query.value = "";
  void nextTick(() => input.value?.focus());
}

function focusResult(index: number) {
  const buttons = resultButtons.value.filter(Boolean);
  if (!buttons.length) return;
  buttons[Math.max(0, Math.min(index, buttons.length - 1))]?.focus();
}

function keyboard(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
    return;
  }

  const focusables = Array.from(
    dialog.value?.querySelectorAll<HTMLElement>("input, button:not([disabled])") || [],
  ).filter((element) => element.getClientRects().length > 0);
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

  const buttons = resultButtons.value.filter(Boolean);
  const currentIndex = buttons.findIndex((button) => button === document.activeElement);
  if (event.key === "ArrowDown" && buttons.length) {
    event.preventDefault();
    focusResult(currentIndex < 0 ? 0 : (currentIndex + 1) % buttons.length);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    if (currentIndex <= 0) input.value?.focus();
    else focusResult(currentIndex - 1);
  } else if (event.key === "Home" && currentIndex >= 0) {
    event.preventDefault();
    focusResult(0);
  } else if (event.key === "End" && currentIndex >= 0) {
    event.preventDefault();
    focusResult(buttons.length - 1);
  } else if (event.key === "Enter" && document.activeElement === input.value && firstResult.value) {
    event.preventDefault();
    open(firstResult.value.path);
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="command-search">
      <div
        v-if="ui.commandOpen"
        class="command-backdrop"
        :class="{ 'is-keyboard-open': keyboardOpen }"
        :style="visualViewportStyle"
        @click.self="close"
      >
        <section
          ref="dialog"
          class="command-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="command-search-title"
          @keydown="keyboard"
        >
          <h2 id="command-search-title" class="visually-hidden">全局搜索</h2>

          <header class="command-mobile-head">
            <span>万象册</span>
            <strong>搜索</strong>
            <small>{{ statusText }}</small>
          </header>

          <div
            id="command-search-results"
            class="command-results"
            :class="{ 'is-suggestions': !hasQuery }"
            aria-live="polite"
          >
            <section v-if="!hasQuery && recentQueries.length" class="command-recent">
              <header>
                <strong>最近搜索</strong>
                <button type="button" @click="clearRecentQueries">清除</button>
              </header>
              <div>
                <button
                  v-for="item in recentQueries"
                  :key="item"
                  type="button"
                  @click="useSuggestion(item)"
                >
                  <AppIcon name="search" aria-hidden="true" />
                  <span>{{ item }}</span>
                </button>
              </div>
            </section>

            <section
              v-for="group in resultGroups"
              :key="group.key"
              class="command-result-group"
            >
              <header class="command-result-group-label">
                <strong>{{ group.label }}</strong>
                <span>{{ group.items.length }}</span>
              </header>
              <div class="command-result-card">
                <button
                  v-for="item in group.items"
                  :key="item.path + item.label"
                  :ref="(element) => { if (element) resultButtons[item.resultIndex] = element as HTMLButtonElement; }"
                  type="button"
                  @click="open(item.path)"
                >
                  <span class="command-result-icon" aria-hidden="true">
                    <AppIcon :name="item.icon" />
                  </span>
                  <span class="command-result-copy">
                    <strong>{{ item.label }}</strong>
                    <small>{{ item.detail }}</small>
                  </span>
                  <small class="command-result-meta">{{ item.meta }}</small>
                  <AppIcon class="command-result-chevron" name="chevron-right" aria-hidden="true" />
                </button>
              </div>
            </section>

            <section v-if="hasQuery && !results.length" class="command-empty">
              <span aria-hidden="true"><AppIcon name="search" /></span>
              <strong>没有找到“{{ query.trim() }}”</strong>
              <p>试试账号、宠物、装备或技能关键词。</p>
              <div>
                <button type="button" @click="useSuggestion('FC')">FC</button>
                <button type="button" @click="useSuggestion('宠物')">宠物</button>
                <button type="button" @click="useSuggestion('技能')">技能</button>
              </div>
            </section>
          </div>

          <div class="command-search-toolbar">
            <label class="command-input" for="command-search-input">
              <AppIcon name="search" aria-hidden="true" />
              <input
                id="command-search-input"
                ref="input"
                v-model="query"
                type="search"
                autocomplete="off"
                aria-controls="command-search-results"
                placeholder="搜索账号、宠物、装备、技能或页面"
              />
              <button
                v-if="query"
                type="button"
                class="command-clear"
                aria-label="清空搜索"
                @click.prevent="clearQuery"
              >
                <AppIcon name="close" aria-hidden="true" />
              </button>
            </label>
            <button type="button" class="command-mobile-cancel" @click="close">取消</button>
          </div>

          <footer>
            <span>↑↓ 选择 · Enter 打开</span>
            <button type="button" class="command-close" @click="close">关闭</button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@media (min-width: 981px) {
  .command-dialog {
    display: flex;
    flex-direction: column;
  }

  .command-mobile-head,
  .command-mobile-cancel,
  .command-recent,
  .command-result-group-label,
  .command-result-icon,
  .command-result-chevron {
    display: none;
  }

  .command-search-toolbar {
    order: -1;
  }

  .command-result-group,
  .command-result-card {
    display: contents;
  }

  .command-result-copy {
    display: contents;
  }

  .command-result-copy > small {
    display: none;
  }

  .command-result-meta {
    margin-left: auto;
  }
}

.command-clear {
  width: 28px;
  min-width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: var(--color-text-muted);
  background: var(--color-surface-subtle);
}

.command-clear :deep(svg) {
  width: 14px;
  height: 14px;
}
</style>
