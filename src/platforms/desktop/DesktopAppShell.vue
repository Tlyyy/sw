<script setup lang="ts">
import { computed } from "vue";
import { primaryNavigation } from "../../app/navigation";
import { appName } from "../../app/brand";
import { useUiStore } from "../../stores/ui";
import AppIcon from "../../components/AppIcon.vue";
import { useShellContext } from "../shared/useShellContext";

const ui = useUiStore();
const {
  route,
  auth,
  cloudSync,
  title,
  isDashboard,
  isImmersivePage,
  date,
  compactSyncLabel,
} = useShellContext();
const links = primaryNavigation;
const desktopSection = computed(() => String(route.meta.desktopSection || (
  ["home", "record", "week", "resources"].includes(String(route.meta.section))
    ? route.meta.section
    : "resources"
)));

function desktopAriaCurrent(link: { to: string; section: string }) {
  if (route.path === link.to) return "page";
  if (desktopSection.value === link.section) return "location";
  return undefined;
}

function openCommandSearch() {
  ui.commandOpen = true;
}
</script>

<template>
  <div class="orbit-shell" data-app-device="desktop" data-testid="desktop-app-shell">
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
  </div>
</template>
