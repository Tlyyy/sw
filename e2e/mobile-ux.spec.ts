import { expect, test, type Page } from "@playwright/test";

const mobileRoutes = [
  "/#/",
  "/#/record",
  "/#/earnings",
  "/#/week",
  "/#/resources",
  "/#/accounts/LG2",
  "/#/assets/pets",
  "/#/assets/equipment",
  "/#/assets/skills",
  "/#/assets/evidence",
  "/#/plans/upgrades",
  "/#/plans/beasts",
  "/#/plans/tasks",
  "/#/plans/timeline",
  "/#/plans/parameters",
  "/#/analysis/recommendations",
  "/#/analysis/species",
  "/#/analysis/matrix",
  "/#/publish",
  "/#/data/inventory",
  "/#/data/market",
  "/#/data/sources",
  "/#/settings",
] as const;

const formRoutes = [
  "/#/record",
  "/#/earnings",
  "/#/week",
  "/#/assets/pets",
  "/#/assets/equipment",
  "/#/assets/skills",
  "/#/plans/tasks",
  "/#/plans/parameters",
  "/#/analysis/species",
  "/#/analysis/matrix",
  "/#/publish",
  "/#/data/inventory",
  "/#/data/market",
  "/#/settings",
] as const;

const primaryTargetSelector = [
  ".orbit-menu-button",
  ".orbit-header-tools .orbit-command-trigger",
  ".orbit-nav.open a",
  ".orbit-nav.open button",
  ".orbit-mobile-dock > a",
  ".orbit-mobile-dock > button",
  ".subnav a",
  "main .button",
  "main .workbench-primary",
  "main .radar-action-card.primary",
  "main .mobile-record-primary",
  "main .mobile-weekly-report-card",
  "main .mobile-task-brief > a",
  "main .mobile-account-progress-link",
  "main .mobile-account-earnings-link",
  "main .earnings-intro .movement-toggle",
  "main .earnings-account-tabs button",
  "main .movement-panel button",
  "main .ledger-list button",
  "main .record-primary-action",
  "main .record-option-card",
  "main .inventory-week-button",
  "main .inventory-week-current",
  "main .task-select-cell",
  "main .task-row-action",
  "main [role='tab']",
  "main button[aria-pressed]",
].join(",");

function dateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function currentShanghaiWeek() {
  const shanghaiNow = new Date(Date.now() + 8 * 60 * 60 * 1_000);
  const currentDay = new Date(Date.UTC(shanghaiNow.getUTCFullYear(), shanghaiNow.getUTCMonth(), shanghaiNow.getUTCDate()));
  const monday = new Date(currentDay.getTime() - ((currentDay.getUTCDay() + 6) % 7) * 86_400_000);
  const at = (offset: number) => dateKey(new Date(monday.getTime() + offset * 86_400_000));
  return {
    baseline: at(-1),
    monday: at(0),
    tuesday: at(1),
    wednesday: at(2),
    thursday: at(3),
    friday: at(4),
    saturday: at(5),
    sunday: at(6),
    today: dateKey(currentDay),
  };
}

async function waitForApplicationPage(page: Page) {
  await expect(page.locator(".mobile-home-page, .workbench-page, .page-wrap, .matrix-page, .earnings-page").first()).toBeVisible();
}

async function pageOverflowReport(page: Page) {
  return page.locator(".orbit-main").evaluate((root) => {
    const viewportWidth = document.documentElement.clientWidth;
    const tolerance = 1;

    function isVisible(element: HTMLElement) {
      if (element.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || Number(style.opacity) === 0) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > tolerance && rect.height > tolerance;
    }

    function isInsideLocalHorizontalScroller(element: HTMLElement) {
      for (let ancestor = element.parentElement; ancestor && ancestor !== root; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        const canScrollHorizontally = style.overflowX === "auto" || style.overflowX === "scroll";
        if (canScrollHorizontally && ancestor.scrollWidth > ancestor.clientWidth + tolerance) return true;
      }
      return false;
    }

    function describe(element: HTMLElement) {
      const id = element.id ? `#${element.id}` : "";
      const classes = Array.from(element.classList).slice(0, 3).map((name) => `.${name}`).join("");
      const text = (element.innerText || element.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 48);
      return `${element.tagName.toLowerCase()}${id}${classes}${text ? ` “${text}”` : ""}`;
    }

    function ancestorLayout(element: HTMLElement) {
      const ancestors = [];
      for (let ancestor = element.parentElement; ancestor && ancestors.length < 8; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        const rect = ancestor.getBoundingClientRect();
        ancestors.push({
          element: describe(ancestor),
          overflowX: style.overflowX,
          clientWidth: ancestor.clientWidth,
          scrollWidth: ancestor.scrollWidth,
          left: Number(rect.left.toFixed(1)),
          right: Number(rect.right.toFixed(1)),
        });
      }
      return ancestors;
    }

    const offenders = Array.from(root.querySelectorAll<HTMLElement>("*"))
      .filter(isVisible)
      .filter((element) => !isInsideLocalHorizontalScroller(element))
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.left < -tolerance || rect.right > viewportWidth + tolerance)
      .slice(0, 12)
      .map(({ element, rect }) => ({
        element: describe(element),
        left: Number(rect.left.toFixed(1)),
        right: Number(rect.right.toFixed(1)),
        viewportWidth,
        ancestors: ancestorLayout(element),
      }));

    return {
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      offenders,
    };
  });
}

async function undersizedPrimaryTargets(page: Page) {
  return page.locator(primaryTargetSelector).evaluateAll((elements) => elements.flatMap((element) => {
    const target = element as HTMLElement;
    if (target.closest('[hidden], [aria-hidden="true"], [inert]')) return [];
    const style = getComputedStyle(target);
    const rect = target.getBoundingClientRect();
    if (style.display === "none" || style.visibility === "hidden" || rect.width < 1 || rect.height < 1) return [];
    if (rect.width >= 43.5 && rect.height >= 43.5) return [];
    return [{
      target: target.getAttribute("aria-label") || target.textContent?.trim().replace(/\s+/g, " ").slice(0, 48) || target.tagName.toLowerCase(),
      width: Number(rect.width.toFixed(1)),
      height: Number(rect.height.toFixed(1)),
    }];
  }));
}

async function undersizedInputFonts(page: Page) {
  const selector = [
    'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]):not([type="color"])',
    "select",
    "textarea",
  ].join(",");

  return page.locator(selector).evaluateAll((elements) => {
    let audited = 0;
    const offenders = elements.flatMap((element) => {
      const field = element as HTMLElement;
      if (field.closest('[hidden], [aria-hidden="true"], [inert]')) return [];
      const style = getComputedStyle(field);
      const rect = field.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || rect.width < 1 || rect.height < 1) return [];
      audited += 1;
      const fontSize = Number.parseFloat(style.fontSize);
      if (fontSize >= 16) return [];
      return [{
        field: field.getAttribute("aria-label") || field.getAttribute("placeholder") || field.getAttribute("name") || field.tagName.toLowerCase(),
        fontSize,
      }];
    });
    return { audited, offenders };
  });
}

