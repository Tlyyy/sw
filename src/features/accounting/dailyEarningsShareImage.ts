import { appName } from "../../app/brand";
import type { AccountAccountingSummary } from "../../domain/accounting";
import {
  inventoryRegularEggValueWan,
  inventorySilverWithRegularEggsWan,
} from "../../domain/inventory";
import { accountIds, type AccountId } from "../../domain/types";
import {
  shareImageAccountColors as accountColors,
  shareImagePalette as palette,
} from "../../utils/shareImagePalette";

type AccountValueMap = Record<AccountId, number | null>;
export type DailyEarningsShareMetric = "silverWan" | "silverWithRegularEggsWan";

export interface DailyEarningsShareRow {
  label: string;
  date: string;
  basis: string;
  values: AccountValueMap;
  total: number | null;
}

export interface DailyEarningsShareSummaryRow {
  label: string;
  basis: string;
  values: AccountValueMap;
  total: number | null;
}

export interface DailyEarningsShareImageData {
  metric: DailyEarningsShareMetric;
  metricLabel: string;
  conversionNote: string | null;
  weekStart: string;
  weekEnd: string;
  recordedDays: number;
  rows: DailyEarningsShareRow[];
  weeklyTotal: DailyEarningsShareSummaryRow;
  dailyAverage: DailyEarningsShareSummaryRow;
}

const WIDTH = 1080;
const HEIGHT = 1350;
const FONT_FAMILY = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
const weekdayLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"] as const;

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

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function shortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function emptyAccountValues(): AccountValueMap {
  return Object.fromEntries(accountIds.map((accountId) => [accountId, null])) as AccountValueMap;
}

function sumKnown(values: Array<number | null>) {
  const known = values.filter((value): value is number => value !== null);
  if (!known.length) return null;
  return Number(known.reduce((sum, value) => sum + value, 0).toFixed(2));
}

function divideKnown(value: number | null, divisor: number) {
  if (value === null || divisor <= 0) return null;
  return Number((value / divisor).toFixed(2));
}

function formatValue(value: number | null) {
  if (value === null) return "—";
  const normalized = Number(value.toFixed(2));
  const formatted = normalized.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
  return normalized > 0 ? `+${formatted}` : formatted;
}

function valueColor(value: number | null) {
  if (value === null) return palette.text.faint;
  if (value === 0) return palette.text.body;
  return value > 0 ? palette.status.positive.foreground : palette.status.negative.foreground;
}

function drawCellText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  color: string,
  weight = 750,
  size = 20,
) {
  context.fillStyle = color;
  setFont(context, size, weight);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, x + width / 2, y);
}

