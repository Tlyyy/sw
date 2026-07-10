import {
  buildGemPriceCrops,
  gemRecognitionLevel,
  parseRecognizedGemPrice,
  type GemMarketItemName,
  type GemPriceCrop,
} from "../../domain/gemMarketRecognition";
import { parsePaddleGemMarketItems, type PaddleTextItem } from "../../domain/gemMarketPaddleParsing";
import { publicAsset } from "../../utils/publicAsset";

export interface GemMarketOcrResult {
  name: GemMarketItemName;
  price: number | null;
  confidence: number;
  level: "high" | "medium" | "low";
  rawText: string;
  engine: "paddle" | "template";
}

export interface GemMarketOcrProgress {
  progress: number;
  label: string;
}

interface BinaryRow {
  width: number;
  height: number;
  pixels: Uint8Array;
}

interface Glyph {
  pixels: Uint8Array;
}

type TemplateMap = Map<string, Uint8Array[]>;

const REFERENCE_IMAGE = publicAsset("图片/原始截图/公共/宝石行情/2026-07-09/gem-market-2026-07-09.png");
const REFERENCE_VALUES = ["798", "852", "1257", "1240", "308", "264"] as const;
const GLYPH_WIDTH = 24;
const GLYPH_HEIGHT = 36;

interface PaddleEngine {
  predict(input: unknown, params?: Record<string, unknown>): Promise<Array<{
    image: { width: number; height: number };
    items: PaddleTextItem[];
  }>>;
}

let paddleEnginePromise: Promise<PaddleEngine> | undefined;

async function loadPaddleEngine(): Promise<PaddleEngine> {
  if (!paddleEnginePromise) {
    paddleEnginePromise = import("@paddleocr/paddleocr-js").then(async ({ PaddleOCR }) => PaddleOCR.create({
      lang: "ch",
      ocrVersion: "PP-OCRv6",
      textDetectionModelName: "PP-OCRv6_small_det",
      textRecognitionModelName: "PP-OCRv6_small_rec",
      textDetectionModelAsset: { url: publicAsset("ocr-models/PP-OCRv6_small_det_onnx_infer.tar") },
      textRecognitionModelAsset: { url: publicAsset("ocr-models/PP-OCRv6_small_rec_onnx_infer.tar") },
      textDetectionBatchSize: 1,
      textRecognitionBatchSize: 8,
      ortOptions: {
        backend: "wasm",
        wasmPaths: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/",
        numThreads: 1,
        simd: true,
        proxy: false,
      },
    }) as Promise<PaddleEngine>);
  }
  return paddleEnginePromise;
}

function upscaleForPaddle(image: HTMLImageElement) {
  const scale = Math.max(2, Math.min(4, Math.ceil(720 / image.naturalWidth)));
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth * scale;
  canvas.height = image.naturalHeight * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法建立强力 OCR 画布。");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function recognizeWithPaddle(file: File, onProgress?: (state: GemMarketOcrProgress) => void): Promise<GemMarketOcrResult[]> {
  onProgress?.({ progress: 0.12, label: "正在读取并放大行情截图" });
  const image = await loadImage(file);
  const canvas = upscaleForPaddle(image);
  onProgress?.({ progress: 0.24, label: "正在加载 PP-OCRv6 强力模型（首次约 60 MB）" });
  const engine = await loadPaddleEngine();
  onProgress?.({ progress: 0.58, label: "正在自动定位表格文字和六项价格" });
  const [result] = await engine.predict(canvas, {
    textDetLimitSideLen: 960,
    textDetLimitType: "max",
    textDetBoxThresh: 0.42,
    textDetThresh: 0.25,
    textDetUnclipRatio: 1.8,
    textRecScoreThresh: 0.2,
  });
  const parsed = parsePaddleGemMarketItems(result?.items || [], canvas.width, canvas.height);
  onProgress?.({ progress: 0.92, label: "正在核对识别结果" });
  return parsed.map((row) => ({
    ...row,
    level: gemRecognitionLevel(row.confidence, row.price),
    engine: "paddle" as const,
  }));
}

function loadImage(source: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = source instanceof File ? URL.createObjectURL(source) : "";
    const image = new Image();
    image.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error("无法读取这张图片，请重新导出为 PNG、JPG 或 WebP。"));
    };
    image.src = typeof source === "string" ? source : objectUrl;
  });
}

