import { appName } from "../../app/brand";
import type {
  AccountingIntervalKind,
  AccountingResources,
} from "../../domain/accounting";
import type { AccountId } from "../../domain/types";

export interface EarningsShareImageData {
  accountId: AccountId;
  accountTone: string;
  kind: AccountingIntervalKind;
  fromDate: string;
  toDate: string;
  intervalDays: number;
  inventoryNetChange: AccountingResources;
  ledgerImpact: AccountingResources;
  actualIncome: AccountingResources;
  settledEntryCount: number;
}

const WIDTH = 1080;
const HEIGHT = 1350;
const FONT_FAMILY = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';

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
  lineWidth = 2,
) {
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

function signedLabel(value: number | null, unit: string) {
  if (value === null) return "未知";
  const normalized = Number(value.toFixed(2));
  const prefix = normalized > 0 ? "+" : "";
  return `${prefix}${numberLabel(normalized)} ${unit}`;
}

function compactResources(resources: AccountingResources) {
  return [
    `银 ${signedLabel(resources.silverWan, "万")}`,
    `专 ${signedLabel(resources.dedicatedEggs, "个")}`,
    `普 ${signedLabel(resources.regularEggs, "个")}`,
    `碎 ${signedLabel(resources.innerShards, "片")}`,
  ].join("　");
}

function valueTone(value: number | null) {
  if (value === null || value === 0) return "#40534f";
  return value > 0 ? "#08765a" : "#b5473c";
}

function shortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function dataUrlToBlob(dataUrl: string) {
  const [metadata, encoded] = dataUrl.split(",");
  const mimeType = metadata.match(/^data:(.*?);base64$/)?.[1] || "image/png";
  const binary = globalThis.atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

function drawMetric(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  tone: string,
) {
  fillRoundedRect(context, x, y, width, 152, 18, "#f6f9f8");
  strokeRoundedRect(context, x, y, width, 152, 18, "#dce5e3", 2);
  context.fillStyle = "#71817e";
  setFont(context, 18, 750);
  context.fillText(label, x + 24, y + 24);
  context.fillStyle = tone;
  setFont(context, 31, 850);
  context.fillText(value, x + 24, y + 68);
}

export function createEarningsShareImage(data: EarningsShareImageData) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法生成图片");

  context.textBaseline = "top";
  context.textAlign = "left";
  context.fillStyle = "#edf3f1";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  const backdrop = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
  backdrop.addColorStop(0, "rgba(0, 121, 111, .13)");
  backdrop.addColorStop(.58, "rgba(255, 255, 255, 0)");
  backdrop.addColorStop(1, "rgba(196, 108, 0, .08)");
  context.fillStyle = backdrop;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = "#006b63";
  setFont(context, 34, 850);
  context.fillText(appName, 58, 42);
  context.fillStyle = "#60736f";
  setFont(context, 19, 750);
  context.textAlign = "right";
  context.fillText("ACTUAL INCOME", WIDTH - 58, 52);
  context.textAlign = "left";

  fillRoundedRect(context, 44, 112, 992, 1178, 30, "#ffffff");
  strokeRoundedRect(context, 44, 112, 992, 1178, 30, "#d5e0de", 2);
  fillRoundedRect(context, 44, 112, 992, 10, 5, data.accountTone);

  fillRoundedRect(context, 76, 158, 116, 66, 16, `${data.accountTone}18`);
  strokeRoundedRect(context, 76, 158, 116, 66, 16, data.accountTone, 2);
  context.fillStyle = data.accountTone;
  setFont(context, 28, 850);
  context.textAlign = "center";
  context.fillText(data.accountId, 134, 174);
  context.textAlign = "left";

  context.fillStyle = "#142522";
  setFont(context, 38, 850);
  context.fillText(data.kind === "daily" ? "每日实际所得" : "区间实际所得", 220, 151);
  context.fillStyle = "#657975";
  setFont(context, 20, 650);
  const range = data.kind === "daily"
    ? `${shortDate(data.toDate)} · 连续库存结算`
    : `${shortDate(data.fromDate)} → ${shortDate(data.toDate)} · ${data.intervalDays} 天`;
  context.fillText(range, 220, 202);

  fillRoundedRect(context, 76, 264, 928, 208, 24, "#eaf5f2");
  context.fillStyle = "#657975";
  setFont(context, 19, 800);
  context.fillText("实际所得 · 银子", 108, 302);
  context.fillStyle = valueTone(data.actualIncome.silverWan);
  setFont(context, 64, 900);
  context.fillText(signedLabel(data.actualIncome.silverWan, "万"), 108, 342);
  context.fillStyle = "#657975";
  setFont(context, 17, 650);
  context.textAlign = "right";
  context.fillText(`已核销 ${data.settledEntryCount} 笔流水`, 972, 408);
  context.textAlign = "left";

  context.fillStyle = "#142522";
  setFont(context, 24, 850);
  context.fillText("这笔所得怎么计算", 76, 518);
  const calculation = [
    {
      label: "库存净变化",
      value: signedLabel(data.inventoryNetChange.silverWan, "万"),
      tone: valueTone(data.inventoryNetChange.silverWan),
    },
    {
      label: "流水修正",
      value: signedLabel(data.ledgerImpact.silverWan, "万"),
      tone: valueTone(data.ledgerImpact.silverWan),
    },
    {
      label: "实际所得",
      value: signedLabel(data.actualIncome.silverWan, "万"),
      tone: valueTone(data.actualIncome.silverWan),
    },
  ];
  calculation.forEach((item, index) => {
    const x = 76 + index * 312;
    fillRoundedRect(context, x, 562, 288, 128, 16, index === 2 ? "#edf7f4" : "#f7f9f8");
    strokeRoundedRect(context, x, 562, 288, 128, 16, index === 2 ? "#a7d4c9" : "#dce5e3", 2);
    context.fillStyle = "#71817e";
    setFont(context, 16, 750);
    context.fillText(item.label, x + 20, 582);
    context.fillStyle = item.tone;
    setFont(context, 28, 850);
    context.fillText(item.value, x + 20, 621);
    if (index < 2) {
      context.fillStyle = "#8a9995";
      setFont(context, 29, 700);
      context.textAlign = "center";
      context.fillText(index === 0 ? "+" : "=", x + 300, 610);
      context.textAlign = "left";
    }
  });

  context.fillStyle = "#142522";
  setFont(context, 24, 850);
  context.fillText("本次实际所得明细", 76, 742);
  const resources = [
    { label: "银子", value: signedLabel(data.actualIncome.silverWan, "万"), tone: valueTone(data.actualIncome.silverWan) },
    { label: "专用蛋", value: signedLabel(data.actualIncome.dedicatedEggs, "个"), tone: valueTone(data.actualIncome.dedicatedEggs) },
    { label: "普通蛋", value: signedLabel(data.actualIncome.regularEggs, "个"), tone: valueTone(data.actualIncome.regularEggs) },
    { label: "内丹碎片", value: signedLabel(data.actualIncome.innerShards, "片"), tone: valueTone(data.actualIncome.innerShards) },
  ];
  resources.forEach((item, index) => {
    drawMetric(
      context,
      76 + (index % 2) * 468,
      786 + Math.floor(index / 2) * 174,
      444,
      item.label,
      item.value,
      item.tone,
    );
  });

  fillRoundedRect(context, 76, 1148, 928, 82, 16, "#f3f6f5");
  context.fillStyle = "#657975";
  setFont(context, 15, 700);
  context.fillText("库存净变化", 100, 1167);
  context.fillStyle = "#2e423e";
  setFont(context, 16, 750);
  context.fillText(compactResources(data.inventoryNetChange), 224, 1165);
  context.fillStyle = "#657975";
  setFont(context, 15, 700);
  context.fillText("流水修正", 100, 1198);
  context.fillStyle = "#2e423e";
  setFont(context, 16, 750);
  context.fillText(compactResources(data.ledgerImpact), 224, 1196);

  context.fillStyle = "#81908d";
  setFont(context, 16, 650);
  context.textAlign = "center";
  context.fillText("实际所得 = 结束库存 − 开始库存 + 已确认流水修正", WIDTH / 2, 1250);

  return dataUrlToBlob(canvas.toDataURL("image/png"));
}
