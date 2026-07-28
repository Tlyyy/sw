import { useCatalogStore } from "../../stores/catalog";
import { useUiStore } from "../../stores/ui";
import type { AccountId } from "../../domain/types";

export const assetLinks = [
  { to: "/assets/pets", title: "宠物资产", copy: "宠物、资质、技能和定位", icon: "account" },
  { to: "/assets/equipment", title: "装备资产", copy: "装备归属与属性资料", icon: "assets" },
  { to: "/assets/skills", title: "技能资料", copy: "技能说明与检索", icon: "publish" },
  { to: "/assets/evidence", title: "截图证据", copy: "原始图片与记录依据", icon: "report" },
] as const;

export const analysisLinks = [
  { to: "/analysis/recommendations", title: "推荐分析", copy: "优先级和养成建议" },
  { to: "/analysis/species", title: "同名对比", copy: "同类宠物横向比较" },
  { to: "/analysis/matrix", title: "固定矩阵", copy: "五账号完整对照表" },
] as const;

export const planningLinks = [
  { to: "/plans/beasts", title: "神兽主线", copy: "当前阶段与资源缺口" },
  { to: "/plans/timeline", title: "五号概览", copy: "五账号推进时间线" },
  { to: "/plans/gems", title: "宝石计划", copy: "目标段位与周投入" },
  { to: "/plans/parameters", title: "计划参数", copy: "任务价格与计划口径" },
] as const;

export const dataLinks = [
  { to: "/data/inventory", title: "库存资料", copy: "当前库存、周变化与历史记录", icon: "assets" },
  { to: "/data/market", title: "行情记录与趋势", copy: "查看价格变化；更新请从“录入”进入", icon: "analysis" },
  { to: "/data/sources", title: "数据来源", copy: "静态资料和版本依据", icon: "report" },
] as const;

export const managementLinks = [
  { to: "/publish", title: "内容发布", copy: "整理素材与发布文案", icon: "publish" },
  { to: "/settings", title: "同步与设置", copy: "云同步、密码与界面偏好", icon: "settings" },
] as const;

export function useResourcesPage() {
  const catalog = useCatalogStore();
  const ui = useUiStore();

  function selectAccount(accountId: AccountId) {
    ui.recentAccount = accountId;
  }

  return {
    catalog,
    ui,
    assetLinks,
    analysisLinks,
    planningLinks,
    dataLinks,
    managementLinks,
    selectAccount,
  };
}
