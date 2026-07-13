import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("sw-site-auth-session", "1"));
});

test.describe("desktop regressions", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
  });

  test("同一页面内的路由查询会反向同步技能和宠物筛选", async ({ page }) => {
    await page.goto("/#/assets/skills?type=%E5%85%BD%E5%86%B3&q=%E9%AB%98%E7%BA%A7");
    await expect(page.getByRole("tab", { name: /^兽决/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByPlaceholder("搜索技能名称或备注")).toHaveValue("高级");

    await page.evaluate(() => {
      window.location.hash = "/assets/skills?type=%E5%BC%BA%E5%8C%96%E6%8A%80%E8%83%BD&q=%E5%BF%85%E6%9D%80%E5%BC%BA%E5%8C%96";
    });
    await expect(page.getByRole("tab", { name: /^强化技能/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByPlaceholder("搜索技能名称或备注")).toHaveValue("必杀强化");
    await expect(page.locator(".skill-grid article").filter({ hasText: "必杀强化" })).toHaveCount(1);

    await page.goto("/#/assets/pets?account=FC&q=%E7%A5%B8%E6%96%97");
    await expect(page.getByLabel("账号范围")).toHaveValue("FC");
    await page.evaluate(() => {
      window.location.hash = "/assets/pets?account=LG2&q=%E7%A5%B8%E6%96%97";
    });
    await expect(page.getByLabel("账号范围")).toHaveValue("LG2");
    await expect(page.getByPlaceholder("在宠物、技能、面板和资质中筛选")).toHaveValue("祸斗");
    await expect(page.locator(".pet-list .pet-row")).toHaveCount(1);
    await expect(page.locator(".pet-list .pet-row").first()).toContainText("LG2");
  });

  test("全局技能搜索保留分类，并支持键盘选择和焦点恢复", async ({ page }) => {
    await page.goto("/#/");
    const trigger = page.getByRole("button", { name: "搜索全系统" });
    await trigger.focus();
    await trigger.press("Enter");

    const dialog = page.getByRole("dialog", { name: "全局搜索" });
    const input = page.getByPlaceholder("搜索账号、宠物、装备、技能或页面");
    await expect(dialog).toBeVisible();
    await expect(input).toBeFocused();
    await input.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.press("Enter");
    await input.fill("必杀强化");
    const skillResult = page.locator(".command-results button").filter({ hasText: "必杀强化" });
    await expect(skillResult).toHaveCount(1);
    await input.press("ArrowDown");
    await expect(skillResult).toBeFocused();
    await skillResult.press("Enter");

    await expect(page).toHaveURL(/#\/assets\/skills\?/);
    await expect(page.getByRole("tab", { name: /^强化技能/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByPlaceholder("搜索技能名称或备注")).toHaveValue("必杀强化");
    await expect(page.locator(".skill-grid article").filter({ hasText: "必杀强化" })).toHaveCount(1);

    await page.goto("/#/assets/pets?account=FC");
    const secondPet = page.locator("button.pet-row-content").nth(1);
    await expect(secondPet).toHaveAttribute("aria-label", /^查看 FC 的/);
    await secondPet.focus();
    await secondPet.press("Enter");
    await expect(secondPet).toHaveAttribute("aria-current", "true");
  });

  test("无效手动行情会报告失败且不会新增历史", async ({ page }) => {
    await page.goto("/#/data/market");
    const historyCountBefore = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("sw.app.settings.v3") || "null");
      return state?.gemPriceHistory?.length || 0;
    });

    await page.getByLabel("太阳石当前价格").fill("0");
    await page.getByRole("button", { name: "记录当前价格" }).click();
    await expect(page.getByText("记录失败：六项价格必须都是大于 0 的有效数字", { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("sw.app.settings.v3") || "null");
      return state?.gemPriceHistory?.length || 0;
    })).toBe(historyCountBefore);
  });

  test("已确认进阶二的神兽蛇不再生成进阶二任务", async ({ page }) => {
    await page.goto("/#/plans/beasts");
    const filters = page.locator(".inline-filters select");
    await expect(filters).toHaveCount(2);
    await filters.nth(0).selectOption("LG1");
    await filters.nth(1).selectOption("snake1");

    const tasks = page.locator(".readonly-task-list article");
    await expect(tasks).not.toContainText("进阶2");

    await filters.nth(0).selectOption("LG2");
    await expect(tasks).not.toContainText("进阶2");

    await filters.nth(0).selectOption("MYT");
    await expect(tasks.filter({ hasText: "饰品" })).toHaveCount(0);
    await expect(tasks.filter({ hasText: "进阶1" })).toHaveCount(0);
  });

  test("装备页展示 2026-07-13 的四处宝石升级", async ({ page }) => {
    await page.goto("/#/assets/equipment");
    const rows = page.locator(".equipment-table article");
    await expect(rows.filter({ hasText: "FC头盔" })).toContainText("月亮石 10★★");
    await expect(rows.filter({ hasText: "PT武器" })).toContainText("神秘石 9★★");
    await expect(rows.filter({ hasText: "MYT鞋子" })).toContainText("黑宝石 11★★");
    await expect(rows.filter({ hasText: "LG2鞋子" })).toContainText("黑宝石 11");
  });

  test("旧本地状态迁移后可导出包含四个分区的完整备份", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("sw.app.settings.v2", JSON.stringify({
        version: 2,
        gemPriceOverrides: {},
        settings: { startDate: "2026-01-02" },
        overrides: {},
        gemPriceHistory: [],
      }));
      localStorage.setItem("sw.app.publish.v1", JSON.stringify({
        selectedIds: ["FC:pet:01"],
        draft: "旧版发布草稿",
      }));
      localStorage.setItem("sw.app.ui.v1", JSON.stringify({
        accountScope: "LG1",
        recentAccount: "FC",
        matrixDensity: "comfortable",
        matrixDisplay: { stats: true, aptitudes: false, skills: true },
      }));
    });

    await page.goto("/#/settings");
    await expect(page.getByRole("heading", { name: "完整业务备份" })).toBeVisible();
    await expect(page.getByText(/包含库存、行情与历史、神兽任务、发布草稿和界面偏好/)).toBeVisible();
    await expect(page.getByLabel("最近账号")).toHaveValue("FC");
    await expect(page.getByLabel("矩阵密度")).toHaveValue("comfortable");
    await expect(page.getByText("1 组宠物已加入发布清单", { exact: true })).toBeVisible();

    await expect.poll(() => page.evaluate(() => ({
      settings: JSON.parse(localStorage.getItem("sw.app.settings.v3") || "null")?.version,
      publish: JSON.parse(localStorage.getItem("sw.app.publish.v2") || "null")?.version,
      ui: JSON.parse(localStorage.getItem("sw.app.ui.v2") || "null")?.version,
    }))).toEqual({ settings: 3, publish: 2, ui: 2 });

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "导出完整 JSON" }).click(),
    ]);
    const downloadPath = await download.path();
    if (!downloadPath) throw new Error("完整备份下载文件不可用");
    const backup = JSON.parse(await readFile(downloadPath, "utf8"));
    expect(backup).toMatchObject({
      format: "sw-workspace-backup",
      version: 1,
      inventory: { version: 2 },
      settings: { version: 3, settings: { startDate: "2026-01-02" } },
      publish: { version: 2, selectedIds: ["FC:pet:01"], draft: "旧版发布草稿" },
      ui: { version: 2, recentAccount: "FC", matrixDensity: "comfortable" },
    });
  });
});

test("移动导航是可关闭、可困住焦点并恢复焦点的对话框", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.goto("/#/");
  const menuButton = page.locator("button.orbit-menu-button");
  await expect(menuButton).toHaveAttribute("aria-label", "打开导航");
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await menuButton.click();

  const navigation = page.getByRole("dialog", { name: "主导航" });
  const closeButton = navigation.getByRole("button", { name: "关闭导航" });
  const logoutButton = navigation.getByRole("button", { name: "退出登录" });
  await expect(navigation).toBeVisible();
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  await expect(closeButton).toBeFocused();
  await closeButton.press("Shift+Tab");
  await expect(logoutButton).toBeFocused();
  await logoutButton.press("Tab");
  await expect(closeButton).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(navigation).toHaveCount(0);
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expect(menuButton).toHaveAttribute("aria-label", "打开导航");
  await expect(menuButton).toBeFocused();
});