function extractBinaryRow(image: HTMLImageElement, crop: GemPriceCrop): BinaryRow {
  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("当前浏览器无法处理截图画布。");
  context.drawImage(image, crop.left, crop.top, crop.width, crop.height, 0, 0, crop.width, crop.height);

  const rgba = context.getImageData(0, 0, crop.width, crop.height).data;
  const pixels = new Uint8Array(crop.width * crop.height);
  for (let index = 0; index < pixels.length; index += 1) {
    const offset = index * 4;
    const red = rgba[offset];
    const green = rgba[offset + 1];
    const blue = rgba[offset + 2];
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
    pixels[index] = luminance > 164 && spread < 96 ? 1 : 0;
  }
  return { width: crop.width, height: crop.height, pixels };
}

function normalizeGlyph(row: BinaryRow, left: number, right: number): Glyph | null {
  let top = row.height;
  let bottom = -1;
  for (let y = 0; y < row.height; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (row.pixels[y * row.width + x]) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (bottom < top || right - left < 1) return null;

  const sourceWidth = right - left + 1;
  const sourceHeight = bottom - top + 1;
  const normalized = new Uint8Array(GLYPH_WIDTH * GLYPH_HEIGHT);
  for (let y = 0; y < GLYPH_HEIGHT; y += 1) {
    const sourceY = top + Math.min(sourceHeight - 1, Math.floor((y / GLYPH_HEIGHT) * sourceHeight));
    for (let x = 0; x < GLYPH_WIDTH; x += 1) {
      const sourceX = left + Math.min(sourceWidth - 1, Math.floor((x / GLYPH_WIDTH) * sourceWidth));
      normalized[y * GLYPH_WIDTH + x] = row.pixels[sourceY * row.width + sourceX];
    }
  }
  return { pixels: normalized };
}

function segmentGlyphs(row: BinaryRow, expectedCount?: number): Glyph[] {
  const visited = new Uint8Array(row.pixels.length);
  const components: Array<{ left: number; right: number; top: number; bottom: number; area: number }> = [];
  for (let start = 0; start < row.pixels.length; start += 1) {
    if (!row.pixels[start] || visited[start]) continue;
    const stack = [start];
    visited[start] = 1;
    let left = row.width;
    let right = -1;
    let top = row.height;
    let bottom = -1;
    let area = 0;

    while (stack.length) {
      const current = stack.pop()!;
      const x = current % row.width;
      const y = Math.floor(current / row.width);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      area += 1;
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (!offsetX && !offsetY) continue;
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextX >= row.width || nextY < 0 || nextY >= row.height) continue;
          const next = nextY * row.width + nextX;
          if (row.pixels[next] && !visited[next]) {
            visited[next] = 1;
            stack.push(next);
          }
        }
      }
    }
    if (area >= 5 && bottom - top >= 5) components.push({ left, right, top, bottom, area });
  }

  components.sort((left, right) => left.left - right.left);
  if (expectedCount && components.length) {
    const groupLeft = Math.min(...components.map((component) => component.left));
    const groupRight = Math.max(...components.map((component) => component.right));
    const groupWidth = groupRight - groupLeft + 1;
    return Array.from({ length: expectedCount }, (_, index) => {
      const left = Math.round(groupLeft + (groupWidth * index) / expectedCount);
      const right = Math.round(groupLeft + (groupWidth * (index + 1)) / expectedCount) - 1;
      return normalizeGlyph(row, left, right);
    }).filter((glyph): glyph is Glyph => glyph !== null);
  }

  const ranges: Array<[number, number]> = [];
  components.forEach((component) => {
    const previous = ranges.at(-1);
    if (previous && component.left <= previous[1]) previous[1] = Math.max(previous[1], component.right);
    else ranges.push([component.left, component.right]);
  });

  return ranges
    .map(([left, right]) => normalizeGlyph(row, left, right))
    .filter((glyph): glyph is Glyph => glyph !== null);
}

function glyphSimilarity(left: Uint8Array, right: Uint8Array): number {
  let intersection = 0;
  let union = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] || right[index]) union += 1;
    if (left[index] && right[index]) intersection += 1;
  }
  return union ? intersection / union : 0;
}

