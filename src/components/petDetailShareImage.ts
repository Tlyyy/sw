export interface PetDetailShareMetric {
  label: string;
  value: string;
}

export interface PetDetailShareData {
  accountId: string;
  accountTone: string;
  petName: string;
  levelLabel: string;
  role: string;
  meta: string;
  advice: string;
  tags: string[];
  capturedAt: string;
  screenshotUrl?: string;
  stats: PetDetailShareMetric[];
  aptitudes: PetDetailShareMetric[];
  skills: string[];
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

function drawMetricRow(
  context: CanvasRenderingContext2D,
  metrics: PetDetailShareMetric[],
  x: number,
  y: number,
  width: number,
  valueSize: number,
) {
  const cellWidth = width / Math.max(metrics.length, 1);
  metrics.forEach((metric, index) => {
    const centerX = x + cellWidth * index + cellWidth / 2;
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillStyle = "#71817e";
    setFont(context, 15, 700);
    context.fillText(fitText(context, metric.label, cellWidth - 20), centerX, y);
    context.fillStyle = "#142522";
    setFont(context, valueSize, 850);
    context.fillText(fitText(context, metric.value || "—", cellWidth - 20), centerX, y + 28);

    if (index < metrics.length - 1) {
      context.strokeStyle = "#dce6e3";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x + cellWidth * (index + 1), y + 2);
      context.lineTo(x + cellWidth * (index + 1), y + 69);
      context.stroke();
    }
  });
}

export async function createPetDetailShareImage(data: PetDetailShareData) {
  const screenshot = data.screenshotUrl ? await loadImage(data.screenshotUrl) : null;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法生成图片");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#edf3f1";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  const backdrop = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
  backdrop.addColorStop(0, "rgba(0, 121, 111, .12)");
  backdrop.addColorStop(.56, "rgba(255, 255, 255, 0)");
  backdrop.addColorStop(1, `${data.accountTone}16`);
  context.fillStyle = backdrop;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.textBaseline = "top";
  context.textAlign = "left";
  context.fillStyle = "#006b63";
  setFont(context, 30, 850);
  context.fillText("项目台账", 56, 38);
  context.fillStyle = "#6c7d79";
  setFont(context, 18, 700);
  context.fillText("宠物档案", 56, 80);
  context.textAlign = "right";
  context.fillText(`数据 · ${data.capturedAt || "待确认"}`, 1024, 51);

  const summaryY = 124;
  fillRoundedRect(context, 48, summaryY, 984, 184, 20, "rgba(255, 255, 255, .94)");
  strokeRoundedRect(context, 48, summaryY, 984, 184, 20, "#d2dfdc", 2);
  fillRoundedRect(context, 48, summaryY, 8, 184, 4, data.accountTone);

  fillRoundedRect(context, 76, 151, 104, 62, 14, `${data.accountTone}14`);
  strokeRoundedRect(context, 76, 151, 104, 62, 14, data.accountTone, 2);
  context.fillStyle = data.accountTone;
  setFont(context, 27, 850);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(data.accountId, 128, 182);

  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillStyle = "#142522";
  setFont(context, 36, 850);
  context.fillText(fitText(context, data.petName, 390), 202, 145);
  context.fillStyle = "#6a7c78";
  setFont(context, 17, 650);
  context.fillText(fitText(context, `${data.levelLabel} · ${data.meta}`, 548), 202, 197);

  fillRoundedRect(context, 806, 148, 194, 46, 13, "#e4f2ee");
  context.fillStyle = "#08765a";
  setFont(context, 18, 850);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(fitText(context, data.role, 162), 903, 171);
  context.fillStyle = "#71817e";
  setFont(context, 15, 700);
  context.textBaseline = "top";
  context.fillText(`${data.skills.length} 技能`, 903, 205);

  context.strokeStyle = "#e0e8e6";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(76, 235);
  context.lineTo(1002, 235);
  context.stroke();
  context.textAlign = "left";
  context.fillStyle = "#40534f";
  setFont(context, 17, 700);
  const summaryLine = [data.advice, data.tags.slice(0, 3).join(" · ")].filter(Boolean).join("　");
  context.fillText(fitText(context, summaryLine || "资料已确认", 926), 76, 257);

  const imageY = 330;
  fillRoundedRect(context, 48, imageY, 984, 650, 20, "#10211f");
  strokeRoundedRect(context, 48, imageY, 984, 650, 20, "#cddbd8", 2);
  context.save();
  roundedRect(context, 62, imageY + 14, 956, 622, 13);
  context.clip();
  context.fillStyle = "#071411";
  context.fillRect(62, imageY + 14, 956, 622);
  if (screenshot) {
    drawContainedImage(context, screenshot, 62, imageY + 14, 956, 622);
  } else {
    context.fillStyle = "#9fb0ac";
    setFont(context, 22, 700);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("原始截图暂不可用", WIDTH / 2, imageY + 325);
  }
  context.restore();

  const detailY = 1004;
  fillRoundedRect(context, 48, detailY, 984, 288, 20, "rgba(255, 255, 255, .94)");
  strokeRoundedRect(context, 48, detailY, 984, 288, 20, "#d2dfdc", 2);
  drawMetricRow(context, data.stats.slice(0, 5), 72, 1035, 936, 25);

  context.strokeStyle = "#dce6e3";
  context.beginPath();
  context.moveTo(72, 1124);
  context.lineTo(1008, 1124);
  context.stroke();

  drawMetricRow(context, data.aptitudes.slice(0, 6), 72, 1144, 936, 21);

  context.strokeStyle = "#dce6e3";
  context.beginPath();
  context.moveTo(72, 1231);
  context.lineTo(1008, 1231);
  context.stroke();
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillStyle = "#60736f";
  setFont(context, 15, 750);
  context.fillText("技能", 72, 1251);
  context.fillStyle = "#233733";
  setFont(context, 16, 700);
  const highlightedSkills = data.skills
    .slice(0, 5)
    .map((skill) => skill.replace(/^小/, "低级"))
    .join(" / ");
  const skillSummary = data.skills.length > 5
    ? `${highlightedSkills}　共 ${data.skills.length} 技能`
    : highlightedSkills;
  context.fillText(fitText(context, skillSummary || "待确认", 866), 132, 1250);

  context.fillStyle = "#899793";
  setFont(context, 16, 650);
  context.textAlign = "left";
  context.fillText(`${data.accountId} · ${data.petName}`, 56, 1318);
  context.textAlign = "right";
  context.fillText("项目台账", 1024, 1318);

  return dataUrlToBlob(canvas.toDataURL("image/png"));
}
