import {
  formatCurrency,
  formatGemLevel,
  formatNumber,
  type GemAccountProjection,
  type GemPlanProjection,
} from "../../domain/gems";
import type { AccountId } from "../../domain/types";
import { appName } from "../../app/brand";

export interface GemPlanShareData {
  projection: GemPlanProjection;
  marketDate: string;
}

const WIDTH = 1080;
const HEIGHT = 1350;
const FONT_FAMILY = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
const accountTones: Record<AccountId, string> = {
  FC: "#12678f",
  LG1: "#6446a6",
  LG2: "#8a5a00",
  PT: "#a33838",
  MYT: "#28764a",
};

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function fillRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string,
) {
  roundedRect(context, x, y, width, height, radius);
  context.fillStyle = color;
  context.fill();
}

function strokeRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string,
  lineWidth = 1,
) {
  roundedRect(context, x, y, width, height, radius);
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.stroke();
}

function setFont(context: CanvasRenderingContext2D, size: number, weight = 500) {
  context.font = `${weight} ${size}px ${FONT_FAMILY}`;
}

function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (context.measureText(text).width <= maxWidth) return text;
  let fitted = text;
  while (fitted && context.measureText(`${fitted}…`).width > maxWidth) fitted = fitted.slice(0, -1);
  return `${fitted}…`;
}

function dataUrlToBlob(dataUrl: string) {
  const [metadata, encoded] = dataUrl.split(",");
  const mimeType = metadata.match(/^data:(.*?);base64$/)?.[1] || "image/png";
  const binary = window.atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

function formatDate(value: string | null) {
  return value ? value.replaceAll("-", ".") : "待设置每周投入";
}

function weeksLabel(value: number | null) {
  if (value === null) return "待排期";
  return value === 0 ? "已达成" : `${value} 周`;
}

function drawSummaryMetric(
  context: CanvasRenderingContext2D,
  label: string,
  value: string,
  note: string,
  x: number,
  width: number,
  accent = false,
) {
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillStyle = "#71817e";
  setFont(context, 15, 700);
  context.fillText(label, x, 178);
  context.fillStyle = accent ? "#006b63" : "#142522";
  setFont(context, accent ? 29 : 25, 850);
  context.fillText(fitText(context, value, width), x, 207);
  context.fillStyle = "#71817e";
  setFont(context, 13, 650);
  context.fillText(fitText(context, note, width), x, 246);
}

function drawAccountCard(context: CanvasRenderingContext2D, account: GemAccountProjection, target: string, y: number) {
  const x = 48;
  const width = 984;
  const height = 178;
  const tone = accountTones[account.accountId];

  fillRoundedRect(context, x, y, width, height, 16, "#ffffff");
  strokeRoundedRect(context, x, y, width, height, 16, "#d5e0de", 1.5);
  fillRoundedRect(context, x, y, 7, height, 4, tone);

  fillRoundedRect(context, 70, y + 17, 88, 48, 11, `${tone}12`);
  strokeRoundedRect(context, 70, y + 17, 88, 48, 11, tone, 2);
  context.fillStyle = tone;
  context.textAlign = "center";
  context.textBaseline = "middle";
  setFont(context, 22, 850);
  context.fillText(account.accountId, 114, y + 41);

  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillStyle = "#142522";
  setFont(context, 24, 850);
  context.fillText(weeksLabel(account.weeks), 180, y + 16);
  context.fillStyle = "#71817e";
  setFont(context, 14, 650);
  context.fillText(`完成度 ${account.completion.toFixed(1)}%`, 180, y + 49);

  context.fillStyle = "#08765a";
  setFont(context, 20, 800);
  context.fillText(`缺 ${formatNumber(account.gap)} 颗`, 370, y + 18);
  context.fillStyle = "#40534f";
  setFont(context, 16, 750);
  context.fillText(`预算 ${formatCurrency(account.cost)}`, 565, y + 21);

  context.textAlign = "right";
  context.fillStyle = "#142522";
  setFont(context, 18, 800);
  context.fillText(formatDate(account.finishDate), 1004, y + 16);
  context.fillStyle = "#71817e";
  setFont(context, 13, 650);
  context.fillText(`目标 ${formatGemLevel(target)}`, 1004, y + 46);

  context.strokeStyle = "#dfe7e5";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(70, y + 76);
  context.lineTo(1004, y + 76);
  context.stroke();

  const cellWidth = 934 / Math.max(account.items.length, 1);
  account.items.forEach((entry, index) => {
    const cellX = 70 + index * cellWidth;
    if (index) {
      context.strokeStyle = "#e2e9e7";
      context.beginPath();
      context.moveTo(cellX, y + 90);
      context.lineTo(cellX, y + 158);
      context.stroke();
    }
    context.textAlign = "left";
    context.textBaseline = "top";
    context.fillStyle = "#71817e";
    setFont(context, 12, 700);
    context.fillText(fitText(context, `${entry.item.slot} · ${entry.item.gem.name}`, cellWidth - 18), cellX + 9, y + 91);
    context.fillStyle = "#243a36";
    setFont(context, 14, 800);
    context.fillText(fitText(context, `${entry.item.gem.level} → ${target}`, cellWidth - 18), cellX + 9, y + 116);
    context.fillStyle = entry.gap ? "#08765a" : "#71817e";
    setFont(context, 13, 750);
    context.fillText(entry.gap ? `缺 ${formatNumber(entry.gap)}` : "已达成", cellX + 9, y + 142);
  });
}

export function createGemPlanShareImage(data: GemPlanShareData) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法生成图片");

  context.fillStyle = "#edf3f1";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillStyle = "#006b63";
  setFont(context, 31, 850);
  context.fillText(appName, 52, 34);
  context.fillStyle = "#142522";
  setFont(context, 39, 850);
  context.fillText("宝石计划", 52, 83);
  context.textAlign = "right";
  context.fillStyle = "#60736f";
  setFont(context, 18, 650);
  context.fillText(`行情 ${data.marketDate}`, 1028, 43);
  context.fillText(`每号每周投入 ${formatNumber(data.projection.weeklyIncomeWan)} 万`, 1028, 91);

  fillRoundedRect(context, 48, 150, 984, 126, 16, "#ffffff");
  strokeRoundedRect(context, 48, 150, 984, 126, 16, "#d5e0de", 1.5);
  drawSummaryMetric(context, "目标", formatGemLevel(data.projection.targetLevel), "五号装备统一目标", 76, 176, true);
  drawSummaryMetric(context, "总缺口", `${formatNumber(data.projection.totalGap)} 颗`, "按当前装备进度", 282, 190);
  drawSummaryMetric(context, "总预算", formatCurrency(data.projection.totalCost), "按当前生效行情", 510, 190);
  drawSummaryMetric(context, "最长周期", weeksLabel(data.projection.longestWeeks), formatDate(data.projection.finishDate), 742, 250, true);

  data.projection.accounts.slice(0, 5).forEach((account, index) => {
    drawAccountCard(context, account, data.projection.targetLevel, 300 + index * 190);
  });

  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillStyle = "#71817e";
  setFont(context, 15, 650);
  context.fillText(`起算 ${data.projection.startDate} · 五个账号按每号每周投入独立排期`, WIDTH / 2, 1284);
  context.fillStyle = "#9aa8a4";
  setFont(context, 14, 650);
  context.fillText(appName, WIDTH / 2, 1315);

  return dataUrlToBlob(canvas.toDataURL("image/png"));
}
