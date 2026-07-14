import type { Catalog, EvidenceSource, PetView } from "./types";

export interface PublishOptions {
  mode: "sale" | "record";
  format: "markdown" | "plain";
  title: string;
  intro: string;
  includeStats: boolean;
  includeSkills: boolean;
  includeNotes: boolean;
  allShots: boolean;
}

export const publishDefaults = {
  sale: {
    title: "【出售】账号宠物资产说明",
    intro: "出售账号，下面是按现有截图整理的宠物资产说明。资产以截图和游戏内实际为准，主要展示宠物面板、资质、养成、技能、符、驭和觉醒情况。",
  },
  record: {
    title: "【记录贴】宠物和技能图整理，慢慢补图",
    intro: "开个记录贴，主要发图，顺手记一下整理进度。现在先把宠物面板、技能、符、驭、觉醒这些信息按批次整理出来，后面继续补。",
  },
};

const rowText = (title: string, rows: Array<[string, string]>) => rows.length ? `${title}：${rows.map(([label, value]) => `${label}${value}`).join("，")}` : "";
const skillCount = (pet: PetView) => pet.skillCount;
const isBeast = (pet: PetView) => pet.role.tags.includes("神兽");
const evidenceFor = (catalog: Catalog, pet: PetView, allShots: boolean) => {
  const rows = pet.evidenceIds.map((id) => catalog.evidence.find((item) => item.id === id)).filter(Boolean) as EvidenceSource[];
  return allShots ? rows : rows.slice(0, 1);
};

function petBlock(catalog: Catalog, pet: PetView, options: PublishOptions) {
  const markdown = options.format === "markdown";
  const lines = [markdown ? `### ${pet.accountId}-${pet.sourceRecordId} ${pet.name}` : `${pet.accountId}-${pet.sourceRecordId} ${pet.name}`];
  evidenceFor(catalog, pet, options.allShots).forEach((shot, index) => lines.push(markdown ? `![${pet.accountId} ${pet.name} 图${index + 1}](./${shot.sourcePath})` : `图${index + 1}：./${shot.sourcePath}`));
  lines.push("");
  lines.push(`${markdown ? "- " : ""}基础：${pet.meta}${pet.heart ? ` / ${pet.heart}` : ""}`);
  lines.push(`${markdown ? "- " : ""}资产标签：${[isBeast(pet) ? "神兽/永生" : "", `${skillCount(pet)} 技能`, pet.bloodline, pet.talent ? `天资 ${pet.talent}` : ""].filter(Boolean).join(" / ")}`);
  if (options.includeStats) {
    lines.push(`${markdown ? "- " : ""}${rowText("面板", pet.panel)}`);
    lines.push(`${markdown ? "- " : ""}${rowText("资质/寿命", pet.aptitudes)}`);
    if (pet.growth.length) lines.push(`${markdown ? "- " : ""}${rowText("养成", pet.growth)}`);
  }
  if (options.includeSkills) lines.push(`${markdown ? "- " : ""}完整技能：${pet.skills.filter((skill) => skill !== "空").join("、")}`);
  if (options.includeNotes) lines.push(`${markdown ? "- " : ""}看点：${pet.role.advice}`);
  return lines.join("\n");
}

export function generatePublishContent(catalog: Catalog, pets: PetView[], options: PublishOptions) {
  const markdown = options.format === "markdown";
  const title = options.title.trim() || publishDefaults[options.mode].title;
  const intro = options.intro.trim() || publishDefaults[options.mode].intro;
  const lines = [markdown ? `# ${title}` : title, "", intro, ""];
  if (!pets.length) return [...lines, "先选择要写入正文的宠物资产。"].join("\n");
  const shotCount = pets.reduce((sum, pet) => sum + evidenceFor(catalog, pet, options.allShots).length, 0);

  if (options.mode === "sale") {
    const accounts = [...new Set(pets.map((pet) => pet.accountId))];
    lines.push(markdown ? "## 资产总览" : "资产总览", "");
    lines.push(`- 账号/目录：${accounts.join("、")}`);
    lines.push(`- 宠物记录：${pets.length} 组`);
    lines.push(`- 截图证明：${shotCount} 张`);
    lines.push(`- 神兽/永生：${pets.filter(isBeast).length} 组`);
    lines.push(`- 六技能资产：${pets.filter((pet) => pet.skillCount >= 6).length} 组`);
    lines.push("", markdown ? "## 分账号资产" : "分账号资产");
    accounts.forEach((accountId) => {
      const rows = pets.filter((pet) => pet.accountId === accountId);
      lines.push("", markdown ? `### ${accountId}` : accountId, `- 小计：${rows.length} 组宠物，神兽/永生 ${rows.filter(isBeast).length} 组。`, `- 宠物：${rows.map((pet) => pet.name).join("、")}`);
    });
    lines.push("", markdown ? "## 完整宠物明细" : "完整宠物明细", "");
    pets.forEach((pet) => lines.push(petBlock(catalog, pet, options), ""));
    lines.push(markdown ? "## 交易说明" : "交易说明", "", "- 以上内容根据本地截图识别记录整理，实际资产以游戏内查看为准。", "- 图片清单可单独复制，发帖时建议按账号顺序上传。", "- 价格、区服、角色基础信息和联系方式可在发帖前手动补充。");
  } else {
    lines.push(`目前已选 ${pets.length} 组记录，${shotCount} 张图。`, "");
    pets.forEach((pet) => lines.push(petBlock(catalog, pet, options), ""));
    lines.push("先这样，后面继续慢慢补图。");
  }
  return lines.join("\n").trim();
}

export function publishImagePaths(catalog: Catalog, pets: PetView[], allShots: boolean) {
  return pets.flatMap((pet) => evidenceFor(catalog, pet, allShots).map((item) => `./${item.sourcePath}`));
}
