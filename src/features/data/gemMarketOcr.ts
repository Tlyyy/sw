import {
  GEM_MARKET_ITEM_NAMES,
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
  expanded: Uint8Array;
  ink: number;
  holes: number;
  expandedHoles: number;
  rowProfile: Uint8Array;
  columnProfile: Uint8Array;
}

interface ImagePixels {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
}

interface EdgePeak {
  position: number;
  score: number;
}

type TemplateMap = Map<string, Glyph[]>;

const REFERENCE_IMAGE = publicAsset("图片/原始截图/公共/宝石行情/2026-07-09/gem-market-2026-07-09.png");
const REFERENCE_VALUES = ["798", "852", "1257", "1240", "308", "264"] as const;
const GLYPH_WIDTH = 24;
const GLYPH_HEIGHT = 36;

function countHoles(pixels: Uint8Array): number {
  const visited = new Uint8Array(pixels.length);
  let holes = 0;

  for (let start = 0; start < pixels.length; start += 1) {
    if (pixels[start] || visited[start]) continue;
    const stack = [start];
    visited[start] = 1;
    let area = 0;
    let touchesEdge = false;

    while (stack.length) {
      const current = stack.pop()!;
      const x = current % GLYPH_WIDTH;
      const y = Math.floor(current / GLYPH_WIDTH);
      area += 1;
      if (x === 0 || x === GLYPH_WIDTH - 1 || y === 0 || y === GLYPH_HEIGHT - 1) touchesEdge = true;

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (!offsetX && !offsetY) continue;
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextX >= GLYPH_WIDTH || nextY < 0 || nextY >= GLYPH_HEIGHT) continue;
          const next = nextY * GLYPH_WIDTH + nextX;
          if (!pixels[next] && !visited[next]) {
            visited[next] = 1;
            stack.push(next);
          }
        }
      }
    }

    if (!touchesEdge && area >= 4) holes += 1;
  }

  return holes;
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

function readImagePixels(image: HTMLImageElement): ImagePixels {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("当前浏览器无法分析行情表位置。");
  context.drawImage(image, 0, 0);
  return {
    width: canvas.width,
    height: canvas.height,
    rgba: context.getImageData(0, 0, canvas.width, canvas.height).data,
  };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  values.sort((left, right) => left - right);
  return values[Math.floor(values.length / 2)];
}

function pixelDifference(rgba: Uint8ClampedArray, first: number, second: number): number {
  return Math.abs(rgba[first] - rgba[second])
    + Math.abs(rgba[first + 1] - rgba[second + 1])
    + Math.abs(rgba[first + 2] - rgba[second + 2]);
}

function horizontalEdgeScores(pixels: ImagePixels): number[] {
  const scores = Array.from({ length: pixels.height }, () => 0);
  const left = Math.round(pixels.width * 0.08);
  const right = Math.round(pixels.width * 0.92);
  for (let y = 1; y < pixels.height; y += 1) {
    const differences: number[] = [];
    for (let x = left; x < right; x += 1) {
      const current = (y * pixels.width + x) * 4;
      differences.push(pixelDifference(pixels.rgba, current - pixels.width * 4, current));
    }
    scores[y] = median(differences);
  }
  return scores;
}

function verticalEdgeScores(pixels: ImagePixels, top: number, bottom: number): number[] {
  const scores = Array.from({ length: pixels.width }, () => 0);
  for (let x = 1; x < pixels.width; x += 1) {
    const differences: number[] = [];
    for (let y = top; y < bottom; y += 1) {
      const current = (y * pixels.width + x) * 4;
      differences.push(pixelDifference(pixels.rgba, current - 4, current));
    }
    scores[x] = median(differences);
  }
  return scores;
}

