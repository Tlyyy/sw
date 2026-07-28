<script setup lang="ts">
import "../../styles/mobile-experience.css";
import "../../styles/ios26-mobile.css";
import "../../styles/ios-latest-mobile.css";
import { computed } from "vue";
import { mobileNavigation } from "../../app/navigation";
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
const links = mobileNavigation;
const mobileSection = computed(() => String(route.meta.mobileSection || route.meta.section || "home"));

function mobileAriaCurrent(link: { to: string; section: string }) {
  if (route.path === link.to) return "page";
  if (mobileSection.value === link.section) return "location";
  return undefined;
}

function openCommandSearch() {
  ui.commandOpen = true;
}

function openGlobalRecordSheet() {
  ui.openRecordSheet("inventory", { sourcePath: route.fullPath });
}
</script>

<template>
  <div class="orbit-shell" data-app-device="mobile" data-testid="mobile-app-shell">
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
          v-for="link in links"
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
  </div>
</template>
