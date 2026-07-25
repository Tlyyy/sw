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
  ".orbit-mobile-dock > a",
  ".subnav a",
  "main .button",
  "main .workbench-primary",
  "main .radar-action-card.primary",
  "main .next-step-action",
  "main .priority-account-row",
  "main .week-pulse-card",
  "main .task-mobile-summary-main",
  "main .task-mobile-summary-action",
  "main .task-mobile-row-main",
  "main .task-mobile-row-action",
  "main .week-mobile-full-report > summary",
  "main .earnings-intro .movement-toggle",
  "main .earnings-account-tabs button",
  "main .movement-panel button",
  "main .ledger-list button",
  "main .record-primary-action",
  "main .record-option-card",
  "main .inventory-week-button",
  "main .inventory-week-current",
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
  await expect(page.locator(".today-workbench, .mobile-home-page, .workbench-page, .page-wrap, .matrix-page, .earnings-page").first()).toBeVisible();
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
    if (target.closest(".task-mobile-segments")) return [];
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

  test("三项 Liquid Glass 底栏与主要移动操作保持可触控", async ({ page }) => {
    await page.goto("/#/");
    await waitForApplicationPage(page);

    const mobileNavigation = page.getByRole("navigation", { name: "手机快捷导航" });
    const dockLinks = mobileNavigation.getByRole("link");
    await expect(mobileNavigation).toBeVisible();
    await expect(dockLinks).toHaveText(["今日", "任务", "周报"]);
    expect(await dockLinks.evaluateAll((elements) => elements.map((element) => element.getAttribute("href"))))
      .toEqual(["#/", "#/plans/tasks", "#/week"]);
    await expect(mobileNavigation.getByRole("button")).toHaveCount(0);
    expect(await undersizedPrimaryTargets(page), "移动主导航存在不足 44px 的主要触控目标").toEqual([]);

    for (const url of [
      "/#/",
      "/#/week",
      "/#/plans/tasks",
    ] as const) {
      await test.step(url, async () => {
        await page.goto(url);
        await waitForApplicationPage(page);
        const dock = page.getByRole("navigation", { name: "手机快捷导航" });
        await expect(dock.getByRole("link")).toHaveCount(3);
        if (url === "/#/plans/tasks") {
          const segments = page.locator(".task-mobile-segments");
          await expect(segments.getByRole("button")).toHaveText([/待处理/, /已完成/, /全部/]);
          const completed = segments.getByRole("button", { name: /已完成/ });
          await completed.tap();
          await expect(completed).toHaveAttribute("aria-pressed", "true");
          const pending = segments.getByRole("button", { name: /待处理/ });
          await pending.tap();
          await expect(pending).toHaveAttribute("aria-pressed", "true");
        }
        expect(await undersizedPrimaryTargets(page), `${url} 存在不足 44px 的主要触控目标`).toEqual([]);
      });
    }
  });

  test("iPhone 16 Pro Max 的 Liquid Glass 底栏安全悬浮且账号操作保持单行", async ({ page }) => {
    await page.goto("/#/accounts/FC");
    await waitForApplicationPage(page);

    const mainlineSection = page.locator(".account-page .split-workspace > div").filter({ hasText: "主线任务与资源" });
    const inventoryLink = mainlineSection.getByRole("link", { name: /更新库存/ });
    await expect(inventoryLink).toBeVisible();

    const layout = await page.evaluate(() => {
      const dock = document.querySelector<HTMLElement>(".orbit-mobile-dock");
      const main = document.querySelector<HTMLElement>(".orbit-main");
      const topbar = document.querySelector<HTMLElement>(".ios26-mobile-header");
      const brand = document.querySelector<HTMLElement>(".ios26-mobile-brand");
      const syncState = document.querySelector<HTMLElement>(".ios26-mobile-sync");
      const link = [...document.querySelectorAll<HTMLElement>(".account-page .section-head > a")]
        .find((element) => element.textContent?.includes("更新库存"));
      if (!dock || !main || !topbar || !brand || !syncState || !link) throw new Error("iPhone 安全区审查缺少目标元素");
      const dockRect = dock.getBoundingClientRect();
      const topbarRect = topbar.getBoundingClientRect();
      const buttonBottom = Math.max(...[...dock.querySelectorAll<HTMLElement>("a, button")]
        .map((element) => element.getBoundingClientRect().bottom));
      const linkStyle = getComputedStyle(link);
      const dockStyle = getComputedStyle(dock);
      return {
        viewportHeight: window.innerHeight,
        topbarHeight: topbar.getBoundingClientRect().height,
        brandTop: brand.getBoundingClientRect().top,
        syncTop: syncState.getBoundingClientRect().top,
        headerTop: topbarRect.top,
        headerBottom: topbarRect.bottom,
        dockHeight: dockRect.height,
        dockTop: dockRect.top,
        dockBottomGap: window.innerHeight - dockRect.bottom,
        dockPosition: dockStyle.position,
        dockColumns: dockStyle.gridTemplateColumns.split(" ").length,
        dockBackdrop: dockStyle.backdropFilter || dockStyle.getPropertyValue("-webkit-backdrop-filter"),
        dockRadius: Number.parseFloat(dockStyle.borderRadius),
        buttonBottom,
        mainPaddingBottom: Number.parseFloat(getComputedStyle(main).paddingBottom),
        linkHeight: link.getBoundingClientRect().height,
        linkWhiteSpace: linkStyle.whiteSpace,
        linkFits: link.scrollWidth <= link.clientWidth + 1,
      };
    });

    expect(layout.topbarHeight, "手机顶部工具栏应保持紧凑").toBeGreaterThanOrEqual(64);
    expect(layout.brandTop, "品牌文字应位于手机工具栏内").toBeGreaterThanOrEqual(layout.headerTop);
    expect(layout.syncTop, "同步入口应位于手机工具栏内").toBeGreaterThanOrEqual(layout.headerTop);
    expect(layout.headerBottom).toBeLessThanOrEqual(layout.dockTop);
    expect(layout.dockPosition).toBe("fixed");
    expect(layout.dockColumns, "Liquid Glass 底栏应固定为三列").toBe(3);
    expect(layout.dockBackdrop, "Liquid Glass 底栏应保留材质模糊").not.toBe("none");
    expect(layout.dockRadius, "Liquid Glass 底栏应保持胶囊圆角").toBeGreaterThanOrEqual(28);
    expect(layout.dockBottomGap, "底栏应与视口底边保留悬浮间距").toBeGreaterThanOrEqual(7);
    expect(layout.dockHeight, "底栏应完整容纳三项主导航").toBeGreaterThanOrEqual(64);
    expect(layout.buttonBottom, "底栏按钮不能超出悬浮容器").toBeLessThanOrEqual(layout.viewportHeight - layout.dockBottomGap + 1);
    expect(layout.mainPaddingBottom, "正文应为固定底栏预留滚动空间").toBeGreaterThanOrEqual(82);
    expect(layout.linkHeight, "更新库存应保持可触控高度").toBeGreaterThanOrEqual(44);
    expect(layout.linkWhiteSpace).toBe("nowrap");
    expect(layout.linkFits, "更新库存不能被挤成两行").toBe(true);
  });

  test("首页首屏呈现今日进度、两个优先账号与周报入口", async ({ page }) => {
    await page.goto("/#/");
    await waitForApplicationPage(page);

    const home = page.getByTestId("mobile-week-home");
    const priorityRows = home.locator(".priority-account-row");
    const weekPulse = home.locator(".week-pulse-card");
    await expect(home).toBeVisible();
    await expect(home.getByRole("heading", { name: "今日进度", exact: true })).toBeVisible();
    await expect(home.locator(".today-progress-grid > .progress-metric")).toHaveCount(3);
    await expect(priorityRows).toHaveCount(2);
    await expect(weekPulse).toHaveAttribute("href", "#/week");
    await expect(weekPulse).toContainText("本周脉搏");
    await expect(page.getByRole("navigation", { name: "手机快捷导航" }).getByRole("link")).toHaveText([
      "今日",
      "任务",
      "周报",
    ]);

    const layout = await page.evaluate(() => {
      const progress = document.querySelector<HTMLElement>(".today-progress-card");
      const primaryAction = document.querySelector<HTMLElement>(".next-step-action");
      const priorityRows = [...document.querySelectorAll<HTMLElement>(".priority-account-row")];
      const mobileDock = document.querySelector<HTMLElement>(".orbit-mobile-dock");
      if (!progress || !primaryAction || priorityRows.length !== 2 || !mobileDock) {
        throw new Error("首页移动首屏关键区域未完整渲染");
      }
      const progressRect = progress.getBoundingClientRect();
      const primaryRect = primaryAction.getBoundingClientRect();
      const dockRect = mobileDock.getBoundingClientRect();
      return {
        progressLeft: progressRect.left,
        progressRight: progressRect.right,
        priorityRowsFit: priorityRows.every((row) => {
          const rect = row.getBoundingClientRect();
          return rect.left >= -1 && rect.right <= document.documentElement.clientWidth + 1;
        }),
        primaryBottom: primaryRect.bottom,
        dockTop: dockRect.top,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    });

    expect(layout.progressLeft, "今日进度卡左侧不能超出视口").toBeGreaterThanOrEqual(0);
    expect(layout.progressRight, "今日进度卡右侧不能超出视口").toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.priorityRowsFit, "两个优先账号入口应完整位于手机视口内").toBe(true);
    expect(layout.primaryBottom, "主操作不应被底部导航遮挡").toBeLessThanOrEqual(layout.dockTop - 6);
    expect(layout.documentWidth, "首页不应产生横向页面滚动").toBeLessThanOrEqual(layout.viewportWidth + 1);
  });

  test("iPhone 16 Pro Max 首页一次点击打开全局库存工作表", async ({ page }, testInfo) => {
    await page.addInitScript(() => localStorage.removeItem("sw.app.inventory.v2"));
    await page.goto("/#/");
    await waitForApplicationPage(page);

    const recordToday = page.getByRole("button", { name: "记录今日库存", exact: true });
    await expect(recordToday).toBeVisible();
    await recordToday.tap();

    const dialog = page.getByRole("dialog", { name: "记录今日信息" });
    await expect(page).toHaveURL(/#\/$/);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".ios26-record-segments").getByRole("button")).toHaveText(["库存", "支出", "行情"]);
    await expect(dialog.getByRole("button", { name: "库存", exact: true })).toHaveClass(/active/);
    await expect(dialog.locator(".ios26-inventory-row")).toHaveCount(5);
    await expect(dialog.getByRole("spinbutton")).toHaveCount(20);
    await expect(dialog.getByLabel("FC 专用蛋")).toBeVisible();
    await expect(dialog.getByLabel("FC 普通蛋")).toBeVisible();
    await expect(dialog.getByLabel("FC 银子")).toBeVisible();
    await expect(dialog.getByLabel("FC 碎片")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("home-direct-record-iphone-16-pro-max.png") });
    await dialog.getByRole("button", { name: "取消", exact: true }).tap();
    await expect(dialog).toHaveCount(0);

    await page.reload();
    await waitForApplicationPage(page);
    await expect(dialog).toHaveCount(0);
  });

  test("全局录入工作表切换模式时保持统一高度、字号与内部滚动", async ({ page }) => {
    await page.setViewportSize({ width: 440, height: 700 });
    await page.addInitScript(() => localStorage.removeItem("sw.app.inventory.v2"));
    await page.goto("/#/");
    await waitForApplicationPage(page);

    await page.getByRole("button", { name: "记录今日库存", exact: true }).tap();

    const sheet = page.locator(".ios26-record-sheet");
    await expect(sheet).toBeVisible();
    await expect.poll(() => sheet.evaluate(
      (element) => getComputedStyle(element).transform,
    )).toBe("none");

    const modes = [
      {
        label: "库存",
        title: "记录今日信息",
        fieldSelector: ".ios26-inventory-row input",
        labelSelector: ".ios26-inventory-row strong",
      },
      {
        label: "支出",
        title: "记录支出",
        fieldSelector: '.ios26-sheet-field input[placeholder="0.00"]',
        labelSelector: ".ios26-sheet-field > span",
      },
      {
        label: "行情",
        title: "更新行情",
        fieldSelector: ".ios26-market-input",
        labelSelector: ".ios26-market-grid label > span:first-child",
      },
    ] as const;

    type ModeSnapshot = {
      label: string;
      sheetTop: number;
      sheetHeight: number;
      bodyOverflowY: string;
      bodyClientHeight: number;
      bodyScrollHeight: number;
      titleFontSize: number;
      segmentFontSize: number;
      labelFontSize: number;
      inputFontSize: number;
      inputFontWeight: number;
      inputHeight: number;
      saveFontSize: number;
      saveHeight: number;
    };

    const snapshots: ModeSnapshot[] = [];

    for (const mode of modes) {
      const modeButton = sheet.getByRole("button", { name: mode.label, exact: true });
      await modeButton.tap();
      await expect(modeButton).toHaveClass(/active/);
      await expect(sheet.getByRole("heading", { name: mode.title, exact: true })).toBeVisible();

      const snapshot = await sheet.evaluate((element, currentMode) => {
        const body = element.querySelector<HTMLElement>(".ios26-record-body");
        const field = body?.querySelector<HTMLElement>(currentMode.fieldSelector);
        const input = field?.matches("input")
          ? field as HTMLInputElement
          : field?.querySelector<HTMLInputElement>("input");
        const label = body?.querySelector<HTMLElement>(currentMode.labelSelector);
        const title = element.querySelector<HTMLElement>(".ios26-record-head h2");
        const segment = element.querySelector<HTMLElement>(".ios26-record-segments button");
        const save = element.querySelector<HTMLElement>(".ios26-record-save");

        if (!body || !field || !input || !label || !title || !segment || !save) {
          throw new Error(`${currentMode.label} 模式缺少统一录入结构`);
        }

        const sheetRect = element.getBoundingClientRect();
        return {
          label: currentMode.label,
          sheetTop: Math.round(sheetRect.top),
          sheetHeight: Math.round(sheetRect.height),
          bodyOverflowY: getComputedStyle(body).overflowY,
          bodyClientHeight: body.clientHeight,
          bodyScrollHeight: body.scrollHeight,
          titleFontSize: Number.parseFloat(getComputedStyle(title).fontSize),
          segmentFontSize: Number.parseFloat(getComputedStyle(segment).fontSize),
          labelFontSize: Number.parseFloat(getComputedStyle(label).fontSize),
          inputFontSize: Number.parseFloat(getComputedStyle(input).fontSize),
          inputFontWeight: Number.parseInt(getComputedStyle(input).fontWeight, 10),
          inputHeight: Math.round(field.getBoundingClientRect().height),
          saveFontSize: Number.parseFloat(getComputedStyle(save).fontSize),
          saveHeight: Math.round(save.getBoundingClientRect().height),
        };
      }, mode);

      expect(["auto", "scroll"]).toContain(snapshot.bodyOverflowY);
      expect(snapshot.bodyScrollHeight).toBeGreaterThan(snapshot.bodyClientHeight);
      expect(snapshot.labelFontSize).toBe(13);
      expect(snapshot.inputFontSize).toBe(16);
      expect(snapshot.inputFontWeight).toBe(600);
      expect(snapshot.inputHeight).toBe(50);
      expect(snapshot.saveHeight).toBe(50);

      const scrollTop = await sheet.locator(".ios26-record-body").evaluate((element) => {
        element.scrollTop = element.scrollHeight;
        return element.scrollTop;
      });
      expect(scrollTop, `${mode.label} 内容应只在表单主体内滚动`).toBeGreaterThan(0);

      snapshots.push(snapshot);
    }

    const baseline = snapshots[0];
    for (const current of snapshots.slice(1)) {
      expect(Math.abs(current.sheetTop - baseline.sheetTop),
        `${current.label} 切换后工作表顶部不应跳动`).toBeLessThanOrEqual(1);
      expect(Math.abs(current.sheetHeight - baseline.sheetHeight),
        `${current.label} 切换后工作表高度不应变化`).toBeLessThanOrEqual(1);
      expect(current.titleFontSize).toBe(baseline.titleFontSize);
      expect(current.segmentFontSize).toBe(baseline.segmentFontSize);
      expect(current.labelFontSize).toBe(baseline.labelFontSize);
      expect(current.inputFontSize).toBe(baseline.inputFontSize);
      expect(current.inputFontWeight).toBe(baseline.inputFontWeight);
      expect(current.inputHeight).toBe(baseline.inputHeight);
      expect(current.saveFontSize).toBe(baseline.saveFontSize);
      expect(current.saveHeight).toBe(baseline.saveHeight);
    }

    await sheet.getByRole("button", { name: "取消", exact: true }).tap();
    await expect(sheet).toHaveCount(0);
  });

  test("首页展示两个优先账号并从账号行进入任务详情", async ({ page }) => {
    await page.goto("/#/");
    await waitForApplicationPage(page);

    const accountIds = ["FC", "LG1", "PT", "LG2", "MYT"] as const;
    const priorityRows = page.locator(".priority-account-row");
    await expect(priorityRows).toHaveCount(2);
    const priorityAccountIds = await priorityRows.evaluateAll((elements) => elements.map((element) => (
      (element as HTMLElement).dataset.accountId || ""
    )));
    expect(new Set(priorityAccountIds).size, "首页两个优先账号不能重复").toBe(2);
    expect(priorityAccountIds.every((accountId) => accountIds.includes(accountId as typeof accountIds[number])),
      "首页只能展示系统内的有效账号").toBe(true);
    expect(await priorityRows.evaluateAll((elements) => elements.map((element) => element.getAttribute("href"))))
      .toEqual(priorityAccountIds.map((accountId) => `#/plans/tasks?account=${accountId}`));

    const selectedAccountId = priorityAccountIds[0];
    const selectedRow = priorityRows.first();
    expect((await selectedRow.boundingBox())?.height, "优先账号入口应保持 44px 触控高度").toBeGreaterThanOrEqual(44);
    await selectedRow.tap();
    await expect(page).toHaveURL(new RegExp(`#\\/plans\\/tasks\\?account=${selectedAccountId}$`));
    await expect(page.locator(".task-mobile-drilldown-head")).toContainText(`${selectedAccountId} ·`);
    await expect(page.locator(".task-mobile-account-group")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "手机快捷导航" })
      .getByRole("link", { name: "任务", exact: true })).toHaveAttribute("aria-current", "page");
  });

  test("首页任务入口能进入任务分区维护", async ({ page }) => {
    await page.goto("/#/");
    await waitForApplicationPage(page);

    await page.locator(".priority-heading").getByRole("link", { name: "查看全部", exact: true }).tap();
    await expect(page).toHaveURL(/#\/plans\/tasks$/);
    await expect(page.getByRole("navigation", { name: "手机快捷导航" }).getByRole("link", { name: "任务", exact: true })).toHaveAttribute("aria-current", "page");
  });

  test("任务勾选、完成与批量操作避开固定底栏", async ({ page }) => {
    await page.goto("/#/plans/tasks");
    await waitForApplicationPage(page);

    const accountSummary = page.locator(".task-mobile-summary-row").first();
    const accountEntry = accountSummary.locator(".task-mobile-summary-main");
    const accountAction = accountSummary.locator(".task-mobile-summary-action");
    await expect(accountSummary).toBeVisible();
    expect((await accountEntry.boundingBox())?.height, "账号任务入口应保持 44px 触控高度").toBeGreaterThanOrEqual(44);
    expect((await accountAction.boundingBox())?.height, "账号首项处理入口应保持 44px 触控高度").toBeGreaterThanOrEqual(44);
    await accountEntry.tap();

    const taskRow = page.locator(".task-mobile-account-group article")
      .filter({ has: page.locator("input[type='checkbox']:not(:disabled)") }).first();
    const selectTarget = taskRow.locator(".task-mobile-check");
    const completionAction = taskRow.locator(".task-mobile-row-action");
    await expect(taskRow).toBeVisible();
    expect((await selectTarget.boundingBox())?.height, "任务勾选区域应保持 44px 触控高度").toBeGreaterThanOrEqual(44);
    expect((await taskRow.locator(".task-mobile-row-main").boundingBox())?.height, "任务详情入口应保持 44px 触控高度").toBeGreaterThanOrEqual(44);
    expect((await completionAction.boundingBox())?.height, "任务处理入口应保持 44px 触控高度").toBeGreaterThanOrEqual(44);
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
    await page.goto("/#/plans/tasks?account=LG1");
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

    await expect(page.locator(".task-mobile-drilldown-head")).toContainText("LG1 ·");
    await page.getByRole("button", { name: "打开任务筛选", exact: true }).tap();
    await page.locator(".task-mobile-filters").getByPlaceholder("搜索账号、神兽或任务").fill("剑气蛇 皮肤");
    const row = page.locator(".task-mobile-account-group article").filter({ hasText: "剑气蛇" });
    await expect(row).toHaveCount(1);
    await row.locator(".task-mobile-row-action").tap();

    const dialog = page.locator(".task-settlement-dialog");
    const automaticSilver = dialog.getByLabel(/^自动补购银子 \/ 万/);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "取消", exact: true })).toBeFocused();
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
      const mobileHeader = element.querySelector<HTMLElement>(".task-settlement-mobile-header");
      if (!backdrop || !mobileHeader) return null;
      const backdropRect = backdrop.getBoundingClientRect();
      const mobileHeaderRect = mobileHeader.getBoundingClientRect();
      return {
        backdropTop: Math.round(backdropRect.top),
        backdropHeight: Math.round(backdropRect.height),
        mobileHeaderWithinViewport: mobileHeaderRect.top >= backdropRect.top - 1
          && mobileHeaderRect.bottom <= backdropRect.bottom + 1,
      };
    })).toEqual({
      backdropTop: 20,
      backdropHeight: 560,
      mobileHeaderWithinViewport: true,
    });
    await page.screenshot({ path: testInfo.outputPath("task-settlement-iphone-16-pro-max-keyboard.png") });

    const layout = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const mobileHeader = element.querySelector<HTMLElement>(".task-settlement-mobile-header");
      const buttons = Array.from(element.querySelectorAll<HTMLElement>(".task-settlement-mobile-header button"));
      return {
        viewportWidth: document.documentElement.clientWidth,
        viewportHeight: document.documentElement.clientHeight,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        left: rect.left,
        right: rect.right,
        mobileHeaderTop: mobileHeader?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
        mobileHeaderBottom: mobileHeader?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY,
        buttonHeights: buttons.map((button) => button.getBoundingClientRect().height),
      };
    });
    expect(layout.documentOverflow).toBe(0);
    expect(layout.left).toBeGreaterThanOrEqual(-1);
    expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.mobileHeaderTop).toBeGreaterThanOrEqual(19);
    expect(layout.mobileHeaderBottom).toBeLessThanOrEqual(layout.viewportHeight + 1);
    expect(layout.buttonHeights.every((height) => height >= 38)).toBe(true);
    await dialog.getByRole("button", { name: "取消", exact: true }).tap();
    await expect(dialog).toHaveCount(0);
  });

  test("精简后的五账号核算页在 iPhone 16 Pro Max 完整展示并调用系统分享", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      const accountIds = ["FC", "LG1", "PT", "LG2", "MYT"] as const;
      const accounts = (silverWan: number, regularEggs = 11) => Object.fromEntries(accountIds.map((accountId) => [accountId, {
        dedicatedEggs: accountId === "FC" ? 9 : 5,
        regularEggs: accountId === "FC" ? regularEggs : 4,
        silverWan: accountId === "FC" ? silverWan : 100,
        innerShardCount: accountId === "FC" ? 32 : 20,
      }]));
      localStorage.setItem("sw.app.inventory.v2", JSON.stringify({
        version: 2,
        snapshots: [
          { effectiveDate: "2026-07-22", recordedAt: "2026-07-22T10:00:00.000Z", accounts: accounts(100) },
          { effectiveDate: "2026-07-23", recordedAt: "2026-07-23T10:00:00.000Z", accounts: accounts(90, 13) },
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
    const dailyTable = page.getByRole("region", { name: "五账号每日实际所得" });
    await expect(dailyTable).toBeVisible();
    await expect(dailyTable.locator("tbody > tr")).toHaveCount(9);
    const dailyTableBox = await dailyTable.boundingBox();
    expect((dailyTableBox?.x || 0) + (dailyTableBox?.width || 0), "五账号每日所得表格不应撑出手机视口").toBeLessThanOrEqual(440);
    const dailyTableScroll = dailyTable.locator(".daily-table-scroll");
    expect(
      await dailyTableScroll.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      "440px 视口下每日所得表格应直接完整展示",
    ).toBe(true);
    const july23Row = dailyTable.locator("tr[data-date='2026-07-23']");
    await expect(july23Row.locator("td")).toHaveText(["+10", "0", "0", "0", "0", "+10"]);

    const accountOverview = page.getByRole("region", { name: "当前库存" });
    await expect(accountOverview).toBeVisible();
    await expect(accountOverview.locator(".selected-account-metrics dd")).toHaveText(["90 万", "9 个", "13 个", "32 片"]);
    const inventoryMetricBoxes = await accountOverview.locator(".selected-account-metrics > div").evaluateAll((elements) => (
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { top: rect.top, right: rect.right, height: rect.height };
      })
    ));
    expect(inventoryMetricBoxes).toHaveLength(4);
    expect(
      Math.max(...inventoryMetricBoxes.map(({ top }) => top)) - Math.min(...inventoryMetricBoxes.map(({ top }) => top)),
      "16 Pro Max 下四项当前库存应保持同一行",
    ).toBeLessThanOrEqual(1);
    expect(Math.max(...inventoryMetricBoxes.map(({ right }) => right)), "当前库存不应超出 16 Pro Max 视口").toBeLessThanOrEqual(440);

    await expect(dailyTable.locator(".daily-table-share")).toHaveCount(1);
    const combinedShareButton = page.getByRole("button", {
      name: "分享五个账号 2026-07-20 至 2026-07-26 每日实际所得图片",
      exact: true,
    });
    await expect(combinedShareButton).toBeVisible();
    const combinedShareBox = await combinedShareButton.boundingBox();
    expect(combinedShareBox?.height, "五账号每日所得分享按钮应保持 44px 触控高度").toBeGreaterThanOrEqual(44);
    expect((combinedShareBox?.x || 0) + (combinedShareBox?.width || 0), "五账号分享按钮不应超出 16 Pro Max 视口").toBeLessThanOrEqual(440);
    await combinedShareButton.tap();

    await expect.poll(() => page.evaluate(() => (
      window as typeof window & {
        __earningsShare?: { name: string; type: string; size: number; title?: string };
      }
    ).__earningsShare)).toEqual(expect.objectContaining({
      name: "五号每日实际所得-2026-07-20-2026-07-26.png",
      type: "image/png",
      title: "五号每日实际所得",
    }));
    await expect(page.getByRole("status")).toContainText("五号每日所得图片已打开系统分享");

    await dailyTable.getByRole("button", { name: "银+蛋折银", exact: true }).tap();
    await expect(dailyTable.getByRole("table", { name: "五账号本周每日实际所得（银+蛋折银）" })).toBeVisible();
    await expect(july23Row.locator("td")).toHaveText(["+21", "0", "0", "0", "0", "+21"]);
    await expect(dailyTable).toContainText("专用蛋不参与折算");
    const combinedWithEggsShareButton = page.getByRole("button", {
      name: "分享五个账号 2026-07-20 至 2026-07-26 每日实际所得银加蛋折银图片",
      exact: true,
    });
    await expect(combinedWithEggsShareButton).toBeVisible();
    const combinedWithEggsShareBox = await combinedWithEggsShareButton.boundingBox();
    expect(combinedWithEggsShareBox?.height, "五账号银+蛋折银分享按钮应保持 44px 触控高度").toBeGreaterThanOrEqual(44);
    expect((combinedWithEggsShareBox?.x || 0) + (combinedWithEggsShareBox?.width || 0), "五账号银+蛋折银分享按钮不应超出 16 Pro Max 视口").toBeLessThanOrEqual(440);
    await combinedWithEggsShareButton.tap();

    await expect.poll(() => page.evaluate(() => (
      window as typeof window & {
        __earningsShare?: { name: string; type: string; size: number; title?: string };
      }
    ).__earningsShare)).toEqual(expect.objectContaining({
      name: "五号每日实际所得-银加蛋折银-2026-07-20-2026-07-26.png",
      type: "image/png",
      title: "五号每日实际所得 · 银+蛋折银",
    }));
    await expect(page.getByRole("status")).toContainText("五号银+蛋折银图片已打开系统分享");

    const shareButton = accountOverview.getByRole("button", { name: "分享 FC 7月23日 实际所得图片", exact: true });
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

    const accountingRule = page.locator(".accounting-rule");
    await expect(accountingRule).not.toHaveAttribute("open", "");
    const accountingSummary = accountingRule.locator("summary");
    const accountingSummaryBox = await accountingSummary.boundingBox();
    expect(accountingSummaryBox?.height, "核算说明入口应保持足够触控高度").toBeGreaterThanOrEqual(44);
    await accountingSummary.tap();
    await expect(accountingRule).toHaveAttribute("open", "");
    await expect(accountingRule).toContainText("先看真实库存");

    const ledgerTab = page.getByRole("tab", { name: /实际流水/ });
    await expect(ledgerTab).toHaveAttribute("aria-selected", "true");
    const intervalTab = page.getByRole("tab", { name: /跨天区间/ });
    await intervalTab.tap();
    await expect(intervalTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name: /跨天区间/ })).toContainText("每日记录已在上表展示");

    const overflowReport = await pageOverflowReport(page);
    expect(
      overflowReport.documentScrollWidth - overflowReport.documentClientWidth,
      "精简后的核算页不应产生整页横向溢出",
    ).toBeLessThanOrEqual(1);
    expect(overflowReport.offenders, "精简后的核算页不应有元素越出手机视口").toEqual([]);
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

    const supplementButton = page.locator(".week-supplement-card")
      .getByRole("button", { name: "补充记录", exact: true });
    await expect(supplementButton).toBeVisible();
    await supplementButton.tap();
    const supplementSheet = page.getByRole("dialog", { name: "记录今日信息" });
    await expect(supplementSheet).toBeVisible();
    await supplementSheet.getByRole("button", { name: "取消", exact: true }).tap();
    await expect(supplementSheet).toHaveCount(0);
    const fullReport = page.locator(".week-mobile-full-report");
    await expect(fullReport).not.toHaveAttribute("open", "");
    await fullReport.locator(":scope > summary").tap();
    await expect(fullReport).toHaveAttribute("open", "");
    await fullReport.getByRole("button", { name: "生成本周小结", exact: true }).tap();
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
    test.setTimeout(75_000);
    let auditedFields = 0;
    for (const url of formRoutes) {
      await test.step(url, async () => {
        await page.goto(url);
        await waitForApplicationPage(page);
        if (url === "/#/record") await page.locator(".record-option-card[aria-controls='quick-expense-form']").tap();
        if (url === "/#/week") {
          await page.locator(".week-supplement-card")
            .getByRole("button", { name: "补充记录", exact: true }).tap();
          await page.locator(".ios26-record-sheet")
            .getByRole("button", { name: "支出", exact: true }).tap();
        }
        if (url === "/#/plans/tasks") {
          await page.getByRole("button", { name: "打开任务筛选", exact: true }).tap();
        }
        const moreFilters = page.getByRole("button", { name: "更多筛选", exact: true });
        if (await moreFilters.isVisible().catch(() => false)) await moreFilters.tap();
        const report = await undersizedInputFonts(page);
        auditedFields += report.audited;
        expect(report.offenders, `${url} 存在小于 16px 的可见输入控件`).toEqual([]);
        if (url === "/#/week") {
          await page.locator(".ios26-record-sheet")
            .getByRole("button", { name: "取消", exact: true }).tap();
        }
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
    await expect(dock.getByRole("link")).toHaveText(["今日", "任务", "周报"]);
    await expect(dock.getByRole("link")).toHaveCount(3);
    await expect(dock.getByRole("button")).toHaveCount(0);

    const overflow = await pageOverflowReport(page);
    expect(overflow.offenders, "展开手机日报后不应产生页面级横向裁切").toEqual([]);
    expect(overflow.documentScrollWidth).toBeLessThanOrEqual(overflow.documentClientWidth + 1);
  });

  test("规划与数据分区末项在直接进入时保持可见", async ({ page }) => {
    await expectCurrentSectionLinkInView(page, "/#/plans/parameters", "规划分区", "计划参数");
    await expectCurrentSectionLinkInView(page, "/#/settings", "数据中心分区", "本地设置与备份");
  });
});
