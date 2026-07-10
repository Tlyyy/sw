import type { BeastConfig, BeastCostSummary, Catalog, PetAnalysis, PetAsset, PetView } from "./types";

export const getStat = (rows: Array<[string, string]>, label: string) => rows.find(([name]) => name.includes(label))?.[1] || "";
export const firstNumber = (value: unknown) => Number(String(value ?? "").match(/\d+/)?.[0] || 0);
export const currentAptitude = (value: string) => Number(String(value || "").split("/")[0] || 0);
export const isCountedSkill = (skill: string) => skill !== "空" && !skill.includes("(符)") && !skill.includes("(驭)") && !skill.includes("强化") && !skill.includes("之心") && !skill.startsWith("觉醒");
export const unique = <T>(items: T[]) => [...new Set(items.filter(Boolean))];

const beastBaseAptitudes: Record<string, Record<string, number>> = {
  神兽青蛇: { attack: 1500, defense: 1450, stamina: 1450, magic: 1500, speed: 1400 },
  神兽龙马: { attack: 1500, defense: 1500, stamina: 1450, magic: 1450, speed: 1400 },
};

function isPendingBook(row: PetView) {
  if (row.skills.filter((skill) => skill === "空").length >= 4) return true;
  if (!row.name.includes("神兽") || row.name !== "神兽青蛇") return false;
  const counted = row.skills.filter(isCountedSkill).length;
  const text = row.skills.join("、");
  const hasCore = ["高级必杀", "高级连击", "高级强力", "高级偷袭", "高级法术暴击", "高级法术连击", "高级灵蕴", "剑气四射", "高级隐身"].some((item) => text.includes(item));
  return counted <= 5 && !hasCore;
}

function classify(row: PetView): PetAnalysis {
  const text = row.skills.join("、");
  const isBeast = row.name.includes("神兽") || row.life === "永生";
  if (isPendingBook(row)) return { primary: "待打书", tone: "pending", tags: unique(["待打书", isBeast ? "神兽" : ""]), advice: "技能未成型，先按待打书半成品处理。" };
  const forcedRole = row.name === "桃花精灵" ? "千速" : ["赤炎童子", "冥卫"].includes(row.name) ? "卡速" : "";
  if (forcedRole) return { primary: forcedRole, tone: "speed", tags: unique([forcedRole, isBeast ? "神兽" : ""]), advice: forcedRole === "千速" ? "优先比较速度、生存和速度资质。" : "优先比较速度、生存和抗性。" };

  const hasSword = text.includes("剑气四射");
  const hasSpecialMagic = ["涡轮火", "分水神剑", "雷利风行", "山崩地倾", "葫芦仙法"].some((skill) => text.includes(skill));
  const hasNormalMagic = text.includes("红莲业火");
  const hasMagic = hasSpecialMagic || hasNormalMagic || ["法术", "法连", "法爆", "灵蕴"].some((skill) => text.includes(skill));
  const hasStealth = text.includes("高级隐身");
  if (row.name === "沧海公主") return { primary: "特殊单攻", tone: "physical", tags: unique(["特殊单攻", isBeast ? "神兽" : ""]), advice: "比较攻击面板、核心输出技能和生存补强。" };
  if (row.name === "神兽青蛇" && hasMagic) return { primary: "普通法", tone: "magic", tags: ["普通法", "神兽"], advice: "比较法连、法暴、灵蕴、灵力和法资。" };
  if (hasStealth && row.speed < 1400) return { primary: "隐攻", tone: "physical", tags: unique(["隐攻", isBeast ? "神兽" : "", hasSword ? "剑气" : ""]), advice: "比较攻击、必杀、连击、偷袭和生存。" };

  const magicScore = (row.spirit >= 1200 ? 2 : 0) + (["法术", "法连", "法爆"].some((item) => text.includes(item)) ? 2 : 0) + (text.includes("灵蕴") ? 1 : 0) + (hasSpecialMagic || hasNormalMagic ? 2 : 0);
  const physicalScore = (row.attack >= 1800 ? 2 : 0) + ["高级必杀", "高级连击", "高级吸血", "高级偷袭"].filter((item) => text.includes(item)).length + (["高级强力", "高级攻坚"].some((item) => text.includes(item)) ? 1 : 0) + (hasSword ? 2 : 0);
  let primary = "待归类";
  let tone: PetAnalysis["tone"] = "";
  let advice = "结合队伍缺口再定用途。";
  if (row.speed >= 1400) { primary = "千速"; tone = "speed"; advice = "优先比较速度、生存和速度资质。"; }
  else if (row.speed >= 850 && row.attack < 1300 && row.spirit < 800) { primary = row.speed >= 1000 ? "千速" : "卡速"; tone = "speed"; advice = "优先比较抗性、血量和敏捷投入。"; }
  else if (magicScore >= physicalScore && magicScore >= 3) { primary = hasSpecialMagic ? "特殊法" : "普通群法"; tone = "magic"; advice = "比较法连、法暴、灵蕴、灵力和法资。"; }
  else if (physicalScore >= 3) { primary = hasSword ? "剑气" : "全力单攻"; tone = "physical"; advice = "比较攻击面板和输出技能完整度。"; }
  else if (hasNormalMagic || text.includes("高级敏捷")) { primary = row.speed >= 850 ? "卡速" : "普通群法"; tone = row.speed >= 850 ? "speed" : "magic"; }
  const tags = [primary];
  if (isBeast) tags.push("神兽");
  if (primary !== "千速" && row.speed >= 1000) tags.push("千速");
  if (primary !== "卡速" && row.speed >= 850 && row.speed < 1000) tags.push("卡速");
  if (primary !== "剑气" && hasSword) tags.push("剑气");
  return { primary, tone, tags: unique(tags), advice };
}