function clusterEdgePeaks(scores: number[]): EdgePeak[] {
  const strongest = Math.max(...scores);
  if (!strongest) return [];
  const threshold = Math.max(12, strongest * 0.15);
  const positions = scores
    .map((score, position) => ({ position, score }))
    .filter((entry) => entry.score >= threshold);
  const clusters: EdgePeak[][] = [];

  positions.forEach((entry) => {
    const cluster = clusters.at(-1);
    if (cluster && entry.position - cluster.at(-1)!.position <= 2) cluster.push(entry);
    else clusters.push([entry]);
  });

  return clusters.map((cluster) => cluster.reduce((best, entry) => entry.score > best.score ? entry : best));
}

function searchRegularRowBoundaries(scores: number[], height: number): number[] | null {
  const strongest = Math.max(...scores);
  if (!strongest) return null;
  let best: { positions: number[]; score: number } | undefined;
  const edgeNear = (position: number) => Math.max(
    scores[position - 1] || 0,
    scores[position] || 0,
    scores[position + 1] || 0,
  );

  for (let start = Math.round(height * 0.07); start <= height * 0.3; start += 1) {
    for (let gap = height * 0.09; gap <= height * 0.2; gap += 0.25) {
      const positions = Array.from({ length: 7 }, (_, index) => Math.round(start + gap * index));
      if (positions.at(-1)! >= height) continue;
      const edgeStrength = positions.reduce((sum, position) => sum + edgeNear(position), 0) / (strongest * positions.length);
      const bottomGap = (height - positions.at(-1)!) / gap;
      const score = edgeStrength - Math.max(0, bottomGap - 0.55) * 0.12;
      if (!best || score > best.score) best = { positions, score };
    }
  }

  return best && best.score >= 0.16 ? best.positions : null;
}

function chooseRowBoundaries(scores: number[], height: number): number[] | null {
  const peaks = clusterEdgePeaks(scores)
    .filter((peak) => peak.position >= height * 0.04 && peak.position <= height - 1);
  if (peaks.length < 7) return searchRegularRowBoundaries(scores, height);

  let best: { positions: number[]; score: number } | undefined;
  const selected: EdgePeak[] = [];
  const evaluate = () => {
    const positions = selected.map((peak) => peak.position);
    const gaps = positions.slice(1).map((position, index) => position - positions[index]);
    const meanGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    if (meanGap < height * 0.09 || meanGap > height * 0.2) return;
    if (gaps.some((gap) => Math.abs(gap - meanGap) > meanGap * 0.18)) return;
    if (positions[0] > height * 0.3 || positions.at(-1)! < height * 0.78) return;

    const uniformityPenalty = gaps.reduce((sum, gap) => sum + Math.abs(gap - meanGap) / meanGap, 0) / gaps.length;
    const bottomPenalty = (height - positions.at(-1)!) / meanGap;
    const strength = selected.reduce((sum, peak) => sum + peak.score, 0) / (selected.length * Math.max(...scores));
    const score = strength - uniformityPenalty * 3 - bottomPenalty * 0.2;
    if (!best || score > best.score) best = { positions, score };
  };

  const visit = (start: number) => {
    if (selected.length === 7) {
      evaluate();
      return;
    }
    const remaining = 7 - selected.length;
    for (let index = start; index <= peaks.length - remaining; index += 1) {
      selected.push(peaks[index]);
      visit(index + 1);
      selected.pop();
    }
  };
  visit(0);
  return best?.positions || searchRegularRowBoundaries(scores, height);
}

function strongestSeparator(scores: number[], start: number, end: number): number {
  let bestPosition = start;
  let bestScore = -1;
  for (let position = start; position <= end; position += 1) {
    const score = (scores[position - 1] || 0) + (scores[position] || 0) + (scores[position + 1] || 0);
    if (score > bestScore) {
      bestPosition = position;
      bestScore = score;
    }
  }
  return bestPosition;
}