async function expectCurrentSectionLinkInView(page: Page, url: string, navigationName: string, linkName: string) {
  await page.goto(url);
  await waitForApplicationPage(page);
  const navigation = page.getByRole("navigation", { name: navigationName });
  const routePath = new URL(url, "http://mobile.local").hash.slice(1);
  const activeLink = navigation.locator(`a[href$="${routePath}"]`);
  await expect(navigation).toBeVisible();
  await expect(activeLink).toHaveAttribute("aria-current", "page");

  const geometry = await activeLink.evaluate((element) => {
    const navigation = element.closest("nav");
    if (!navigation) throw new Error("分区链接缺少所属导航");
    const navigationRect = navigation.getBoundingClientRect();
    const linkRect = element.getBoundingClientRect();
    return {
      navigationLeft: navigationRect.left,
      navigationRight: navigationRect.right,
      linkLeft: linkRect.left,
      linkRight: linkRect.right,
      linkHeight: linkRect.height,
    };
  });

  expect(geometry.linkLeft, `${linkName} 左侧不应离开分区导航视区`).toBeGreaterThanOrEqual(geometry.navigationLeft - 1);
  expect(geometry.linkRight, `${linkName} 右侧不应离开分区导航视区`).toBeLessThanOrEqual(geometry.navigationRight + 1);
  expect(geometry.linkHeight, `${linkName} 触控高度应至少为 44px`).toBeGreaterThanOrEqual(43.5);
}

interface SimulatedVisualViewport {
  width?: number;
  height: number;
  offsetLeft?: number;
  offsetTop: number;
  scale?: number;
}

async function simulateVisualViewport(page: Page, metrics: SimulatedVisualViewport) {
  return page.evaluate((nextMetrics) => {
    const viewport = window.visualViewport;
    if (!viewport) return false;
    try {
      const nextValues = [
        ["width", nextMetrics.width ?? viewport.width],
        ["height", nextMetrics.height],
        ["offsetLeft", nextMetrics.offsetLeft ?? viewport.offsetLeft],
        ["offsetTop", nextMetrics.offsetTop],
        ["scale", nextMetrics.scale ?? viewport.scale],
      ] as const;
      nextValues.forEach(([property, value]) => {
        Object.defineProperty(viewport, property, { configurable: true, value });
      });
      viewport.dispatchEvent(new Event("resize"));
      viewport.dispatchEvent(new Event("scroll"));
      return true;
    } catch {
      return false;
    }
  }, metrics);
}

