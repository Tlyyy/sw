import { expect, test, type Page } from "@playwright/test";

const mobileRoutes = [
  "/#/",
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
  ".orbit-nav.open > a",
  ".orbit-nav.open > button",
  ".orbit-mobile-dock > a",
  ".orbit-mobile-dock > button",
  ".subnav a",
  "main .button",
  "main .workbench-primary",
  "main .radar-action-card.primary",
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
  return { baseline: at(-1), monday: at(0), tuesday: at(1), wednesday: at(2) };
}

async function waitForApplicationPage(page: Page) {
  await expect(page.locator(".workbench-page, .page-wrap, .matrix-page").first()).toBeVisible();
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
    await page.getByRole("button", { name: "打开导航" }).tap();
    const mobileNavigation = page.getByRole("dialog", { name: "主导航" });
    await expect(mobileNavigation).toBeVisible();
    expect(await undersizedPrimaryTargets(page), "移动主导航存在不足 44px 的主要触控目标").toEqual([]);
    await mobileNavigation.getByRole("button", { name: "关闭导航" }).tap();

    for (const url of ["/#/", "/#/plans/tasks", "/#/analysis/matrix", "/#/settings"] as const) {
      await test.step(url, async () => {
        await page.goto(url);
        await waitForApplicationPage(page);
        expect(await undersizedPrimaryTargets(page), `${url} 存在不足 44px 的主要触控目标`).toEqual([]);
      });
    }
  });

  test("移动表单输入字号不触发浏览器自动缩放", async ({ page }) => {
    test.setTimeout(60_000);
    let auditedFields = 0;
    for (const url of formRoutes) {
      await test.step(url, async () => {
        await page.goto(url);
        await waitForApplicationPage(page);
        const moreFilters = page.getByRole("button", { name: "更多筛选", exact: true });
        if (await moreFilters.isVisible().catch(() => false)) await moreFilters.tap();
        const report = await undersizedInputFonts(page);
        auditedFields += report.audited;
        expect(report.offenders, `${url} 存在小于 16px 的可见输入控件`).toEqual([]);
      });
    }
    expect(auditedFields, "应实际审查一批移动表单控件").toBeGreaterThan(10);
  });

  test("库存录入弹窗锁住背景并保持操作栏可见", async ({ page }) => {
    await page.goto("/#/data/inventory");
    await waitForApplicationPage(page);
    await page.getByRole("button", { name: /录入五号快照|建立库存基线/ }).first().tap();

    const dialog = page.getByRole("dialog", { name: "录入库存快照" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("spinbutton")).toHaveCount(20);

    const layout = await dialog.evaluate((element) => {
      const dialogRect = element.getBoundingClientRect();
      const footer = element.querySelector("footer");
      if (!footer) throw new Error("库存录入弹窗缺少操作栏");
      const footerRect = footer.getBoundingClientRect();
      return {
        rootOverflow: getComputedStyle(document.documentElement).overflowY,
        bodyOverflow: getComputedStyle(document.body).overflowY,
        viewportWidth: document.documentElement.clientWidth,
        viewportHeight: window.innerHeight,
        dialogLeft: dialogRect.left,
        dialogRight: dialogRect.right,
        footerTop: footerRect.top,
        footerBottom: footerRect.bottom,
      };
    });

    expect(layout.rootOverflow, "弹窗打开后 html 根滚动应锁定").toBe("hidden");
    expect(layout.bodyOverflow, "弹窗打开后 body 滚动应锁定").toBe("hidden");
    expect(layout.dialogLeft).toBeGreaterThanOrEqual(-1);
    expect(layout.dialogRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.footerTop, "弹窗操作栏应出现在当前视口").toBeGreaterThanOrEqual(0);
    expect(layout.footerBottom, "弹窗操作栏不应超出当前视口").toBeLessThanOrEqual(layout.viewportHeight + 1);

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
    }, { version: 2, snapshots });

    await page.goto("/#/data/inventory");
    await waitForApplicationPage(page);

    const report = page.getByTestId("inventory-week-report");
    await expect(report).toBeVisible();
    await expect(report.getByText("2 / 7 天有记录", { exact: true })).toBeVisible();
    await expect(report.locator(".week-day-entry")).toHaveCount(7);
    await expect(report.getByRole("button", { name: `补录${week.tuesday}库存`, exact: true })).toBeVisible();
    await expect(report.getByText(`${week.baseline} → ${week.wednesday}`, { exact: false })).toBeVisible();
    await expect(report.getByText("银列仅合计纯银子；普通蛋按 5.5 万/个在表下单独折算", { exact: true })).toBeVisible();

    const weeklyTotal = report.getByRole("row", { name: "本周净变化合计", exact: true });
    await expect(weeklyTotal).toBeVisible();
    await expect(weeklyTotal.locator(":scope > *")).toHaveText(["合计", "+20", "+40", "+200", "+60"]);

    const weeklyValueTotal = report.getByTestId("weekly-value-total");
    await expect(weeklyValueTotal).toBeVisible();
    await expect(weeklyValueTotal.getByText("纯银子 +200万", { exact: true })).toBeVisible();
    await expect(weeklyValueTotal.getByText("普通蛋 +40 × 5.5万/个 = +220万", { exact: true })).toBeVisible();
    await expect(weeklyValueTotal.locator(":scope > b")).toHaveText("+420万");

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

    await report.getByRole("button", { name: `查看${week.wednesday}库存日报`, exact: true }).tap();
    await expect(report.getByText(`${week.wednesday} 日报`, { exact: true })).toBeVisible();
    await expect(report.getByRole("table", { name: `${week.wednesday} 五账号库存明细`, exact: true })).toBeVisible();

    const dock = page.getByRole("navigation", { name: "手机快捷导航", exact: true });
    await expect(dock).toBeVisible();
    await expect(dock.locator("a, button")).toHaveCount(5);
    await expect(dock.getByRole("link", { name: "数据", exact: true })).toHaveAttribute("aria-current", "page");

    const overflow = await pageOverflowReport(page);
    expect(overflow.offenders, "展开手机日报后不应产生页面级横向裁切").toEqual([]);
    expect(overflow.documentScrollWidth).toBeLessThanOrEqual(overflow.documentClientWidth + 1);
  });

  test("规划与数据分区末项在直接进入时保持可见", async ({ page }) => {
    await expectCurrentSectionLinkInView(page, "/#/plans/parameters", "规划分区", "计划参数");
    await expectCurrentSectionLinkInView(page, "/#/settings", "数据中心分区", "本地设置与备份");
  });
});
