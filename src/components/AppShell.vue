<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import { useRoute } from "vue-router";
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

const links = computed(() => [
  { to: "/", text: "行动推进台", icon: "home", section: "home" },
  { to: `/accounts/${ui.recentAccount}`, text: "账号", icon: "account", section: "accounts" },
  { to: "/assets/pets", text: "资产", icon: "assets", section: "assets" },
  { to: "/plans/beasts", text: "计划", icon: "plan", section: "plans" },
  { to: "/analysis/recommendations", text: "分析", icon: "analysis", section: "analysis" },
  { to: "/publish", text: "发布", icon: "publish", section: "publish" },
  { to: "/data/inventory", text: "数据", icon: "settings", section: "data" },
]);

const title = computed(() => String(route.meta.title || "幻唐志账号管理系统"));
const isDashboard = computed(() => route.meta.section === "home");
const isImmersivePage = computed(() => route.name === "matrix");
const date = computed(() => inventory.latestSnapshot?.effectiveDate || catalog.data.generatedAt.slice(0, 10));

function keydown(event: KeyboardEvent) {
  if (document.querySelector('[aria-modal="true"]')) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    ui.commandOpen = true;
  }
}

onMounted(() => window.addEventListener("keydown", keydown));
onBeforeUnmount(() => window.removeEventListener("keydown", keydown));
</script>

<template>
  <div class="orbit-shell">
    <header class="orbit-topbar">
      <button class="orbit-menu-button" aria-label="打开导航" @click="ui.mobileNavOpen = true">☰</button>
      <RouterLink class="orbit-brand" to="/" @click="ui.mobileNavOpen = false">
        <strong>幻唐志</strong>
        <span>幻唐志账号管理系统</span>
      </RouterLink>

      <nav class="orbit-nav" :class="{ open: ui.mobileNavOpen }" aria-label="主导航">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          :class="{ active: route.meta.section === link.section }"
          @click="ui.mobileNavOpen = false"
        >
          <AppIcon :name="link.icon" />
          <span>{{ link.text }}</span>
        </RouterLink>
        <button class="orbit-mobile-logout" @click="auth.logout">退出登录</button>
      </nav>

      <div class="orbit-header-tools">
        <button class="orbit-command-trigger" aria-label="搜索全系统" title="搜索全系统（Ctrl+K）" @click="ui.commandOpen = true">
          <span class="orbit-command-label">搜索全系统</span>
          <AppIcon name="search" />
        </button>
        <span class="orbit-local-user"><AppIcon name="account" /><b>本地用户</b></span>
        <button class="orbit-logout" title="退出登录" @click="auth.logout">退出</button>
      </div>
    </header>

    <button v-if="ui.mobileNavOpen" class="orbit-nav-scrim" aria-label="关闭导航" @click="ui.mobileNavOpen = false"></button>

    <main class="orbit-main">
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