test.describe("mobile UX release gate", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile");
    await page.addInitScript(() => sessionStorage.setItem("sw-e2e-auth-v1", "1"));
  });

  test("所有主要路由只允许局部容器横向滚动", async ({ page }) => {
    test.setTimeout(75_000);
    for (const url of mobileRoutes) {
      await test.step(url, async () => {
        await page.goto(url);
        await waitForApplicationPage(page);
        const report = await pageOverflowReport(page);
        expect(report.offenders, `${url} 存在未放入局部滚动容器的横向裁切`).toEqual([]);
        expect(report.documentScrollWidth, `${url} 不应产生页面级横向滚动`).toBeLessThanOrEqual(report.documentClientWidth + 1);
      });
    }
  });

  test("主要移动导航与操作保持 44px 触控面积", async ({ page }) => {
    await page.goto("/#/");
    await waitForApplicationPage(page);
    await page.getByRole("button", { name: "打开全部导航" }).tap();
    const mobileNavigation = page.getByRole("dialog", { name: "主导航" });
    await expect(mobileNavigation).toBeVisible();
    const accountQuickLinks = mobileNavigation.locator(".orbit-mobile-account-links > a");
    await expect(accountQuickLinks).toHaveText(["FC", "LG1", "PT", "LG2", "MYT"]);
    expect(await accountQuickLinks.evaluateAll((elements) => elements.map((element) => element.getAttribute("href"))))
      .toEqual(["#/accounts/FC", "#/accounts/LG1", "#/accounts/PT", "#/accounts/LG2", "#/accounts/MYT"]);
    expect(await undersizedPrimaryTargets(page), "移动主导航存在不足 44px 的主要触控目标").toEqual([]);
    await mobileNavigation.getByRole("button", { name: "关闭导航" }).tap();

    for (const url of [
      "/#/",
      "/#/record",
      "/#/earnings",
      "/#/week",
      "/#/resources",
      "/#/accounts/FC",
      "/#/plans/tasks",
      "/#/analysis/matrix",
      "/#/settings",
    ] as const) {
      await test.step(url, async () => {
        await page.goto(url);
        await waitForApplicationPage(page);
        expect(await undersizedPrimaryTargets(page), `${url} 存在不足 44px 的主要触控目标`).toEqual([]);
      });
    }
  });

  test("iPhone 16 Pro Max 底栏避开 Home Indicator 且账号操作保持单行", async ({ page }) => {
    await page.goto("/#/accounts/FC");
    await waitForApplicationPage(page);
    await page.addStyleTag({
      content: ":root{--orbit-safe-area-top:59px!important;--orbit-safe-area-bottom:34px!important}",
    });

    const mainlineSection = page.locator(".account-page .split-workspace > div").filter({ hasText: "主线任务与资源" });
    const inventoryLink = mainlineSection.getByRole("link", { name: /更新库存/ });
    await expect(inventoryLink).toBeVisible();

    const layout = await page.evaluate(() => {
      const dock = document.querySelector<HTMLElement>(".orbit-mobile-dock");
      const main = document.querySelector<HTMLElement>(".orbit-main");
      const topbar = document.querySelector<HTMLElement>(".orbit-topbar");
      const brand = document.querySelector<HTMLElement>(".orbit-brand");
      const syncState = document.querySelector<HTMLElement>(".orbit-sync-state");
      const link = [...document.querySelectorAll<HTMLElement>(".account-page .section-head > a")]
        .find((element) => element.textContent?.includes("更新库存"));
      if (!dock || !main || !topbar || !brand || !syncState || !link) throw new Error("iPhone 安全区审查缺少目标元素");
      const dockRect = dock.getBoundingClientRect();
      const buttonBottom = Math.max(...[...dock.querySelectorAll<HTMLElement>("a, button")]
        .map((element) => element.getBoundingClientRect().bottom));
      const linkStyle = getComputedStyle(link);
      return {
        viewportHeight: window.innerHeight,
        topbarHeight: topbar.getBoundingClientRect().height,
        topbarContentHeight: topbar.getBoundingClientRect().height - 59,
        brandTop: brand.getBoundingClientRect().top,
        syncTop: syncState.getBoundingClientRect().top,
        dockHeight: dockRect.height,
        dockTop: dockRect.top,
        dockPaddingBottom: Number.parseFloat(getComputedStyle(dock).paddingBottom),
        buttonBottom,
        mainPaddingBottom: Number.parseFloat(getComputedStyle(main).paddingBottom),
        linkHeight: link.getBoundingClientRect().height,
        linkWhiteSpace: linkStyle.whiteSpace,
        linkFits: link.scrollWidth <= link.clientWidth + 1,
      };
    });

    expect(layout.topbarContentHeight, "安全区外的顶部栏应保持 48px 紧凑高度").toBeCloseTo(48, 0);
    expect(layout.topbarHeight, "顶部栏总高度应包含 59px iPhone 状态栏安全区").toBeCloseTo(107, 0);
    expect(layout.brandTop, "品牌文字不能进入灵动岛/状态栏区域").toBeGreaterThanOrEqual(59);
    expect(layout.syncTop, "同步状态不能进入灵动岛/状态栏区域").toBeGreaterThanOrEqual(59);
    expect(layout.dockPaddingBottom, "底栏应为 Home Indicator 留出安全区").toBeGreaterThanOrEqual(34);
    expect(layout.dockHeight, "底栏总高度应包含按钮区与底部安全区").toBeGreaterThanOrEqual(103);
    expect(layout.buttonBottom, "底部按钮不能进入 Home Indicator 区域").toBeLessThanOrEqual(layout.viewportHeight - 34);
    expect(layout.mainPaddingBottom, "正文应为固定底栏预留滚动空间").toBeGreaterThanOrEqual(layout.dockHeight + 10);
    expect(layout.linkHeight, "更新库存应保持可触控高度").toBeGreaterThanOrEqual(44);
    expect(layout.linkWhiteSpace).toBe("nowrap");
    expect(layout.linkFits, "更新库存不能被挤成两行").toBe(true);
  });

  test("首页首屏保持紧凑并呈现逐账号本周入口", async ({ page }) => {
    await page.goto("/#/");
    await waitForApplicationPage(page);

    await expect(page.getByTestId("mobile-week-home")).toBeVisible();
    await expect(page.locator(".mobile-week-rhythm > article")).toHaveCount(7);
    await expect(page.locator(".mobile-record-primary")).toBeVisible();
    await expect(page.locator(".mobile-task-brief")).toBeVisible();
    await expect(page.locator(".mobile-account-progress-list > article")).toHaveCount(5);
    await expect(page.locator(".mobile-weekly-report-card")).toHaveAttribute("href", "#/week");
    await expect(page.getByRole("navigation", { name: "手机快捷导航" }).locator("a, button")).toHaveText([
      "首页",
      "录入",
      "任务",
      "本周小结",
      "更多",
    ]);

    const layout = await page.evaluate(() => {
      const rhythm = document.querySelector<HTMLElement>(".mobile-week-rhythm");
      const primaryAction = document.querySelector<HTMLElement>(".mobile-record-primary");
      const mobileDock = document.querySelector<HTMLElement>(".orbit-mobile-dock");
      if (!rhythm || !primaryAction || !mobileDock) {
        throw new Error("首页移动首屏关键区域未完整渲染");
      }
      const rhythmRect = rhythm.getBoundingClientRect();
      const primaryRect = primaryAction.getBoundingClientRect();
      const dockRect = mobileDock.getBoundingClientRect();
      return {
        rhythmLeft: rhythmRect.left,
        rhythmRight: rhythmRect.right,
        rhythmScrollWidth: rhythm.scrollWidth,
        rhythmClientWidth: rhythm.clientWidth,
        primaryBottom: primaryRect.bottom,
        dockTop: dockRect.top,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    });

    expect(layout.rhythmLeft, "七天节奏左侧不能超出视口").toBeGreaterThanOrEqual(0);
    expect(layout.rhythmRight, "七天节奏右侧不能超出视口").toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.rhythmScrollWidth, "七天节奏必须一次完整展示").toBeLessThanOrEqual(layout.rhythmClientWidth + 1);
    expect(layout.primaryBottom, "主操作不应被底部导航遮挡").toBeLessThanOrEqual(layout.dockTop - 6);
    expect(layout.documentWidth, "首页不应产生横向页面滚动").toBeLessThanOrEqual(layout.viewportWidth + 1);
  });

  test("iPhone 16 Pro Max 首页记录今天一次点击直达库存弹窗", async ({ page }, testInfo) => {
    let releaseRecordPage = () => undefined;
    const recordPageGate = new Promise<void>((resolve) => {
      releaseRecordPage = resolve;
    });
    let recordPageRequested = false;
    await page.route(/\/(?:src\/features\/mobile\/RecordPage\.vue|assets\/RecordPage-[^/?]+\.js)(?:\?.*)?$/, async (route) => {
      recordPageRequested = true;
      await recordPageGate;
      await route.continue();
    });
    await page.addInitScript(() => localStorage.removeItem("sw.app.inventory.v2"));
    await page.goto("/#/");
    await waitForApplicationPage(page);

    const recordToday = page.locator(".mobile-record-primary");
    await expect(recordToday).toHaveText("记录今天");
    await expect(recordToday).toHaveAttribute("href", "#/record?open=inventory");
    await expect.poll(() => recordPageRequested, { message: "手机首页应在点击前预热录入页" }).toBe(true);
    await recordToday.evaluate((element) => (element as HTMLElement).click());
    await expect(recordToday).toHaveAttribute("aria-busy", "true");
    await expect(recordToday).toHaveText("正在打开…");
    releaseRecordPage();

    const dialog = page.getByRole("dialog", { name: "录入库存快照" });
    await expect(page).toHaveURL(/#\/record$/);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("tab")).toHaveCount(5);
    await expect(dialog.getByRole("tab", { name: /^FC 账号/ })).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByRole("spinbutton")).toHaveCount(4);
    await page.screenshot({ path: testInfo.outputPath("home-direct-record-iphone-16-pro-max.png") });
    await dialog.getByRole("button", { name: "取消", exact: true }).tap();
    await expect(dialog).toHaveCount(0);

    await page.reload();
    await waitForApplicationPage(page);
    await expect(dialog).toHaveCount(0);
  });

  test("首页固定展示五个账号并提供详情与实际所得入口", async ({ page }) => {
    await page.goto("/#/");
    await waitForApplicationPage(page);

    const accountIds = ["FC", "LG1", "PT", "LG2", "MYT"] as const;
    const accountCards = page.locator(".mobile-account-progress-list > article");
    const accountLinks = accountCards.locator(".mobile-account-progress-link");
    const earningsLinks = accountCards.locator(".mobile-account-earnings-link");
    await expect(accountCards).toHaveCount(accountIds.length);
    expect(await accountCards.evaluateAll((elements) => elements.map((element) => (
      (element as HTMLElement).dataset.accountId
    ))), "首页账号顺序应与系统固定顺序一致").toEqual(accountIds);
    expect(await accountLinks.evaluateAll((elements) => elements.map((element) => element.getAttribute("href"))))
      .toEqual(accountIds.map((accountId) => `#/accounts/${accountId}`));
    expect(await earningsLinks.evaluateAll((elements) => elements.map((element) => element.getAttribute("href"))))
      .toEqual(accountIds.map((accountId) => `#/earnings?account=${accountId}`));

    await page.getByRole("link", { name: "查看 PT 实际所得", exact: true }).tap();
    await expect(page).toHaveURL(/#\/earnings\?account=PT$/);
    await expect(page.getByTestId("earnings-page")).toBeVisible();
    await expect(page.getByRole("button", { name: "查看 PT 实际所得", exact: true })).toHaveAttribute("aria-pressed", "true");

    for (const accountId of accountIds) {
      await test.step(`进入 ${accountId} 账号详情`, async () => {
        await page.goto("/#/");
        await waitForApplicationPage(page);
        const accountLink = page.getByRole("link", { name: `查看 ${accountId} 账号详情`, exact: true });
        await accountLink.scrollIntoViewIfNeeded();
        expect((await accountLink.boundingBox())?.height, `${accountId} 账号入口应保持 44px 触控高度`).toBeGreaterThanOrEqual(44);
        await accountLink.tap();
        await expect(page).toHaveURL(new RegExp(`#\\/accounts\\/${accountId}$`));
        await expect(page.getByRole("heading", { name: `${accountId} 账号详情`, exact: true })).toBeVisible();
      });
    }
  });

  test("首页任务入口能进入任务分区维护", async ({ page }) => {
    await page.goto("/#/");
    await waitForApplicationPage(page);

    await page.getByRole("link", { name: "查看任务", exact: true }).tap();
    await expect(page).toHaveURL(/#\/plans\/tasks$/);
    await expect(page.getByRole("navigation", { name: "手机快捷导航" }).getByRole("link", { name: "任务", exact: true })).toHaveAttribute("aria-current", "page");
  });

  test("任务勾选、完成与批量操作避开固定底栏", async ({ page }) => {
    await page.goto("/#/plans/tasks");
    await waitForApplicationPage(page);
    await page.addStyleTag({
      content: ":root{--orbit-safe-area-bottom:34px!important}",
    });

    const taskRow = page.locator(".task-work-row").filter({ has: page.locator("input[type='checkbox']:not(:disabled)") }).first();
    const selectTarget = taskRow.locator(".task-select-cell");
    const completionAction = taskRow.locator(".task-row-action");
    await expect(taskRow).toBeVisible();
    expect((await selectTarget.boundingBox())?.height, "任务勾选区域应保持 44px 触控高度").toBeGreaterThanOrEqual(44);
    expect((await completionAction.boundingBox())?.height, "标记完成应保持 44px 触控高度").toBeGreaterThanOrEqual(44);
    await taskRow.locator("input[type='checkbox']").check();

    const bulk = page.getByRole("complementary", { name: "批量任务操作" });
    await expect(bulk).toBeVisible();
    await bulk.scrollIntoViewIfNeeded();
    const layout = await page.evaluate(() => {
      const bulkAction = document.querySelector<HTMLElement>(".task-bulk-action-bar");
      const dock = document.querySelector<HTMLElement>(".orbit-mobile-dock");
      if (!bulkAction || !dock) throw new Error("任务批量操作安全区审查缺少目标元素");
      return {
        bulkBottom: bulkAction.getBoundingClientRect().bottom,
        dockTop: dock.getBoundingClientRect().top,
      };
    });
    expect(layout.bulkBottom, "批量操作栏不能被固定底栏覆盖").toBeLessThanOrEqual(layout.dockTop - 6);
  });

  test("固定蛋任务在 iPhone 16 Pro Max 自动计算缺口且不修改库存", async ({ page }, testInfo) => {
    await page.goto("/#/plans/tasks");
    await waitForApplicationPage(page);
    await page.evaluate(() => {
      const accountIds = ["FC", "LG1", "PT", "LG2", "MYT"];
      const accounts = Object.fromEntries(accountIds.map((accountId) => [accountId, {
        dedicatedEggs: accountId === "LG1" ? 9 : 0,
        regularEggs: accountId === "LG1" ? 11 : 0,
        silverWan: 0,
        innerShardCount: 0,
      }]));
      localStorage.setItem("sw.app.inventory.v2", JSON.stringify({
        version: 2,
        snapshots: [{
          effectiveDate: "2026-07-23",
          recordedAt: "2026-07-23T02:00:00.000Z",
          accounts,
        }],
      }));
      const settings = JSON.parse(localStorage.getItem("sw.app.settings.v4") || "null");
      settings.settings.eggPriceWan = 5.5;
      localStorage.setItem("sw.app.settings.v4", JSON.stringify(settings));
    });
    await page.reload();
    await waitForApplicationPage(page);

    await page.getByRole("button", { name: "筛选 LG1 账号任务", exact: true }).tap();
    await page.getByLabel("任务关键词筛选").fill("剑气蛇 皮肤");
    const row = page.locator(".task-work-row").filter({ hasText: "剑气蛇" });
    await expect(row).toHaveCount(1);
    await row.getByRole("button", { name: /标记完成/ }).tap();

    const dialog = page.getByRole("dialog", { name: "确认任务消耗" });
    const automaticSilver = dialog.getByLabel(/^自动补购银子 \/ 万/);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "取消并关闭任务结算" })).toBeFocused();
    await expect(dialog.getByLabel(/^本次实际使用专用蛋 \/ 个/)).not.toBeFocused();
    await expect(automaticSilver).toHaveValue("110");
    await expect(automaticSilver).toHaveAttribute("readonly", "");
    await dialog.getByLabel(/^本次实际使用专用蛋 \/ 个/).fill("0");
    await dialog.getByLabel(/^本次实际使用普通蛋 \/ 个/).fill("1");
    await expect(automaticSilver).toHaveValue("214.5");
    await expect(dialog).toContainText("实际使用 1 + 自动补购 39");
    await expect(dialog).toContainText("今天真实用掉的蛋");

    const eggFieldLayout = await dialog.locator(".task-egg-fields > .task-settlement-field").evaluateAll((elements) => (
      elements.slice(0, 2).map((element) => {
        const rect = element.getBoundingClientRect();
        return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left };
      })
    ));
    expect(eggFieldLayout).toHaveLength(2);
    expect(eggFieldLayout[1].top, "iPhone 上普通蛋应排在专用蛋下方").toBeGreaterThanOrEqual(eggFieldLayout[0].bottom - 1);
    expect(eggFieldLayout.every((field) => field.left >= -1 && field.right <= 441), "蛋输入不应横向裁切").toBe(true);

    expect(await simulateVisualViewport(page, { height: 560, offsetTop: 20 }), "应能模拟 iOS 键盘后的 VisualViewport").toBe(true);
    await expect.poll(() => dialog.evaluate((element) => {
      const backdrop = element.closest<HTMLElement>(".task-settlement-backdrop");
      const footer = element.querySelector<HTMLElement>(".task-settlement-footer");
      if (!backdrop || !footer) return null;
      const backdropRect = backdrop.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      return {
        backdropTop: Math.round(backdropRect.top),
        backdropHeight: Math.round(backdropRect.height),
        footerWithinViewport: footerRect.bottom <= backdropRect.bottom + 1,
      };
    })).toEqual({
      backdropTop: 20,
      backdropHeight: 560,
      footerWithinViewport: true,
    });
    await page.screenshot({ path: testInfo.outputPath("task-settlement-iphone-16-pro-max-keyboard.png") });

    const layout = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const footer = element.querySelector<HTMLElement>(".task-settlement-footer");
      const buttons = Array.from(element.querySelectorAll<HTMLElement>(".task-settlement-footer button"));
      return {
        viewportWidth: document.documentElement.clientWidth,
        viewportHeight: document.documentElement.clientHeight,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        left: rect.left,
        right: rect.right,
        footerBottom: footer?.getBoundingClientRect().bottom ?? 0,
        buttonHeights: buttons.map((button) => button.getBoundingClientRect().height),
      };
    });
    expect(layout.documentOverflow).toBe(0);
    expect(layout.left).toBeGreaterThanOrEqual(-1);
    expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.footerBottom).toBeLessThanOrEqual(layout.viewportHeight + 1);
    expect(layout.buttonHeights.every((height) => height >= 50)).toBe(true);
    await dialog.getByRole("button", { name: "取消", exact: true }).tap();
    await expect(dialog).toHaveCount(0);
  });

  test("逐账号每日实际所得在 iPhone 16 Pro Max 调用系统分享", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      const accountIds = ["FC", "LG1", "PT", "LG2", "MYT"] as const;
      const accounts = (silverWan: number) => Object.fromEntries(accountIds.map((accountId) => [accountId, {
        dedicatedEggs: accountId === "FC" ? 9 : 5,
        regularEggs: accountId === "FC" ? 11 : 4,
        silverWan: accountId === "FC" ? silverWan : 100,
        innerShardCount: accountId === "FC" ? 32 : 20,
      }]));
      localStorage.setItem("sw.app.inventory.v2", JSON.stringify({
        version: 2,
        snapshots: [
          { effectiveDate: "2026-07-22", recordedAt: "2026-07-22T10:00:00.000Z", accounts: accounts(100) },
          { effectiveDate: "2026-07-23", recordedAt: "2026-07-23T10:00:00.000Z", accounts: accounts(90) },
        ],
      }));
      localStorage.setItem("sw.app.accounting.v1", JSON.stringify({
        version: 1,
        entries: [{
          id: "mobile-share-test-expense",
          accountId: "FC",
          effectiveDate: "2026-07-23",
          occurredAt: "2026-07-23T03:00:00.000Z",
          recordedAt: "2026-07-23T03:01:00.000Z",
          status: "confirmed",
          source: "test",
          note: "测试支出",
          legs: [{
            kind: "expense",
            resources: {
              silverWan: 20,
              dedicatedEggs: 0,
              regularEggs: 0,
              innerShards: 0,
            },
          }],
        }],
      }));
      const state = window as typeof window & {
        __earningsShare?: { name: string; type: string; size: number; title?: string };
      };
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: (data: ShareData) => Boolean(data.files?.length),
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: ShareData) => {
          const file = data.files?.[0];
          if (file) state.__earningsShare = {
            name: file.name,
            type: file.type,
            size: file.size,
            title: data.title,
          };
        },
      });
    });

    await page.goto("/#/earnings?account=FC");
    await waitForApplicationPage(page);
    const shareButton = page.getByRole("button", { name: "分享 FC 7月23日 实际所得图片", exact: true });
    await expect(shareButton).toBeVisible();
    const shareBox = await shareButton.boundingBox();
    expect(shareBox?.height, "每日实际所得分享按钮应保持 44px 触控高度").toBeGreaterThanOrEqual(44);
    expect((shareBox?.x || 0) + (shareBox?.width || 0), "分享按钮不应超出 16 Pro Max 视口").toBeLessThanOrEqual(440);
    await shareButton.tap();

    await expect.poll(() => page.evaluate(() => (
      window as typeof window & {
        __earningsShare?: { name: string; type: string; size: number; title?: string };
      }
    ).__earningsShare)).toEqual(expect.objectContaining({
      name: "FC-2026-07-23-每日实际所得.png",
      type: "image/png",
      title: "FC 每日实际所得",
    }));
    const shared = await page.evaluate(() => (
      window as typeof window & {
        __earningsShare?: { name: string; type: string; size: number; title?: string };
      }
    ).__earningsShare);
    expect(shared?.size, "每日实际所得 PNG 不应为空白文件").toBeGreaterThan(10_000);
    await expect(page.getByRole("status")).toContainText("实际所得图片已打开系统分享");
    await page.screenshot({ path: testInfo.outputPath("earnings-share-iphone-16-pro-max.png") });
  });

  test("本周小结可生成 PNG、调用 iPhone 分享并回退下载", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-07-22T02:00:00Z"));
    await page.addInitScript(() => {
      const state = window as typeof window & {
        __allowWeeklyShare?: boolean;
        __weeklyShare?: { name: string; type: string; size: number };
      };
      state.__allowWeeklyShare = true;
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: (data: ShareData) => Boolean(state.__allowWeeklyShare && data.files?.length),
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: ShareData) => {
          const file = data.files?.[0];
          if (file) state.__weeklyShare = { name: file.name, type: file.type, size: file.size };
        },
      });
    });

    await page.goto("/#/week");
    await waitForApplicationPage(page);

    await page.getByRole("button", { name: "生成本周小结", exact: true }).tap();
    const preview = page.getByRole("dialog", { name: "本周小结图片" });
    await expect(preview).toBeVisible();
    const shareButton = preview.getByRole("button", { name: "分享", exact: true });
    const closeButton = preview.getByRole("button", { name: "关闭本周小结图片预览" });
    expect((await shareButton.boundingBox())?.height, "分享按钮应保持 44px 触控高度").toBeGreaterThanOrEqual(44);
    expect((await closeButton.boundingBox())?.height, "小结预览关闭按钮应保持 44px 触控高度").toBeGreaterThanOrEqual(44);
    await shareButton.tap();

    await expect.poll(() => page.evaluate(() => (
      window as typeof window & { __weeklyShare?: { name: string; type: string; size: number } }
    ).__weeklyShare)).toEqual(expect.objectContaining({
      name: "本周小结-2026-07-20-2026-07-22.png",
      type: "image/png",
    }));
    const shared = await page.evaluate(() => (
      window as typeof window & { __weeklyShare?: { name: string; type: string; size: number } }
    ).__weeklyShare);
    expect(shared?.size, "本周小结 PNG 不应为空白文件").toBeGreaterThan(10_000);

    await page.evaluate(() => {
      (window as typeof window & { __allowWeeklyShare?: boolean }).__allowWeeklyShare = false;
    });
    const downloadPromise = page.waitForEvent("download");
    await shareButton.tap();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("本周小结-2026-07-20-2026-07-22.png");
    await preview.getByRole("button", { name: "关闭", exact: true }).tap();
    await expect(preview).toBeHidden();
  });

  test("移动表单输入字号不触发浏览器自动缩放", async ({ page }) => {
    test.setTimeout(60_000);
    let auditedFields = 0;
    for (const url of formRoutes) {
      await test.step(url, async () => {
        await page.goto(url);
        await waitForApplicationPage(page);
        if (url === "/#/record") await page.locator(".record-option-card[aria-controls='quick-expense-form']").tap();
        if (url === "/#/week") await page.getByRole("button", { name: "补记其他支出", exact: true }).tap();
        const moreFilters = page.getByRole("button", { name: "更多筛选", exact: true });
        if (await moreFilters.isVisible().catch(() => false)) await moreFilters.tap();
        const report = await undersizedInputFonts(page);
        auditedFields += report.audited;
        expect(report.offenders, `${url} 存在小于 16px 的可见输入控件`).toEqual([]);
      });
    }
    expect(auditedFields, "应实际审查一批移动表单控件").toBeGreaterThan(10);
  });

  test("库存录入弹窗逐账号录入并适配缩放后的 VisualViewport", async ({ page }, testInfo) => {
    await page.goto("/#/record");
    await waitForApplicationPage(page);
    await page.getByRole("button", { name: /开始录入|检查并更新/ }).tap();

    const dialog = page.getByRole("dialog", { name: "录入库存快照" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("tab")).toHaveCount(5);
    await expect(dialog.getByRole("tab", { name: /^FC 账号/ })).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByRole("spinbutton")).toHaveCount(4);
    await expect(dialog.getByRole("button", { name: "关闭库存快照录入" })).toBeFocused();
    await expect(dialog.getByRole("spinbutton").first()).not.toBeFocused();

    await dialog.getByLabel("FC专用蛋库存").fill("101");
    await dialog.getByLabel("FC普通蛋库存").fill("102");
    await dialog.getByLabel("FC银子库存（万）").fill("103.5");
    await dialog.getByLabel("FC内丹碎片库存").fill("104");
    await dialog.getByLabel("FC普通蛋库存").focus();
    expect(await simulateVisualViewport(page, {
      width: 366,
      height: 540,
      offsetLeft: 37,
      offsetTop: 18,
      scale: 1.2,
    }), "应能模拟 iOS 数字键盘缩放后的完整 VisualViewport").toBe(true);
    await expect.poll(() => dialog.evaluate((element) => {
      const viewport = window.visualViewport;
      const backdrop = element.closest<HTMLElement>(".snapshot-dialog-backdrop");
      const dateField = element.querySelector<HTMLElement>(".snapshot-date-field");
      const entryScroll = element.querySelector<HTMLElement>(".snapshot-entry-scroll");
      const accountPanel = element.querySelector<HTMLElement>(".snapshot-account-panel");
      const accountFields = element.querySelector<HTMLElement>(".snapshot-account-fields");
      const footer = element.querySelector<HTMLElement>("footer");
      if (!viewport || !backdrop || !dateField || !entryScroll || !accountPanel || !accountFields || !footer) return null;
      const viewportLeft = viewport.offsetLeft;
      const viewportTop = viewport.offsetTop;
      const viewportRight = viewportLeft + viewport.width;
      const viewportBottom = viewportTop + viewport.height;
      const backdropRect = backdrop.getBoundingClientRect();
      const dialogRect = element.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      const focusedRect = document.activeElement instanceof HTMLElement
        ? document.activeElement.getBoundingClientRect()
        : null;
      const constrainedElements = [
        element,
        ...element.querySelectorAll<HTMLElement>(
          ".snapshot-account-stepper, .snapshot-account-tab, .snapshot-entry-scroll, .snapshot-account-panel, .snapshot-account-fields, .snapshot-account-field, .snapshot-account-field input, footer, footer .button",
        ),
      ].filter((item) => item.offsetParent !== null);
      const horizontalOffenders = constrainedElements.flatMap((item) => {
        const rect = item.getBoundingClientRect();
        if (rect.left >= viewportLeft - 1 && rect.right <= viewportRight + 1) return [];
        return [item.getAttribute("aria-label") || item.className || item.tagName];
      });
      const scrollContainers = [element, entryScroll, accountPanel, accountFields, footer];
      return {
        viewportLeft: Math.round(viewportLeft),
        viewportTop: Math.round(viewportTop),
        viewportWidth: Math.round(viewport.width),
        viewportHeight: Math.round(viewport.height),
        viewportScale: Number(viewport.scale.toFixed(1)),
        backdropLeft: Math.round(backdropRect.left),
        backdropTop: Math.round(backdropRect.top),
        backdropWidth: Math.round(backdropRect.width),
        backdropHeight: Math.round(backdropRect.height),
        dateVisible: getComputedStyle(dateField).display !== "none",
        dialogWithinViewport: dialogRect.left >= viewportLeft - 1
          && dialogRect.right <= viewportRight + 1
          && dialogRect.top >= viewportTop - 1
          && dialogRect.bottom <= viewportBottom + 1,
        footerWithinViewport: footerRect.bottom <= backdropRect.bottom + 1,
        focusedFieldWithinViewport: Boolean(focusedRect)
          && focusedRect!.left >= viewportLeft - 1
          && focusedRect!.right <= viewportRight + 1
          && focusedRect!.top >= viewportTop - 1
          && focusedRect!.bottom <= viewportBottom + 1,
        visibleFieldCount: element.querySelectorAll(".snapshot-account-field input").length,
        horizontalOffenders,
        noHorizontalOverflow: scrollContainers.every((item) => item.scrollWidth <= item.clientWidth + 1),
      };
    })).toEqual({
      viewportLeft: 37,
      viewportTop: 18,
      viewportWidth: 366,
      viewportHeight: 540,
      viewportScale: 1.2,
      backdropLeft: 37,
      backdropTop: 18,
      backdropWidth: 366,
      backdropHeight: 540,
      dateVisible: false,
      dialogWithinViewport: true,
      footerWithinViewport: true,
      focusedFieldWithinViewport: true,
      visibleFieldCount: 4,
      horizontalOffenders: [],
      noHorizontalOverflow: true,
    });
    await page.screenshot({ path: testInfo.outputPath("inventory-snapshot-iphone-16-pro-max-keyboard.png") });

    const layout = await dialog.evaluate((element) => {
      const viewport = window.visualViewport;
      const dialogRect = element.getBoundingClientRect();
      const footer = element.querySelector("footer");
      if (!viewport || !footer) throw new Error("库存录入弹窗缺少 VisualViewport 或操作栏");
      const footerRect = footer.getBoundingClientRect();
      return {
        rootOverflow: getComputedStyle(document.documentElement).overflowY,
        bodyOverflow: getComputedStyle(document.body).overflowY,
        viewportLeft: viewport.offsetLeft,
        viewportRight: viewport.offsetLeft + viewport.width,
        viewportTop: viewport.offsetTop,
        viewportBottom: viewport.offsetTop + viewport.height,
        dialogLeft: dialogRect.left,
        dialogRight: dialogRect.right,
        dialogTop: dialogRect.top,
        dialogBottom: dialogRect.bottom,
        footerTop: footerRect.top,
        footerBottom: footerRect.bottom,
      };
    });

    expect(layout.rootOverflow, "弹窗打开后 html 根滚动应锁定").toBe("hidden");
    expect(layout.bodyOverflow, "弹窗打开后 body 滚动应锁定").toBe("hidden");
    expect(layout.dialogLeft).toBeGreaterThanOrEqual(layout.viewportLeft - 1);
    expect(layout.dialogRight).toBeLessThanOrEqual(layout.viewportRight + 1);
    expect(layout.dialogTop).toBeGreaterThanOrEqual(layout.viewportTop - 1);
    expect(layout.dialogBottom).toBeLessThanOrEqual(layout.viewportBottom + 1);
    expect(layout.footerTop, "弹窗操作栏应出现在当前可视视口").toBeGreaterThanOrEqual(layout.viewportTop - 1);
    expect(layout.footerBottom, "弹窗操作栏不应超出当前可视视口").toBeLessThanOrEqual(layout.viewportBottom + 1);

    await dialog.getByRole("button", { name: /下一账号.*LG1/ }).tap();
    await expect(dialog.getByRole("tab", { name: /^LG1 账号/ })).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByRole("spinbutton")).toHaveCount(4);
    await dialog.getByLabel("LG1普通蛋库存").fill("205");

    await dialog.getByRole("button", { name: /上一个.*FC/ }).tap();
    await expect(dialog.getByRole("tab", { name: /^FC 账号/ })).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByLabel("FC专用蛋库存")).toHaveValue("101");
    await expect(dialog.getByLabel("FC普通蛋库存")).toHaveValue("102");
    await expect(dialog.getByLabel("FC银子库存（万）")).toHaveValue("103.5");
    await expect(dialog.getByLabel("FC内丹碎片库存")).toHaveValue("104");

    await dialog.getByRole("tab", { name: /^LG1 账号/ }).tap();
    await expect(dialog.getByRole("spinbutton")).toHaveCount(4);
    await expect(dialog.getByLabel("LG1普通蛋库存")).toHaveValue("205");
    await dialog.getByRole("tab", { name: /^FC 账号/ }).tap();

    page.once("dialog", (confirmation) => confirmation.accept());
    await dialog.getByRole("button", { name: "取消" }).tap();
    await expect(dialog).toBeHidden();
    expect(await page.locator("html").evaluate((element) => element.style.overflow)).not.toBe("hidden");
  });

  test("库存周报固定展示七天、保留空缺并可展开日报", async ({ page }) => {
    const week = currentShanghaiWeek();
    const accountIds = ["FC", "LG1", "PT", "LG2", "MYT"] as const;
    const makeAccounts = (seed: number) => Object.fromEntries(accountIds.map((accountId, index) => [accountId, {
      dedicatedEggs: seed + index,
      regularEggs: seed * 2 + index,
      silverWan: seed * 10 + index,
      innerShardCount: seed * 3 + index,
    }]));
    const snapshots = [
      { effectiveDate: week.baseline, recordedAt: `${week.baseline}T12:00:00.000Z`, accounts: makeAccounts(1) },
      { effectiveDate: week.monday, recordedAt: `${week.monday}T12:00:00.000Z`, accounts: makeAccounts(2) },
      { effectiveDate: week.wednesday, recordedAt: `${week.wednesday}T12:00:00.000Z`, accounts: makeAccounts(5) },
    ];
    await page.addInitScript((payload) => {
      localStorage.setItem("sw.app.inventory.v2", JSON.stringify(payload));
      const state = window as typeof window & {
        __allowInventoryImageShare?: boolean;
        __inventoryImageShare?: { name: string; type: string; size: number };
      };
      state.__allowInventoryImageShare = true;
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: (data: ShareData) => Boolean(state.__allowInventoryImageShare && data.files?.length),
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: ShareData) => {
          const file = data.files?.[0];
          if (file) state.__inventoryImageShare = { name: file.name, type: file.type, size: file.size };
        },
      });
    }, { version: 2, snapshots });

    await page.goto("/#/data/inventory");
    await waitForApplicationPage(page);

    await page.getByRole("button", { name: "周报分析", exact: true }).tap();
    const weeklyTask = page.getByTestId("inventory-task-panel");
    const report = page.getByTestId("inventory-week-report");
    await expect(report).toBeVisible();
    await expect(weeklyTask.getByText("2 / 7 天有记录", { exact: true })).toBeVisible();
    const dailyView = report.getByRole("button", { name: "按日对比", exact: true });
    await expect(dailyView).toHaveAttribute("aria-pressed", "true");
    await expect(report.locator(".inventory-daily-matrix")).toBeVisible();
    const defaultMatrixShare = report.getByRole("button", { name: "生成并分享银子库存周报", exact: true });
    await expect(defaultMatrixShare).toContainText("生成并分享库存周报");
    const matrixBox = await report.locator(".inventory-daily-matrix").boundingBox();
    const activityBox = await report.getByTestId("weekly-activity-panel").boundingBox();
    expect(matrixBox?.y, "七天库存表格应排在五账号本周情况之前").toBeLessThan(activityBox?.y || Number.POSITIVE_INFINITY);

    await report.getByRole("button", { name: "汇总视图", exact: true }).tap();
    await expect(report.locator(".weekly-change-panel > header").getByText(`${week.baseline} → ${week.wednesday}`, { exact: false })).toBeVisible();
    await expect(report.getByText("银 = 纯银子；银+蛋 = 纯银子 + 普通蛋 × 5.5 万/个", { exact: true })).toBeVisible();

    await expect(report.getByRole("columnheader")).toHaveText(["账号", "专", "普", "银 / 万", "银+蛋 / 万", "碎"]);

    for (const accountId of accountIds) {
      const accountRow = report.locator(".weekly-change-row:not(.weekly-change-total)").filter({ hasText: accountId });
      await expect(accountRow).toHaveCount(1);
      await expect(accountRow.locator(":scope > *")).toHaveText([accountId, "+4", "+8", "+40", "+84", "+12"]);
    }

    const weeklyTotal = report.getByRole("row", { name: "本周净变化合计", exact: true });
    await expect(weeklyTotal).toBeVisible();
    await expect(weeklyTotal.locator(":scope > *")).toHaveText(["合计", "+20", "+40", "+200", "+420", "+60"]);

    const summaryShare = report.getByRole("button", { name: "分享当前库存汇总", exact: true });
    await expect(summaryShare).toBeVisible();
    expect((await summaryShare.boundingBox())?.height, "库存分享按钮应保持 44px 触控高度").toBeGreaterThanOrEqual(44);
    await summaryShare.tap();
    await expect.poll(() => page.evaluate(() => (
      window as typeof window & { __inventoryImageShare?: { name: string; type: string; size: number } }
    ).__inventoryImageShare)).toEqual(expect.objectContaining({
      name: expect.stringMatching(/^库存汇总-.*\.png$/),
      type: "image/png",
    }));
    const sharedInventory = await page.evaluate(() => (
      window as typeof window & { __inventoryImageShare?: { name: string; type: string; size: number } }
    ).__inventoryImageShare);
    expect(sharedInventory?.size, "库存汇总 PNG 不应为空白文件").toBeGreaterThan(10_000);
    await expect(report.locator(".inventory-share-notice")).toHaveText("库存图片已生成");

    await report.getByRole("button", { name: "按日对比", exact: true }).tap();
    const metricSwitch = report.locator(".matrix-metric-switch");
    await expect(metricSwitch.locator("button")).toHaveText(["银子", "银+蛋", "专用蛋", "普通蛋", "内丹碎片"]);
    const convertedSilverButton = report.getByRole("button", {
      name: "银子加普通蛋，普通蛋按每个 5.5 万折算",
      exact: true,
    });
    await convertedSilverButton.tap();
    await expect(convertedSilverButton).toHaveAttribute("aria-pressed", "true");
    await expect(report.getByText("折算：银子 + 普通蛋 × 5.5 万/个", { exact: true })).toBeVisible();

    await page.evaluate(() => {
      (window as typeof window & { __allowInventoryImageShare?: boolean }).__allowInventoryImageShare = false;
    });
    const matrixDownloadPromise = page.waitForEvent("download");
    await report.getByRole("button", { name: "生成并分享银+蛋库存周报", exact: true }).tap();
    const matrixDownload = await matrixDownloadPromise;
    expect(matrixDownload.suggestedFilename()).toMatch(/^银\+蛋按日对比-.*\.png$/);
    await expect(report.locator(".inventory-share-notice")).toHaveText("库存图片已下载");

    const matrixTable = report.locator(".inventory-matrix-table");
    await expect(matrixTable).toBeVisible();
    await expect(matrixTable.locator("tfoot .matrix-week-total > *")).toHaveText([
      "本周合计3 天区间",
      "+84",
      "+84",
      "+84",
      "+84",
      "+84",
      "+420",
    ]);
    await expect(matrixTable.locator("tfoot .matrix-week-average > *")).toHaveText([
      "区间日均按实际间隔天数折算",
      "+28",
      "+28",
      "+28",
      "+28",
      "+28",
      "+140",
    ]);
    await report.getByRole("button", { name: "汇总视图", exact: true }).tap();

    const weeklyChangeEdgeDeltas = await report.locator(".weekly-change-table").evaluate((table) => {
      const headers = Array.from(table.querySelector(".weekly-change-head")!.children);
      const rows = Array.from(table.querySelectorAll(".weekly-change-row"));
      return rows.flatMap((row) => {
        const cells = Array.from(row.children);
        return headers.map((header, index) => {
          const headerRect = header.getBoundingClientRect();
          const cellRect = cells[index].getBoundingClientRect();
          return Math.abs(index === 0 ? headerRect.left - cellRect.left : headerRect.right - cellRect.right);
        });
      });
    });
    weeklyChangeEdgeDeltas.forEach((delta) => expect(delta).toBeLessThanOrEqual(1));

    await page.getByRole("button", { name: "记录管理", exact: true }).tap();
    const records = page.getByTestId("inventory-task-panel");
    await expect(records.locator(".inventory-record-entry")).toHaveCount(7);
    const emptyDates = [week.tuesday, week.thursday, week.friday, week.saturday, week.sunday];
    const recordableEmptyDate = emptyDates.find((date) => date <= week.today);
    const upcomingEmptyDate = emptyDates.find((date) => date > week.today);
    if (recordableEmptyDate) {
      await expect(records.getByRole("button", { name: `补录${recordableEmptyDate}库存`, exact: true })).toBeVisible();
    }
    if (upcomingEmptyDate) {
      await expect(records.getByLabel(`${upcomingEmptyDate}尚未到日期`, { exact: true })).toBeVisible();
      await expect(records.getByRole("button", { name: `补录${upcomingEmptyDate}库存`, exact: true })).toHaveCount(0);
    }
    await records.getByRole("button", { name: `查看${week.wednesday}库存日报`, exact: true }).tap();
    await expect(records.getByText(`${week.wednesday} 日报`, { exact: true })).toBeVisible();
    await expect(records.getByRole("table", { name: `${week.wednesday} 五账号库存明细`, exact: true })).toBeVisible();

    const dock = page.getByRole("navigation", { name: "手机快捷导航", exact: true });
    await expect(dock).toBeVisible();
    await expect(dock.locator("a, button")).toHaveCount(5);
    await expect(dock.getByRole("button", { name: "打开全部导航", exact: true })).toHaveClass(/active/);

    const overflow = await pageOverflowReport(page);
    expect(overflow.offenders, "展开手机日报后不应产生页面级横向裁切").toEqual([]);
    expect(overflow.documentScrollWidth).toBeLessThanOrEqual(overflow.documentClientWidth + 1);
  });

  test("规划与数据分区末项在直接进入时保持可见", async ({ page }) => {
    await expectCurrentSectionLinkInView(page, "/#/plans/parameters", "规划分区", "计划参数");
    await expectCurrentSectionLinkInView(page, "/#/settings", "数据中心分区", "本地设置与备份");
  });
});
