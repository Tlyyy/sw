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
const accountColors: Record<string, string> = {
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
  if (!signed || value === null || value === 0) return value === null ? "#8a9996" : "#142522";
  return value > 0 ? "#08765a" : "#b42318";
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

  fillRoundedRect(context, x, y, 920, tableHeight, 14, "#ffffff");
  strokeRoundedRect(context, x, y, 920, tableHeight, 14, "#d7e1df", 2);

  context.fillStyle = "#f2f6f5";
  context.fillRect(x + 1, y + 1, 918, headerHeight - 1);
  let columnX = x;
  headers.forEach((header, index) => {
    drawCellText(context, header, columnX, y + headerHeight / 2, widths[index], "#617571", 750, 18);
    columnX += widths[index];
  });

  const allRows = [...rows, total];
  allRows.forEach((row, rowIndex) => {
    const isTotal = rowIndex === rows.length;
    const rowY = y + headerHeight + rowIndex * rowHeight;
    const height = isTotal ? totalHeight : rowHeight;
    if (isTotal) {
      context.fillStyle = "#e8f3f1";
      context.fillRect(x + 1, rowY, 918, height - 1);
      context.fillStyle = "#00796f";
      context.fillRect(x + 1, rowY, 918, 3);
    }
    context.strokeStyle = "#dce5e3";
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
      isTotal ? "#006b63" : (accountColors[row.label] || "#142522"),
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
    context.strokeStyle = "#e0e8e6";
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
  const headers = ["日期", "FC", "LG1", "LG2", "PT", "MYT", "五号合计"];
  const headerHeight = 54;
  const rowHeight = 72;
  const allRows = [
    ...data.rows,
    { label: "本周合计", basis: data.intervalLabel, values: data.weeklyTotal.values },
    { label: "区间日均", basis: "按实际间隔", values: data.dailyAverage.values },
  ];
  const tableHeight = headerHeight + allRows.length * rowHeight;

  fillRoundedRect(context, x, y, 920, tableHeight, 14, "#ffffff");
  strokeRoundedRect(context, x, y, 920, tableHeight, 14, "#d7e1df", 2);
  context.fillStyle = "#f2f6f5";
  context.fillRect(x + 1, y + 1, 918, headerHeight - 1);

  drawCellText(context, headers[0], x, y + headerHeight / 2, dateWidth, "#617571", 750, 18);
  headers.slice(1).forEach((header, index) => {
    const color = accountColors[header] || "#617571";
    drawCellText(context, header, x + dateWidth + index * valueWidth, y + headerHeight / 2, valueWidth, color, 800, 18);
  });

  allRows.forEach((row, rowIndex) => {
    const rowY = y + headerHeight + rowIndex * rowHeight;
    const isSummary = rowIndex >= data.rows.length;
    if (isSummary) {
      context.fillStyle = rowIndex === data.rows.length ? "#e8f3f1" : "#f1f7f5";
      context.fillRect(x + 1, rowY, 918, rowHeight - 1);
      if (rowIndex === data.rows.length) {
        context.fillStyle = "#00796f";
        context.fillRect(x + 1, rowY, 918, 3);
      }
    }
    context.strokeStyle = "#dce5e3";
    context.beginPath();
    context.moveTo(x, rowY);
    context.lineTo(x + 920, rowY);
    context.stroke();

    context.textAlign = "left";
    context.textBaseline = "top";
    context.fillStyle = isSummary ? "#006b63" : "#142522";
    setFont(context, 20, 850);
    context.fillText(row.label, x + 14, rowY + 13);
    context.fillStyle = "#71817e";
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
    context.strokeStyle = "#e0e8e6";
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
  context.fillStyle = "#eef3f2";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  const backdrop = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
  backdrop.addColorStop(0, "rgba(0, 121, 111, .11)");
  backdrop.addColorStop(.58, "rgba(255, 255, 255, 0)");
  backdrop.addColorStop(1, "rgba(18, 103, 143, .07)");
  context.fillStyle = backdrop;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = "#006b63";
  setFont(context, 34, 800);
  context.fillText("项目台账", 64, 48);
  context.fillStyle = "#60736f";
  setFont(context, 23, 650);
  context.textAlign = "right";
  context.fillText("库存周报", WIDTH - 64, 58);
  context.textAlign = "left";

  fillRoundedRect(context, 48, 116, 984, 1182, 30, "#ffffff");
  strokeRoundedRect(context, 48, 116, 984, 1182, 30, "#d4dfdd", 2);
  fillRoundedRect(context, 48, 116, 984, 10, 5, "#00796f");

  context.fillStyle = "#142522";
  setFont(context, 36, 850);
  context.fillText(data.view === "summary" ? "五号库存汇总" : `按日净变化 · ${data.metricLabel}`, 80, 166);
  context.fillStyle = "#657975";
  setFont(context, 22, 650);
  context.fillText(`${data.weekStart} 至 ${data.weekEnd}`, 80, 216);
  fillRoundedRect(context, 790, 166, 210, 54, 15, "#e7f3f0");
  context.fillStyle = "#08765a";
  setFont(context, 21, 800);
  context.textAlign = "center";
  context.fillText(`${data.recordedDays} / 7 天有记录`, 895, 181);
  context.textAlign = "left";

  if (data.view === "summary") {
    context.fillStyle = "#142522";
    setFont(context, 23, 850);
    context.fillText(data.snapshot ? `最新库存 · ${data.snapshot.date}` : "最新库存", 80, 286);
    if (data.snapshot) {
      drawSummaryTable(context, 326, data.snapshot.rows, data.snapshot.total, false);
    } else {
      fillRoundedRect(context, 80, 326, 920, 188, 14, "#f4f7f6");
      context.fillStyle = "#71817e";
      setFont(context, 26, 700);
      context.textAlign = "center";
      context.fillText("本周暂无库存记录", 540, 400);
      context.textAlign = "left";
    }

    context.fillStyle = "#142522";
    setFont(context, 23, 850);
    context.fillText("本周净变化", 80, 800);
    context.fillStyle = "#71817e";
    setFont(context, 17, 650);
    context.textAlign = "right";
    context.fillText(data.change?.caption || "暂无变化基线", 1000, 804);
    context.textAlign = "left";
    if (data.change) {
      drawSummaryTable(context, 840, data.change.rows, data.change.total, true);
    } else {
      fillRoundedRect(context, 80, 840, 920, 188, 14, "#f4f7f6");
      context.fillStyle = "#71817e";
      setFont(context, 26, 700);
      context.textAlign = "center";
      context.fillText("暂无可计算的周变化", 540, 914);
      context.textAlign = "left";
    }

    context.fillStyle = "#71817e";
    setFont(context, 17, 650);
    context.fillText(data.valuationNote, 80, 1260);
  } else {
    context.fillStyle = "#657975";
    setFont(context, 19, 650);
    const matrixContext = data.conversionNote
      ? `单位：${data.unit}　${data.conversionNote}`
      : `单位：${data.unit}　${data.intervalLabel}`;
    context.fillText(matrixContext, 80, 274);
    drawMatrixTable(context, data, 320);
    context.fillStyle = "#71817e";
    setFont(context, 17, 650);
    context.fillText(data.conversionNote || data.intervalLabel, 80, 1260);
  }

  context.fillStyle = "#899793";
  setFont(context, 17, 650);
  context.textAlign = "right";
  context.fillText(`${data.weekStart} — ${data.weekEnd}`, 1000, 1260);

  return dataUrlToBlob(canvas.toDataURL("image/png"));
}
