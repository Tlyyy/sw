import type { PetDetailShareData, PetDetailShareMetric } from "./petDetailShareImage";

export interface PetBatchShareImageOptions {
  dataDate: string;
  onProgress?: (current: number, total: number) => void;
}

const WIDTH = 1080;
const PAGE_X = 48;
const GRID_Y = 168;
const GRID_GAP = 18;
const FOOTER_HEIGHT = 48;
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

function yieldToBrowser() {
  return new Promise<void>((resolve) => {
    if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(() => resolve());
    else resolve();
  });
}

function compactMeta(meta: string) {
  return meta
    .replace(/血脉[： ]*(\d+)级血脉/, "血脉 $1级")
    .replaceAll("｜", " · ")
    .replaceAll("：", " ");
}

function compactAptitudeLabel(label: string) {
  return label
    .replace("攻击资质", "攻资")
    .replace("防御资质", "防资")
    .replace("体力资质", "体资")
    .replace("法力资质", "法资")
    .replace("速度资质", "速资");
}

function visibleSkills(skills: string[]) {
  return skills.filter((skill) => !skill.includes("(驭)") && !skill.startsWith("觉醒"));
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

function drawDataBand(
  context: CanvasRenderingContext2D,
  title: string,
  metrics: PetDetailShareMetric[],
  x: number,
  y: number,
  width: number,
  accountTone: string,
  valueSize: number,
) {
  const titleWidth = 58;
  const cellWidth = (width - titleWidth) / Math.max(metrics.length, 1);
  fillRoundedRect(context, x, y, width, 60, 10, "#f4f8f7");
  context.fillStyle = accountTone;
  context.textAlign = "center";
  context.textBaseline = "middle";
  setFont(context, 13, 850);
  context.fillText(title, x + titleWidth / 2, y + 30);
  context.strokeStyle = "#dce6e3";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x + titleWidth, y + 10);
  context.lineTo(x + titleWidth, y + 50);
  context.stroke();

  metrics.forEach((metric, index) => {
    const centerX = x + titleWidth + cellWidth * index + cellWidth / 2;
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillStyle = "#7a8986";
    setFont(context, 11, 750);
    context.fillText(fitText(context, metric.label, cellWidth - 8), centerX, y + 9);
    context.fillStyle = "#152724";
    setFont(context, valueSize, 850);
    context.fillText(fitText(context, metric.value || "—", cellWidth - 8), centerX, y + 29);

    if (index < metrics.length - 1) {
      context.strokeStyle = "#e0e8e6";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x + titleWidth + cellWidth * (index + 1), y + 10);
      context.lineTo(x + titleWidth + cellWidth * (index + 1), y + 50);
      context.stroke();
    }
  });
}

function skillLines(
  context: CanvasRenderingContext2D,
  skills: string[],
  maxWidth: number,
  maxLines: number,
) {
  if (!skills.length) return ["待确认"];
  const lines: string[] = [];
  let current = "";
  for (const [index, skill] of skills.entries()) {
    const candidate = current ? `${current} · ${skill}` : skill;
    if (!current || context.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = skill;
    if (lines.length === maxLines - 1) {
      const remaining = [current, ...skills.slice(index + 1)].join(" · ");
      lines.push(fitText(context, remaining, maxWidth));
      return lines;
    }
  }
  if (current) lines.push(fitText(context, current, maxWidth));
  return lines.slice(0, maxLines);
}

function drawPetCard(
  context: CanvasRenderingContext2D,
  data: PetDetailShareData,
  x: number,
  y: number,
  width: number,
  height: number,
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
  const secondary = `${data.role} · ${data.levelLabel}`;
  context.fillText(fitText(context, secondary, width - 132), x + 106, y + 44);

  const life = data.aptitudes.find((metric) => metric.label === "寿命")?.value;
  const metadata = [compactMeta(data.meta), life ? `寿命 ${life}` : ""].filter(Boolean).join(" · ");
  fillRoundedRect(context, x + 18, y + 68, width - 36, 32, 9, `${data.accountTone}0d`);
  context.fillStyle = "#526762";
  context.textAlign = "left";
  context.textBaseline = "middle";
  setFont(context, 12, 750);
  context.fillText(fitText(context, metadata, width - 64), x + 32, y + 84);

  drawDataBand(context, "面板", data.stats.slice(0, 5), x + 18, y + 110, width - 36, data.accountTone, 17);
  drawDataBand(
    context,
    "资质",
    data.aptitudes.slice(0, 5).map((metric) => ({ ...metric, label: compactAptitudeLabel(metric.label) })),
    x + 18,
    y + 180,
    width - 36,
    data.accountTone,
    12,
  );

  context.strokeStyle = "#dce6e3";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x + 20, y + 254);
  context.lineTo(x + width - 20, y + 254);
  context.stroke();
  context.fillStyle = data.accountTone;
  context.textAlign = "left";
  context.textBaseline = "top";
  setFont(context, 13, 850);
  const skills = visibleSkills(data.skills);
  context.fillText(`技能 · ${skills.length}`, x + 20, y + 268);
  context.fillStyle = "#314641";
  setFont(context, 13, 700);
  skillLines(context, skills, width - 40, 3).forEach((line, index) => {
    context.fillText(line, x + 20, y + 292 + index * 20);
  });
}

export async function createPetBatchShareImage(
  pets: PetDetailShareData[],
  options: PetBatchShareImageOptions,
) {
  if (!pets.length) throw new Error("至少选择一只宠物");
  const columns = 2;
  const cardWidth = (WIDTH - PAGE_X * 2 - GRID_GAP * (columns - 1)) / columns;
  const cardHeight = 366;
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
    drawPetCard(context, pet, x, y, cardWidth, cardHeight);
    options.onProgress?.(index + 1, pets.length);
    if ((index + 1) % 4 === 0 && index < pets.length - 1) await yieldToBrowser();
  }

  return canvasToBlob(canvas);
}
