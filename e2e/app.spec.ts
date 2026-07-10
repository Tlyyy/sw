import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("sw-site-auth-session", "1"));
});

test.describe("desktop application", () => {
  test("核心路由、搜索和业务基线", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    await page.goto("/#/");
    await expect(page.getByRole("heading", { name: "今日决策" })).toBeVisible();
    await expect(page.getByText("第 72 周", { exact: true }).first()).toBeVisible();
    const typography = await page.evaluate(() => ({
      nav: Number.parseFloat(getComputedStyle(document.querySelector(".orbit-nav a")!).fontSize),
      title: Number.parseFloat(getComputedStyle(document.querySelector(".decision-summary h1")!).fontSize),
      body: Number.parseFloat(getComputedStyle(document.querySelector(".orbit-dashboard-page")!).fontSize),
      button: Number.parseFloat(getComputedStyle(document.querySelector("button")!).fontSize),
    }));
    expect(typography.nav).toBeGreaterThanOrEqual(14);
    expect(typography.title).toBeGreaterThanOrEqual(22);
    expect(typography.body).toBeGreaterThanOrEqual(14);
    expect(typography.button).toBeGreaterThanOrEqual(13);
    await page.screenshot({ path: "docs/refactor/screenshots/dashboard-desktop.png" });

    const routes = [
      ["/#/accounts/LG2", "LG2 账号"],
      ["/#/assets/pets", "宠物资产"],
      ["/#/assets/equipment", "装备资产"],
      ["/#/assets/skills", "技能资料"],
      ["/#/assets/evidence", "截图证据"],
      ["/#/plans/upgrades", "升级计划"],
      ["/#/plans/beasts", "神兽计划"],
      ["/#/plans/timeline", "联合时间轴"],
      ["/#/analysis/recommendations", "推荐分析"],
      ["/#/analysis/species", "同名对比"],
      ["/#/analysis/matrix", "固定矩阵"],
      ["/#/publish", "内容发布"],
      ["/#/data/market", "数据中心"],
      ["/#/data/resources", "数据中心"],
      ["/#/data/tasks", "数据中心"],
      ["/#/data/sources", "数据中心"],
      ["/#/settings", "界面设置"],
    ] as const;
    for (const [url, heading] of routes) {
      await page.goto(url);
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
    }

    await page.goto("/#/assets/pets");
    await page.getByLabel("账号范围").selectOption("ALL");
    await page.getByPlaceholder("在宠物、技能、面板和资质中筛选").fill("祸斗");
    await expect(page.getByText("5 / 53", { exact: true })).toBeVisible();
    await expect(page.locator(".pet-list .pet-row")).toHaveCount(5);

    await page.goto("/#/");
    await page.getByRole("button", { name: "搜索全系统" }).click();
    await page.getByPlaceholder("搜索账号、宠物、装备、技能或页面").fill("矩阵");
    await page.getByText("固定矩阵", { exact: true }).click();
    await expect(page).toHaveURL(/#\/analysis\/matrix$/);
    await page.getByRole("button", { name: "PK：速度" }).click();
    await expect(page.locator(".matrix-table tbody tr")).toHaveCount(3);

    const skills = page.getByRole("checkbox", { name: "技能" });
    await skills.uncheck();
    await expect(page.locator(".matrix-skills")).toHaveCount(0);
    await skills.check();

    await page.goto("/#/publish");
    await page.getByRole("button", { name: "推荐首发" }).click();
    await expect(page.getByText("已选 15 组 · 30 张图", { exact: true })).toBeVisible();
    await expect(page.locator(".output-panel textarea")).toHaveValue(/资产总览/);

    await page.goto("/#/plans/upgrades");
    await expect(page.locator(".gem-ocr-panel, .market-band input")).toHaveCount(0);
    await page.goto("/#/plans/beasts");
    await expect(page.locator(".settings-band input, .resource-table input, .task-list input")).toHaveCount(0);
  });
});

test.describe("mobile application", () => {
  test("导航完全离屏且矩阵局部滚动", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile");
    await page.goto("/#/");
    await expect(page.getByRole("heading", { name: "今日决策" })).toBeVisible();
    const layout = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
      navRight: document.querySelector(".orbit-nav")!.getBoundingClientRect().right,
    }));
    expect(layout.scroll).toBe(layout.client);
    expect(layout.navRight).toBeLessThanOrEqual(0);
    await page.screenshot({ path: "docs/refactor/screenshots/dashboard-mobile.png" });

    await page.getByRole("button", { name: "打开导航" }).click();
    await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
    await page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "分析" }).click();
    await page.getByRole("link", { name: "固定矩阵", exact: true }).click();
    await expect(page.locator(".matrix-scroll")).toBeVisible();
    await expect(page.locator(".orbit-nav-scrim")).toHaveCount(0);
    await page.waitForTimeout(250);
    const matrix = await page.evaluate(() => {
      const scroller = document.querySelector(".matrix-scroll")!;
      return {
        rootClient: document.documentElement.clientWidth,
        rootScroll: document.documentElement.scrollWidth,
        client: scroller.clientWidth,
        scroll: scroller.scrollWidth,
      };
    });
    expect(matrix.rootScroll).toBe(matrix.rootClient);
    expect(matrix.scroll).toBeGreaterThan(matrix.client);
    await page.screenshot({ path: "docs/refactor/screenshots/matrix-mobile.png" });

    await page.goto("/#/data/tasks");
    await expect(page.locator(".data-task-list")).toBeVisible();
    const taskLayout = await page.evaluate(() => {
      const scroller = document.querySelector(".data-task-list")!;
      return { rootClient: document.documentElement.clientWidth, rootScroll: document.documentElement.scrollWidth, client: scroller.clientWidth, scroll: scroller.scrollWidth };
    });
    expect(taskLayout.rootScroll).toBe(taskLayout.rootClient);
    expect(taskLayout.scroll).toBeGreaterThan(taskLayout.client);

    await page.goto("/#/plans/beasts");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
    await expect(page.locator(".settings-band input, .resource-table input, .task-list input")).toHaveCount(0);
  });
});

test.describe("tablet application", () => {
  test("关键页面无页面级横向溢出", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("tablet-"));
    for (const url of ["/#/", "/#/assets/pets", "/#/plans/upgrades", "/#/data/market", "/#/data/resources", "/#/analysis/matrix"]) {
      await page.goto(url);
      await expect(page.locator(".orbit-dashboard-page, .page-wrap")).toBeVisible();
      const width = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      expect(width.scroll, `${url} 不应产生页面级横向滚动`).toBe(width.client);
    }
    await page.goto("/#/");
    await page.screenshot({ path: `docs/refactor/screenshots/dashboard-${testInfo.project.name}.png` });
  });
});
