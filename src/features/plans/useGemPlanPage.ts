import { computed, onScopeDispose, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import {
  buildGemPlanProjection,
  formatCurrency,
  formatGemLevel,
  formatNumber,
  gemPlanTargetLevels,
  marketItems,
} from "../../domain/gems";
import type { AccountId } from "../../domain/types";
import { useCatalogStore } from "../../stores/catalog";
import { usePlanningDraftStore } from "../../stores/planningDraft";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";
import { createGemPlanShareImage } from "./gemPlanShareImage";

export const gemAccountTones: Record<AccountId, string> = {
  FC: "var(--color-account-fc)",
  LG1: "var(--color-account-lg1)",
  LG2: "var(--color-account-lg2)",
  PT: "var(--color-account-pt)",
  MYT: "var(--color-account-myt)",
};

export function useGemPlanPage() {
  const catalog = useCatalogStore();
  const settings = useSettingsStore();
  const ui = useUiStore();
  const draft = usePlanningDraftStore();
  settings.hydrate();
  if (!catalog.data.accounts.some((item) => item.id === draft.gemAccount)) {
    draft.gemAccount = ui.recentAccount;
  }
  const { gemAccount: selected } = storeToRefs(draft);
  const sharing = ref(false);
  const shareNotice = ref("");
  let shareNoticeTimer: number | undefined;

  watch(selected, (accountId) => {
    ui.recentAccount = accountId as AccountId;
  });

  const targetLevels = computed(() => gemPlanTargetLevels(catalog.data));
  const market = computed(() => marketItems(catalog.data, settings.gemPriceOverrides));
  const plan = computed(() => buildGemPlanProjection(
    catalog.data,
    settings.gemPriceOverrides,
    settings.gemPlan.targetLevel,
    settings.gemPlan.weeklyIncomeWan,
    settings.planningAsOfDate,
  ));
  const selectedPlan = computed(() => plan.value.accounts
    .find((account) => account.accountId === selected.value) || plan.value.accounts[0]);

  function formatDate(value: string | null) {
    if (!value) return "待设置投入";
    const [year, month, day] = value.split("-");
    return `${year}年${Number(month)}月${Number(day)}日`;
  }
  function weeksLabel(value: number | null) {
    if (value === null) return "待排期";
    return value === 0 ? "已达成" : `${value} 周`;
  }
  function compactCost(value: number) {
    return formatCurrency(value).replace("银币", "");
  }
  function setTarget(event: Event) {
    settings.setGemPlanTargetLevel((event.target as HTMLSelectElement).value);
  }
  function setWeeklyIncome(event: Event) {
    settings.setGemPlanWeeklyIncome(Number((event.target as HTMLInputElement).value));
  }
  function showShareNotice(message: string) {
    shareNotice.value = message;
    if (shareNoticeTimer !== undefined) window.clearTimeout(shareNoticeTimer);
    shareNoticeTimer = window.setTimeout(() => {
      shareNotice.value = "";
      shareNoticeTimer = undefined;
    }, 2_800);
  }
  function downloadImage(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
  async function shareGemPlan() {
    if (sharing.value) return;
    sharing.value = true;
    try {
      const blob = createGemPlanShareImage({
        projection: plan.value,
        marketDate: catalog.data.gemMarketSnapshots.at(-1)?.sourceDate || "待更新",
      });
      const target = plan.value.targetLevel.replaceAll("★", "星");
      const fileName = `宝石计划-${target}-${plan.value.startDate}.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      const shareData: ShareData = { files: [file], title: `宝石计划 · ${formatGemLevel(plan.value.targetLevel)}` };
      const supportsFileShare = typeof navigator.share === "function"
        && typeof navigator.canShare === "function"
        && navigator.canShare(shareData);
      if (supportsFileShare) {
        try {
          await navigator.share(shareData);
          showShareNotice("宝石计划图片已生成");
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      downloadImage(blob, fileName);
      showShareNotice("宝石计划图片已下载");
    } catch {
      showShareNotice("图片生成失败，请重试");
    } finally {
      sharing.value = false;
    }
  }

  onScopeDispose(() => {
    if (shareNoticeTimer !== undefined) window.clearTimeout(shareNoticeTimer);
  });

  return {
    catalog,
    settings,
    selected,
    sharing,
    shareNotice,
    targetLevels,
    market,
    plan,
    selectedPlan,
    accountTones: gemAccountTones,
    formatGemLevel,
    formatNumber,
    formatDate,
    weeksLabel,
    compactCost,
    setTarget,
    setWeeklyIncome,
    shareGemPlan,
  };
}
