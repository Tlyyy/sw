import type { WeeklyActivitySummary } from "../domain/weeklyActivity";
import { taskCompletionResourceLabel } from "../domain/weeklyActivity";

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

function dataUrlToBlob(dataUrl: string) {
  const [metadata, base64 = ""] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(metadata)?.[1] || "image/png";
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

export function createWeeklyActivityReportImage(data: WeeklyActivityReportImageData) {
  const displayedTasks = data.taskCompletions.slice(0, 6);
  const displayedExpenses = data.manualExpenses.slice(0, 3);
  const expenseSectionY = displayedTasks.length ? Math.min(1060, 646 + displayedTasks.length * 72) : 760;
  const expenseSectionBottom = displayedExpenses.length
    ? expenseSectionY + 94 + (displayedExpenses.length - 1) * 58
    : expenseSectionY + 116;
  const height = Math.max(MIN_HEIGHT, expenseSectionBottom + 160);
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
  context.fillText(`完成任务 · ${data.taskCompletions.length} 项`, 80, 566);
  context.fillStyle = "#71817e";
  setFont(context, 16, 650);
  context.textAlign = "right";
  context.fillText("完成任务会自动记录日期与资源消耗", 1000, 574);
  context.textAlign = "left";

  if (!displayedTasks.length) {
    fillRoundedRect(context, 80, 610, 920, 86, 12, "#f7f9f8");
    context.fillStyle = "#81908d";
    setFont(context, 20, 700);
    context.textAlign = "center";
    context.fillText("本周暂未标记完成任务", 540, 640);
    context.textAlign = "left";
  } else {
    displayedTasks.forEach((task, index) => {
      const y = 610 + index * 72;
      context.fillStyle = index % 2 ? "#fbfcfc" : "#f6f9f8";
      context.fillRect(80, y, 920, 62);
      fillRoundedRect(context, 96, y + 16, 70, 30, 9, "#e7f3f0");
      context.fillStyle = "#08765a";
      setFont(context, 16, 850);
      context.textAlign = "center";
      context.fillText(task.accountId, 131, y + 21);
      context.textAlign = "left";
      context.fillStyle = "#20312e";
      setFont(context, 18, 800);
      context.fillText(fitText(context, `${task.typeLabel} · ${task.actionLabel}`, 490), 184, y + 10);
      context.fillStyle = "#788985";
      setFont(context, 15, 650);
      context.fillText(`${shortDate(task.completedOn)} · ${task.taskKind}`, 184, y + 36);
      context.fillStyle = task.silverSpentWan > 0 ? "#a45c00" : "#506762";
      setFont(context, 17, 800);
      context.textAlign = "right";
      context.fillText(fitText(context, taskCompletionResourceLabel(task), 210), 980, y + 22);
      context.textAlign = "left";
    });
    if (data.taskCompletions.length > displayedTasks.length) {
      context.fillStyle = "#71817e";
      setFont(context, 15, 650);
      context.textAlign = "right";
      context.fillText(`另有 ${data.taskCompletions.length - displayedTasks.length} 项任务未展开`, 1000, 610 + displayedTasks.length * 72 - 2);
      context.textAlign = "left";
    }
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
      context.fillStyle = "#20312e";
      setFont(context, 17, 750);
      context.fillText(fitText(context, expense.note, 610), 178, y + 14);
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
