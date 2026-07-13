import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort("blockedbyclient"));
  await page.addInitScript(() => sessionStorage.setItem("sw-site-auth-session", "1"));
});

test("粘贴真实行情截图后可识别、记录趋势并在刷新后保留", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  test.setTimeout(120_000);
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    if (/^https?:\/\/(?!127\.0\.0\.1|localhost)/.test(request.url())) externalRequests.push(request.url());
  });

  await page.goto("/#/data/market");
  await expect(page.locator(".gem-dropzone")).toBeVisible();
  const imageBase64 = readFileSync(path.resolve("图片/原始截图/公共/宝石行情/2026-07-09/gem-market-2026-07-09.png")).toString("base64");
  await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const blob = new Blob([bytes], { type: "image/png" });
    const file = new File([blob], "clipboard-market.png", { type: "image/png" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: transfer });
    window.dispatchEvent(event);
  }, imageBase64);

  await expect(page.getByText("已识别 6 项价格", { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/剪贴板图片/)).toBeVisible();
  await expect(page.getByText(/本地离线数字识别 · 结果清晰/)).toBeVisible();
  const recognized = await page.locator(".gem-result-row input").evaluateAll((nodes) =>
    nodes.map((node) => Number((node as HTMLInputElement).value)),
  );
  expect(recognized).toEqual([798, 852, 1257, 1240, 308, 264]);

  await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const margin = 10;
    const scale = 0.72;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale) + margin * 2;
    canvas.height = Math.round(bitmap.height * scale) + margin * 2;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#74a7df";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.filter = "blur(0.25px)";
    context.drawImage(bitmap, margin, margin, canvas.width - margin * 2, canvas.height - margin * 2);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), "image/jpeg", 0.78));
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], "scaled-margin.jpg", { type: "image/jpeg" }));
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: transfer });
    window.dispatchEvent(event);
  }, imageBase64);
  await expect(page.getByText("已识别 6 项价格", { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/项需要重点核对/)).toBeVisible();
  const correctedPrices = [798, 852, 1257, 1240, 308, 264];
  const resultInputs = page.locator(".gem-result-row input");
  await expect(resultInputs).toHaveCount(correctedPrices.length);
  for (let index = 0; index < correctedPrices.length; index += 1) {
    await resultInputs.nth(index).fill(String(correctedPrices[index]));
  }

  await page.getByLabel("太阳石识别价格").fill("799");
  await page.getByRole("button", { name: "确认并应用六项价格" }).click();
  await expect(page.getByLabel("太阳石当前价格")).toHaveValue("799");
  await expect(page.locator(".market-maintenance em.edited")).toHaveCount(1);
  await expect(page.getByText("截图价格已应用并记入行情历史")).toBeVisible();
  await expect(page.locator(".gem-history-row")).toHaveCount(2);
  await expect(page.locator(".gem-history-row").first()).toContainText("截图识别");

  await page.reload();
  await expect(page.getByLabel("太阳石当前价格")).toHaveValue("799");
  await expect(page.locator(".market-maintenance em.edited")).toHaveCount(1);
  await expect(page.locator(".gem-history-row")).toHaveCount(2);

  await page.getByLabel("太阳石当前价格").fill("801");
  await page.getByRole("button", { name: "记录当前价格" }).click();
  await expect(page.locator(".gem-history-row")).toHaveCount(3);
  await expect(page.locator(".gem-history-row").first()).toContainText("手动记录");
  await page.reload();
  await expect(page.getByLabel("太阳石当前价格")).toHaveValue("801");
  await expect(page.locator(".gem-history-row")).toHaveCount(3);

  await page.goto("/#/plans/upgrades");
  await expect(page.locator(".readonly-market-band article").first().locator("strong")).toHaveText("801");
  await expect(page.locator(".market-band input, .gem-ocr-panel")).toHaveCount(0);
  expect(externalRequests).toEqual([]);
});
