// Derived gem progress calculations. Depends on data/gem-levels.js and data/gem-market.raw.js.
(function () {
  const upgradeTable = window.gemUpgradeSteps || [];
  const marketSnapshots = window.gemMarketSnapshots || [];
  const marketStorageKey = "sw.gemMarketPriceOverrides.v1";
  const defaultTargetLevel = "13";
  const defaultWeeklyIncome = 880000;

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("zh-CN");
  }

  function trimFixed(value, digits) {
    return Number(value || 0).toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  }

  function formatCurrency(value) {
    const amount = Number(value || 0);
    if (amount >= 100000000) return `${trimFixed(amount / 100000000, 2)}亿银币`;
    if (amount >= 10000) return `${trimFixed(amount / 10000, 1)}万银币`;
    return `${formatNumber(amount)}银币`;
  }

  function formatDurationWeeks(weeks) {
    const wholeWeeks = Math.max(0, Math.ceil(Number(weeks || 0)));
    const months = wholeWeeks / 4.345;
    if (wholeWeeks <= 0) return "本周后已够";
    if (wholeWeeks < 8) return `${wholeWeeks}周`;
    return `${wholeWeeks}周（约${trimFixed(months, 1)}个月）`;
  }

  function latestMarketSnapshot() {
    return marketSnapshots.at(-1) || null;
  }

  function rawMarketItems() {
    return latestMarketSnapshot()?.items || [];
  }

  function readMarketPriceOverrides() {
    try {
      const raw = window.localStorage?.getItem(marketStorageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return Object.fromEntries(
        Object.entries(parsed)
          .map(([name, price]) => [name, Number(price)])
          .filter(([, price]) => Number.isFinite(price) && price >= 0)
      );
    } catch {
      return {};
    }
  }

  function writeMarketPriceOverrides(overrides) {
    try {
      const entries = Object.entries(overrides).filter(([, price]) => Number.isFinite(Number(price)) && Number(price) >= 0);
      if (!entries.length) {
        window.localStorage?.removeItem(marketStorageKey);
        return;
      }
      window.localStorage?.setItem(marketStorageKey, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      // Local storage can be unavailable in private contexts; calculations still use base prices.
    }
  }

  function marketItems() {
    const overrides = readMarketPriceOverrides();
    return rawMarketItems().map((item) => {
      const overridePrice = Number(overrides[item.name]);
      const hasOverride = Number.isFinite(overridePrice) && overridePrice >= 0;
      return {
        ...item,
        basePrice: item.price,
        price: hasOverride ? overridePrice : item.price,
        priceEdited: hasOverride && overridePrice !== Number(item.price),
      };
    });
  }

  function gemMarketItem(gemName) {
    return marketItems().find((item) => item.name === gemName) || null;
  }

  function gemUnitPrice(gemName) {
    return Number(gemMarketItem(gemName)?.price || 0);
  }

  function gemUnitLabel() {
    const snapshot = latestMarketSnapshot();
    return snapshot ? `${snapshot.currency}/${snapshot.unit}` : "银币/颗";
  }

  function updateGemPrice(gemName, price) {
    const normalized = Math.max(0, Math.round(Number(price) || 0));
    const baseItem = rawMarketItems().find((item) => item.name === gemName);
    if (!baseItem) return;
    const overrides = readMarketPriceOverrides();
    if (normalized === Number(baseItem.price)) {
      delete overrides[gemName];
    } else {
      overrides[gemName] = normalized;
    }
    writeMarketPriceOverrides(overrides);
  }

  function resetGemPrices() {
    writeMarketPriceOverrides({});
  }

  function marketOverrideCount() {
    return marketItems().filter((item) => item.priceEdited).length;
  }

  function baseTotal(level) {
    if (!level || level === "0") return 0;
    return upgradeTable.find((step) => step.to === level)?.total || 0;
  }

  function targetTotal(level = defaultTargetLevel) {
    return baseTotal(level);
  }

  function maxTotal() {
    return upgradeTable.at(-1)?.total || 0;
  }

  function itemTotal(item) {
    return baseTotal(item.gem.level) + Number(item.gem.progress?.current || 0);
  }

  function itemStageGap(item) {
    const progress = item.gem.progress || {};
    return Math.max(0, Number(progress.required || 0) - Number(progress.current || 0));
  }

  function itemCurrentValue(item) {
    return itemTotal(item) * gemUnitPrice(item.gem.name);
  }

  function itemStageCost(item) {
    return itemStageGap(item) * gemUnitPrice(item.gem.name);
  }

  function itemTargetGap(item, level = defaultTargetLevel) {
    return Math.max(0, targetTotal(level) - itemTotal(item));
  }

  function itemTargetCost(item, level = defaultTargetLevel) {
    return itemTargetGap(item, level) * gemUnitPrice(item.gem.name);
  }

  function datasetTotal(dataset) {
    return dataset.items.reduce((sum, item) => sum + itemTotal(item), 0);
  }

  function datasetStageGap(dataset) {
    return dataset.items.reduce((sum, item) => sum + itemStageGap(item), 0);
  }

  function datasetCurrentValue(dataset) {
    return dataset.items.reduce((sum, item) => sum + itemCurrentValue(item), 0);
  }

  function datasetStageCost(dataset) {
    return dataset.items.reduce((sum, item) => sum + itemStageCost(item), 0);
  }

  function datasetTargetGap(dataset, level = defaultTargetLevel) {
    return dataset.items.reduce((sum, item) => sum + itemTargetGap(item, level), 0);
  }

  function datasetTargetCost(dataset, level = defaultTargetLevel) {
    return dataset.items.reduce((sum, item) => sum + itemTargetCost(item, level), 0);
  }

  function weeksForCost(cost, weeklyIncome = defaultWeeklyIncome) {
    const income = Number(weeklyIncome || 0);
    if (!income) return 0;
    return Number(cost || 0) / income;
  }

  function itemTargetWeeks(item, level = defaultTargetLevel, weeklyIncome = defaultWeeklyIncome) {
    return weeksForCost(itemTargetCost(item, level), weeklyIncome);
  }

  function datasetTargetWeeks(dataset, level = defaultTargetLevel, weeklyIncome = defaultWeeklyIncome) {
    return weeksForCost(datasetTargetCost(dataset, level), weeklyIncome);
  }

  function datasetCompletion(dataset) {
    const max = maxTotal() * dataset.items.length;
    return max ? (datasetTotal(dataset) / max) * 100 : 0;
  }

  function itemSearchText(item) {
    return [
      item.slot,
      item.name,
      item.type,
      item.file,
      item.sourceImage,
      item.legacySourceImage,
      ...(item.attributes || []),
      ...(item.effects || []),
      item.durability,
      item.gem.name,
      item.gem.level,
      item.gem.effect,
      gemUnitPrice(item.gem.name),
      gemUnitLabel(),
      item.gem.progress?.current,
      item.gem.progress?.required,
      item.gem.progress?.next,
      item.gem.progress?.gain,
      "13段",
      itemTargetGap(item),
      itemTargetCost(item),
    ]
      .join(" ")
      .toLowerCase();
  }

  function datasetSearchText(dataset) {
    return [dataset.key, dataset.label, dataset.source, dataset.legacySource, ...dataset.items.map(itemSearchText)].join(" ").toLowerCase();
  }

  function marketSearchText() {
    const snapshot = latestMarketSnapshot();
    if (!snapshot) return "";
    return [
      snapshot.sourceDate,
      snapshot.sourceType,
      snapshot.currency,
      snapshot.unit,
      snapshot.sourceImage,
      ...marketItems().flatMap((item) => [item.name, item.price, item.basePrice, item.priceEdited ? "已修改" : "截图价"]),
    ]
      .join(" ")
      .toLowerCase();
  }

  window.GemProgress = {
    baseTotal,
    datasetCompletion,
    datasetCurrentValue,
    datasetSearchText,
    datasetStageCost,
    datasetStageGap,
    datasetTargetCost,
    datasetTargetGap,
    datasetTargetWeeks,
    datasetTotal,
    defaultTargetLevel,
    defaultWeeklyIncome,
    formatCurrency,
    formatDurationWeeks,
    formatNumber,
    gemMarketItem,
    gemUnitLabel,
    gemUnitPrice,
    itemSearchText,
    itemCurrentValue,
    itemStageCost,
    itemStageGap,
    itemTargetCost,
    itemTargetGap,
    itemTargetWeeks,
    itemTotal,
    latestMarketSnapshot,
    marketItems,
    marketOverrideCount,
    marketSearchText,
    maxTotal,
    resetGemPrices,
    targetTotal,
    updateGemPrice,
    weeksForCost,
  };
})();
