import type {
  WeeklyAccountActivitySummary,
  WeeklyActivitySummary,
} from "../domain/weeklyActivity";

export interface WeeklyActivityReportImageData extends WeeklyActivitySummary {
  generatedAt: string;
}

const WIDTH = 1080;
const MIN_HEIGHT = 1040;
const FONT_FAMILY = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function fillRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, color: string) {
  roundedRect(context, x, y, width, height, radius);
  context.fillStyle = color;
  context.fill();
}

function strokeRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, color: string, lineWidth = 2) {
  roundedRect(context, x, y, width, height, radius);
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.stroke();
}

function setFont(context: CanvasRenderingContext2D, size: number, weight = 500) {
  context.font = `${weight} ${size}px ${FONT_FAMILY}`;
}

function numberLabel(value: number) {
  return Number(value.toFixed(2)).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function wanLabel(value: number | null, signed = false) {
  if (value === null) return "—";
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${numberLabel(value)} 万`;
}

function fitText(context: CanvasRenderingContext2D, value: string, maxWidth: number) {
  if (context.measureText(value).width <= maxWidth) return value;
  let candidate = value;
  while (candidate.length > 1 && context.measureText(`${candidate}…`).width > maxWidth) candidate = candidate.slice(0, -1);
  return `${candidate}…`;
}

function shortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function drawMetric(
  context: CanvasRenderingContext2D,
  x: number,
  label: string,
  value: string,
  note: string,
  tone: "teal" | "amber" | "neutral" = "neutral",
) {
  const colors = tone === "teal"
    ? { border: "#9bcfc7", surface: "#e7f5f2", value: "#067068" }
    : tone === "amber"
      ? { border: "#ead3a5", surface: "#fff7e8", value: "#9a5a00" }
      : { border: "#d8e1df", surface: "#f7f9f8", value: "#20312e" };
  fillRoundedRect(context, x, 286, 218, 146, 16, colors.surface);
  strokeRoundedRect(context, x, 286, 218, 146, 16, colors.border, 2);
  context.fillStyle = "#647874";
  setFont(context, 18, 750);
  context.fillText(label, x + 18, 306);
  context.fillStyle = colors.value;
  setFont(context, value === "—" ? 36 : 31, 850);
  context.fillText(fitText(context, value, 182), x + 18, 344);
  context.fillStyle = "#7a8b87";
  setFont(context, 15, 650);
  context.fillText(fitText(context, note, 182), x + 18, 399);
}

function accountTaskNames(account: WeeklyAccountActivitySummary) {
  if (!account.taskCompletions.length) return "本周无完成任务";
  const names = account.taskCompletions.slice(0, 2)
    .map((task) => `${task.typeLabel} · ${task.actionLabel}`);
  const remainder = account.taskCompletions.length - names.length;
  return `${names.join("、")}${remainder > 0 ? `，另 ${remainder} 项` : ""}`;
}

function accountTaskResources(account: WeeklyAccountActivitySummary) {
  const totals = account.taskCompletions.reduce((result, task) => {
    result[task.resourceKind] += task.resourceAmount;
    return result;
  }, { silver: 0, eggs: 0, innerShards: 0 });
  const parts = [
    totals.silver > 0 ? `${numberLabel(totals.silver)} 万银` : "",
    totals.eggs > 0 ? `${numberLabel(totals.eggs)} 蛋` : "",
    totals.innerShards > 0 ? `${numberLabel(totals.innerShards)} 碎片` : "",
  ].filter(Boolean);
  return parts.length ? `任务消耗 ${parts.join(" · ")}` : "无任务资源消耗";
}

function dataUrlToBlob(dataUrl: string) {
  const [metadata, base64 = ""] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(metadata)?.[1] || "image/png";
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

export function createWeeklyActivityReportImage(data: WeeklyActivityReportImageData) {
  const displayedExpenses = data.manualExpenses.slice(0, 4);
  const accountRowsY = 622;
  const accountRowStep = 112;
  const accountSectionBottom = accountRowsY + data.accountSummaries.length * accountRowStep;
  const hasUnassignedExpenses = data.unassignedManualSilverExpenseWan > 0;
  const unassignedBannerY = accountSectionBottom + 6;
  const expenseSectionY = accountSectionBottom + (hasUnassignedExpenses ? 80 : 36);
  const expenseSectionBottom = displayedExpenses.length
    ? expenseSectionY + 44 + displayedExpenses.length * 58
    : expenseSectionY + 116;
  const height = Math.max(MIN_HEIGHT, expenseSectionBottom + 150);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法生成图片");

  context.textBaseline = "top";
  context.fillStyle = "#eef3f2";
  context.fillRect(0, 0, WIDTH, height);
  const backdrop = context.createLinearGradient(0, 0, WIDTH, height);
  backdrop.addColorStop(0, "rgba(0, 121, 111, .13)");
  backdrop.addColorStop(.55, "rgba(255, 255, 255, 0)");
  backdrop.addColorStop(1, "rgba(18, 103, 143, .08)");
  context.fillStyle = backdrop;
  context.fillRect(0, 0, WIDTH, height);

  context.fillStyle = "#006b63";
  setFont(context, 34, 850);
  context.fillText("项目台账", 64, 48);
  context.fillStyle = "#60736f";
  setFont(context, 20, 750);
  context.textAlign = "right";
  context.fillText("WEEKLY REPORT", WIDTH - 64, 58);
  context.textAlign = "left";

  fillRoundedRect(context, 48, 116, 984, height - 176, 30, "#ffffff");
  strokeRoundedRect(context, 48, 116, 984, height - 176, 30, "#d4dfdd", 2);
  fillRoundedRect(context, 48, 116, 984, 10, 5, "#00796f");

  context.fillStyle = "#142522";
  setFont(context, 38, 850);
  context.fillText("本周银子与任务周报", 80, 164);
  context.fillStyle = "#657975";
  setFont(context, 22, 650);
  context.fillText(`${data.weekStart} 至 ${data.reportEnd}`, 80, 218);
  fillRoundedRect(context, 780, 172, 220, 52, 15, "#e7f3f0");
  context.fillStyle = "#08765a";
  setFont(context, 19, 800);
  context.textAlign = "center";
  context.fillText(`${data.recordedDays} 天库存记录`, 890, 187);
  context.textAlign = "left";

  drawMetric(context, 80, "本周收获", wanLabel(data.harvestedSilverWan), "净变化 + 已记录支出", "teal");
  drawMetric(context, 314, "已记录支出", wanLabel(data.totalSilverExpenseWan), `任务 ${numberLabel(data.taskSilverExpenseWan)} · 其他 ${numberLabel(data.manualSilverExpenseWan)}`, "amber");
  drawMetric(context, 548, "库存净变化", wanLabel(data.inventoryNetChangeWan, true), data.inventoryChangeTo ? `截至 ${data.inventoryChangeTo}` : "等待比较基线");
  drawMetric(context, 782, "当前银子库存", wanLabel(data.currentSilverWan), data.latestInventoryDate ? `库存日期 ${data.latestInventoryDate}` : "尚无库存记录");

  fillRoundedRect(context, 80, 458, 920, 68, 14, "#f2f7f6");
  context.fillStyle = "#08765a";
  setFont(context, 18, 800);
  context.fillText("计算口径", 102, 480);
  context.fillStyle = "#536a66";
  setFont(context, 18, 650);
  context.fillText("本周收获 = 库存净变化 + 已记录的银子支出", 210, 480);

  context.fillStyle = "#142522";
  setFont(context, 24, 850);
  context.fillText(`各账号本周情况 · ${data.accountSummaries.length} 个账号`, 80, 566);
  context.fillStyle = "#71817e";
  setFont(context, 16, 650);
  context.textAlign = "right";
  context.fillText(`完成任务共 ${data.taskCompletions.length} 项，支出已按账号归集`, 1000, 574);
  context.textAlign = "left";

  data.accountSummaries.forEach((account, index) => {
    const y = accountRowsY + index * accountRowStep;
    fillRoundedRect(context, 80, y, 920, 102, 14, index % 2 ? "#fbfcfc" : "#f5f8f7");
    strokeRoundedRect(context, 80, y, 920, 102, 14, "#e1e8e6", 1);
    fillRoundedRect(context, 96, y + 18, 72, 42, 11, "#e3f2ef");
    context.fillStyle = "#08765a";
    setFont(context, 18, 850);
    context.textAlign = "center";
    context.fillText(account.accountId, 132, y + 27);
    context.fillStyle = "#71817e";
    setFont(context, 13, 750);
    context.fillText(`${account.taskCompletions.length} 项任务`, 132, y + 70);
    context.textAlign = "left";

    const accountMetrics = [
      { x: 190, label: "收获", value: wanLabel(account.harvestedSilverWan), color: "#067068" },
      { x: 314, label: "支出", value: wanLabel(account.totalSilverExpenseWan), color: account.totalSilverExpenseWan > 0 ? "#9a5a00" : "#20312e" },
      { x: 438, label: "净变化", value: wanLabel(account.inventoryNetChangeWan, true), color: (account.inventoryNetChangeWan ?? 0) < 0 ? "#a33d35" : "#20312e" },
      { x: 562, label: "当前库存", value: wanLabel(account.currentSilverWan), color: "#20312e" },
    ];
    accountMetrics.forEach((metric) => {
      context.fillStyle = "#71817e";
      setFont(context, 13, 750);
      context.fillText(metric.label, metric.x, y + 17);
      context.fillStyle = metric.color;
      setFont(context, 20, 850);
      context.fillText(fitText(context, metric.value, 112), metric.x, y + 43);
    });

    context.fillStyle = "#d9e2e0";
    context.fillRect(688, y + 16, 1, 70);
    context.fillStyle = "#20312e";
    setFont(context, 15, 800);
    context.fillText(fitText(context, accountTaskNames(account), 282), 708, y + 14);
    context.fillStyle = "#71817e";
    setFont(context, 13, 650);
    context.fillText(fitText(context, accountTaskResources(account), 282), 708, y + 43);
    context.fillText(
      fitText(context, `支出：任务 ${numberLabel(account.taskSilverExpenseWan)} · 其他 ${numberLabel(account.manualSilverExpenseWan)} 万`, 282),
      708,
      y + 69,
    );
  });

  if (hasUnassignedExpenses) {
    fillRoundedRect(context, 80, unassignedBannerY, 920, 54, 12, "#fff6e6");
    context.fillStyle = "#9a5a00";
    setFont(context, 16, 800);
    context.fillText(`有 ${numberLabel(data.unassignedManualSilverExpenseWan)} 万旧支出未分账号`, 102, unassignedBannerY + 16);
    context.fillStyle = "#75664e";
    setFont(context, 14, 650);
    context.textAlign = "right";
    context.fillText("已计入总览，未计入上方单账号小计", 978, unassignedBannerY + 18);
    context.textAlign = "left";
  }

  context.fillStyle = "#142522";
  setFont(context, 24, 850);
  context.fillText(`其他银子支出 · ${data.manualExpenses.length} 笔`, 80, expenseSectionY);
  if (!displayedExpenses.length) {
    fillRoundedRect(context, 80, expenseSectionY + 44, 920, 72, 12, "#f7f9f8");
    context.fillStyle = "#81908d";
    setFont(context, 18, 700);
    context.fillText("本周没有补记其他支出", 104, expenseSectionY + 68);
  } else {
    displayedExpenses.forEach((expense, index) => {
      const y = expenseSectionY + 44 + index * 58;
      context.fillStyle = index % 2 ? "#fbfcfc" : "#f7f9f8";
      context.fillRect(80, y, 920, 50);
      context.fillStyle = "#71817e";
      setFont(context, 16, 700);
      context.fillText(shortDate(expense.effectiveDate), 100, y + 15);
      fillRoundedRect(context, 176, y + 10, expense.accountId ? 68 : 96, 30, 9, expense.accountId ? "#e7f3f0" : "#fff1d8");
      context.fillStyle = expense.accountId ? "#08765a" : "#9a5a00";
      setFont(context, 14, 850);
      context.textAlign = "center";
      context.fillText(expense.accountId || "未分账号", expense.accountId ? 210 : 224, y + 16);
      context.textAlign = "left";
      context.fillStyle = "#20312e";
      setFont(context, 17, 750);
      context.fillText(fitText(context, expense.note, expense.accountId ? 510 : 482), expense.accountId ? 262 : 290, y + 14);
      context.fillStyle = "#a45c00";
      setFont(context, 17, 850);
      context.textAlign = "right";
      context.fillText(`${numberLabel(expense.amountWan)} 万`, 980, y + 14);
      context.textAlign = "left";
    });
  }

  context.fillStyle = "#899793";
  setFont(context, 15, 650);
  context.fillText(`生成时间 ${data.generatedAt}`, 80, height - 104);
  context.textAlign = "right";
  context.fillText(data.latestInventoryDate ? `库存截至 ${data.latestInventoryDate}` : "库存尚未建立比较基线", 1000, height - 104);
  context.textAlign = "left";

  return dataUrlToBlob(canvas.toDataURL("image/png"));
}
