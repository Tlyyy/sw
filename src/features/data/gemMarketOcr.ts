import {
  buildGemPriceCrops,
  gemRecognitionLevel,
  parseRecognizedGemPrice,
  type GemMarketItemName,
  type GemPriceCrop,
} from "../../domain/gemMarketRecognition";
import { publicAsset } from "../../utils/publicAsset";

export interface GemMarketOcrResult {
  name: GemMarketItemName;
  price: number | null;
  confidence: number;
  level: "high" | "medium" | "low";
  rawText: string;
  engine: "template";
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

function segmentGlyphs(row: BinaryRow, expectedCount?: number, fixedBounds?: { left: number; right: number }): Glyph[] {
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
    const groupLeft = fixedBounds?.left ?? Math.min(...components.map((component) => component.left));
    const groupRight = fixedBounds?.right ?? Math.max(...components.map((component) => component.right));
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

function horizontalInkBounds(row: BinaryRow) {
  let left = row.width;
  let right = -1;
  for (let index = 0; index < row.pixels.length; index += 1) {
    if (!row.pixels[index]) continue;
    const x = index % row.width;
    left = Math.min(left, x);
    right = Math.max(right, x);
  }
  return right >= left ? { left, right } : undefined;
}

async function normalizeToReference(image: HTMLImageElement, width: number, height: number, margin: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法建立离线识别画布。");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    margin,
    margin,
    image.naturalWidth - margin * 2,
    image.naturalHeight - margin * 2,
    0,
    0,
    width,
    height,
  );
  return loadImage(canvas.toDataURL("image/png"));
}

function addTemplates(templates: TemplateMap, reference: HTMLImageElement, required: boolean) {
  const crops = buildGemPriceCrops(reference.naturalWidth, reference.naturalHeight);
  crops.forEach((crop, rowIndex) => {
    const expected = REFERENCE_VALUES[rowIndex];
    const glyphs = segmentGlyphs(extractBinaryRow(reference, crop), expected.length);
    if (glyphs.length !== expected.length) {
      if (required) throw new Error(`本地数字基准加载失败（第 ${rowIndex + 1} 行：${glyphs.length}/${expected.length}），请刷新页面后重试。`);
      return;
    }
    glyphs.forEach((glyph, glyphIndex) => {
      const digit = expected[glyphIndex];
      const list = templates.get(digit) || [];
      list.push(glyph.pixels);
      templates.set(digit, list);
    });
  });
}

async function buildTemplates(reference: HTMLImageElement, targetWidth: number, targetHeight: number): Promise<TemplateMap> {
  const templates: TemplateMap = new Map();
  if (targetWidth === reference.naturalWidth && targetHeight === reference.naturalHeight) addTemplates(templates, reference, true);
  const variants = await Promise.all([0.78].map(async (quality) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(120, targetWidth);
    canvas.height = Math.max(160, targetHeight);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.filter = "blur(0.25px)";
    context.drawImage(reference, 0, 0, canvas.width, canvas.height);
    const compressed = await loadImage(canvas.toDataURL("image/jpeg", quality));
    return normalizeToReference(compressed, reference.naturalWidth, reference.naturalHeight, 0);
  }));
  variants.filter((variant): variant is HTMLImageElement => variant !== null).forEach((variant) => addTemplates(templates, variant, true));
  return templates;
}

function recognizeRow(row: BinaryRow, templates: TemplateMap, expectedCount: number, fixedBounds?: { left: number; right: number }) {
  const glyphs = segmentGlyphs(row, expectedCount, fixedBounds);
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
  onProgress?.({ progress: 0.3, label: "正在加载本地数字基准" });
  const referenceRatio = reference.naturalWidth / reference.naturalHeight;
  const estimatedMargin = Math.max(0, (image.naturalWidth - referenceRatio * image.naturalHeight) / (2 * (1 - referenceRatio)));
  const candidateMargins = estimatedMargin < 2
    ? [0]
    : [...new Set([-4, -3, -2, -1, 0, 1, 2, 3, 4].map((offset) => Math.round(estimatedMargin) + offset))]
      .filter((margin) => margin >= 0 && margin * 2 < Math.min(image.naturalWidth, image.naturalHeight) * 0.12);

  const candidates = await Promise.all(candidateMargins.map(async (margin) => {
    const templates = await buildTemplates(reference, image.naturalWidth - margin * 2, image.naturalHeight - margin * 2);
    const normalizedImage = await normalizeToReference(image, reference.naturalWidth, reference.naturalHeight, margin);
    const crops = buildGemPriceCrops(reference.naturalWidth, reference.naturalHeight);
    const rows = crops.map((crop, index) => {
      const referenceRow = extractBinaryRow(reference, crop);
      const recognized = recognizeRow(extractBinaryRow(normalizedImage, crop), templates, REFERENCE_VALUES[index].length, horizontalInkBounds(referenceRow));
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
    return { rows, score: rows.reduce((sum, row) => sum + row.confidence, 0) };
  }));
  const bestRows = candidates.sort((left, right) => right.score - left.score)[0]?.rows || [];
  const transformedInput = image.naturalWidth !== reference.naturalWidth || image.naturalHeight !== reference.naturalHeight;
  const results = transformedInput ? bestRows.map((row) => {
    const confidence = Math.min(row.confidence, 70);
    return { ...row, confidence, level: gemRecognitionLevel(confidence, row.price) };
  }) : bestRows;
  results.forEach((_, index) => onProgress?.({ progress: 0.35 + ((index + 1) / results.length) * 0.6, label: `正在识别第 ${index + 1} / ${results.length} 行` }));

  onProgress?.({ progress: 1, label: "识别完成，请核对价格" });
  return results;
}

export async function recognizeGemMarketScreenshot(
  file: File,
  onProgress?: (state: GemMarketOcrProgress) => void,
): Promise<GemMarketOcrResult[]> {
  return recognizeWithTemplate(file, onProgress);
}
