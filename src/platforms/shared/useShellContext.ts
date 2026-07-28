import { computed } from "vue";
import { useRoute } from "vue-router";
import { appName } from "../../app/brand";
import { useAuthStore } from "../../stores/auth";
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { useSyncStore } from "../../stores/sync";

export function useShellContext() {
  const route = useRoute();
  const catalog = useCatalogStore();
  const inventory = useInventoryStore();
  const auth = useAuthStore();
  const cloudSync = useSyncStore();

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

  return {
    route,
    auth,
    cloudSync,
    title,
    isDashboard,
    isImmersivePage,
    date,
    compactSyncLabel,
  };
}
