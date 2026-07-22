import { appName } from "../../app/brand";

export interface MainlineOverviewShareTask {
  stage: string;
  title: string;
  due: string;
}

export interface MainlineOverviewShareAccount {
  accountId: string;
  accountTone: string;
  status: string;
  statusTone: "positive" | "warning" | "danger";
  resourceStatus: string;
  tasks: MainlineOverviewShareTask[];
  finish: string;
  resources: {
    dedicatedEggs: string;
    regularEggs: string;
    silverWan: string;
    innerShards: string;
  };
}

export interface MainlineOverviewShareData {
  inventoryDate: string;
  accounts: MainlineOverviewShareAccount[];
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

function drawTask(
  context: CanvasRenderingContext2D,
  task: MainlineOverviewShareTask | undefined,
  x: number,
  y: number,
  width: number,
  fallback: string,
) {
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillStyle = "#71817e";
  setFont(context, 15, 750);
  context.fillText(task?.stage || fallback, x, y);
  context.fillStyle = "#142522";
  setFont(context, 20, 800);
  context.fillText(fitText(context, task?.title || "—", width), x, y + 25);
  context.fillStyle = "#697c78";
  setFont(context, 15, 650);
  context.fillText(fitText(context, task?.due || "", width), x, y + 54);
}

function drawAccountCard(context: CanvasRenderingContext2D, account: MainlineOverviewShareAccount, y: number) {
  const x = 48;
  const width = 984;
  const height = 202;
  const palette = {
    positive: { foreground: "#08765a", background: "#e5f3ef", border: "#0a8a68" },
    warning: { foreground: "#8a5a00", background: "#fff3dc", border: "#c47a00" },
    danger: { foreground: "#a33838", background: "#faeaea", border: "#bf4b45" },
  }[account.statusTone];

  fillRoundedRect(context, x, y, width, height, 20, "#ffffff");
  strokeRoundedRect(context, x, y, width, height, 20, "#d5e0de", 2);
  fillRoundedRect(context, x, y, 8, height, 4, account.accountTone);

  fillRoundedRect(context, 76, y + 18, 98, 54, 13, `${account.accountTone}16`);
  strokeRoundedRect(context, 76, y + 18, 98, 54, 13, account.accountTone, 2);
  context.fillStyle = account.accountTone;
  setFont(context, 25, 850);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(account.accountId, 125, y + 45);

  const currentTask = account.tasks[0];
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillStyle = "#71817e";
  setFont(context, 15, 750);
  context.fillText("当前", 196, y + 14);
  context.fillStyle = "#142522";
  setFont(context, 24, 850);
  context.fillText(fitText(context, currentTask?.title || "主线已完成", 520), 196, y + 37);
  context.fillStyle = "#697c78";
  setFont(context, 16, 650);
  context.fillText(fitText(context, currentTask?.due || "全部完成", 520), 196, y + 67);

  fillRoundedRect(context, 782, y + 16, 220, 44, 13, palette.background);
  context.fillStyle = palette.foreground;
  setFont(context, 18, 850);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(fitText(context, account.resourceStatus, 188), 892, y + 38);
  context.fillStyle = "#71817e";
  setFont(context, 14, 650);
  context.textAlign = "right";
  context.textBaseline = "top";
  context.fillText(fitText(context, `整线 ${account.finish}`, 300), 1002, y + 67);

  context.strokeStyle = "#dfe7e5";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(76, y + 92);
  context.lineTo(1002, y + 92);
  context.stroke();

  drawTask(context, account.tasks[1], 76, y + 108, 230, "下一步");
  drawTask(context, account.tasks[2], 332, y + 108, 230, "再下一步");

  context.strokeStyle = "#dfe7e5";
  context.beginPath();
  context.moveTo(586, y + 106);
  context.lineTo(586, y + 184);
  context.stroke();

  context.fillStyle = "#71817e";
  setFont(context, 15, 750);
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillText("当前库存", 614, y + 109);
  context.fillStyle = "#40534f";
  setFont(context, 16, 700);
  const resourceLine = `专 ${account.resources.dedicatedEggs}　普 ${account.resources.regularEggs}　银 ${account.resources.silverWan}万　碎 ${account.resources.innerShards}`;
  context.fillText(fitText(context, resourceLine, 388), 614, y + 139);
}

export function createMainlineOverviewShareImage(data: MainlineOverviewShareData) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法生成图片");

  context.fillStyle = "#edf3f1";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  const backdrop = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
  backdrop.addColorStop(0, "rgba(0, 121, 111, .11)");
  backdrop.addColorStop(.55, "rgba(255, 255, 255, 0)");
  backdrop.addColorStop(1, "rgba(18, 103, 143, .08)");
  context.fillStyle = backdrop;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.textBaseline = "top";
  context.textAlign = "left";
  context.fillStyle = "#006b63";
  setFont(context, 32, 850);
  context.fillText(appName, 56, 38);
  context.fillStyle = "#60736f";
  setFont(context, 21, 650);
  context.textAlign = "right";
  context.fillText(`库存 ${data.inventoryDate}`, 1024, 48);

  context.textAlign = "left";
  context.fillStyle = "#142522";
  setFont(context, 38, 850);
  context.fillText("五号主线推进轨道", 56, 96);

  data.accounts.slice(0, 5).forEach((account, index) => drawAccountCard(context, account, 166 + index * 214));

  context.fillStyle = "#899793";
  setFont(context, 17, 650);
  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillText(`五号主线 · ${data.accounts.length} 个账号`, WIDTH / 2, 1305);

  return dataUrlToBlob(canvas.toDataURL("image/png"));
}
