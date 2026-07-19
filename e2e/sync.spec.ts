import { expect, test } from "@playwright/test";

type Rgb = [number, number, number];

function luminance([red, green, blue]: Rgb) {
  const channels = [red, green, blue].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground: Rgb, background: Rgb) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("sw-e2e-auth-v1", "1"));
});

test("automation 本机状态在桌面与手机端提供可访问的同步入口", async ({ page }, testInfo) => {
  test.skip(!["desktop", "mobile"].includes(testInfo.project.name), "仅覆盖桌面与手机断点");
  await page.goto("/#/");

  const entry = page.getByRole("link", { name: "查看云同步状态" });
  const liveRegion = entry.locator('[aria-live="polite"]');
  const fullLabel = entry.locator(".orbit-sync-label-full");
  const compactLabel = entry.locator(".orbit-sync-label-compact");

  await expect(entry).toBeVisible();
  await expect(entry).toHaveAttribute("href", "#/settings");
  await expect(entry).toHaveAttribute("title", "仅本机");
  await expect(entry).toHaveClass(/(?:^|\s)is-neutral(?:\s|$)/);
  await expect(entry).not.toHaveClass(/(?:^|\s)is-(?:info|success|warning|danger)(?:\s|$)/);
  await expect(liveRegion).toHaveCount(1);
  await expect(liveRegion).toHaveAttribute("aria-live", "polite");
  await expect(fullLabel).toHaveText("仅本机");
  await expect(compactLabel).toHaveText("仅本机");

  if (testInfo.project.name === "desktop") {
    await expect(fullLabel).toBeVisible();
    await expect(compactLabel).not.toBeVisible();
  } else {
    await expect(fullLabel).not.toBeVisible();
    await expect(compactLabel).toBeVisible();

    const touchTarget = await entry.boundingBox();
    expect(touchTarget).not.toBeNull();
    expect(touchTarget!.width).toBeGreaterThanOrEqual(44);
    expect(touchTarget!.height).toBeGreaterThanOrEqual(44);
  }

  await entry.click();
  await expect(page).toHaveURL(/#\/settings$/);
  await expect(page.getByRole("heading", { name: "界面、同步与备份", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "自动云同步", exact: true })).toBeVisible();
});

test("同步入口与成功状态卡片在深色主题下清晰可见", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.goto("/#/settings");

  await expect(page.getByRole("link", { name: "查看云同步状态" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "自动云同步" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "更换访问密码" })).toBeVisible();
  const nextPassword = page.getByLabel("新密码（至少 6 个字符）");
  const confirmation = page.getByLabel("再次输入新密码");
  await expect(nextPassword).toBeVisible();
  await expect(nextPassword).toHaveAttribute("minlength", "6");
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toHaveAttribute("minlength", "6");
  const section = page.locator(".cloud-sync-section");
  await expect(section).toBeVisible();

  const colors = await section.evaluate((element) => {
    element.classList.remove("is-neutral", "is-info", "is-warning", "is-danger");
    element.classList.add("is-success");

    const parse = (value: string): [number, number, number, number] => {
      const channels = value.match(/[\d.]+/g)?.map(Number) || [];
      return [channels[0] || 0, channels[1] || 0, channels[2] || 0, channels[3] ?? 1];
    };
    const over = (foreground: number[], background: number[]) => {
      const alpha = foreground[3] + background[3] * (1 - foreground[3]);
      if (!alpha) return [0, 0, 0, 0];
      return [
        (foreground[0] * foreground[3] + background[0] * background[3] * (1 - foreground[3])) / alpha,
        (foreground[1] * foreground[3] + background[1] * background[3] * (1 - foreground[3])) / alpha,
        (foreground[2] * foreground[3] + background[2] * background[3] * (1 - foreground[3])) / alpha,
        alpha,
      ];
    };

    let background = [0, 0, 0, 0];
    for (let current: Element | null = element; current && background[3] < 0.999; current = current.parentElement) {
      background = over(background, parse(getComputedStyle(current).backgroundColor));
    }
    const heading = element.querySelector("h2");
    const paragraph = element.querySelector("p");
    return {
      background: background.slice(0, 3) as [number, number, number],
      heading: parse(getComputedStyle(heading!).color).slice(0, 3) as [number, number, number],
      paragraph: parse(getComputedStyle(paragraph!).color).slice(0, 3) as [number, number, number],
    };
  });

  expect(contrastRatio(colors.heading, colors.background)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(colors.paragraph, colors.background)).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: testInfo.outputPath("sync-settings.png"), fullPage: true });
});
