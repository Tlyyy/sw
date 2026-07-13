<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { buildPrimaryNavigation } from "../app/navigation";
import AppIcon from "./AppIcon.vue";
import CommandSearch from "./CommandSearch.vue";
import { useCatalogStore } from "../stores/catalog";
import { useInventoryStore } from "../stores/inventory";
import { useUiStore } from "../stores/ui";
import { useAuthStore } from "../stores/auth";

const route = useRoute();
const catalog = useCatalogStore();
const inventory = useInventoryStore();
const ui = useUiStore();
const auth = useAuthStore();
const menuButton = ref<HTMLButtonElement>();
const mobileNav = ref<HTMLElement>();
const mobileCloseButton = ref<HTMLButtonElement>();
const mobileMedia = window.matchMedia("(max-width: 980px)");
const isMobile = ref(mobileMedia.matches);
let previousMobileFocus: HTMLElement | null = null;
let previousBodyOverflow = "";
let restoreMobileFocus = true;

const links = computed(() => buildPrimaryNavigation(ui.recentAccount));

const title = computed(() => String(route.meta.title || "幻唐志账号管理系统"));
const isDashboard = computed(() => route.meta.section === "home");
const isImmersivePage = computed(() => route.name === "matrix");
const date = computed(() => inventory.latestSnapshot?.effectiveDate || catalog.data.generatedAt.slice(0, 10));
const mobileDialogOpen = computed(() => isMobile.value && ui.mobileNavOpen);
const mobileNavClosed = computed(() => isMobile.value && !ui.mobileNavOpen);

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
      >☰</button>
      <RouterLink class="orbit-brand" to="/" :inert="mobileDialogOpen || undefined" :tabindex="mobileDialogOpen ? -1 : undefined" @click="closeMobileNavigation(false)">
        <strong>幻唐志</strong>
        <span>幻唐志账号管理系统</span>
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
        <button ref="mobileCloseButton" class="orbit-mobile-nav-close" type="button" @click="closeMobileNavigation()">关闭导航</button>
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          :class="{ active: route.meta.section === link.section }"
          @click="closeMobileNavigation(false)"
        >
          <AppIcon :name="link.icon" />
          <span>{{ link.text }}</span>
        </RouterLink>
        <button class="orbit-mobile-logout" @click="closeMobileNavigation(false); auth.logout()">退出登录</button>
      </nav>

      <div class="orbit-header-tools" :inert="mobileDialogOpen || undefined">
        <button class="orbit-command-trigger" aria-label="搜索全系统" title="搜索全系统（Ctrl+K）" @click="openCommandSearch">
          <span class="orbit-command-label">搜索全系统</span>
          <AppIcon name="search" />
        </button>
        <span class="orbit-local-user"><AppIcon name="account" /><b>本地用户</b></span>
        <button class="orbit-logout" title="退出登录" @click="auth.logout">退出</button>
      </div>
    </header>

    <button v-if="mobileDialogOpen" class="orbit-nav-scrim" aria-label="关闭导航" @click="closeMobileNavigation()"></button>

    <main class="orbit-main" :inert="mobileDialogOpen || undefined">
      <header v-if="!isDashboard && !isImmersivePage" class="orbit-route-context">
        <div>
          <h1>{{ title }}</h1>
          <p>数据日期 {{ date }}</p>
        </div>
      </header>
      <RouterView />
    </main>
    <CommandSearch />
  </div>
</template>
