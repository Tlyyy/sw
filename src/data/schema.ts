import { z } from "zod";

const accountId = z.enum(["FC", "LG1", "PT", "LG2", "MYT"]);
const statRows = z.array(z.tuple([z.string(), z.string()]));

export const catalogSchema = z.object({
  version: z.number(),
  generatedAt: z.string(),
  accounts: z.array(z.object({ id: accountId, label: z.string() })).length(5),
  pets: z.array(z.object({
    id: z.string(),
    sourceRecordId: z.string(),
    accountId,
    name: z.string(),
    beastType: z.enum(["snake1", "snake2", "horse"]).optional(),
    beastProgress: z.object({
      ornament: z.boolean().optional(),
      advance1: z.boolean().optional(),
      advance2: z.boolean().optional(),
      skin: z.boolean().optional(),
      strengthen: z.boolean().optional(),
    }).optional(),
    level: z.number().optional(),
    meta: z.string(),
    talent: z.number().optional(),
    bloodline: z.string().optional(),
    heart: z.string().optional(),
    panel: statRows,
    points: statRows,
    aptitudes: statRows,
    growth: statRows,
    skills: z.array(z.string()),
    evidenceIds: z.array(z.string()).min(1),
    recognitionStatus: z.enum(["confirmed", "pending"]),
  })),
  equipment: z.array(z.object({
    id: z.string(),
    accountId,
    slot: z.string(),
    name: z.string(),
    type: z.string(),
    attributes: z.array(z.string()),
    effects: z.array(z.string()),
    durability: z.number().optional(),
    gem: z.object({
      name: z.string(), level: z.string(), effect: z.string(),
      progress: z.object({
        current: z.number().optional(), required: z.number().optional(), next: z.string().optional(), gain: z.string().optional(),
      }).optional(),
    }),
    evidenceIds: z.array(z.string()).min(1).optional(),
    evidenceId: z.string(),
  })),
  skills: z.array(z.object({
    name: z.string(), type: z.enum(["兽决", "御兽", "强化技能"]), certainty: z.string(), icon: z.string(), note: z.string(),
  })),
  evidence: z.array(z.object({
    id: z.string(), accountId: z.union([accountId, z.literal("PUBLIC")]), kind: z.enum(["pet", "equipment", "market"]),
    capturedAt: z.string(), sourcePath: z.string(), file: z.string(),
  })),
  gemUpgradeSteps: z.array(z.object({ from: z.string(), to: z.string(), cost: z.number(), total: z.number() })),
  gemMarketSnapshots: z.array(z.object({
    sourceDate: z.string(), sourceType: z.string(), currency: z.string(), unit: z.string(), sourceImage: z.string(),
    items: z.array(z.object({ name: z.string(), price: z.number() })),
  })),
  beastConfig: z.object({
    eggPriceWan: z.number(),
    eggSellPriceWan: z.number(),
    costRules: z.array(z.object({ key: z.string(), label: z.string(), priceWan: z.number(), eggCount: z.number(), appliesTo: z.literal("horse").optional() })),
    typeDefs: z.array(z.object({ key: z.enum(["snake1", "snake2", "horse"]), label: z.string(), pet: z.string() })),
    estimateRules: z.array(z.object({ key: z.string(), label: z.string(), priceWan: z.number() })),
    talismanMissingByFolder: z.record(z.string(), z.array(z.string())),
    innerShardRequirement: z.number(),
    taskDefaultSettings: z.object({
      startDate: z.string(), thisWeekEggs: z.number(), weeklyEggs: z.number(), weeklyDedicatedEggs: z.number(), weeklyRegularEggs: z.number(), weeklySilverWan: z.number(), thisWeekInnerShards: z.number(), weeklyInnerShards: z.number(), eggPriceWan: z.number(),
    }),
    taskDefaultResources: z.record(accountId, z.object({ silverWan: z.number(), eggCount: z.number(), innerShardCount: z.number() })),
    taskActionOrder: z.array(z.object({ key: z.string(), label: z.string(), kind: z.string(), sourceKey: z.string(), resourceType: z.literal("innerShard").optional() })),
  }),
}).superRefine((data, context) => {
  const duplicate = (values: string[]) => values.find((value, index) => values.indexOf(value) !== index);
  const addDuplicateIssue = (label: string, values: string[]) => {
    const value = duplicate(values);
    if (value) context.addIssue({ code: z.ZodIssueCode.custom, message: `${label} 重复：${value}` });
  };

  addDuplicateIssue("账号 ID", data.accounts.map((row) => row.id));
  addDuplicateIssue("宠物 ID", data.pets.map((row) => row.id));
  addDuplicateIssue("账号内宠物来源记录", data.pets.map((row) => `${row.accountId}:${row.sourceRecordId}`));
  addDuplicateIssue("装备 ID", data.equipment.map((row) => row.id));
  addDuplicateIssue("证据 ID", data.evidence.map((row) => row.id));
  addDuplicateIssue("技能", data.skills.map((row) => `${row.type}:${row.name}`));
  addDuplicateIssue("神兽类型", data.beastConfig.typeDefs.map((row) => row.key));
  addDuplicateIssue("神兽成本规则", data.beastConfig.costRules.map((row) => row.key));
  addDuplicateIssue("神兽估算规则", data.beastConfig.estimateRules.map((row) => row.key));
  addDuplicateIssue("神兽任务动作", data.beastConfig.taskActionOrder.map((row) => row.key));
  for (const beastType of ["snake1", "snake2", "horse"] as const) {
    if (!data.beastConfig.typeDefs.some((row) => row.key === beastType)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `缺少神兽类型定义：${beastType}` });
    }
  }

  const evidenceById = new Map(data.evidence.map((row) => [row.id, row]));
  for (const pet of data.pets) {
    if (pet.beastProgress && !pet.beastType) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `普通宠物 ${pet.id} 不能记录神兽养成进度` });
    }
    if (pet.beastProgress?.strengthen !== undefined && pet.beastType !== "horse") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `非小马神兽 ${pet.id} 不能记录马强化进度` });
    }
    for (const evidenceId of pet.evidenceIds) {
      const evidence = evidenceById.get(evidenceId);
      if (!evidence || evidence.kind !== "pet" || evidence.accountId !== pet.accountId) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `宠物 ${pet.id} 引用了无效证据 ${evidenceId}` });
      }
    }
  }
  for (const equipment of data.equipment) {
    for (const evidenceId of equipment.evidenceIds ?? [equipment.evidenceId]) {
      const evidence = evidenceById.get(evidenceId);
      if (!evidence || evidence.kind !== "equipment" || evidence.accountId !== equipment.accountId) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `装备 ${equipment.id} 引用了无效证据 ${evidenceId}` });
      }
    }
    if (equipment.evidenceIds && equipment.evidenceId !== equipment.evidenceIds.at(-1)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `装备 ${equipment.id} 的最新证据指针未指向证据列表末项` });
    }
  }
  for (const snapshot of data.gemMarketSnapshots) {
    if (!data.evidence.some((row) => row.kind === "market" && row.sourcePath === snapshot.sourceImage)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `行情截图没有证据记录：${snapshot.sourceImage}` });
    }
  }

  const accountSet = new Set(data.accounts.map((row) => row.id));
  for (const accountIdValue of data.accounts.map((row) => row.id)) {
    const beasts = data.pets.filter((row) => row.accountId === accountIdValue && row.beastType);
    for (const beastType of ["snake1", "snake2", "horse"] as const) {
      const matching = beasts.filter((row) => row.beastType === beastType);
      const expectedName = beastType === "horse" ? "神兽龙马" : "神兽青蛇";
      if (matching.length !== 1 || matching[0]?.name !== expectedName) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `${accountIdValue} 的 ${beastType} 身份不完整或物种不符` });
      }
    }
  }
  for (const accountIdValue of Object.keys(data.beastConfig.talismanMissingByFolder)) {
    if (!accountSet.has(accountIdValue as typeof data.accounts[number]["id"])) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `法宝缺口引用未知账号：${accountIdValue}` });
    }
  }
  for (const [accountIdValue, beastTypes] of Object.entries(data.beastConfig.talismanMissingByFolder)) {
    for (const beastType of beastTypes) {
      if (!["snake1", "snake2", "horse"].includes(beastType)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `${accountIdValue} 的法宝缺口引用未知神兽类型：${beastType}` });
      }
    }
  }

  const sourceKeys = new Set([
    ...data.beastConfig.costRules.map((row) => row.key),
    ...data.beastConfig.estimateRules.map((row) => row.key),
    "innerDan",
  ]);
  for (const action of data.beastConfig.taskActionOrder) {
    if (!sourceKeys.has(action.sourceKey)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `任务动作引用未知来源：${action.sourceKey}` });
    }
  }
});
