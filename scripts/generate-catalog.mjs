import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceFile = resolve(root, "src/data/source/catalog.json");
const equipmentSnapshotFile = resolve(root, "src/data/source/equipment-2026-07-13.json");
const catalogFile = resolve(root, "src/data/generated/catalog.json");
const reportFile = resolve(root, "src/data/generated/migration-report.json");
const checkOnly = process.argv.includes("--check");

const data = JSON.parse(readFileSync(sourceFile, "utf8"));
const equipmentSnapshot = JSON.parse(readFileSync(equipmentSnapshotFile, "utf8"));
for (const update of equipmentSnapshot.equipment) {
  const equipment = data.equipment.find((row) => row.id === update.id);
  if (!equipment) throw new Error(`装备快照引用未知装备：${update.id}`);
  const evidenceId = `${update.id}:${equipmentSnapshot.capturedAt}`;
  Object.assign(equipment.gem, update.gem);
  equipment.evidenceIds = [...new Set([...(equipment.evidenceIds ?? [equipment.evidenceId]), evidenceId])];
  equipment.evidenceId = evidenceId;
  data.evidence.push({
    id: evidenceId,
    accountId: equipment.accountId,
    kind: "equipment",
    capturedAt: equipmentSnapshot.capturedAt,
    sourcePath: update.sourcePath,
    file: update.file,
  });
}
const problems = [];
const assertUnique = (label, values) => {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) problems.push(`${label} 重复：${value}`);
    seen.add(value);
  }
};

assertUnique("账号 ID", data.accounts.map((row) => row.id));
assertUnique("宠物 ID", data.pets.map((row) => row.id));
assertUnique("账号内宠物来源记录", data.pets.map((row) => `${row.accountId}:${row.sourceRecordId}`));
assertUnique("装备 ID", data.equipment.map((row) => row.id));
assertUnique("证据 ID", data.evidence.map((row) => row.id));
assertUnique("技能", data.skills.map((row) => `${row.type}:${row.name}`));
assertUnique("神兽类型", data.beastConfig.typeDefs.map((row) => row.key));
assertUnique("神兽成本规则", data.beastConfig.costRules.map((row) => row.key));
assertUnique("神兽估算规则", data.beastConfig.estimateRules.map((row) => row.key));
assertUnique("神兽任务动作", data.beastConfig.taskActionOrder.map((row) => row.key));
for (const beastType of ["snake1", "snake2", "horse"]) {
  if (!data.beastConfig.typeDefs.some((row) => row.key === beastType)) problems.push(`缺少神兽类型定义：${beastType}`);
}

const evidenceById = new Map(data.evidence.map((row) => [row.id, row]));
for (const pet of data.pets) {
  for (const evidenceId of pet.evidenceIds) {
    const evidence = evidenceById.get(evidenceId);
    if (!evidence || evidence.kind !== "pet" || evidence.accountId !== pet.accountId) problems.push(`宠物 ${pet.id} 的证据无效：${evidenceId}`);
  }
}
for (const equipment of data.equipment) {
  for (const evidenceId of equipment.evidenceIds ?? [equipment.evidenceId]) {
    const evidence = evidenceById.get(evidenceId);
    if (!evidence || evidence.kind !== "equipment" || evidence.accountId !== equipment.accountId) problems.push(`装备 ${equipment.id} 的证据无效：${evidenceId}`);
  }
  if (equipment.evidenceIds && equipment.evidenceId !== equipment.evidenceIds.at(-1)) problems.push(`装备 ${equipment.id} 的最新证据指针未指向证据列表末项`);
}
for (const snapshot of data.gemMarketSnapshots) {
  if (!data.evidence.some((row) => row.kind === "market" && row.sourcePath === snapshot.sourceImage)) problems.push(`行情截图没有证据记录：${snapshot.sourceImage}`);
}

for (const account of data.accounts) {
  for (const beastType of ["snake1", "snake2", "horse"]) {
    const matches = data.pets.filter((row) => row.accountId === account.id && row.beastType === beastType);
    const expectedName = beastType === "horse" ? "神兽龙马" : "神兽青蛇";
    if (matches.length !== 1 || matches[0]?.name !== expectedName) problems.push(`${account.id} 的 ${beastType} 身份不完整或物种不符`);
  }
}
const accountIds = new Set(data.accounts.map((row) => row.id));
for (const [accountId, beastTypes] of Object.entries(data.beastConfig.talismanMissingByFolder)) {
  if (!accountIds.has(accountId)) problems.push(`法宝缺口引用未知账号：${accountId}`);
  for (const beastType of beastTypes) {
    if (!["snake1", "snake2", "horse"].includes(beastType)) problems.push(`${accountId} 的法宝缺口引用未知神兽类型：${beastType}`);
  }
}

const sourceKeys = new Set([
  ...data.beastConfig.costRules.map((row) => row.key),
  ...data.beastConfig.estimateRules.map((row) => row.key),
  "innerDan",
]);
for (const action of data.beastConfig.taskActionOrder) {
  if (!sourceKeys.has(action.sourceKey)) problems.push(`任务动作引用未知来源：${action.sourceKey}`);
}

const runtimePaths = new Set([
  ...data.evidence.map((row) => row.sourcePath),
  ...data.gemMarketSnapshots.map((row) => row.sourceImage),
  ...data.skills.map((row) => row.icon),
]);
for (const relativePath of runtimePaths) {
  const normalized = relativePath.replace(/^\.\//, "");
  if (!existsSync(resolve(root, normalized))) problems.push(`运行时资源不存在：${relativePath}`);
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

const report = {
  accounts: data.accounts.length,
  pets: data.pets.length,
  petEvidence: data.evidence.filter((row) => row.kind === "pet").length,
  uniquePetNames: new Set(data.pets.map((row) => row.name)).size,
  equipment: data.equipment.length,
  skills: data.skills.length,
  skillTypes: Object.fromEntries([...new Set(data.skills.map((row) => row.type))].sort().map((type) => [type, data.skills.filter((row) => row.type === type).length])),
  evidence: data.evidence.length,
  gemMarketItems: data.gemMarketSnapshots.at(-1)?.items.length ?? 0,
};

const serializedCatalog = `${JSON.stringify(data, null, 2)}\n`;
const serializedReport = `${JSON.stringify(report, null, 2)}\n`;
if (checkOnly) {
  if (!existsSync(catalogFile) || readFileSync(catalogFile, "utf8") !== serializedCatalog) problems.push("generated/catalog.json 已过期，请运行 npm run data:generate");
  if (!existsSync(reportFile) || readFileSync(reportFile, "utf8") !== serializedReport) problems.push("generated/migration-report.json 已过期，请运行 npm run data:generate");
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log("Catalog 生成物与来源一致，关系和资源路径有效。");
} else {
  mkdirSync(dirname(catalogFile), { recursive: true });
  writeFileSync(catalogFile, serializedCatalog);
  writeFileSync(reportFile, serializedReport);
  console.log(`已生成 ${data.pets.length} 个宠物、${data.equipment.length} 件装备、${data.skills.length} 个技能。`);
}
