import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("sw-e2e-auth-v1", "1"));
});

test.describe("desktop application", () => {
  test("旧账号范围不会过滤五账号分析", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    await page.addInitScript(() => localStorage.setItem("sw.app.ui.v1", JSON.stringify({
      accountScope: "LG2",
      recentAccount: "LG2",
      matrixDensity: "compact",
      matrixDisplay: { stats: true, aptitudes: true, skills: true },
    })));

    const accountIds = ["FC", "LG1", "LG2", "PT", "MYT"];
    await page.goto("/#/analysis/recommendations");
    const recommendationCodes = page.locator(".recommendation-board .account-code");
    await expect(recommendationCodes.first()).toBeVisible();
    const recommendationAccounts = await recommendationCodes.allTextContents();
    expect([...new Set(recommendationAccounts)].sort()).toEqual([...accountIds].sort());

    await page.goto("/#/analysis/species");
    await expect(page.getByRole("heading", { name: "同名对比", exact: true })).toBeVisible();
    const speciesAccountColumns = await page.locator(".species-table article > span:nth-child(2)").allTextContents();
    for (const accountId of accountIds) {
      expect(speciesAccountColumns.some((value) => value.includes(accountId))).toBeTruthy();
    }
  });

  test("核心路由、搜索和业务基线", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    await page.goto("/#/");
    await expect(page.getByRole("heading", { name: "五条主线推进轨道" })).toBeVisible();
    await expect(page.locator(".mainline-row")).toHaveCount(5);
    await expect(page.getByRole("button", { name: /录入五号库存快照/ })).toBeVisible();
    await page.getByRole("button", { name: "录入五号库存快照", exact: true }).click();
    const inventoryDialog = page.getByRole("dialog", { name: "录入库存快照" });
    await expect(inventoryDialog).toBeVisible();
    await expect(inventoryDialog.getByRole("spinbutton")).toHaveCount(20);
    await inventoryDialog.getByRole("button", { name: "关闭库存快照录入" }).click();
    await expect(inventoryDialog).toHaveCount(0);
    const typography = await page.evaluate(() => ({
      nav: Number.parseFloat(getComputedStyle(document.querySelector(".orbit-nav a")!).fontSize),
      title: Number.parseFloat(getComputedStyle(document.querySelector(".workbench-titlebar h1")!).fontSize),
      body: Number.parseFloat(getComputedStyle(document.querySelector(".workbench-page")!).fontSize),
      button: Number.parseFloat(getComputedStyle(document.querySelector("button")!).fontSize),
    }));
    expect(typography.nav).toBeGreaterThanOrEqual(14);
    expect(typography.title).toBeGreaterThanOrEqual(22);
    expect(typography.body).toBeGreaterThanOrEqual(14);
    expect(typography.button).toBeGreaterThanOrEqual(13);
    await page.screenshot({ path: testInfo.outputPath("dashboard-desktop.png") });

    const routes = [
      ["/#/accounts/LG2", "LG2 账号详情"],
      ["/#/assets/pets", "宠物资产"],
      ["/#/assets/equipment", "装备资产"],
      ["/#/assets/skills", "技能资料"],
      ["/#/assets/evidence", "截图证据"],
      ["/#/plans/upgrades", "宝石计划"],
      ["/#/plans/beasts", "神兽主线任务"],
      ["/#/plans/tasks", "任务维护"],
      ["/#/plans/timeline", "五号主线概览"],
      ["/#/plans/parameters", "计划参数"],
      ["/#/analysis/recommendations", "推荐分析"],
      ["/#/analysis/species", "同名对比"],
      ["/#/analysis/matrix", "固定矩阵"],
      ["/#/publish", "内容发布"],
      ["/#/data/market", "宝石行情"],
      ["/#/data/resources", "库存资料"],
      ["/#/data/sources", "数据来源"],
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
    await page.getByRole("tab", { name: "PK：速度" }).click();
    await expect(page.locator(".matrix-table tbody tr")).toHaveCount(3);
    await expect(page.getByRole("tab", { name: "PK：速度" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("columnheader")).toHaveCount(6);

    await page.getByRole("tab", { name: "PK：神兽蛇 / 小马" }).click();
    await expect(page.locator(".matrix-table tbody th > strong")).toHaveText(["剑气蛇", "法蛇", "隐攻蛇", "小马"]);
    await expect(page.getByText("剑气蛇、法蛇、隐攻蛇与小马", { exact: true })).toBeVisible();
    await expect(page.getByText("追影蛇", { exact: true })).toHaveCount(0);

    const skills = page.getByRole("checkbox", { name: "技能" });
    await skills.uncheck();
    await expect(page.locator(".matrix-skills")).toHaveCount(0);
    await skills.check();

    await page.goto("/#/publish");
    await page.getByRole("button", { name: "推荐首发" }).click();
    await expect(page.getByText("已选 15 组 · 36 张图", { exact: true })).toBeVisible();
    await expect(page.locator(".output-panel textarea")).toHaveValue(/资产总览/);

    await page.goto("/#/plans/upgrades");
    await expect(page.locator(".gem-ocr-panel, .market-band input")).toHaveCount(0);
    await page.goto("/#/plans/beasts");
    await expect(page.locator(".settings-band input, .resource-table input, .task-list input")).toHaveCount(0);
    await expect(page.getByRole("option", { name: "小马", exact: true })).toHaveCount(1);
    await expect(page.getByText("普通宠不进入此任务表", { exact: false })).toBeVisible();

    await page.goto("/#/data/tasks");
    await expect(page).toHaveURL(/#\/plans\/tasks$/);
    await expect(page.getByRole("heading", { name: "任务维护", exact: true })).toBeVisible();
    const taskStatusFilter = page.getByRole("group", { name: "任务状态筛选" });
    await expect(taskStatusFilter.getByRole("button", { name: /待完成/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".task-work-row.done")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "计划参数", exact: true })).toBeVisible();
    await expect(page.getByText("单项可直接标记完成", { exact: false })).toBeVisible();

    await page.getByLabel("任务账号筛选").selectOption("LG1");
    await page.getByLabel("任务关键词筛选").fill("剑气蛇 皮肤");
    const completionRow = page.locator(".task-work-row").filter({ hasText: "剑气蛇" });
    await expect(completionRow).toHaveCount(1);
    await completionRow.getByRole("button", { name: /标记完成/ }).click();
    await expect(page.locator(".task-work-row")).toHaveCount(0);
    await taskStatusFilter.getByRole("button", { name: /已完成/ }).click();
    await expect(page.locator(".task-work-row.done")).toHaveCount(1);
    await expect(page.locator(".task-work-row.done").getByRole("button", { name: /恢复未完成/ })).toBeVisible();

    await page.goto("/#/plans/parameters");
    await expect(page.getByLabel("每周专用蛋")).toHaveValue("2");
    await expect(page.getByLabel("每周普通蛋")).toHaveValue("2");
    await expect(page.getByLabel("每周银子收入 / 万")).toHaveValue("50");
    await expect(page.getByRole("heading", { name: "单项成本覆盖", exact: true })).toBeVisible();
  });

  test("首页同时突出蛋缺口和资金缺口", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    await page.clock.setFixedTime(new Date("2026-07-18T02:00:00Z"));
    await page.addInitScript(() => {
      localStorage.setItem("sw.app.inventory.v2", JSON.stringify({
        version: 2,
        snapshots: [{
          effectiveDate: "2026-07-18",
          recordedAt: "2026-07-18T02:00:00.000Z",
          accounts: {
            FC: { dedicatedEggs: 7, regularEggs: 7, silverWan: 122, innerShardCount: 30 },
            LG1: { dedicatedEggs: 5, regularEggs: 5, silverWan: 100, innerShardCount: 20 },
            LG2: { dedicatedEggs: 4, regularEggs: 4, silverWan: 100, innerShardCount: 20 },
            PT: { dedicatedEggs: 1, regularEggs: 0, silverWan: 100, innerShardCount: 20 },
            MYT: { dedicatedEggs: 4, regularEggs: 4, silverWan: 60, innerShardCount: 20 },
          },
        }],
      }));
      localStorage.setItem("sw.app.ui.v2", JSON.stringify({
        version: 2,
        accountScope: "ALL",
        recentAccount: "FC",
        matrixDensity: "compact",
        matrixDisplay: { stats: true, aptitudes: true, skills: true },
      }));
    });

    await page.goto("/#/");
    const fcAccount = page.locator(".radar-account-item").filter({ hasText: "FC" });
    await expect(fcAccount.locator(".radar-account-gap strong")).toHaveText("26个蛋");
    await expect(fcAccount.locator(".radar-account-gap em")).toHaveText("差 21万");
    const fundingCard = page.locator(".radar-funding-gap");
    await expect(fundingCard).toContainText("资金缺口");
    await expect(fundingCard.locator("strong")).toHaveText("21万");
    await expect(fundingCard).toContainText("买齐当前缺口还需");

    for (const accountId of ["FC", "LG1", "LG2", "PT", "MYT"]) {
      await page.locator(".radar-account-item").filter({ hasText: accountId }).click();
      await expect(page.locator(".radar-focus-header h2 b")).toHaveText(accountId);
      await expect(fundingCard.locator("strong")).toHaveText(/^(?:\d+(?:\.\d+)?万|待计算|待确认)$/);
    }
    await fcAccount.click();
    await expect(fundingCard.locator("strong")).toHaveText("21万");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
    expect(runtimeErrors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("dashboard-funding-gap.png") });
  });

  test("统一库存快照同时保存蛋、银子和内丹碎片", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    await page.goto("/#/data/inventory");
    await page.getByRole("button", { name: "录入今天库存", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "录入库存快照" });
    await expect(dialog.getByRole("spinbutton")).toHaveCount(20);
    await dialog.getByLabel("FC专用蛋库存").fill("11");
    await dialog.getByLabel("FC普通蛋库存").fill("22");
    await dialog.getByLabel("FC银子库存（万）").fill("33.5");
    await dialog.getByLabel("FC内丹碎片库存").fill("44");
    await dialog.getByRole("button", { name: "保存五号快照" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status")).toContainText(/已保存|已更新/);

    const fcCard = page.getByTestId("inventory-current-account-FC");
    await expect(fcCard).toBeVisible();
    await expect(fcCard).toContainText("内丹碎片");
    await expect(fcCard).toContainText("44");
    const persisted = await page.evaluate(() => ({
      inventory: JSON.parse(localStorage.getItem("sw.app.inventory.v2") || "null"),
      settings: JSON.parse(localStorage.getItem("sw.app.settings.v4") || localStorage.getItem("sw.app.settings.v3") || localStorage.getItem("sw.app.settings.v2") || "null"),
    }));
    expect(persisted.inventory.version).toBe(2);
    expect(persisted.inventory.snapshots[0].accounts.FC).toEqual({
      dedicatedEggs: 11,
      regularEggs: 22,
      silverWan: 33.5,
      innerShardCount: 44,
    });
    expect(persisted.settings).not.toHaveProperty("resources");

    await page.reload();
    await expect(page.getByTestId("inventory-current-account-FC")).toContainText("44");
    await page.goto("/#/accounts/FC");
    await expect(page.getByRole("heading", { name: "FC 账号详情" })).toBeVisible();
    await expect(page.locator(".resource-line")).toContainText("内丹碎片 44");
  });

  test("任务维护支持清晰的批量完成流程", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    await page.goto("/#/plans/tasks");

    const pendingRows = page.locator(".task-work-row:not(.done)");
    const initialCount = await pendingRows.count();
    await pendingRows.nth(0).getByRole("checkbox").check();
    await pendingRows.nth(1).getByRole("checkbox").check();

    const bulkBar = page.getByRole("complementary", { name: "批量任务操作" });
    await expect(bulkBar.getByText("已选 2 项", { exact: true })).toBeVisible();
    await bulkBar.getByRole("button", { name: "批量标记完成", exact: true }).click();
    await expect(page.getByText("已完成 2 项任务并记录完成日期", { exact: false })).toBeVisible();
    await expect(page.locator(".task-work-row:not(.done)")).toHaveCount(initialCount - 2);

    await page.getByRole("group", { name: "任务状态筛选" }).getByRole("button", { name: /已完成/ }).click();
    await expect(page.locator(".task-work-row.done")).toHaveCount(2);
  });

  test("手动发布正文会被复制、保留并可主动重新生成", async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(baseURL!).origin });
    await page.goto("/#/publish");
    await page.getByRole("button", { name: "推荐首发" }).click();

    const draft = page.getByLabel("发布正文");
    await expect(draft).toHaveValue(/资产总览/);
    const manualText = "这是手动修改后的最终发布正文。";
    await draft.fill(manualText);
    await expect(page.getByText("已保留手动编辑", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "纯文本", exact: true }).click();
    await expect(draft).toHaveValue(manualText);
    await page.getByRole("button", { name: "复制正文", exact: true }).click();
    await expect(page.getByText("正文已复制", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(manualText);

    await page.reload();
    await expect(page.getByLabel("发布正文")).toHaveValue(manualText);
    await page.getByRole("button", { name: "重新生成正文", exact: true }).click();
    await expect(page.getByLabel("发布正文")).toHaveValue(/资产总览/);
    await expect(page.getByText("已保留手动编辑", { exact: true })).toHaveCount(0);
  });
});

