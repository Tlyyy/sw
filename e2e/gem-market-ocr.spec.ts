import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort("blockedbyclient"));
  await page.addInitScript(() => sessionStorage.setItem("sw-e2e-auth-v1", "1"));
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

  const staleCurrentPrices = [815, 880, 1289, 1255, 303, 265];
  const gemNames = ["太阳石", "月亮石", "舍利子", "黑宝石", "红玛瑙", "神秘石"];
  for (let index = 0; index < gemNames.length; index += 1) {
    await page.getByLabel(`${gemNames[index]}当前价格`).fill(String(staleCurrentPrices[index]));
  }

  await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const margin = 7;
    const scale = 0.52;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale) + margin * 2;
    canvas.height = Math.round(bitmap.height * scale) + margin * 2;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#74a7df";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.filter = "blur(0.36px)";
    context.drawImage(bitmap, margin, margin, canvas.width - margin * 2, canvas.height - margin * 2);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), "image/jpeg", 0.66));
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], "scaled-margin.jpg", { type: "image/jpeg" }));
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: transfer });
    window.dispatchEvent(event);
  }, imageBase64);
  await expect(page.getByText("已识别 6 项价格", { exact: true })).toBeVisible({ timeout: 90_000 });
  const correctedPrices = [798, 852, 1257, 1240, 308, 264];
  const transformedRecognized = await page.locator(".gem-result-row input").evaluateAll((nodes) =>
    nodes.map((node) => Number((node as HTMLInputElement).value)),
  );
  expect(transformedRecognized).toEqual(correctedPrices);
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
  await expect(page).toHaveURL(/#\/plans\/gems$/);
  await expect(page.locator(".gem-market-strip > div > span").first().locator("strong")).toHaveText("801");
  await expect(page.locator(".gem-market-strip input, .gem-ocr-panel")).toHaveCount(0);
  expect(externalRequests).toEqual([]);
});

test("识别带偏移边栏的真实 228×251 行情截图", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.goto("/#/data/market");
  await expect(page.locator(".gem-dropzone")).toBeVisible();

  const imageBase64 = readFileSync(path.resolve("e2e/fixtures/gem-market-real-228x251.png")).toString("base64");
  const startedAt = Date.now();
  await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const file = new File([bytes], "real-market-228x251.png", { type: "image/png" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: transfer });
    window.dispatchEvent(event);
  }, imageBase64);

  await expect(page.getByText("已识别 6 项价格", { exact: true })).toBeVisible({ timeout: 5_000 });
  const recognized = await page.locator(".gem-result-row input").evaluateAll((nodes) =>
    nodes.map((node) => Number((node as HTMLInputElement).value)),
  );
  expect(recognized).toEqual([822, 875, 1264, 1224, 318, 264]);
  expect(Date.now() - startedAt).toBeLessThan(5_000);
});
