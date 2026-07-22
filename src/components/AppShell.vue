<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { buildPrimaryNavigation } from "../app/navigation";
import { appName } from "../app/brand";
import AppIcon from "./AppIcon.vue";
import CommandSearch from "./CommandSearch.vue";
import { useCatalogStore } from "../stores/catalog";
import { useInventoryStore } from "../stores/inventory";
import { useUiStore } from "../stores/ui";
import { useAuthStore } from "../stores/auth";
import { useSyncStore } from "../stores/sync";

const route = useRoute();
const catalog = useCatalogStore();
const inventory = useInventoryStore();
const ui = useUiStore();
const auth = useAuthStore();
const cloudSync = useSyncStore();
const menuButton = ref<HTMLButtonElement>();
const mobileNav = ref<HTMLElement>();
const mobileCloseButton = ref<HTMLButtonElement>();
const mobileMedia = window.matchMedia("(max-width: 980px)");
const isMobile = ref(mobileMedia.matches);
let previousMobileFocus: HTMLElement | null = null;
let previousBodyOverflow = "";
let restoreMobileFocus = true;

const links = computed(() => buildPrimaryNavigation(ui.recentAccount));
const mobileDockLinks = computed(() => {
  const labels = { home: "首页", accounts: "账号", plans: "计划", data: "数据" } as const;
  return (["home", "accounts", "plans", "data"] as const).map((section) => {
    const link = links.value.find((item) => item.section === section)!;
    return { ...link, text: labels[section] };
  });
});
const mobileDockMoreActive = computed(() => !mobileDockLinks.value.some((link) => link.section === route.meta.section));

const title = computed(() => String(route.meta.title || appName));
const isDashboard = computed(() => route.meta.section === "home");
const isImmersivePage = computed(() => route.name === "matrix");
const date = computed(() => inventory.latestSnapshot?.effectiveDate || catalog.data.generatedAt.slice(0, 10));
const mobileDialogOpen = computed(() => isMobile.value && ui.mobileNavOpen);
const mobileNavClosed = computed(() => isMobile.value && !ui.mobileNavOpen);
const compactSyncLabel = computed(() => ({
  local: "仅本机",
  connecting: "连接中",
  syncing: "同步中",
  synced: "已同步",
  offline: "离线",
  conflict: "需处理",
  error: "失败",
})[cloudSync.status]);

function closeMobileNavigation(restoreFocus = true) {
  if (!ui.mobileNavOpen) return;
  restoreMobileFocus = restoreFocus;
  ui.mobileNavOpen = false;
}

function openMobileNavigation() {
  previousMobileFocus = document.activeElement instanceof HTMLElement ? document.activeElement : menuButton.value || null;
  ui.mobileNavOpen = true;
}

function openCommandSearch() {
  closeMobileNavigation(false);
  ui.commandOpen = true;
}

function mobileNavKeydown(event: KeyboardEvent) {
  if (!mobileDialogOpen.value || event.key !== "Tab") return;
  const focusables = Array.from(mobileNav.value?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') || []);
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function keydown(event: KeyboardEvent) {
  if (event.key === "Escape" && mobileDialogOpen.value) {
    event.preventDefault();
    closeMobileNavigation();
    return;
  }
  if (document.querySelector('[aria-modal="true"]')) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openCommandSearch();
  }
}

function syncMobileMedia(event: MediaQueryListEvent) {
  isMobile.value = event.matches;
  if (!event.matches) closeMobileNavigation(false);
}

watch(mobileDialogOpen, async (open) => {
  if (open) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    await nextTick();
    mobileCloseButton.value?.focus();
    return;
  }

  document.body.style.overflow = previousBodyOverflow;
  if (restoreMobileFocus) {
    await nextTick();
    previousMobileFocus?.focus();
  }
  previousMobileFocus = null;
  restoreMobileFocus = true;
});

watch(() => route.fullPath, () => closeMobileNavigation(false));

onMounted(() => {
  window.addEventListener("keydown", keydown);
  mobileMedia.addEventListener("change", syncMobileMedia);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", keydown);
  mobileMedia.removeEventListener("change", syncMobileMedia);
  document.body.style.overflow = previousBodyOverflow;
});
</script>