test.describe("mobile application", () => {
  test("导航完全离屏且矩阵局部滚动", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile");
    await page.goto("/#/");
    await expect(page.getByTestId("mobile-week-home")).toBeVisible();
    const layout = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
      navRight: document.querySelector(".orbit-nav")!.getBoundingClientRect().right,
    }));
    expect(layout.scroll).toBe(layout.client);
    expect(layout.navRight).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath("dashboard-mobile.png") });

    await page.getByRole("button", { name: "打开全部导航" }).click();
    const mobileNavigation = page.getByRole("dialog", { name: "主导航" });
    await expect(mobileNavigation).toBeVisible();
    await mobileNavigation.getByRole("link", { name: "分析" }).click();
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
    await expect(page.getByText("可左右滚动；账号表头和位置列会保持可见。")).toBeVisible();
    await expect(page.locator(".matrix-table tbody th").first()).toHaveCSS("position", "sticky");
    await page.screenshot({ path: testInfo.outputPath("matrix-mobile.png") });

    await page.goto("/#/plans/tasks");
    await expect(page.locator(".task-worklist")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
    await expect(page.getByRole("group", { name: "任务状态筛选" })).toBeVisible();
    await page.getByRole("button", { name: "更多筛选", exact: true }).click();
    await expect(page.getByLabel("任务账号筛选")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
    await page.screenshot({ path: testInfo.outputPath("plan-tasks-mobile.png") });

    await page.goto("/#/plans/parameters");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
    await expect(page.getByLabel("每周专用蛋")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("plan-parameters-mobile.png") });

    await page.goto("/#/plans/beasts");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
    await expect(page.locator(".settings-band input, .resource-table input, .task-list input")).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("beasts-mobile.png") });
  });
});