function dataUrlToBlob(dataUrl: string) {
  const [metadata, encoded] = dataUrl.split(",");
  const mimeType = metadata.match(/^data:(.*?);base64$/)?.[1] || "image/png";
  const binary = globalThis.atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

export function buildDailyEarningsShareData(
  reports: Record<AccountId, AccountAccountingSummary>,
  asOfDate: string,
  metric: DailyEarningsShareMetric = "silverWan",
): DailyEarningsShareImageData {
  const reference = reports[accountIds[0]];
  const weekStart = reference.week.weekStart;
  const weekEnd = reference.week.weekEnd;
  const rows = Array.from({ length: 7 }, (_, dayIndex): DailyEarningsShareRow => {
    const date = addDays(weekStart, dayIndex);
    const intervals = Object.fromEntries(accountIds.map((accountId) => [
      accountId,
      reports[accountId].intervals.find((interval) => interval.toDate === date) || null,
    ])) as Record<AccountId, AccountAccountingSummary["intervals"][number] | null>;
    const values = emptyAccountValues();

    accountIds.forEach((accountId) => {
      const interval = intervals[accountId];
      values[accountId] = interval?.kind === "daily"
        ? metric === "silverWithRegularEggsWan"
          ? inventorySilverWithRegularEggsWan(interval.actualIncome)
          : interval.actualIncome.silverWan
        : null;
    });

    const knownValues = accountIds.map((accountId) => values[accountId]);
    const allAccountsSettled = knownValues.every((value) => value !== null);
    const referenceInterval = intervals[accountIds[0]];
    const settledEntryCount = accountIds.reduce(
      (sum, accountId) => sum + (intervals[accountId]?.entries.length || 0),
      0,
    );
    const basis = date > asOfDate
      ? "尚未到日期"
      : referenceInterval?.kind === "daily"
        ? `连续库存 · 核销 ${settledEntryCount} 笔`
        : referenceInterval
          ? `${referenceInterval.intervalDays} 天区间，非单日`
          : "未结算";

    return {
      label: `${weekdayLabels[dayIndex]} ${shortDate(date)}`,
      date,
      basis,
      values,
      total: allAccountsSettled ? sumKnown(knownValues) : null,
    };
  });

  const recordedDays = rows.filter((row) => row.total !== null).length;
  const weeklyValues = Object.fromEntries(accountIds.map((accountId) => [
    accountId,
    sumKnown(rows.map((row) => row.values[accountId])),
  ])) as AccountValueMap;
  const weeklyTotal = sumKnown(rows.map((row) => row.total));
  const averageValues = Object.fromEntries(accountIds.map((accountId) => [
    accountId,
    divideKnown(weeklyValues[accountId], recordedDays),
  ])) as AccountValueMap;

  return {
    metric,
    metricLabel: metric === "silverWithRegularEggsWan" ? "银+蛋折银" : "银子",
    conversionNote: metric === "silverWithRegularEggsWan"
      ? `实际所得银子 + 实际所得普通蛋 × ${inventoryRegularEggValueWan} 万/个`
      : null,
    weekStart,
    weekEnd,
    recordedDays,
    rows,
    weeklyTotal: {
      label: "本周已结算",
      basis: `${recordedDays} 天每日记录`,
      values: weeklyValues,
      total: weeklyTotal,
    },
    dailyAverage: {
      label: "结算日均",
      basis: "按已结算天数",
      values: averageValues,
      total: divideKnown(weeklyTotal, recordedDays),
    },
  };
}

function drawMatrixTable(
  context: CanvasRenderingContext2D,
  data: DailyEarningsShareImageData,
  y: number,
) {
  const x = 80;
  const dateWidth = 170;
  const valueWidth = 125;
  const headers = ["日期", ...accountIds, "五号合计"];
  const headerHeight = 54;
  const rowHeight = 72;
  const allRows = [...data.rows, data.weeklyTotal, data.dailyAverage];
  const tableHeight = headerHeight + allRows.length * rowHeight;

  fillRoundedRect(context, x, y, 920, tableHeight, 14, palette.surface.default);
  strokeRoundedRect(context, x, y, 920, tableHeight, 14, palette.border.strong, 2);
  context.fillStyle = palette.surface.muted;
  context.fillRect(x + 1, y + 1, 918, headerHeight - 1);

  drawCellText(context, headers[0], x, y + headerHeight / 2, dateWidth, palette.text.caption, 750, 18);
  headers.slice(1).forEach((header, index) => {
    const color = accountColors[header as AccountId] || palette.text.caption;
    drawCellText(
      context,
      header,
      x + dateWidth + index * valueWidth,
      y + headerHeight / 2,
      valueWidth,
      color,
      800,
      18,
    );
  });

  allRows.forEach((row, rowIndex) => {
    const rowY = y + headerHeight + rowIndex * rowHeight;
    const isSummary = rowIndex >= data.rows.length;
    if (isSummary) {
      context.fillStyle = rowIndex === data.rows.length
        ? palette.status.positive.backgroundStrong
        : palette.surface.muted;
      context.fillRect(x + 1, rowY, 918, rowHeight - 1);
      if (rowIndex === data.rows.length) {
        context.fillStyle = palette.brand.accent;
        context.fillRect(x + 1, rowY, 918, 3);
      }
    }
    context.strokeStyle = palette.border.default;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x, rowY);
    context.lineTo(x + 920, rowY);
    context.stroke();

    context.textAlign = "left";
    context.textBaseline = "top";
    context.fillStyle = isSummary ? palette.brand.primary : palette.text.primary;
    setFont(context, 20, 850);
    context.fillText(row.label, x + 14, rowY + 13);
    context.fillStyle = palette.text.muted;
    setFont(context, 15, 650);
    context.fillText(row.basis, x + 14, rowY + 41);

    const rowValues = [...accountIds.map((accountId) => row.values[accountId]), row.total];
    rowValues.forEach((value, valueIndex) => {
      drawCellText(
        context,
        formatValue(value),
        x + dateWidth + valueIndex * valueWidth,
        rowY + rowHeight / 2,
        valueWidth,
        valueColor(value),
        isSummary ? 850 : 750,
        20,
      );
    });
  });

  let columnX = x + dateWidth;
  for (let index = 0; index < 6; index += 1) {
    context.strokeStyle = palette.border.subtle;
    context.beginPath();
    context.moveTo(columnX, y);
    context.lineTo(columnX, y + tableHeight);
    context.stroke();
    columnX += valueWidth;
  }
}