<template>
  <div class="orbit-shell">
    <header class="orbit-topbar">
      <button
        ref="menuButton"
        class="orbit-menu-button"
        aria-controls="orbit-primary-navigation"
        :aria-expanded="mobileDialogOpen"
        :aria-label="mobileDialogOpen ? '关闭导航' : '打开导航'"
        :tabindex="mobileDialogOpen ? -1 : undefined"
        @click="mobileDialogOpen ? closeMobileNavigation() : openMobileNavigation()"
      ><AppIcon :name="mobileDialogOpen ? 'close' : 'menu'" /></button>
      <RouterLink class="orbit-brand" to="/" :inert="mobileDialogOpen || undefined" :tabindex="mobileDialogOpen ? -1 : undefined" @click="closeMobileNavigation(false)">
        <strong>{{ appName }}</strong>
        <span>进度与资源汇总</span>
      </RouterLink>

      <nav
        id="orbit-primary-navigation"
        ref="mobileNav"
        class="orbit-nav"
        :class="{ open: mobileDialogOpen }"
        :inert="mobileNavClosed || undefined"
        :aria-hidden="mobileNavClosed ? 'true' : undefined"
        :role="mobileDialogOpen ? 'dialog' : undefined"
        :aria-modal="mobileDialogOpen ? 'true' : undefined"
        aria-label="主导航"
        @keydown="mobileNavKeydown"
      >
        <div class="orbit-mobile-nav-head">
          <div class="orbit-mobile-nav-identity">
            <strong>{{ appName }}</strong>
            <span>功能导航</span>
          </div>
          <button
            ref="mobileCloseButton"
            class="orbit-mobile-nav-close"
            type="button"
            aria-label="关闭导航"
            @click="closeMobileNavigation()"
          >
            <AppIcon name="close" />
            <span class="visually-hidden">关闭导航</span>
          </button>
        </div>
        <p class="orbit-mobile-nav-label">主要功能</p>
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          :class="{ active: route.meta.section === link.section }"
          :aria-current="route.meta.section === link.section ? 'page' : undefined"
          @click="closeMobileNavigation(false)"
        >
          <AppIcon :name="link.icon" />
          <span>{{ link.text }}</span>
        </RouterLink>
        <button class="orbit-mobile-logout" type="button" @click="closeMobileNavigation(false); auth.logout()">
          <span>退出登录</span>
          <small>结束当前设备会话</small>
        </button>
      </nav>

      <Transition name="orbit-nav-scrim">
        <button
          v-if="mobileDialogOpen"
          class="orbit-nav-scrim"
          type="button"
          tabindex="-1"
          aria-label="关闭导航"
          @click="closeMobileNavigation()"
        ></button>
      </Transition>

      <div class="orbit-header-tools" :inert="mobileDialogOpen || undefined">
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

    <main class="orbit-main" :inert="mobileDialogOpen || undefined">
      <p v-if="auth.warning" class="orbit-auth-warning" role="status">{{ auth.warning }}</p>
      <header v-if="!isDashboard && !isImmersivePage" class="orbit-route-context">
        <div>
          <h1>{{ title }}</h1>
          <p>数据日期 {{ date }}</p>
        </div>
      </header>
      <RouterView />
    </main>
    <nav class="orbit-mobile-dock" aria-label="手机快捷导航" :inert="mobileDialogOpen || undefined">
      <RouterLink
        v-for="link in mobileDockLinks"
        :key="link.to"
        :to="link.to"
        :class="{ active: route.meta.section === link.section }"
        :aria-current="route.meta.section === link.section ? 'page' : undefined"
        @click="closeMobileNavigation(false)"
      >
        <AppIcon :name="link.icon" />
        <span>{{ link.text }}</span>
      </RouterLink>
      <button
        type="button"
        :class="{ active: mobileDockMoreActive || mobileDialogOpen }"
        aria-controls="orbit-primary-navigation"
        :aria-expanded="mobileDialogOpen"
        aria-label="打开全部导航"
        @click="openMobileNavigation"
      >
        <AppIcon name="menu" />
        <span>更多</span>
      </button>
    </nav>
    <CommandSearch />
  </div>
</template>