test.describe("pet detail sharing", () => {
  test("desktop and mobile can generate a pet profile image", async ({ page }, testInfo) => {
    test.skip(!["desktop", "mobile"].includes(testInfo.project.name));
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });

    await page.goto("/#/assets/pets?selected=FC%3Apet%3A01");
    const detail = page.locator(".detail-panel");
    await expect(detail.getByRole("heading", { name: "祸斗", exact: true })).toBeVisible();
    const shareButton = detail.getByRole("button", { name: "分享 FC 的 祸斗宠物档案" });
    await expect(shareButton).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await shareButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("FC-祸斗-宠物档案.png");
    await download.saveAs(testInfo.outputPath(`FC-祸斗-宠物档案-${testInfo.project.name}.png`));
    await expect(page.getByRole("status")).toContainText("宠物图片已下载");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
    expect(runtimeErrors).toEqual([]);
    await detail.screenshot({ path: testInfo.outputPath(`pet-detail-share-${testInfo.project.name}.png`) });
  });

  test("selected pets are combined into one share image", async ({ page }, testInfo) => {
    test.skip(!["desktop", "mobile"].includes(testInfo.project.name));
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });

    if (testInfo.project.name === "mobile") {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "canShare", {
          configurable: true,
          value: (data: ShareData) => Boolean(data.files?.length),
        });
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: async (data: ShareData) => {
            (window as typeof window & { __petBatchShare?: Array<{ name: string; type: string; size: number }> }).__petBatchShare = Array.from(data.files || []).map((file) => ({
              name: file.name,
              type: file.type,
              size: file.size,
            }));
          },
        });
      });
    }

    await page.goto("/#/assets/pets?account=FC");
    const petCheckboxes = page.getByRole("checkbox", { name: /选择 FC 的/ });
    for (const index of [0, 1, 2, 3, 6]) await petCheckboxes.nth(index).check();
    const batchBar = page.getByRole("complementary", { name: "批量分享宠物" });
    await expect(batchBar.getByText("5 只宠物", { exact: true })).toBeVisible();
    const shareButton = batchBar.getByRole("button", { name: "批量分享 5 只宠物" });

    if (testInfo.project.name === "mobile") {
      await shareButton.click();
      await expect(batchBar.getByRole("status")).toHaveText("已生成 1 张合集图");
      const sharedFiles = await page.evaluate(() => (window as typeof window & { __petBatchShare?: Array<{ name: string; type: string; size: number }> }).__petBatchShare);
      expect(sharedFiles).toHaveLength(1);
      expect(sharedFiles?.[0]?.name).toBe("宠物合集-2026-07-13-5只.png");
      expect(sharedFiles?.every((file) => file.type === "image/png" && file.size > 0)).toBeTruthy();
    } else {
      const downloadPromise = page.waitForEvent("download");
      await shareButton.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe("宠物合集-2026-07-13-5只.png");
      await download.saveAs(testInfo.outputPath("宠物合集-5只.png"));
      await expect(batchBar.getByRole("status")).toHaveText("宠物合集图已下载");
    }

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
    expect(runtimeErrors).toEqual([]);
    await batchBar.screenshot({ path: testInfo.outputPath(`pet-batch-share-${testInfo.project.name}.png`) });
    await page.screenshot({ path: testInfo.outputPath(`pet-batch-page-${testInfo.project.name}.png`) });
  });
});

