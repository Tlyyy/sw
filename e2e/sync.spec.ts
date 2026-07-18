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

test("同步入口与成功状态卡片在深色主题下清晰可见", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.goto("/#/settings");

  await expect(page.getByRole("link", { name: "查看云同步状态" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "自动云同步" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "更换访问密码" })).toBeVisible();
  await expect(page.getByLabel("新密码（至少 16 个字符）")).toBeVisible();
  await expect(page.getByLabel("再次输入新密码")).toBeVisible();
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
