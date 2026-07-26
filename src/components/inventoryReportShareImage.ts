import { appName } from "../app/brand";
import {
  shareImageAccountColors as accountColors,
  shareImagePalette as palette,
} from "../utils/shareImagePalette";

export interface InventoryShareRow {
  label: string;
  values: Array<number | null>;
}

export interface InventoryShareSnapshotTable {
  date: string;
  rows: InventoryShareRow[];
  total: InventoryShareRow;
}

export interface InventoryShareChangeTable {
  caption: string;
  rows: InventoryShareRow[];
  total: InventoryShareRow;
}

export interface InventoryShareMatrixRow {
  label: string;
  basis: string;
  values: Array<number | null>;
}

interface InventoryShareCommonData {
  weekStart: string;
  weekEnd: string;
  recordedDays: number;
}

export interface InventorySummaryShareData extends InventoryShareCommonData {
  view: "summary";
  snapshot: InventoryShareSnapshotTable | null;
  change: InventoryShareChangeTable | null;
  valuationNote: string;
}

export interface InventoryMatrixShareData extends InventoryShareCommonData {
  view: "matrix";
  metricLabel: string;
  unit: string;
  conversionNote: string | null;
  rows: InventoryShareMatrixRow[];
  weeklyTotal: InventoryShareRow;
  dailyAverage: InventoryShareRow;
  intervalLabel: string;
}

export type InventoryReportShareData = InventorySummaryShareData | InventoryMatrixShareData;

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

function formatValue(value: number | null, signed = false) {
  if (value === null) return "—";
  const normalized = Number(value.toFixed(2));
  const formatted = normalized.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
  if (!signed || normalized <= 0) return formatted;
  return `+${formatted}`;
}

function valueColor(value: number | null, signed: boolean) {
  if (!signed || value === null || value === 0) {
    return value === null ? palette.text.faint : palette.text.primary;
  }
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
  size = 22,
) {
  context.fillStyle = color;
  setFont(context, size, weight);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, x + width / 2, y);
}

function drawSummaryTable(
  context: CanvasRenderingContext2D,
  y: number,
  rows: InventoryShareRow[],
  total: InventoryShareRow,
  signed: boolean,
) {
  const x = 80;
  const widths = [120, 150, 150, 170, 180, 150];
  const headers = ["账号", "专用蛋", "普通蛋", "银 / 万", "银+蛋 / 万", "碎片"];
  const headerHeight = 50;
  const rowHeight = 58;
  const totalHeight = 62;
  const tableHeight = headerHeight + rows.length * rowHeight + totalHeight;

  fillRoundedRect(context, x, y, 920, tableHeight, 14, palette.surface.default);
  strokeRoundedRect(context, x, y, 920, tableHeight, 14, palette.border.strong, 2);

  context.fillStyle = palette.surface.muted;
  context.fillRect(x + 1, y + 1, 918, headerHeight - 1);
  let columnX = x;
  headers.forEach((header, index) => {
    drawCellText(context, header, columnX, y + headerHeight / 2, widths[index], palette.text.caption, 750, 18);
    columnX += widths[index];
  });

  const allRows = [...rows, total];
  allRows.forEach((row, rowIndex) => {
    const isTotal = rowIndex === rows.length;
    const rowY = y + headerHeight + rowIndex * rowHeight;
    const height = isTotal ? totalHeight : rowHeight;
    if (isTotal) {
      context.fillStyle = palette.status.positive.backgroundStrong;
      context.fillRect(x + 1, rowY, 918, height - 1);
      context.fillStyle = palette.brand.accent;
      context.fillRect(x + 1, rowY, 918, 3);
    }
    context.strokeStyle = palette.border.default;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x, rowY);
    context.lineTo(x + 920, rowY);
    context.stroke();

    drawCellText(
      context,
      row.label,
      x,
      rowY + height / 2,
      widths[0],
      isTotal
        ? palette.brand.primary
        : (accountColors[row.label as keyof typeof accountColors] || palette.text.primary),
      850,
      isTotal ? 22 : 21,
    );
    let valueX = x + widths[0];
    row.values.slice(0, 5).forEach((value, valueIndex) => {
      drawCellText(
        context,
        formatValue(value, signed),
        valueX,
        rowY + height / 2,
        widths[valueIndex + 1],
        valueColor(value, signed),
        isTotal ? 850 : 750,
        isTotal ? 22 : 21,
      );
      valueX += widths[valueIndex + 1];
    });
  });

  columnX = x;
  widths.slice(0, -1).forEach((width) => {
    columnX += width;
    context.strokeStyle = palette.border.subtle;
    context.beginPath();
    context.moveTo(columnX, y);
    context.lineTo(columnX, y + tableHeight);
    context.stroke();
  });
}