function stageFlags(row: PetView) {
  const base = beastBaseAptitudes[row.name];
  if (!base) return { ornament: false, advance1: false, advance2: false, skin: false, strengthen: false };
  const minDelta = Math.min(currentAptitude(row.attackApt) - base.attack, currentAptitude(row.defenseApt) - base.defense, currentAptitude(row.staminaApt) - base.stamina, currentAptitude(row.magicApt) - base.magic, currentAptitude(row.speedApt) - base.speed);
  return { ornament: row.name !== "神兽龙马", advance1: minDelta >= 50, advance2: minDelta >= 70, skin: false, strengthen: false };
}

function beastCost(row: PetView, config: BeastConfig, typeKey: PetView["beastType"]): BeastCostSummary | undefined {
  if (!typeKey) return undefined;
  const flags = stageFlags(row);
  const missing = config.costRules.filter((rule) => (!rule.appliesTo || typeKey === "horse") && !flags[rule.key as keyof typeof flags]).map((rule) => ({ ...rule, kind: "confirmed" as const }));
  const estimates = [] as BeastCostSummary["estimates"];
  const bookRule = config.estimateRules.find((rule) => rule.key === "book");
  const talismanRule = config.estimateRules.find((rule) => rule.key === "talisman");
  if (isPendingBook(row) && bookRule) estimates.push({ ...bookRule, eggCount: 0, kind: "estimate" });
  if (config.talismanMissingByFolder[row.accountId]?.includes(typeKey) && talismanRule) estimates.push({ ...talismanRule, eggCount: 0, kind: "estimate" });
  const totalWan = missing.reduce((sum, item) => sum + item.priceWan, 0);
  const estimatedWan = estimates.reduce((sum, item) => sum + item.priceWan, 0);
  return { missing, estimates, totalWan, estimatedWan, totalWithEstimate: totalWan + estimatedWan, eggCount: missing.reduce((sum, item) => sum + item.eggCount, 0) };
}

function baseView(pet: PetAsset): PetView {
  const view = {
    ...pet,
    hp: firstNumber(getStat(pet.panel, "气血")),
    attack: firstNumber(getStat(pet.panel, "攻击")),
    defense: firstNumber(getStat(pet.panel, "防御")),
    speed: firstNumber(getStat(pet.panel, "速度")),
    spirit: firstNumber(getStat(pet.panel, "灵力")),
    skillCount: pet.skills.filter(isCountedSkill).length,
    life: getStat(pet.aptitudes, "寿命"),
    attackApt: getStat(pet.aptitudes, "攻击资质"), defenseApt: getStat(pet.aptitudes, "防御资质"), staminaApt: getStat(pet.aptitudes, "体力资质"), magicApt: getStat(pet.aptitudes, "法力资质"), speedApt: getStat(pet.aptitudes, "速度资质"),
    role: {} as PetAnalysis,
    beastStage: "",
    searchText: "",
  } satisfies PetView;
  view.role = classify(view);
  const flags = stageFlags(view);
  view.beastStage = flags.advance2 ? "进阶2" : flags.advance1 ? "进阶1" : flags.ornament ? "有饰品" : "";
  return view;
}

export function buildPetViews(catalog: Catalog): PetView[] {
  const views = catalog.pets.map(baseView);
  const snakeCounts = new Map<string, number>();
  for (const row of views) {
    if (row.name === "神兽青蛇") {
      const count = (snakeCounts.get(row.accountId) || 0) + 1;
      snakeCounts.set(row.accountId, count);
      row.beastType = count === 1 ? "snake1" : count === 2 ? "snake2" : undefined;
    } else if (row.name === "神兽龙马") row.beastType = "horse";
    row.beastCost = beastCost(row, catalog.beastConfig, row.beastType);
    row.searchText = [row.accountId, row.name, row.meta, row.heart, row.role.primary, ...row.role.tags, ...row.skills, ...row.panel.flat(), ...row.aptitudes.flat()].filter(Boolean).join(" ").toLowerCase();
  }
  return views;
}

export function buildRecommendations(rows: PetView[]) {
  const usable = rows.filter((row) => row.role.primary !== "待打书");
  const top = (filter: (row: PetView) => boolean, metric: keyof PetView) => [...usable.filter(filter)].sort((a, b) => Number(b[metric]) - Number(a[metric]) || Number(b.talent || 0) - Number(a.talent || 0)).slice(0, 4);
  return [
    { key: "magic", title: "法系优先", metric: "灵力", rows: top((row) => ["特殊法", "普通群法", "普通法"].includes(row.role.primary), "spirit") },
    { key: "physical", title: "物理优先", metric: "攻击", rows: top((row) => ["剑气", "全力单攻", "特殊单攻", "隐攻"].includes(row.role.primary), "attack") },
    { key: "speed", title: "速度优先", metric: "速度", rows: top((row) => row.role.tags.some((tag) => ["卡速", "千速"].includes(tag)), "speed") },
    { key: "beast", title: "神兽优先", metric: "天资", rows: top((row) => row.role.tags.includes("神兽"), "talent") },
  ];
}

export const beastTotals = (rows: PetView[]) => rows.reduce((totals, row) => {
  if (!row.beastCost) return totals;
  totals.confirmedWan += row.beastCost.totalWan;
  totals.estimatedWan += row.beastCost.estimatedWan;
  totals.totalWan += row.beastCost.totalWithEstimate;
  totals.eggs += row.beastCost.eggCount;
  return totals;
}, { confirmedWan: 0, estimatedWan: 0, totalWan: 0, eggs: 0 });