function detectGemPriceCrops(image: HTMLImageElement): GemPriceCrop[] {
  const pixels = readImagePixels(image);
  const rowScores = horizontalEdgeScores(pixels);
  const rowBoundaries = chooseRowBoundaries(rowScores, pixels.height);
  if (!rowBoundaries) return buildGemPriceCrops(pixels.width, pixels.height);

  const rowGaps = rowBoundaries.slice(1).map((position, index) => position - rowBoundaries[index]);
  const rowHeight = rowGaps.reduce((sum, gap) => sum + gap, 0) / rowGaps.length;
  const headerBottom = rowBoundaries[0];
  const headerTopEdge = clusterEdgePeaks(rowScores)
    .filter((peak) => peak.position < headerBottom - rowHeight * 0.2)
    .reduce<EdgePeak | undefined>((best, peak) => !best || peak.score > best.score ? peak : best, undefined);
  const headerTop = headerTopEdge
    ? Math.min(headerBottom - 2, headerTopEdge.position + 1)
    : Math.max(0, Math.round(headerBottom - rowHeight));
  const columnScores = verticalEdgeScores(pixels, headerTop, headerBottom);
  const firstSeparator = strongestSeparator(
    columnScores,
    Math.round(pixels.width * 0.4),
    Math.round(pixels.width * 0.62),
  );
  const secondSeparator = strongestSeparator(
    columnScores,
    Math.max(Math.round(pixels.width * 0.64), firstSeparator + Math.round(pixels.width * 0.14)),
    Math.round(pixels.width * 0.86),
  );
  const horizontalPadding = Math.max(1, Math.round(pixels.width * 0.008));
  const verticalPadding = Math.max(2, Math.round(rowHeight * 0.16));
  const priceLeft = Math.min(
    firstSeparator + horizontalPadding,
    Math.round(pixels.width * 0.45),
  );
  const priceRight = Math.min(
    secondSeparator - horizontalPadding,
    Math.round(pixels.width * 0.74),
  );

  if (secondSeparator - firstSeparator < pixels.width * 0.12) {
    return buildGemPriceCrops(pixels.width, pixels.height);
  }

  return GEM_MARKET_ITEM_NAMES.map((name, index) => ({
    name,
    left: priceLeft,
    top: rowBoundaries[index] + verticalPadding,
    width: priceRight - priceLeft,
    height: rowBoundaries[index + 1] - rowBoundaries[index] - verticalPadding * 2,
  }));
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
    pixels[index] = luminance > 180 && spread < 75 ? 1 : 0;
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
  const expanded = new Uint8Array(normalized.length);
  const rowProfile = new Uint8Array(GLYPH_HEIGHT);
  const columnProfile = new Uint8Array(GLYPH_WIDTH);
  let ink = 0;
  for (let y = 0; y < GLYPH_HEIGHT; y += 1) {
    for (let x = 0; x < GLYPH_WIDTH; x += 1) {
      const index = y * GLYPH_WIDTH + x;
      if (!normalized[index]) continue;
      ink += 1;
      rowProfile[y] += 1;
      columnProfile[x] += 1;
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextX >= GLYPH_WIDTH || nextY < 0 || nextY >= GLYPH_HEIGHT) continue;
          expanded[nextY * GLYPH_WIDTH + nextX] = 1;
        }
      }
    }
  }
  return {
    pixels: normalized,
    expanded,
    ink,
    holes: countHoles(normalized),
    expandedHoles: countHoles(expanded),
    rowProfile,
    columnProfile,
  };
}

