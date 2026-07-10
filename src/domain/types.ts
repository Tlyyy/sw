export const accountIds = ["FC", "LG1", "PT", "LG2", "MYT"] as const;
export type AccountId = (typeof accountIds)[number];
export type AccountScope = AccountId | "ALL";
export type StatValue = [string, string];

export interface Account {
  id: AccountId;
  label: string;
}

export interface EvidenceSource {
  id: string;
  accountId: AccountId | "PUBLIC";
  kind: "pet" | "equipment" | "market";
  capturedAt: string;
  sourcePath: string;
  file: string;
}

export interface PetAsset {
  id: string;
  sourceRecordId: string;
  accountId: AccountId;
  name: string;
  level?: number;
  meta: string;
  talent?: number;
  bloodline?: string;
  heart?: string;
  panel: StatValue[];
  points: StatValue[];
  aptitudes: StatValue[];
  growth: StatValue[];
  skills: string[];
  evidenceIds: string[];
  recognitionStatus: "confirmed" | "pending";
}

export interface GemProgressState {
  name: string;
  level: string;
  effect: string;
  progress?: { current?: number; required?: number; next?: string; gain?: string };
}

export interface EquipmentAsset {
  id: string;
  accountId: AccountId;
  slot: string;
  name: string;
  type: string;
  attributes: string[];
  effects: string[];
  durability?: number;
  gem: GemProgressState;
  evidenceId: string;
}

export interface SkillDefinition {
  name: string;
  type: "兽决" | "御兽" | "强化技能";
  certainty: string;
  icon: string;
  note: string;
}

export interface GemUpgradeStep { from: string; to: string; cost: number; total: number }
export interface GemMarketItem { name: string; price: number }
export interface GemMarketSnapshot {
  sourceDate: string;
  sourceType: string;
  currency: string;
  unit: string;
  sourceImage: string;
  items: GemMarketItem[];
}

export type GemPriceHistorySource = "screenshot" | "manual";
export interface GemPriceHistoryEntry {
  id: string;
  capturedAt: string;
  source: GemPriceHistorySource;
  items: GemMarketItem[];
}

export interface BeastCostRule {
  key: string;
  label: string;
  priceWan: number;
  eggCount: number;
  appliesTo?: "horse";
}
export interface BeastTypeDef { key: "snake1" | "snake2" | "horse"; label: string; pet: string }
export interface BeastTaskAction {
  key: string;
  label: string;
  kind: string;
  sourceKey: string;
  resourceType?: "innerShard";
}
export interface BeastTaskSettings {
  startDate: string;
  thisWeekEggs: number;
  weeklyEggs: number;
  thisWeekInnerShards: number;
  weeklyInnerShards: number;
  eggPriceWan: number;
}
export interface BeastResource { silverWan: number; eggCount: number; innerShardCount: number }
export interface BeastConfig {
  eggPriceWan: number;
  costRules: BeastCostRule[];
  typeDefs: BeastTypeDef[];
  estimateRules: Array<{ key: string; label: string; priceWan: number }>;
  talismanMissingByFolder: Partial<Record<AccountId, string[]>>;
  innerShardRequirement: number;
  taskDefaultSettings: BeastTaskSettings;
  taskDefaultResources: Record<AccountId, BeastResource>;
  taskActionOrder: BeastTaskAction[];
}

export interface Catalog {
  version: number;
  generatedAt: string;
  accounts: Account[];
  pets: PetAsset[];
  equipment: EquipmentAsset[];
  skills: SkillDefinition[];
  evidence: EvidenceSource[];
  gemUpgradeSteps: GemUpgradeStep[];
  gemMarketSnapshots: GemMarketSnapshot[];
  beastConfig: BeastConfig;
}

export interface PetAnalysis {
  primary: string;
  tone: "magic" | "physical" | "speed" | "pending" | "";
  tags: string[];
  advice: string;
}

export interface BeastGapItem extends BeastCostRule { kind: "confirmed" | "estimate" }
export interface BeastCostSummary {
  missing: BeastGapItem[];
  estimates: BeastGapItem[];
  totalWan: number;
  estimatedWan: number;
  totalWithEstimate: number;
  eggCount: number;
}

export interface PetView extends PetAsset {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  spirit: number;
  skillCount: number;
  life: string;
  attackApt: string;
  defenseApt: string;
  staminaApt: string;
  magicApt: string;
  speedApt: string;
  role: PetAnalysis;
  beastStage: string;
  beastType?: "snake1" | "snake2" | "horse";
  beastCost?: BeastCostSummary;
  searchText: string;
}

export interface AccountPlan {
  accountId: AccountId;
  gemRequiredSilver: number;
  beastRequiredSilver: number;
  beastTaskSilver: number;
  beastAvailableSilver: number;
  missingShardCount: number;
  taskCount: number;
  totalSilver: number;
  finishWeek: number;
  finishDate: string;
}
