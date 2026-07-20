import type { PetDetailShareData, PetDetailShareMetric } from "./petDetailShareImage";

export interface PetBatchShareImageOptions {
  dataDate: string;
  onProgress?: (current: number, total: number) => void;
}

const WIDTH = 1080;
const PAGE_X = 48;
const GRID_Y = 168;
const GRID_GAP = 18;
const FOOTER_HEIGHT = 72;
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
  color: string | CanvasGradient,
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

function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (context.measureText(text).width <= maxWidth) return text;
  const suffix = "…";
  let fitted = text;
  while (fitted && context.measureText(`${fitted}${suffix}`).width > maxWidth) fitted = fitted.slice(0, -1);
  return `${fitted}${suffix}`;
}

function dataUrlToBlob(dataUrl: string) {
  const [metadata, encoded] = dataUrl.split(",");
  const mimeType = metadata.match(/^data:(.*?);base64$/)?.[1] || "image/png";
  const binary = window.atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  if (typeof canvas.toBlob !== "function") return Promise.resolve(dataUrlToBlob(canvas.toDataURL("image/png")));
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("宠物合集图生成失败"));
    }, "image/png");
  });
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

function drawContainedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;
  context.drawImage(
    image,
    x + (width - renderedWidth) / 2,
    y + (height - renderedHeight) / 2,
    renderedWidth,
    renderedHeight,
  );
}

function metricValue(metrics: PetDetailShareMetric[], label: string) {
  return metrics.find((metric) => metric.label === label)?.value || "—";
}

function drawHeader(
  context: CanvasRenderingContext2D,
  count: number,
  dataDate: string,
) {
  context.textBaseline = "top";
  context.textAlign = "left";
  context.fillStyle = "#006b63";
  setFont(context, 28, 850);
  context.fillText("项目台账", 52, 36);

  context.fillStyle = "#132522";
  setFont(context, 42, 880);
  context.fillText("宠物合集", 52, 78);

  context.textAlign = "right";
  context.fillStyle = "#6f817d";
  setFont(context, 17, 700);
  context.fillText(`数据 · ${dataDate}`, 1028, 39);

  fillRoundedRect(context, 850, 80, 178, 48, 14, "#e2f2ed");
  context.fillStyle = "#08765a";
  setFont(context, 19, 850);
  context.textBaseline = "middle";
  context.fillText(`${count} 只宠物`, 998, 104);

  context.strokeStyle = "#cfddda";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(52, 145);
  context.lineTo(1028, 145);
  context.stroke();
}

function drawMetricStrip(
  context: CanvasRenderingContext2D,
  data: PetDetailShareData,
  x: number,
  y: number,
  width: number,
) {
  const metrics = ["攻击", "速度", "灵力", "气血"];
  const cellWidth = width / metrics.length;
  metrics.forEach((label, index) => {
    const centerX = x + cellWidth * index + cellWidth / 2;
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillStyle = "#7a8986";
    setFont(context, 12, 750);
    context.fillText(label, centerX, y);
    context.fillStyle = "#152724";
    setFont(context, 18, 850);
    context.fillText(fitText(context, metricValue(data.stats, label), cellWidth - 14), centerX, y + 20);

    if (index < metrics.length - 1) {
      context.strokeStyle = "#e0e8e6";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x + cellWidth * (index + 1), y + 2);
      context.lineTo(x + cellWidth * (index + 1), y + 43);
      context.stroke();
    }
  });
}

