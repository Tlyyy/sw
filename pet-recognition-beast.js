// Beast cost and scheduling rules. Rendering stays in pet-recognition.html.
var beastEggPriceWan = 5.5;
var beastCostRules = [
  { key: "ornament", label: "饰品", priceWan: 20, eggCount: 0 },
  { key: "advance1", label: "进阶1", priceWan: 30 * beastEggPriceWan, eggCount: 30 },
  { key: "advance2", label: "进阶2", priceWan: 30 * beastEggPriceWan, eggCount: 30 },
  { key: "skin", label: "皮肤", priceWan: 40 * beastEggPriceWan, eggCount: 40 },
  { key: "strengthen", label: "马强化", priceWan: 80 * beastEggPriceWan, eggCount: 80, appliesTo: "horse" },
];
var beastCostFolderOrder = ["FC", "LG1", "PT", "LG2", "MYT"];
var beastCostTypeDefs = [
  { key: "snake1", label: "1蛇", pet: "神兽青蛇" },
  { key: "snake2", label: "2蛇", pet: "神兽青蛇" },
  { key: "horse", label: "马", pet: "神兽龙马" },
];
var beastBookEstimateWan = 200;
var beastTalismanEstimateWan = 150;
var beastInnerShardRequirement = 50;
var beastTalismanMissingByFolder = {
  PT: ["snake1"],
  MYT: ["snake2", "horse"],
};
var beastEstimateRules = [
  { key: "book", label: "打书预估", priceWan: beastBookEstimateWan },
  { key: "talisman", label: "洗护符预估", priceWan: beastTalismanEstimateWan },
];
var beastTaskStorageKey = "petRecognition.beastTasks.v1";
var beastTaskDefaultSettings = {
  startDate: "2026-07-02",
  thisWeekEggs: 2.5,
  weeklyEggs: 16,
  thisWeekInnerShards: 0,
  weeklyInnerShards: 2,
  eggPriceWan: beastEggPriceWan,
};
var beastTaskDefaultResources = {
  FC: { silverWan: 148, eggCount: 4, innerShardCount: 26 },
  LG1: { silverWan: 102, eggCount: 6, innerShardCount: 17 },
  PT: { silverWan: 41, eggCount: 3, innerShardCount: 14 },
  LG2: { silverWan: 30, eggCount: 14, innerShardCount: 15 },
  MYT: { silverWan: 3, eggCount: 15, innerShardCount: 14 },
};
var beastTaskTypeOrder = { snake1: 1, snake2: 2, horse: 3 };
var beastTaskActionOrder = [
  { key: "talisman", label: "洗护符", kind: "预估", sourceKey: "talisman" },
  { key: "innerDan", label: "幻神兽内丹", kind: "前置", sourceKey: "innerDan", resourceType: "innerShard" },
  { key: "book", label: "打书", kind: "预估", sourceKey: "book" },
  { key: "ornament", label: "饰品", kind: "确认", sourceKey: "ornament" },
  { key: "advance1", label: "进阶1", kind: "确认", sourceKey: "advance1" },
  { key: "advance2", label: "进阶2", kind: "确认", sourceKey: "advance2" },
  { key: "skin", label: "皮肤", kind: "确认", sourceKey: "skin" },
  { key: "strengthen", label: "马强化", kind: "确认", sourceKey: "strengthen" },
];