function buildTemplates(reference: HTMLImageElement): TemplateMap {
  const templates: TemplateMap = new Map();
  const crops = buildGemPriceCrops(reference.naturalWidth, reference.naturalHeight);
  crops.forEach((crop, rowIndex) => {
    const expected = REFERENCE_VALUES[rowIndex];
    const glyphs = segmentGlyphs(extractBinaryRow(reference, crop), expected.length);
    if (glyphs.length !== expected.length) {
      throw new Error(`本地数字基准加载失败（第 ${rowIndex + 1} 行：${glyphs.length}/${expected.length}），请刷新页面后重试。`);
    }
    glyphs.forEach((glyph, glyphIndex) => {
      const digit = expected[glyphIndex];
      const list = templates.get(digit) || [];
      list.push(glyph.pixels);
      templates.set(digit, list);
    });
  });
  return templates;
}

function recognizeRow(row: BinaryRow, templates: TemplateMap, expectedCount: number) {
  const glyphs = segmentGlyphs(row, expectedCount);
  if (!glyphs.length || glyphs.length > 6) return { text: "", confidence: 0 };

  let confidenceTotal = 0;
  const text = glyphs.map((glyph) => {
    let bestDigit = "";
    let bestScore = 0;
    templates.forEach((candidates, digit) => {
      const score = Math.max(...candidates.map((candidate) => glyphSimilarity(glyph.pixels, candidate)));
      if (score > bestScore) {
        bestDigit = digit;
        bestScore = score;
      }
    });
    confidenceTotal += bestScore;
    return bestDigit;
  }).join("");

  return { text, confidence: Math.round((confidenceTotal / glyphs.length) * 100) };
}

async function recognizeWithTemplate(
  file: File,
  onProgress?: (state: GemMarketOcrProgress) => void,
): Promise<GemMarketOcrResult[]> {
  onProgress?.({ progress: 0.08, label: "正在读取行情截图" });
  const [image, reference] = await Promise.all([loadImage(file), loadImage(REFERENCE_IMAGE)]);
  const crops = buildGemPriceCrops(image.naturalWidth, image.naturalHeight);
  onProgress?.({ progress: 0.3, label: "正在加载本地数字基准" });
  const templates = buildTemplates(reference);

  const results = crops.map((crop, index) => {
    onProgress?.({ progress: 0.35 + ((index + 1) / crops.length) * 0.6, label: `正在识别第 ${index + 1} / ${crops.length} 行` });
    const recognized = recognizeRow(extractBinaryRow(image, crop), templates, REFERENCE_VALUES[index].length);
    const price = parseRecognizedGemPrice(recognized.text);
    return {
      name: crop.name,
      price,
      confidence: recognized.confidence,
      level: gemRecognitionLevel(recognized.confidence, price),
      rawText: recognized.text,
      engine: "template" as const,
    };
  });

  onProgress?.({ progress: 1, label: "识别完成，请核对价格" });
  return results;
}

export async function recognizeGemMarketScreenshot(
  file: File,
  onProgress?: (state: GemMarketOcrProgress) => void,
): Promise<GemMarketOcrResult[]> {
  try {
    const paddleRows = await recognizeWithPaddle(file, onProgress);
    if (paddleRows.filter((row) => row.price !== null).length >= 4) {
      onProgress?.({ progress: 1, label: "PP-OCRv6 识别完成，请核对价格" });
      return paddleRows;
    }
    onProgress?.({ progress: 0.94, label: "强力模型结果不足，正在使用本地基准补充" });
    const templateRows = await recognizeWithTemplate(file);
    const merged = paddleRows.map((row, index) => {
      if (row.price !== null) return row;
      const fallback = templateRows[index];
      return fallback.confidence >= 78 ? fallback : row;
    });
    onProgress?.({ progress: 1, label: "组合识别完成，请核对价格" });
    return merged;
  } catch (cause) {
    console.warn("PP-OCRv6 unavailable; using the built-in offline template fallback.", cause);
    paddleEnginePromise = undefined;
    onProgress?.({ progress: 0.5, label: "强力模型暂不可用，正在切换离线基准" });
    return recognizeWithTemplate(file, onProgress);
  }
}