function drawMatrixTable(context: CanvasRenderingContext2D, data: InventoryMatrixShareData, y: number) {
  const x = 80;
  const dateWidth = 170;
  const valueWidth = 125;
  const headers = ["日期", "FC", "LG1", "PT", "LG2", "MYT", "五号合计"];
  const headerHeight = 54;
  const rowHeight = 72;
  const allRows = [
    ...data.rows,
    { label: "本周合计", basis: data.intervalLabel, values: data.weeklyTotal.values },
    { label: "区间日均", basis: "按实际间隔", values: data.dailyAverage.values },
  ];
  const tableHeight = headerHeight + allRows.length * rowHeight;

  fillRoundedRect(context, x, y, 920, tableHeight, 14, palette.surface.default);
  strokeRoundedRect(context, x, y, 920, tableHeight, 14, palette.border.strong, 2);
  context.fillStyle = palette.surface.muted;
  context.fillRect(x + 1, y + 1, 918, headerHeight - 1);

  drawCellText(context, headers[0], x, y + headerHeight / 2, dateWidth, palette.text.caption, 750, 18);
  headers.slice(1).forEach((header, index) => {
    const color = accountColors[header as keyof typeof accountColors] || palette.text.caption;
    drawCellText(context, header, x + dateWidth + index * valueWidth, y + headerHeight / 2, valueWidth, color, 800, 18);
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

    row.values.slice(0, 6).forEach((value, valueIndex) => {
      drawCellText(
        context,
        formatValue(value, true),
        x + dateWidth + valueIndex * valueWidth,
        rowY + rowHeight / 2,
        valueWidth,
        valueColor(value, true),
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

function dataUrlToBlob(dataUrl: string) {
  const [metadata, encoded] = dataUrl.split(",");
  const mimeType = metadata.match(/^data:(.*?);base64$/)?.[1] || "image/png";
  const binary = window.atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

export function createInventoryReportShareImage(data: InventoryReportShareData) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法生成图片");

  context.textBaseline = "top";
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
  context.fillText("库存周报", WIDTH - 64, 58);
  context.textAlign = "left";

  fillRoundedRect(context, 48, 116, 984, 1182, 30, palette.surface.default);
  strokeRoundedRect(context, 48, 116, 984, 1182, 30, palette.border.strong, 2);
  fillRoundedRect(context, 48, 116, 984, 10, 5, palette.brand.accent);

  context.fillStyle = palette.text.primary;
  setFont(context, 36, 850);
  context.fillText(data.view === "summary" ? "五号库存汇总" : `按日净变化 · ${data.metricLabel}`, 80, 166);
  context.fillStyle = palette.text.secondary;
  setFont(context, 22, 650);
  context.fillText(`${data.weekStart} 至 ${data.weekEnd}`, 80, 216);
  fillRoundedRect(context, 790, 166, 210, 54, 15, palette.status.positive.background);
  context.fillStyle = palette.status.positive.foreground;
  setFont(context, 21, 800);
  context.textAlign = "center";
  context.fillText(`${data.recordedDays} / 7 天有记录`, 895, 181);
  context.textAlign = "left";

  if (data.view === "summary") {
    context.fillStyle = palette.text.primary;
    setFont(context, 23, 850);
    context.fillText(data.snapshot ? `最新库存 · ${data.snapshot.date}` : "最新库存", 80, 286);
    if (data.snapshot) {
      drawSummaryTable(context, 326, data.snapshot.rows, data.snapshot.total, false);
    } else {
      fillRoundedRect(context, 80, 326, 920, 188, 14, palette.surface.muted);
      context.fillStyle = palette.text.muted;
      setFont(context, 26, 700);
      context.textAlign = "center";
      context.fillText("本周暂无库存记录", 540, 400);
      context.textAlign = "left";
    }

    context.fillStyle = palette.text.primary;
    setFont(context, 23, 850);
    context.fillText("本周净变化", 80, 800);
    context.fillStyle = palette.text.muted;
    setFont(context, 17, 650);
    context.textAlign = "right";
    context.fillText(data.change?.caption || "暂无变化基线", 1000, 804);
    context.textAlign = "left";
    if (data.change) {
      drawSummaryTable(context, 840, data.change.rows, data.change.total, true);
    } else {
      fillRoundedRect(context, 80, 840, 920, 188, 14, palette.surface.muted);
      context.fillStyle = palette.text.muted;
      setFont(context, 26, 700);
      context.textAlign = "center";
      context.fillText("暂无可计算的周变化", 540, 914);
      context.textAlign = "left";
    }

    context.fillStyle = palette.text.muted;
    setFont(context, 17, 650);
    context.fillText(data.valuationNote, 80, 1260);
  } else {
    context.fillStyle = palette.text.secondary;
    setFont(context, 19, 650);
    const matrixContext = data.conversionNote
      ? `单位：${data.unit}　${data.conversionNote}`
      : `单位：${data.unit}　${data.intervalLabel}`;
    context.fillText(matrixContext, 80, 274);
    drawMatrixTable(context, data, 320);
    context.fillStyle = palette.text.muted;
    setFont(context, 17, 650);
    context.fillText(data.conversionNote || data.intervalLabel, 80, 1260);
  }

  context.fillStyle = palette.text.faint;
  setFont(context, 17, 650);
  context.textAlign = "right";
  context.fillText(`${data.weekStart} — ${data.weekEnd}`, 1000, 1260);

  return dataUrlToBlob(canvas.toDataURL("image/png"));
}
