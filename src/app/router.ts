import { createRouter, createWebHashHistory, type RouteRecordRaw } from "vue-router";

export const routes: RouteRecordRaw[] = [
  { path: "/", name: "dashboard", component: () => import("../features/dashboard/DashboardPage.vue"), meta: { title: "行动推进台", section: "home" } },
  { path: "/accounts/:accountId(FC|LG1|PT|LG2|MYT)", name: "account", component: () => import("../features/accounts/AccountPage.vue"), meta: { title: "单号下钻", section: "accounts" } },
  { path: "/assets/pets", name: "pets", component: () => import("../features/assets/PetsPage.vue"), meta: { title: "宠物资产", section: "assets" } },
  { path: "/assets/equipment", name: "equipment", component: () => import("../features/assets/EquipmentPage.vue"), meta: { title: "装备资产", section: "assets" } },
  { path: "/assets/skills", name: "skills", component: () => import("../features/assets/SkillsPage.vue"), meta: { title: "技能资料", section: "assets" } },
  { path: "/assets/evidence", name: "evidence", component: () => import("../features/assets/EvidencePage.vue"), meta: { title: "截图证据", section: "assets" } },
  { path: "/plans/upgrades", name: "upgrades", component: () => import("../features/plans/UpgradesPage.vue"), meta: { title: "宝石升级参考", section: "plans" } },
  { path: "/plans/beasts", name: "beasts", component: () => import("../features/plans/BeastsPage.vue"), meta: { title: "神兽主线任务", section: "plans" } },
  { path: "/plans/timeline", name: "timeline", component: () => import("../features/plans/TimelinePage.vue"), meta: { title: "五号主线概览", section: "plans" } },
  { path: "/analysis/recommendations", name: "recommendations", component: () => import("../features/analysis/RecommendationsPage.vue"), meta: { title: "推荐分析", section: "analysis" } },
  { path: "/analysis/species", name: "species", component: () => import("../features/analysis/SpeciesPage.vue"), meta: { title: "同名对比", section: "analysis" } },
  { path: "/analysis/matrix", name: "matrix", component: () => import("../features/analysis/MatrixPage.vue"), meta: { title: "固定矩阵", section: "analysis" } },
  { path: "/publish", name: "publish", component: () => import("../features/publish/PublishPage.vue"), meta: { title: "内容发布", section: "publish" } },
  { path: "/data", redirect: "/data/inventory" },
  { path: "/data/resources", redirect: "/data/inventory" },
  { path: "/data/:section(inventory|market|tasks|sources)", name: "data-center", component: () => import("../features/data/DataCenterPage.vue"), meta: { title: "数据中心", section: "data" } },
  { path: "/settings", name: "settings", component: () => import("../features/settings/SettingsPage.vue"), meta: { title: "界面设置", section: "data" } },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

export const router = createRouter({ history: createWebHashHistory(), routes, scrollBehavior: () => ({ top: 0 }) });