test.describe("tablet application", () => {
  test("关键页面无页面级横向溢出", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("tablet-"));
    for (const url of ["/#/", "/#/assets/pets", "/#/plans/beasts", "/#/plans/tasks", "/#/plans/parameters", "/#/plans/upgrades", "/#/data/market", "/#/data/resources", "/#/analysis/matrix"]) {
      await page.goto(url);
      await expect(page.locator(".workbench-page, .page-wrap")).toBeVisible();
      const width = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      expect(width.scroll, `${url} 不应产生页面级横向滚动`).toBe(width.client);
    }
    await page.goto("/#/");
    await page.screenshot({ path: testInfo.outputPath(`dashboard-${testInfo.project.name}.png`) });
    await page.goto("/#/plans/beasts");
    await page.screenshot({ path: testInfo.outputPath(`beasts-${testInfo.project.name}.png`) });
    await page.goto("/#/plans/tasks");
    await page.screenshot({ path: testInfo.outputPath(`plan-tasks-${testInfo.project.name}.png`) });
  });
});

test.describe("schedule completion dates", () => {
  test("首页轨道标记今天可完成，账号任务显示完整预计日期", async ({ page }, testInfo) => {
    await page.clock.setFixedTime(new Date("2026-07-13T02:00:00Z"));
    await page.addInitScript(() => {
      localStorage.setItem("sw.app.inventory.v2", JSON.stringify({
        version: 2,
        snapshots: [{
          effectiveDate: "2026-07-12",
          recordedAt: "2026-07-12T02:00:00.000Z",
          accounts: Object.fromEntries(["FC", "LG1", "LG2", "PT", "MYT"].map((id) => [id, {
            dedicatedEggs: 10_000,
            regularEggs: 10_000,
            silverWan: 10_000,
            innerShardCount: 1_000,
          }])),
        }],
      }));
      localStorage.setItem("sw.app.settings.v2", JSON.stringify({
        version: 2,
        settings: { startDate: "2026-07-02" },
      }));
    });

    await page.goto("/#/");
    if (testInfo.project.name === "mobile") {
      const taskBrief = page.locator(".mobile-task-brief");
      await expect(taskBrief).toContainText(/\d+ 项现在可完成/);
      expect(await page.locator(".mobile-current-tasks > li").count()).toBeGreaterThan(0);
      await page.locator(".mobile-today-card").screenshot({ path: testInfo.outputPath(`schedule-track-${testInfo.project.name}.png`) });
    } else {
      const ptMainline = page.locator(".mainline-row").filter({ hasText: "PT" });
      const currentTrackTask = ptMainline.locator(".task-track-labels span").first();
      await expect(currentTrackTask.locator("b")).toContainText("剑气蛇 · 进阶2");
      await expect(currentTrackTask.locator(".task-ready-badge")).toHaveText("现在可完成");
      await expect(currentTrackTask.locator("small")).toHaveText("今天可完成");
      await expect(ptMainline.locator(".task-track-finish")).toHaveText("整条主线：待洗护符后排期");
      if (testInfo.project.name === "desktop") {
        const tableWidth = await page.locator(".mainline-table-scroll").evaluate((element) => {
          const table = element.querySelector(".mainline-table")!;
          const lastCell = element.querySelector(".mainline-row > :last-child")!;
          return {
            client: element.clientWidth,
            scroll: element.scrollWidth,
            tableRight: table.getBoundingClientRect().right,
            lastCellRight: lastCell.getBoundingClientRect().right,
          };
        });
        expect(tableWidth.scroll).toBe(tableWidth.client);
        expect(Math.abs(tableWidth.tableRight - tableWidth.lastCellRight)).toBeLessThan(1);
        await expect(page.getByRole("link", { name: /查看 .* 账号明细/ })).toHaveCount(5);
      }
      await ptMainline.locator(".task-track").screenshot({ path: testInfo.outputPath(`schedule-track-${testInfo.project.name}.png`) });
    }

    await page.goto("/#/accounts/PT");
    const accountTask = page.locator(".task-mini-list > div").filter({ hasText: "剑气蛇 · 进阶2" }).first();
    await expect(accountTask.locator("small")).toHaveText("预计 7月13日完成");
    await expect(page.locator(".account-mainline-finish")).toHaveText("整条主线：待洗护符后排期");
    await accountTask.scrollIntoViewIfNeeded();
    const accountWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(accountWidth.scroll).toBe(accountWidth.client);
    await page.screenshot({ path: testInfo.outputPath(`account-schedule-${testInfo.project.name}.png`) });
  });
});

