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
    costRules: z.array(z.object({ key: z.string(), label: z.string(), priceWan: z.number(), eggCount: z.number(), appliesTo: z.literal("horse").optional() })),
    typeDefs: z.array(z.object({ key: z.enum(["snake1", "snake2", "horse"]), label: z.string(), pet: z.string() })),
    estimateRules: z.array(z.object({ key: z.string(), label: z.string(), priceWan: z.number() })),
    talismanMissingByFolder: z.record(z.string(), z.array(z.string())),
    innerShardRequirement: z.number(),
    taskDefaultSettings: z.object({
      startDate: z.string(), thisWeekEggs: z.number(), weeklyEggs: z.number(), thisWeekInnerShards: z.number(), weeklyInnerShards: z.number(), eggPriceWan: z.number(),
    }),
    taskDefaultResources: z.record(accountId, z.object({ silverWan: z.number(), eggCount: z.number(), innerShardCount: z.number() })),
    taskActionOrder: z.array(z.object({ key: z.string(), label: z.string(), kind: z.string(), sourceKey: z.string(), resourceType: z.literal("innerShard").optional() })),
  }),
});