async function drawPetCard(
  context: CanvasRenderingContext2D,
  data: PetDetailShareData,
  x: number,
  y: number,
  width: number,
  height: number,
  screenshotHeight: number,
) {
  context.save();
  context.shadowColor = "rgba(10, 41, 35, .08)";
  context.shadowBlur = 20;
  context.shadowOffsetY = 6;
  fillRoundedRect(context, x, y, width, height, 18, "rgba(255, 255, 255, .96)");
  context.restore();
  strokeRoundedRect(context, x, y, width, height, 18, "#cedbd8", 2);
  fillRoundedRect(context, x, y, 7, height, 4, data.accountTone);

  fillRoundedRect(context, x + 20, y + 17, 70, 42, 11, `${data.accountTone}12`);
  strokeRoundedRect(context, x + 20, y + 17, 70, 42, 11, data.accountTone, 2);
  context.fillStyle = data.accountTone;
  context.textAlign = "center";
  context.textBaseline = "middle";
  setFont(context, 19, 850);
  context.fillText(data.accountId, x + 55, y + 38);

  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillStyle = "#142522";
  setFont(context, 23, 850);
  context.fillText(fitText(context, data.petName, width - 130), x + 106, y + 13);
  context.fillStyle = "#6f7f7c";
  setFont(context, 13, 700);
  const secondary = `${data.role} · ${data.levelLabel} · ${data.skills.length}技能`;
  context.fillText(fitText(context, secondary, width - 132), x + 106, y + 44);

  const screenshotX = x + 18;
  const screenshotY = y + 74;
  const screenshotWidth = width - 36;
  fillRoundedRect(context, screenshotX, screenshotY, screenshotWidth, screenshotHeight, 12, "#10201e");
  const screenshot = data.screenshotUrl ? await loadImage(data.screenshotUrl) : null;
  context.save();
  roundedRect(context, screenshotX, screenshotY, screenshotWidth, screenshotHeight, 12);
  context.clip();
  if (screenshot) {
    drawContainedImage(context, screenshot, screenshotX, screenshotY, screenshotWidth, screenshotHeight);
  } else {
    const placeholder = context.createLinearGradient(screenshotX, screenshotY, screenshotX + screenshotWidth, screenshotY + screenshotHeight);
    placeholder.addColorStop(0, "#142b27");
    placeholder.addColorStop(1, `${data.accountTone}cc`);
    context.fillStyle = placeholder;
    context.fillRect(screenshotX, screenshotY, screenshotWidth, screenshotHeight);
    context.fillStyle = "rgba(255, 255, 255, .68)";
    context.textAlign = "center";
    context.textBaseline = "middle";
    setFont(context, 18, 750);
    context.fillText("暂无截图", screenshotX + screenshotWidth / 2, screenshotY + screenshotHeight / 2);
  }
  context.restore();

  drawMetricStrip(context, data, x + 18, screenshotY + screenshotHeight + 15, width - 36);
}

export async function createPetBatchShareImage(
  pets: PetDetailShareData[],
  options: PetBatchShareImageOptions,
) {
  if (!pets.length) throw new Error("至少选择一只宠物");
  const columns = pets.length > 12 ? 3 : 2;
  const cardWidth = (WIDTH - PAGE_X * 2 - GRID_GAP * (columns - 1)) / columns;
  const screenshotHeight = Math.round((cardWidth - 36) / 1.49);
  const cardHeight = 74 + screenshotHeight + 68;
  const rows = Math.ceil(pets.length / columns);
  const gridHeight = rows * cardHeight + Math.max(rows - 1, 0) * GRID_GAP;
  const height = GRID_Y + gridHeight + FOOTER_HEIGHT;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法生成图片");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#edf3f1";
  context.fillRect(0, 0, WIDTH, height);
  const backdrop = context.createLinearGradient(0, 0, WIDTH, height);
  backdrop.addColorStop(0, "rgba(0, 121, 111, .12)");
  backdrop.addColorStop(.52, "rgba(255, 255, 255, 0)");
  backdrop.addColorStop(1, "rgba(24, 90, 76, .08)");
  context.fillStyle = backdrop;
  context.fillRect(0, 0, WIDTH, height);

  drawHeader(context, pets.length, options.dataDate);

  for (const [index, pet] of pets.entries()) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const itemsInRow = Math.min(columns, pets.length - row * columns);
    const rowWidth = itemsInRow * cardWidth + Math.max(itemsInRow - 1, 0) * GRID_GAP;
    const rowX = (WIDTH - rowWidth) / 2;
    const x = rowX + column * (cardWidth + GRID_GAP);
    const y = GRID_Y + row * (cardHeight + GRID_GAP);
    await drawPetCard(context, pet, x, y, cardWidth, cardHeight, screenshotHeight);
    options.onProgress?.(index + 1, pets.length);
  }

  context.fillStyle = "#81908d";
  context.textBaseline = "middle";
  setFont(context, 15, 650);
  context.textAlign = "left";
  context.fillText("项目台账", 52, height - 34);
  context.textAlign = "right";
  context.fillText(options.dataDate, 1028, height - 34);

  return canvasToBlob(canvas);
}