function segmentGlyphs(row: BinaryRow, expectedCount?: number): Glyph[] {
  const visited = new Uint8Array(row.pixels.length);
  const components: Array<{ left: number; right: number; top: number; bottom: number; area: number }> = [];
  const minimumComponentHeight = Math.max(3, Math.floor(row.height * 0.3));
  const minimumComponentArea = row.height < 16 ? 3 : 5;
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
    if (area >= minimumComponentArea && bottom - top + 1 >= minimumComponentHeight) {
      components.push({ left, right, top, bottom, area });
    }
  }

  components.sort((left, right) => left.left - right.left);
  const maxComponentHeight = components.reduce((height, component) => Math.max(height, component.bottom - component.top + 1), 0);
  const significantComponents = components.filter((component) => component.bottom - component.top + 1 >= maxComponentHeight * 0.55);
  const componentRanges: Array<[number, number]> = [];
  significantComponents.forEach((component) => {
    const previous = componentRanges.at(-1);
    if (previous && component.left <= previous[1]) previous[1] = Math.max(previous[1], component.right);
    else componentRanges.push([component.left, component.right]);
  });

  if (expectedCount && componentRanges.length === expectedCount) {
    const componentGlyphs = componentRanges
      .map(([left, right]) => normalizeGlyph(row, left, right))
      .filter((glyph): glyph is Glyph => glyph !== null);
    if (componentGlyphs.length === expectedCount) return componentGlyphs;
  }

  const projectionRanges: Array<[number, number]> = [];
  let projectionStart = -1;
  for (let x = 0; x <= row.width; x += 1) {
    let hasInk = false;
    if (x < row.width) {
      for (let y = 0; y < row.height; y += 1) {
        if (row.pixels[y * row.width + x]) {
          hasInk = true;
          break;
        }
      }
    }
    if (hasInk && projectionStart < 0) projectionStart = x;
    if (!hasInk && projectionStart >= 0) {
      projectionRanges.push([projectionStart, x - 1]);
      projectionStart = -1;
    }
  }

  if (expectedCount && projectionRanges.length === expectedCount) {
    const projectionGlyphs = projectionRanges
      .map(([left, right]) => normalizeGlyph(row, left, right))
      .filter((glyph): glyph is Glyph => glyph !== null);
    if (projectionGlyphs.length === expectedCount) return projectionGlyphs;
  }

  if (expectedCount && components.length) {
    const detectedBounds = horizontalInkBounds(row);
    const groupLeft = detectedBounds?.left ?? Math.min(...components.map((component) => component.left));
    const groupRight = detectedBounds?.right ?? Math.max(...components.map((component) => component.right));
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

function glyphSimilarity(left: Glyph, right: Glyph): number {
  let intersection = 0;
  let union = 0;
  let leftCovered = 0;
  let rightCovered = 0;
  for (let index = 0; index < left.pixels.length; index += 1) {
    if (left.pixels[index] || right.pixels[index]) union += 1;
    if (left.pixels[index] && right.pixels[index]) intersection += 1;
    if (left.pixels[index] && right.expanded[index]) leftCovered += 1;
    if (right.pixels[index] && left.expanded[index]) rightCovered += 1;
  }

  const tolerantCoverage = ((left.ink ? leftCovered / left.ink : 0) + (right.ink ? rightCovered / right.ink : 0)) / 2;
  const exactOverlap = union ? intersection / union : 0;
  const rowDistance = left.rowProfile.reduce(
    (sum, value, index) => sum + Math.abs(value - right.rowProfile[index]) / GLYPH_WIDTH,
    0,
  ) / GLYPH_HEIGHT;
  const columnDistance = left.columnProfile.reduce(
    (sum, value, index) => sum + Math.abs(value - right.columnProfile[index]) / GLYPH_HEIGHT,
    0,
  ) / GLYPH_WIDTH;
  const projectionSimilarity = 1 - (rowDistance + columnDistance) / 2;
  const holeDistance = Math.abs(left.holes - right.holes) + Math.abs(left.expandedHoles - right.expandedHoles) * 0.6;
  const structuralPenalty = Math.min(0.24, holeDistance * 0.09);

  return Math.max(0, tolerantCoverage * 0.35 + exactOverlap * 0.4 + projectionSimilarity * 0.25 - structuralPenalty);
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

function addTemplates(templates: TemplateMap, reference: HTMLImageElement, required: boolean) {
  const crops = detectGemPriceCrops(reference);
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
      list.push(glyph);
      templates.set(digit, list);
    });
  });
}