function formatWan(value) {
  const rounded = Math.round(Number(value || 0) * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}万`;
}

function beastRuleDetail(rule) {
  return rule.eggCount ? `${rule.label} ${rule.eggCount}蛋/${formatWan(rule.priceWan)}` : `${rule.label} ${formatWan(rule.priceWan)}`;
}

function beastRuleApplies(row, rule) {
  if (rule.appliesTo === "horse") return row.cleanName === "神兽龙马";
  return true;
}

function beastMissingRules(row) {
  if (!beastBaseAptitudes[row.cleanName]) return [];
  const flags = row.beastStages || beastStageFlags(row);
  return beastCostRules.filter((rule) => beastRuleApplies(row, rule) && !flags[rule.key]);
}

function beastOwnedLabels(row) {
  if (!beastBaseAptitudes[row.cleanName]) return [];
  const flags = row.beastStages || {};
  return beastCostRules.filter((rule) => beastRuleApplies(row, rule) && flags[rule.key]).map((rule) => rule.label);
}

function beastCostSummary(row) {
  if (!beastBaseAptitudes[row.cleanName]) return null;
  const missing = beastMissingRules(row);
  const totalWan = missing.reduce((sum, rule) => sum + rule.priceWan, 0);
  return {
    missing,
    totalWan,
    eggCount: missing.reduce((sum, rule) => sum + rule.eggCount, 0),
    detail: missing.map(beastRuleDetail).join("；") || "已齐",
    estimates: [],
    estimatedWan: 0,
    estimateDetail: "-",
    totalWithEstimate: totalWan,
  };
}

function beastTalismanMissing(row, typeKey) {
  return Boolean(beastTalismanMissingByFolder[row.datasetKey]?.includes(typeKey));
}

function beastEstimateItems(row, typeKey) {
  const items = [];
  if (isPendingBookRow(row)) {
    items.push({ ...beastEstimateRules.find((rule) => rule.key === "book"), reason: "待打书" });
  }
  if (beastTalismanMissing(row, typeKey)) {
    items.push({ ...beastEstimateRules.find((rule) => rule.key === "talisman"), reason: "护符缺" });
  }
  return items.filter(Boolean);
}

function applyBeastCostEstimates(row, typeKey) {
  if (!row.beastCost) return row;
  const estimates = beastEstimateItems(row, typeKey);
  const estimatedWan = estimates.reduce((sum, rule) => sum + rule.priceWan, 0);
  row.beastCost = {
    ...row.beastCost,
    estimates,
    estimatedWan,
    estimateDetail: estimates.map((rule) => `${rule.label} ${formatWan(rule.priceWan)}`).join("；") || "-",
    totalWithEstimate: row.beastCost.totalWan + estimatedWan,
  };
  return row;
}

function numericOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function defaultBeastTaskState() {
  return {
    settings: { ...beastTaskDefaultSettings },
    resources: JSON.parse(JSON.stringify(beastTaskDefaultResources)),
    overrides: {},
  };
}

function loadBeastTaskState() {
  const defaults = defaultBeastTaskState();
  try {
    const stored = JSON.parse(localStorage.getItem(beastTaskStorageKey) || "{}");
    return {
      settings: { ...defaults.settings, ...(stored.settings || {}) },
      resources: Object.fromEntries(
        beastCostFolderOrder.map((folderKey) => [
          folderKey,
          { ...defaults.resources[folderKey], ...(stored.resources?.[folderKey] || {}) },
        ])
      ),
      overrides: stored.overrides || {},
    };
  } catch {
    return defaults;
  }
}

function saveBeastTaskState(state) {
  localStorage.setItem(beastTaskStorageKey, JSON.stringify(state));
}

function updateBeastTaskState(mutator) {
  const state = loadBeastTaskState();
  mutator(state);
  saveBeastTaskState(state);
}

function resetBeastTaskState() {
  localStorage.removeItem(beastTaskStorageKey);
}

function taskDateKey(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseTaskDate(dateKey) {
  const [year, month, day] = String(dateKey || beastTaskDefaultSettings.startDate).split("-").map(Number);
  return new Date(Date.UTC(year || 2026, (month || 1) - 1, day || 1));
}

function taskWeekEnd(date) {
  const day = date.getUTCDay();
  const daysToSunday = (7 - day) % 7;
  return new Date(date.getTime() + daysToSunday * 86400000);
}

function taskFinishDate(targetWan, availableWan, settings) {
  const startDate = parseTaskDate(settings.startDate);
  if (targetWan <= availableWan + 0.0001) return taskDateKey(startDate);
  const weekEnd = taskWeekEnd(startDate);
  const thisWeekWan = numericOrDefault(settings.thisWeekEggs, 0) * numericOrDefault(settings.eggPriceWan, beastEggPriceWan);
  if (targetWan <= availableWan + thisWeekWan + 0.0001) return taskDateKey(weekEnd);
  const weeklyWan = Math.max(0.0001, numericOrDefault(settings.weeklyEggs, 0) * numericOrDefault(settings.eggPriceWan, beastEggPriceWan));
  const weeks = Math.ceil((targetWan - availableWan - thisWeekWan - 0.0001) / weeklyWan);
  return taskDateKey(new Date(weekEnd.getTime() + weeks * 7 * 86400000));
}

function taskShardFinishDate(targetShards, availableShards, settings) {
  const startDate = parseTaskDate(settings.startDate);
  if (targetShards <= availableShards + 0.0001) return taskDateKey(startDate);
  const weekEnd = taskWeekEnd(startDate);
  const thisWeekShards = Math.max(0, numericOrDefault(settings.thisWeekInnerShards, 0));
  if (targetShards <= availableShards + thisWeekShards + 0.0001) return taskDateKey(weekEnd);
  const weeklyShards = Math.max(0, numericOrDefault(settings.weeklyInnerShards, 0));
  if (!weeklyShards) return "待补锁片";
  const weeks = Math.ceil((targetShards - availableShards - thisWeekShards - 0.0001) / weeklyShards);
  return taskDateKey(new Date(weekEnd.getTime() + weeks * 7 * 86400000));
}

function taskMaxDateKey(firstDate, secondDate) {
  if (!firstDate || firstDate === "已完成") return secondDate;
  if (!secondDate || secondDate === "已完成") return firstDate;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(firstDate)) return firstDate;
  if (!datePattern.test(secondDate)) return secondDate;
  return firstDate > secondDate ? firstDate : secondDate;
}

function taskId(row, typeKey, actionKey) {
  return `${row.datasetKey}:${typeKey}:${actionKey}`;
}

function taskTypeLabel(typeKey) {
  return beastCostTypeDefs.find((item) => item.key === typeKey)?.label || typeKey;
}

function defaultTaskPrice(row, typeKey, action, settings) {
  const eggPrice = numericOrDefault(settings.eggPriceWan, beastEggPriceWan);
  if (action.key === "talisman") return beastTalismanMissing(row, typeKey) ? beastTalismanEstimateWan : 0;
  if (action.key === "book") return isPendingBookRow(row) ? beastBookEstimateWan : 0;
  if (action.key === "strengthen") return typeKey === "horse" ? 80 * eggPrice : 0;
  const missingRule = row.beastCost?.missing.find((rule) => rule.key === action.sourceKey);
  if (!missingRule) return 0;
  return missingRule.eggCount ? missingRule.eggCount * eggPrice : missingRule.priceWan;
}

function beastInnerDanNeeded(row, typeKey) {
  const skillCount = Number(row.skillCount);
  return typeKey === "horse" && isPendingBookRow(row) && (!Number.isFinite(skillCount) || skillCount <= 4);
}

function defaultTaskShardCount(row, typeKey, action) {
  if (action.key !== "innerDan") return 0;
  return beastInnerDanNeeded(row, typeKey) ? beastInnerShardRequirement : 0;
}

function buildBeastTaskRows(typedRows, state) {
  const settings = state.settings;
  return [...typedRows]
    .sort((a, b) => beastCostFolderOrder.indexOf(a.row.datasetKey) - beastCostFolderOrder.indexOf(b.row.datasetKey) || beastTaskTypeOrder[a.typeKey] - beastTaskTypeOrder[b.typeKey])
    .flatMap(({ row, typeKey }) =>
      beastTaskActionOrder
        .map((action) => {
          const basePriceWan = defaultTaskPrice(row, typeKey, action, settings);
          const baseShardCount = defaultTaskShardCount(row, typeKey, action);
          if (!basePriceWan && !baseShardCount) return null;
          const id = taskId(row, typeKey, action.key);
          const override = state.overrides[id] || {};
          const resourceType = action.resourceType || "wan";
          const priceWan = resourceType === "innerShard" ? 0 : Math.max(0, numericOrDefault(override.priceWan, basePriceWan));
          const shardCount = resourceType === "innerShard" ? baseShardCount : 0;
          const done = Boolean(override.done);
          return {
            id,
            row,
            typeKey,
            action,
            resourceType,
            basePriceWan,
            baseShardCount,
            priceWan,
            shardCount,
            done,
            remainingWan: done ? 0 : priceWan,
            remainingShardCount: done ? 0 : shardCount,
          };
        })
        .filter(Boolean)
    );
}

function buildBeastTaskAccountPlans(typedRows, state) {
  const taskRows = buildBeastTaskRows(typedRows, state);
  return beastCostFolderOrder
    .map((folderKey) => {
      const resource = state.resources[folderKey] || beastTaskDefaultResources[folderKey];
      const availableWan = numericOrDefault(resource.silverWan, 0) + numericOrDefault(resource.eggCount, 0) * numericOrDefault(state.settings.eggPriceWan, beastEggPriceWan);
      const availableShards = numericOrDefault(resource.innerShardCount, 0);
      let cumulativeWan = 0;
      let cumulativeShards = 0;
      let finishDate = taskDateKey(parseTaskDate(state.settings.startDate));
      let dependencyDate = finishDate;
      const tasks = taskRows
        .filter((task) => task.row.datasetKey === folderKey)
        .map((task) => {
          let resourceDueDate = finishDate;
          if (task.resourceType === "innerShard") {
            cumulativeShards += task.remainingShardCount;
            resourceDueDate = taskShardFinishDate(cumulativeShards, availableShards, state.settings);
          } else {
            cumulativeWan += task.remainingWan;
            resourceDueDate = taskFinishDate(cumulativeWan, availableWan, state.settings);
          }
          const dueDate = task.done ? "已完成" : taskMaxDateKey(resourceDueDate, dependencyDate);
          if (!task.done) {
            dependencyDate = taskMaxDateKey(dependencyDate, dueDate);
            finishDate = taskMaxDateKey(finishDate, dueDate);
          }
          return { ...task, cumulativeWan, cumulativeShards, dueDate };
        });
      const remainingWan = tasks.reduce((sum, task) => sum + task.remainingWan, 0);
      const remainingShardCount = tasks.reduce((sum, task) => sum + task.remainingShardCount, 0);
      return {
        folderKey,
        resource,
        availableWan,
        availableShards,
        tasks,
        remainingWan,
        remainingShardCount,
        missingShardCount: Math.max(0, remainingShardCount - availableShards),
        finishDate,
      };
    })
    .filter((plan) => plan.tasks.length);
}