test.describe("standalone gem plan", () => {
  test("target dropdown recalculates five accounts and generates one share image", async ({ page }, testInfo) => {
    await page.clock.setFixedTime(new Date("2026-07-21T02:00:00Z"));
    await page.goto("/#/plans/gems");

    await expect(page.getByRole("heading", { name: "宝石计划", exact: true })).toBeVisible();
    const target = page.getByLabel("目标段位");
    expect(await target.locator("option").count()).toBeGreaterThan(10);
    await target.selectOption("14");
    await page.getByRole("button", { name: "查看 FC 宝石计划" }).click();
    await expect(page.getByRole("heading", { name: "FC · 到 14 段", exact: true })).toBeVisible();

    const weeklyIncome = page.getByLabel("每号每周投入");
    await weeklyIncome.fill("120");
    await weeklyIncome.press("Tab");
    await expect(page.getByText("每个账号按 120 万 / 周独立计算", { exact: true })).toBeVisible();
    await expect(page.locator(".gem-account-row")).toHaveCount(5);
    await page.getByRole("button", { name: "查看 LG1 宝石计划" }).click();
    await expect(page.getByRole("heading", { name: "LG1 · 到 14 段", exact: true })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "分享宝石计划" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("宝石计划-14-2026-07-21.png");
    await download.saveAs(testInfo.outputPath(`宝石计划-14-${testInfo.project.name}.png`));
    await page.screenshot({ path: testInfo.outputPath(`gem-plan-${testInfo.project.name}.png`), fullPage: true });
  });
});

test.describe("week-to-date activity report", () => {
  test("task spending is reconciled into harvest and a report image can be generated manually", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.startsWith("tablet-"));
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    await page.clock.setFixedTime(new Date("2026-07-22T02:00:00.000Z"));
    await page.addInitScript(() => {
      const accountIds = ["FC", "LG1", "LG2", "PT", "MYT"];
      const balances = (silverWan: number) => Object.fromEntries(accountIds.map((id) => [id, {
        dedicatedEggs: 10,
        regularEggs: 10,
        silverWan,
        innerShardCount: 20,
      }]));
      localStorage.setItem("sw.app.inventory.v2", JSON.stringify({
        version: 2,
        snapshots: [
          { effectiveDate: "2026-07-19", recordedAt: "2026-07-19T02:00:00.000Z", accounts: balances(100) },
          { effectiveDate: "2026-07-22", recordedAt: "2026-07-22T02:00:00.000Z", accounts: balances(104) },
        ],
      }));
    });

    await page.goto("/#/plans/tasks");
    await expect(page).toHaveTitle("万象册");
    await expect(page.locator(".orbit-brand strong")).toHaveText("万象册");
    const silverTask = page.locator(".task-work-row").filter({ hasText: /万/ }).first();
    await expect(silverTask).toBeVisible();
    const resourceText = (await silverTask.locator(".task-resource-cell").innerText()).replaceAll(",", "");
    const taskExpense = Number(resourceText.match(/[\d.]+/)?.[0]);
    expect(taskExpense).toBeGreaterThan(0);
    await silverTask.getByRole("button", { name: /标记完成/ }).click();
    await expect(page.getByRole("status")).toContainText("银子支出");

    if (testInfo.project.name === "mobile") {
      await page.goto("/#/week");
      await expect(page).toHaveURL(/#\/week$/);
    } else {
      await page.goto("/#/data/inventory");
      await expect(page).toHaveURL(/#\/data\/inventory$/);
      await page.getByRole("button", { name: "周报分析", exact: true }).click();
    }
    const activity = page.getByTestId("weekly-activity-panel");
    await expect(activity.getByText("本周截至 7月22日", { exact: true })).toBeVisible();
    await expect(activity.getByText("2026-07-20 至 2026-07-22", { exact: true })).toBeVisible();
    await expect(activity.getByText("本周收获 = 库存净变化 + 库存比较区间内的银子支出", { exact: true })).toBeVisible();

    await activity.getByRole("button", { name: "补记其他支出", exact: true }).click();
    await activity.getByLabel("其他支出账号").selectOption("LG1");
    await activity.getByLabel("其他支出金额（万）").fill("10");
    await activity.getByLabel("其他支出用途").fill("购买材料");
    await activity.getByRole("button", { name: "保存支出", exact: true }).click();
    await expect(activity.getByText("购买材料", { exact: true })).toBeVisible();
    const accountRows = activity.locator(".weekly-account-row");
    await expect(accountRows).toHaveCount(5);
    await expect(activity.locator(".weekly-account-row[data-account-id='LG1'] .account-expense small")).toContainText("其他 10");

    const expectedExpense = taskExpense + 10;
    const expenseMetric = activity.locator(".weekly-cashflow-metrics > div").filter({ hasText: "本周支出" });
    const harvestMetric = activity.locator(".weekly-cashflow-metrics > div").filter({ hasText: "本周收获" });
    await expect(expenseMetric.locator("dd")).toHaveText(`${expectedExpense.toLocaleString("zh-CN")} 万`);
    await expect(harvestMetric.locator("dd")).toHaveText(`${(20 + expectedExpense).toLocaleString("zh-CN")} 万`);

    await activity.getByRole("button", { name: "生成本周小结", exact: true }).click();
    const preview = page.getByRole("dialog", { name: "本周小结图片" });
    await expect(preview).toBeVisible();
    const reportImage = preview.getByRole("img", { name: "生成的本周小结图片预览" });
    await expect(reportImage).toHaveJSProperty("naturalWidth", 1080);
    expect(await reportImage.evaluate((image: HTMLImageElement) => image.naturalHeight)).toBeGreaterThan(1_300);
    const downloadPromise = page.waitForEvent("download");
    await preview.getByRole("button", { name: "下载 PNG", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("本周小结-2026-07-20-2026-07-22.png");
    await download.saveAs(testInfo.outputPath(`weekly-activity-report-${testInfo.project.name}.png`));
    await preview.getByRole("button", { name: "关闭本周小结图片预览" }).click();
    await expect(preview).toHaveCount(0);

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBe(pageWidth.client);
    expect(runtimeErrors).toEqual([]);
    await activity.screenshot({ path: testInfo.outputPath(`weekly-activity-panel-${testInfo.project.name}.png`) });
  });
});