async function buildTemplates(
  reference: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  targetCrops: GemPriceCrop[],
): Promise<TemplateMap> {
  const templates: TemplateMap = new Map();
  const referenceCrops = detectGemPriceCrops(reference);
  addTemplates(templates, reference, true);
  const referenceBodySpan = referenceCrops.at(-1)!.top - referenceCrops[0].top;
  const targetBodySpan = targetCrops.at(-1)!.top - targetCrops[0].top;
  const scale = Math.max(0.25, Math.min(3, targetBodySpan / referenceBodySpan));
  const drawWidth = Math.round(reference.naturalWidth * scale);
  const drawHeight = Math.round(reference.naturalHeight * scale);
  const offsetX = Math.round((targetWidth - drawWidth) / 2);
  const offsetY = Math.round((targetHeight - drawHeight) / 2);

  // Recreate the detected scale and surrounding canvas before JPEG compression.
  // This preserves the block alignment and stroke loss seen in small screenshots.
  const variants = await Promise.all([
    { quality: 0.66, blur: 0.36 },
    { quality: 0.62, blur: 0.4 },
    { quality: 0.7, blur: 0.32 },
    { quality: 0.78, blur: 0.25 },
    { quality: 0.88, blur: 0.12 },
  ].map(async ({ quality, blur }) => {
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#74a7df";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.filter = `blur(${blur}px)`;
    context.drawImage(reference, offsetX, offsetY, drawWidth, drawHeight);
    const compressed = await loadImage(canvas.toDataURL("image/jpeg", quality));
    return compressed;
  }));
  variants.filter((variant): variant is HTMLImageElement => variant !== null).forEach((variant) => addTemplates(templates, variant, false));
  const missingDigits = Array.from({ length: 10 }, (_, digit) => String(digit)).filter((digit) => !templates.has(digit));
  if (missingDigits.length) {
    throw new Error(`本地数字基准加载失败（缺少数字 ${missingDigits.join("、")}），请换用更清晰的完整行情表截图。`);
  }
  return templates;
}

function recognizeRow(
  row: BinaryRow,
  templates: TemplateMap,
  expectedCount: number,
) {
  const glyphs = segmentGlyphs(row, expectedCount);
  if (!glyphs.length || glyphs.length > 6) return { text: "", confidence: 0 };

  const matches = glyphs.map((glyph) => {
    const scores: Array<{ digit: string; score: number }> = [];
    templates.forEach((candidates, digit) => {
      scores.push({
        digit,
        score: Math.max(...candidates.map((candidate) => glyphSimilarity(glyph, candidate))),
      });
    });
    return scores.sort((left, right) => right.score - left.score);
  });
  const best = matches.map((entries) => entries[0]).filter((entry) => entry !== undefined);
  return {
    text: best.map((entry) => entry.digit).join(""),
    confidence: Math.round((best.reduce((sum, entry) => sum + entry.score, 0) / best.length) * 100),
  };
}

async function recognizeWithTemplate(
  file: File,
  onProgress?: (state: GemMarketOcrProgress) => void,
): Promise<GemMarketOcrResult[]> {
  onProgress?.({ progress: 0.08, label: "正在读取行情截图" });
  const [image, reference] = await Promise.all([loadImage(file), loadImage(REFERENCE_IMAGE)]);
  onProgress?.({ progress: 0.24, label: "正在定位六行价格" });
  const crops = detectGemPriceCrops(image);
  onProgress?.({ progress: 0.36, label: "正在加载本地数字基准" });
  const templates = await buildTemplates(reference, image.naturalWidth, image.naturalHeight, crops);
  const results = crops.map((crop, index) => {
    const expectedCount = REFERENCE_VALUES[index].length;
    const recognized = recognizeRow(
      extractBinaryRow(image, crop),
      templates,
      expectedCount,
    );
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
