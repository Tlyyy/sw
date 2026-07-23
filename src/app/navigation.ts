export const primaryNavigation = [
  { to: "/", text: "首页", icon: "home", section: "home" },
  { to: "/record", text: "录入", icon: "plus", section: "record" },
  { to: "/plans/tasks", text: "任务", icon: "plan", section: "tasks" },
  { to: "/week", text: "本周小结", icon: "report", section: "week" },
  { to: "/resources", text: "资料", icon: "assets", section: "resources" },
] as const;

export const featureNavigation = [
  { to: "/assets/pets", text: "资产资料", icon: "assets", section: "assets" },
  { to: "/plans/beasts", text: "计划工具", icon: "plan", section: "plans" },
  { to: "/analysis/recommendations", text: "分析工具", icon: "analysis", section: "analysis" },
  { to: "/publish", text: "内容发布", icon: "publish", section: "publish" },
  { to: "/data/inventory", text: "数据中心", icon: "settings", section: "data" },
  { to: "/settings", text: "同步与设置", icon: "settings", section: "settings" },
] as const;

export const mobileNavigation = [
  { to: "/", text: "首页", icon: "home", section: "home" },
  { to: "/record", text: "录入", icon: "plus", section: "record" },
  { to: "/week", text: "本周小结", icon: "report", section: "week" },
  { to: "/resources", text: "资料", icon: "assets", section: "resources" },
] as const;

export const commandPages = [
  ["首页 · 本周节奏", "/"],
  ["录入", "/record"],
  ["本周小结", "/week"],
  ["资料", "/resources"],
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
