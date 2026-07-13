import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const catalog = JSON.parse(readFileSync(resolve(root, "src/data/generated/catalog.json"), "utf8"));
const problems = [];
const runtimeAssets = new Set([
  ...catalog.evidence.map((row) => row.sourcePath),
  ...catalog.gemMarketSnapshots.map((row) => row.sourceImage),
  ...catalog.skills.map((row) => row.icon),
].map((value) => value.replace(/^\.\//, "")));

for (const relativePath of runtimeAssets) {
  if (!existsSync(resolve(dist, relativePath))) problems.push(`构建缺少 Catalog 资源：${relativePath}`);
}
for (const forbidden of ["图片/旧目录", "图片/识别记录", "图片/技能库", "ocr-models"]) {
  if (existsSync(resolve(dist, forbidden))) problems.push(`构建不应包含：${forbidden}`);
}

let totalBytes = 0;
let largestBytes = 0;
const visit = (directory) => {
  for (const name of readdirSync(directory)) {
    const file = resolve(directory, name);
    const stats = statSync(file);
    if (stats.isDirectory()) visit(file);
    else {
      totalBytes += stats.size;
      largestBytes = Math.max(largestBytes, stats.size);
    }
  }
};
visit(dist);
if (readFileSync(resolve(root, "src/features/data/gemMarketOcr.ts"), "utf8").includes("cdn.jsdelivr.net")) problems.push("OCR 源码仍配置了 jsDelivr 运行时");
const mib = (bytes) => bytes / 1024 / 1024;
if (mib(totalBytes) > 30) problems.push(`构建总体积 ${mib(totalBytes).toFixed(1)} MiB 超过 30 MiB 预算`);
if (mib(largestBytes) > 5) problems.push(`最大文件 ${mib(largestBytes).toFixed(1)} MiB 超过 5 MiB 预算`);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`构建资源完整：${runtimeAssets.size} 个 Catalog 文件，总体积 ${mib(totalBytes).toFixed(1)} MiB，最大文件 ${mib(largestBytes).toFixed(1)} MiB。`);
