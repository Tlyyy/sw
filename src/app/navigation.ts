import type { AccountId } from "../domain/types";

export const primaryNavigation = [
  { to: "/", text: "行动推进台", icon: "home", section: "home" },
  { to: "/assets/pets", text: "资产", icon: "assets", section: "assets" },
  { to: "/plans/beasts", text: "计划", icon: "plan", section: "plans" },
  { to: "/analysis/recommendations", text: "分析", icon: "analysis", section: "analysis" },
  { to: "/publish", text: "发布", icon: "publish", section: "publish" },
  { to: "/data/inventory", text: "数据", icon: "settings", section: "data" },
] as const;

export function buildPrimaryNavigation(recentAccount: AccountId) {
  return [
    primaryNavigation[0],
    { to: `/accounts/${recentAccount}`, text: "账号", icon: "account", section: "accounts" },
    ...primaryNavigation.slice(1),
  ];
}

export const commandPages = [
  ["行动推进台", "/"],
  ["宠物资产", "/assets/pets"],
  ["装备资产", "/assets/equipment"],
  ["技能资料", "/assets/skills"],
  ["截图证据", "/assets/evidence"],
  ["神兽主线任务", "/plans/beasts"],
  ["任务维护", "/plans/tasks"],
  ["五号主线概览", "/plans/timeline"],
  ["宝石计划", "/plans/gems"],
  ["计划参数", "/plans/parameters"],
  ["推荐分析", "/analysis/recommendations"],
  ["同名宠物对比", "/analysis/species"],
  ["固定矩阵", "/analysis/matrix"],
  ["内容发布", "/publish"],
  ["库存快照", "/data/inventory"],
  ["宝石行情", "/data/market"],
  ["数据来源", "/data/sources"],
  ["界面设置与备份", "/settings"],
] as const;