export function createDailyEarningsShareImage(data: DailyEarningsShareImageData) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法生成图片");

  context.textBaseline = "top";
  context.textAlign = "left";
  context.fillStyle = palette.canvas.background;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  const backdrop = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
  backdrop.addColorStop(0, palette.gradient.tealGlow);
  backdrop.addColorStop(.58, palette.gradient.transparent);
  backdrop.addColorStop(1, palette.gradient.blueGlow);
  context.fillStyle = backdrop;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = palette.brand.primary;
  setFont(context, 34, 800);
  context.fillText(appName, 64, 48);
  context.fillStyle = palette.text.caption;
  setFont(context, 23, 650);
  context.textAlign = "right";
  context.fillText("实际所得周报", WIDTH - 64, 58);
  context.textAlign = "left";

  fillRoundedRect(context, 48, 116, 984, 1182, 30, palette.surface.default);
  strokeRoundedRect(context, 48, 116, 984, 1182, 30, palette.border.strong, 2);
  fillRoundedRect(context, 48, 116, 984, 10, 5, palette.brand.accent);

  context.fillStyle = palette.text.primary;
  setFont(context, 36, 850);
  context.fillText(`五号每日实际所得 · ${data.metricLabel}`, 80, 166);
  context.fillStyle = palette.text.secondary;
  setFont(context, 22, 650);
  context.fillText(`${data.weekStart} 至 ${data.weekEnd}`, 80, 216);
  fillRoundedRect(context, 790, 166, 210, 54, 15, palette.status.positive.background);
  context.fillStyle = palette.status.positive.foreground;
  setFont(context, 21, 800);
  context.textAlign = "center";
  context.fillText(`${data.recordedDays} / 7 天已结算`, 895, 181);
  context.textAlign = "left";

  context.fillStyle = palette.text.secondary;
  setFont(context, 19, 650);
  context.fillText(
    data.conversionNote
      ? `单位：万　银+蛋折银 = ${data.conversionNote}`
      : "单位：万　实际所得 = 库存净变化 + 已确认流水修正",
    80,
    274,
  );

  drawMatrixTable(context, data, 320);

  context.textAlign = "left";
  context.textBaseline = "top";
  fillRoundedRect(context, 80, 1056, 920, 150, 16, palette.surface.muted);
  context.fillStyle = palette.text.primary;
  setFont(context, 20, 850);
  context.fillText("每日结算口径", 106, 1082);
  context.fillStyle = palette.text.secondary;
  setFont(context, 17, 650);
  context.fillText("只有连续两天都录入库存，才显示当天所得；缺天或跨天区间不会伪装成单日。", 106, 1122);
  context.fillText(
    data.metric === "silverWithRegularEggsWan"
      ? `普通蛋按 ${inventoryRegularEggValueWan} 万/个折算，专用蛋不折算；五号合计为同一天五个账号之和。`
      : "账号间转移与非收益调整已按流水排除；五号合计为同一天五个账号之和。",
    106,
    1155,
  );

  context.fillStyle = palette.text.faint;
  setFont(context, 17, 650);
  context.textAlign = "left";
  context.fillText(`${data.recordedDays} 天有完整五账号每日结算`, 80, 1260);
  context.textAlign = "right";
  context.fillText(`${data.weekStart} — ${data.weekEnd}`, 1000, 1260);

  return dataUrlToBlob(canvas.toDataURL("image/png"));
}
