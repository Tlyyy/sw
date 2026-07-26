<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import { useRoute } from "vue-router";
import { mobileNavigation, primaryNavigation } from "../app/navigation";
import { appName } from "../app/brand";
import { useCatalogStore } from "../stores/catalog";
import { useInventoryStore } from "../stores/inventory";
import { useUiStore } from "../stores/ui";
import { useAuthStore } from "../stores/auth";
import { useSyncStore } from "../stores/sync";
import AppIcon from "./AppIcon.vue";
import CommandSearch from "./CommandSearch.vue";
import GlobalRecordSheet from "./GlobalRecordSheet.vue";

const route = useRoute();
const catalog = useCatalogStore();
const inventory = useInventoryStore();
const ui = useUiStore();
const auth = useAuthStore();
const cloudSync = useSyncStore();
const links = primaryNavigation;
const mobileDockLinks = mobileNavigation;
const mobileSection = computed(() => String(route.meta.mobileSection || route.meta.section || "home"));
const desktopSection = computed(() => String(route.meta.desktopSection || (
  ["home", "record", "week", "resources"].includes(String(route.meta.section))
    ? route.meta.section
    : "resources"
)));
const title = computed(() => String(route.meta.title || appName));
const isDashboard = computed(() => route.meta.section === "home");
const isImmersivePage = computed(() => route.name === "matrix" || Boolean(route.meta.immersive));
const date = computed(() => inventory.latestSnapshot?.effectiveDate || catalog.data.generatedAt.slice(0, 10));
const compactSyncLabel = computed(() => ({
  local: "仅本机",
  connecting: "连接中",
  syncing: "同步中",
  synced: "已同步",
  offline: "离线",
  conflict: "需处理",
  error: "失败",
})[cloudSync.status]);

function mobileAriaCurrent(link: { to: string; section: string }) {
  if (route.path === link.to) return "page";
  if (mobileSection.value === link.section) return "location";
  return undefined;
}

function desktopAriaCurrent(link: { to: string; section: string }) {
  if (route.path === link.to) return "page";
  if (desktopSection.value === link.section) return "location";
  return undefined;
}

function openCommandSearch() {
  ui.commandOpen = true;
}

function openGlobalRecordSheet() {
  ui.openRecordSheet("inventory", { sourcePath: route.fullPath });
}

function keydown(event: KeyboardEvent) {
  if (document.querySelector('[aria-modal="true"]')) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openCommandSearch();
  }
}

onMounted(() => {
  window.addEventListener("keydown", keydown);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", keydown);
});
</script>

<template>
  <div class="orbit-shell">
    <header class="orbit-topbar ios26-desktop-topbar">
      <RouterLink class="orbit-brand" to="/">
        <strong>{{ appName }}</strong>
        <span>记录与本周小结</span>
      </RouterLink>

      <nav id="orbit-primary-navigation" class="orbit-nav" aria-label="主导航">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          :class="{ active: desktopSection === link.section }"
          :aria-current="desktopAriaCurrent(link)"
        >
          <AppIcon :name="link.icon" />
          <span>{{ link.text }}</span>
        </RouterLink>
      </nav>

      <div class="orbit-header-tools">
        <button class="orbit-command-trigger" aria-label="搜索全系统" title="搜索全系统（Ctrl+K）" @click="openCommandSearch">
          <span class="orbit-command-label">搜索全系统</span>
          <AppIcon name="search" />
        </button>
        <RouterLink
          class="orbit-sync-state"
          :class="`is-${cloudSync.statusTone}`"
          to="/settings"
          :title="cloudSync.errorMessage || cloudSync.conflictMessage || cloudSync.statusLabel"
          aria-label="查看云同步状态"
        ><span aria-hidden="true"></span><b aria-live="polite"><span class="orbit-sync-label-full">{{ cloudSync.statusLabel }}</span><span class="orbit-sync-label-compact">{{ compactSyncLabel }}</span></b></RouterLink>
        <button class="orbit-logout" title="退出登录" @click="auth.logout">退出</button>
      </div>
    </header>

    <header class="ios26-mobile-header">
      <RouterLink class="ios26-mobile-brand" to="/">
        <strong>{{ appName }}</strong>
      </RouterLink>
      <div class="ios26-mobile-tools">
        <button type="button" aria-label="快速录入" @click="openGlobalRecordSheet">
          <AppIcon name="plus" />
        </button>
        <RouterLink
          class="ios26-mobile-sync"
          :class="`is-${cloudSync.statusTone}`"
          to="/settings"
          :aria-label="`同步与设置：${cloudSync.statusLabel}`"
        >
          <span aria-hidden="true"></span>
          <b>{{ compactSyncLabel }}</b>
        </RouterLink>
      </div>
    </header>

    <main class="orbit-main">
      <p v-if="auth.warning" class="orbit-auth-warning" role="status">{{ auth.warning }}</p>
      <header v-if="!isDashboard && !isImmersivePage" class="orbit-route-context">
        <div>
          <h1>{{ title }}</h1>
          <p>数据日期 {{ date }}</p>
        </div>
      </header>
      <RouterView />
    </main>

    <div class="ios26-mobile-dock-shell">
      <nav
        class="orbit-mobile-dock ios26-mobile-dock"
        data-state="expanded"
        aria-label="手机快捷导航"
      >
        <RouterLink
          v-for="link in mobileDockLinks"
          :key="link.to"
          :to="link.to"
          :class="{ active: mobileSection === link.section }"
          :aria-current="mobileAriaCurrent(link)"
        >
          <span class="ios26-mobile-dock-icon"><AppIcon :name="link.icon" /></span>
          <span>{{ link.text }}</span>
        </RouterLink>
      </nav>
      <button
        class="ios26-mobile-search"
        type="button"
        aria-label="搜索全系统"
        title="搜索全系统"
        @click="openCommandSearch"
      >
        <AppIcon name="search" />
      </button>
    </div>

    <GlobalRecordSheet />
    <CommandSearch />
  </div>
</template>
