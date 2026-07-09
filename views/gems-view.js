// Gem planning view rendering. Depends on data/equipment.raw.js and analysis/gem-progress.js.
(function () {
  let activeGemDatasetKey = "FC";
  let priceInputTimer = null;

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toWebPath(source) {
    return source ? `./${String(source).replaceAll("\\", "/")}` : "";
  }

  function allDatasets() {
    return window.equipmentDatasets || [];
  }

  function filteredDatasets(queryLower) {
    const datasets = allDatasets();
    const progress = window.GemProgress;
    if (!queryLower) return datasets;
    return datasets
      .map((dataset) => {
        const accountMatches = [dataset.key, dataset.label, dataset.source, dataset.legacySource].join(" ").toLowerCase().includes(queryLower);
        const items = accountMatches ? dataset.items : dataset.items.filter((item) => progress.itemSearchText(item).includes(queryLower));
        return { ...dataset, items };
      })
      .filter((dataset) => dataset.items.length || progress.datasetSearchText(dataset).includes(queryLower));
  }

  function weekCount(weeks) {
    return Math.max(0, Math.ceil(Number(weeks || 0)));
  }

  function formatFinishWeek(weeks) {
    const count = weekCount(weeks);
    return count ? `第 ${count} 周` : "已够";
  }

  function formatMonthApprox(weeks) {
    const count = weekCount(weeks);
    if (!count) return "本周后已够";
    return `约 ${Number(count / 4.345).toFixed(1).replace(/\.0$/, "")} 个月`;
  }

  function accountBudget(dataset, context) {
    const progress = window.GemProgress;
    const beast = context.beastBudgets?.[dataset.key] || {};
    const gemSilver = progress.datasetTargetCost(dataset);
    const beastRequiredSilver = Number(beast.requiredSilver || 0);
    const totalSilver = gemSilver + beastRequiredSilver;
    return {
      beast,
      beastRequiredSilver,
      beastTaskSilver: Number(beast.taskSilver || 0),
      beastAvailableSilver: Number(beast.availableSilver || 0),
      gemSilver,
      missingShardCount: Number(beast.missingShardCount || 0),
      taskCount: Number(beast.taskCount || 0),
      totalSilver,
      weeks: progress.weeksForCost(totalSilver),
    };
  }

  function buildPlanRows(datasets, context) {
    return datasets
      .map((dataset) => ({ dataset, budget: accountBudget(dataset, context) }))
      .sort((a, b) => b.budget.weeks - a.budget.weeks || b.budget.totalSilver - a.budget.totalSilver);
  }

  function planAdvice(row) {
    if (!row) return "";
    const { budget, dataset } = row;
    const moneyFocus = budget.gemSilver >= budget.beastRequiredSilver ? "宝石资金是主项" : "神兽资金是主项";
    const shard = budget.missingShardCount ? `锁片另排 ${budget.missingShardCount} 片` : "锁片无额外缺口";
    return `${dataset.label}：${moneyFocus}，${shard}`;
  }

  function pressureLabel(budget) {
    if (budget.gemSilver >= budget.beastRequiredSilver * 1.4) return "先盯宝石";
    if (budget.beastRequiredSilver >= budget.gemSilver) return "先盯神兽";
    return "两边同步";
  }

  function renderProgress(item) {
    const progress = window.GemProgress;
    const itemProgress = item.gem.progress || {};
    const current = Number(itemProgress.current || 0);
    const required = Number(itemProgress.required || 0);
    const width = required ? Math.min(100, Math.max(0, (current / required) * 100)) : 0;
    return `<div class="gem-progress">
      <div class="gem-progress-top">
        <span>当前 ${escapeHtml(item.gem.level)}</span>
        <b>${progress.formatNumber(current)}/${progress.formatNumber(required)}</b>
        <span>下一 ${escapeHtml(itemProgress.next || "-")}</span>
      </div>
      <div class="gem-progress-track" aria-hidden="true"><div class="gem-progress-fill" style="width: ${width}%"></div></div>
      <div class="gem-progress-bottom">
        <span>本段还差 ${progress.formatNumber(progress.itemStageGap(item))}</span>
        <span>${escapeHtml(itemProgress.gain || "")}</span>
      </div>
    </div>`;
  }

  function renderMarketPanel(highlight, query) {
    const progress = window.GemProgress;
    const snapshot = progress.latestMarketSnapshot();
    if (!snapshot) return "";
    const imageSrc = toWebPath(snapshot.sourceImage);
    const overrideCount = progress.marketOverrideCount();
    return `<details class="gem-market-disclosure">
      <summary>
        <strong>宝石价格</strong>
        <span>${escapeHtml(snapshot.sourceDate)} · ${escapeHtml(progress.gemUnitLabel())} · ${overrideCount ? `${overrideCount} 项已改价` : "截图价格"}</span>
      </summary>
      <div class="gem-market-panel">
        <div class="gem-market-head">
          <div>
            <strong>价格维护</strong>
            <span>修改后，计划金额会立即按新价格重算。</span>
          </div>
          <div class="gem-market-actions">
            <button type="button" data-gem-price-reset>重置价格</button>
            <a href="${imageSrc}" target="_blank" rel="noreferrer">来源截图</a>
          </div>
        </div>
        <div class="gem-market-grid">
          ${progress
            .marketItems()
            .map(
              (item) => `<label class="gem-market-field${item.priceEdited ? " edited" : ""}">
                <span>
                  <b>${highlight(item.name, query)}</b>
                  <small>${item.priceEdited ? `截图价 ${progress.formatNumber(item.basePrice)}` : "当前价格"}</small>
                </span>
                <input type="number" min="0" step="1" value="${escapeHtml(item.price)}" inputmode="numeric" data-gem-price="${escapeHtml(item.name)}" aria-label="${escapeHtml(`${item.name} 价格`)}" />
              </label>`
            )
            .join("")}
        </div>
      </div>
    </details>`;
  }

  function renderItemMarket(item) {
    const progress = window.GemProgress;
    const market = progress.gemMarketItem(item.gem.name);
    if (!market) return "";
    return `<div class="gem-market-row">
      <span>${escapeHtml(item.gem.name)} ${progress.formatNumber(market.price)}${escapeHtml(progress.gemUnitLabel())}</span>
      <span>当前估值 ${progress.formatCurrency(progress.itemCurrentValue(item))}</span>
      <span>本段成本 ${progress.formatCurrency(progress.itemStageCost(item))}</span>
      <span>到13段 ${progress.formatCurrency(progress.itemTargetCost(item))}</span>
    </div>`;
  }

  function renderPlanOverview(rows) {
    const progress = window.GemProgress;
    const slowest = rows[0];
    if (!slowest) return "";
    return `<div class="gem-plan-overview">
      <div>
        <h2>下一步升级计划</h2>
        <p>先按账号同步存钱：每个号每周 ${progress.formatCurrency(progress.defaultWeeklyIncome)}。总进度只看最慢号，锁片单独排，不折成银币。</p>
      </div>
      <div class="gem-plan-decision">
        <span>先盯这个号</span>
        <b>${escapeHtml(slowest.dataset.label)} · ${formatFinishWeek(slowest.budget.weeks)}</b>
        <em>${progress.formatCurrency(slowest.budget.totalSilver)} · ${formatMonthApprox(slowest.budget.weeks)}</em>
      </div>
    </div>
    <div class="gem-plan-steps">
      <article>
        <span>1</span>
        <strong>每号各存各的</strong>
        <p>五个号一起推进，不排队。</p>
      </article>
      <article>
        <span>2</span>
        <strong>瓶颈号决定完工</strong>
        <p>${escapeHtml(slowest.dataset.label)} 现在最慢。</p>
      </article>
      <article>
        <span>3</span>
        <strong>先看卡片</strong>
        <p>明细表只用来核账。</p>
      </article>
    </div>`;
  }

  function renderPlanCards(rows, selectedKey, highlight, query) {
    const progress = window.GemProgress;
    return `<div class="gem-plan-card-grid">
      ${rows
        .map(({ dataset, budget }, index) => {
          const active = dataset.key === selectedKey ? " active" : "";
          const bottleneck = index === 0 ? '<span class="gem-plan-card-tag">瓶颈</span>' : "";
          return `<button class="gem-plan-card${active}" type="button" data-gem-account="${escapeHtml(dataset.key)}" aria-pressed="${dataset.key === selectedKey}">
            <span class="gem-plan-card-head">
              <strong>${highlight(dataset.label, query)}</strong>
              ${bottleneck}
            </span>
            <b>${formatFinishWeek(budget.weeks)}</b>
            <span class="gem-plan-card-money">${progress.formatCurrency(budget.totalSilver)}</span>
            <span class="gem-plan-card-focus">${pressureLabel(budget)}</span>
            <span class="gem-plan-card-meta">
              <span>宝石 ${progress.formatCurrency(budget.gemSilver)}</span>
              <span>神兽 ${progress.formatCurrency(budget.beastRequiredSilver)}</span>
              <span>锁片 ${budget.missingShardCount ? `${budget.missingShardCount}片` : "-"}</span>
            </span>
          </button>`;
        })
        .join("")}
    </div>`;
  }

  function renderPlanTable(rows, selectedKey, highlight, query) {
    const progress = window.GemProgress;
    return `<details class="gem-plan-table-disclosure">
      <summary>
        <strong>数字核对表</strong>
        <span>展开看每号金额拆分</span>
      </summary>
      <div class="gem-plan-table-wrap">
      <table class="gem-plan-table" aria-label="账号升级排期">
        <thead>
          <tr>
            <th scope="col">账号</th>
            <th scope="col">预计完成</th>
            <th scope="col">还需银币</th>
            <th scope="col">宝石</th>
            <th scope="col">神兽</th>
            <th scope="col">锁片</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(({ dataset, budget }, index) => {
              const active = dataset.key === selectedKey ? " active" : "";
              const bottleneck = index === 0 ? '<span class="gem-plan-tag">瓶颈</span>' : "";
              return `<tr class="${active}">
                <td>
                  <button type="button" data-gem-account="${escapeHtml(dataset.key)}">${highlight(dataset.label, query)}</button>
                  ${bottleneck}
                </td>
                <td><strong>${formatFinishWeek(budget.weeks)}</strong><span>${formatMonthApprox(budget.weeks)}</span></td>
                <td><strong>${progress.formatCurrency(budget.totalSilver)}</strong></td>
                <td>${progress.formatCurrency(budget.gemSilver)}</td>
                <td>${progress.formatCurrency(budget.beastRequiredSilver)}</td>
                <td>${budget.missingShardCount ? `${budget.missingShardCount} 片` : "-"}</td>
              </tr>`;
            })
          .join("")}
        </tbody>
      </table>
    </div>
    </details>`;
  }

  function renderAccountPlan(dataset, context) {
    const progress = window.GemProgress;
    const budget = accountBudget(dataset, context);
    const beastMeta = budget.taskCount
      ? `任务额 ${progress.formatCurrency(budget.beastTaskSilver)}，库存抵扣 ${progress.formatCurrency(budget.beastAvailableSilver)}`
      : "没有识别到神兽任务";
    const shardMeta = budget.missingShardCount ? `锁片另缺 ${budget.missingShardCount} 片` : "锁片无额外缺口";
    const focus = budget.gemSilver >= budget.beastRequiredSilver ? "主要压力在宝石" : "主要压力在神兽";
    return `<div class="gem-account-plan">
      <article>
        <span>1. 宝石资金</span>
        <b>${progress.formatCurrency(budget.gemSilver)}</b>
        <em>${progress.formatDurationWeeks(progress.weeksForCost(budget.gemSilver))}</em>
      </article>
      <article>
        <span>2. 神兽资金</span>
        <b>${progress.formatCurrency(budget.beastRequiredSilver)}</b>
        <em>${escapeHtml(beastMeta)}</em>
      </article>
      <article class="total">
        <span>3. 当前号计划</span>
        <b>${formatFinishWeek(budget.weeks)}完成</b>
        <em>${progress.formatCurrency(budget.totalSilver)} · ${focus} · ${shardMeta}</em>
      </article>
    </div>`;
  }

  function renderTarget13Breakdown(dataset, highlight, query) {
    const progress = window.GemProgress;
    const targetLevel = progress.defaultTargetLevel;
    const rows = [...dataset.items].sort((a, b) => progress.itemTargetCost(b) - progress.itemTargetCost(a));
    return `<details class="gem-detail-disclosure">
      <summary>
        <strong>装备到 13 段明细</strong>
        <span>${dataset.items.length} 件 · 还差 ${progress.formatNumber(progress.datasetTargetGap(dataset, targetLevel))} 颗 · ${progress.formatCurrency(progress.datasetTargetCost(dataset, targetLevel))}</span>
      </summary>
      <div class="gem-target13-grid">
        ${rows
          .map(
            (item) => `<article class="gem-target13-card">
              <div>
                <strong>${highlight(`${item.slot} · ${item.name}`, query)}</strong>
                <span>${highlight(`${item.gem.name} ${item.gem.level}`, query)}｜已投 ${progress.formatNumber(progress.itemTotal(item))}</span>
              </div>
              <div>
                <span>还差 ${progress.formatNumber(progress.itemTargetGap(item, targetLevel))} 颗</span>
                <b>${progress.formatCurrency(progress.itemTargetCost(item, targetLevel))}</b>
                <em>${progress.formatDurationWeeks(progress.itemTargetWeeks(item, targetLevel))}</em>
              </div>
            </article>`
          )
          .join("")}
      </div>
    </details>`;
  }

  function renderItem(item, dataset, highlight, query) {
    const progress = window.GemProgress;
    const total = progress.itemTotal(item);
    const attrs = [...(item.attributes || []), `耐久 ${item.durability}`];
    const imageSrc = toWebPath(item.sourceImage || item.legacySourceImage || `${dataset.legacySource}/${item.file}`);
    return `<article class="gem-item">
      <a class="gem-shot-link" href="${imageSrc}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(`${dataset.label} ${item.name} 原图`)}">
        <img class="gem-shot" src="${imageSrc}" alt="${escapeHtml(`${dataset.label} ${item.name}`)}" loading="lazy" />
      </a>
      <div class="gem-info">
        <div class="gem-item-head">
          <div>
            <div class="gem-slot">${highlight(item.slot, query)}</div>
            <h3>${highlight(item.name, query)}</h3>
            <p>${highlight(item.type, query)}</p>
          </div>
          <div class="gem-total-pill">
            <span>累计</span>
            <b>${progress.formatNumber(total)}</b>
          </div>
        </div>
        <div class="gem-chip-row">
          ${(item.effects || []).map((effect) => `<span class="gem-chip effect">${highlight(effect, query)}</span>`).join("")}
          <span class="gem-chip gem-name">${highlight(`${item.gem.name} ${item.gem.level}`, query)}</span>
          <span class="gem-chip">${highlight(item.gem.effect, query)}</span>
        </div>
        <div class="gem-attr-grid">
          ${attrs.map((attr) => `<span>${highlight(attr, query)}</span>`).join("")}
        </div>
        ${renderItemMarket(item)}
        ${renderProgress(item)}
      </div>
    </article>`;
  }

  function renderEquipmentSection(filteredDataset, fullDataset, highlight, query) {
    const countText = query ? `${filteredDataset.items.length}/${fullDataset.items.length} 件匹配` : `${fullDataset.items.length} 件`;
    return `<details class="gem-equipment-disclosure">
      <summary>
        <strong>装备截图与属性</strong>
        <span>${escapeHtml(countText)}</span>
      </summary>
      ${
        filteredDataset.items.length
          ? `<div class="gem-equipment-grid">${filteredDataset.items.map((item) => renderItem(item, fullDataset, highlight, query)).join("")}</div>`
          : `<div class="gem-equipment-empty">当前账号没有匹配的装备明细。</div>`
      }
    </details>`;
  }

  function renderDataset(fullDataset, filteredDataset, highlight, query, context) {
    const progress = window.GemProgress;
    const budget = accountBudget(fullDataset, context);
    return `<section class="compare-section gem-account-section">
      <div class="compare-head">
        <div>
          <h2>${highlight(fullDataset.label, query)} 单号计划</h2>
          <p>按完整 6 件装备计算：宝石到 13 段 ${progress.formatCurrency(budget.gemSilver)}，神兽还需 ${progress.formatCurrency(budget.beastRequiredSilver)}，合计 ${progress.formatCurrency(budget.totalSilver)}。</p>
        </div>
        <div class="gem-role-score">
          <span>预计完成</span>
          <b>${formatFinishWeek(budget.weeks)}</b>
        </div>
      </div>
      ${renderAccountPlan(fullDataset, context)}
      <div class="gem-next-step">
        <strong>下步判断</strong>
        <span>${escapeHtml(planAdvice({ dataset: fullDataset, budget }))}</span>
      </div>
      ${renderTarget13Breakdown(fullDataset, highlight, query)}
      ${renderEquipmentSection(filteredDataset, fullDataset, highlight, query)}
    </section>`;
  }

  function renderEmpty() {
    return `<section class="empty-state">
      <h2>没有宝石基础数据</h2>
      <p>先补充装备宝石截图识别记录后，这里会生成升级计划。</p>
    </section>`;
  }

  function render(context) {
    const progress = window.GemProgress;
    context.destroyBeastCostChart();
    context.setViewCopy(context.viewKey);
    const query = document.getElementById("searchInput").value.trim();
    const queryLower = query.toLowerCase();
    const datasets = allDatasets();
    const filtered = filteredDatasets(queryLower);
    const planRows = buildPlanRows(datasets, context);
    const slowest = planRows[0];
    const selectedFromFiltered = filtered.find((dataset) => dataset.key === activeGemDatasetKey) || (queryLower ? filtered[0] : null);
    const selectedFull = datasets.find((dataset) => dataset.key === (selectedFromFiltered?.key || activeGemDatasetKey)) || datasets[0];
    const selectedFiltered = filtered.find((dataset) => dataset.key === selectedFull?.key) || (selectedFull ? { ...selectedFull, items: [] } : null);
    if (selectedFull) activeGemDatasetKey = selectedFull.key;

    document.getElementById("records").innerHTML = datasets.length && selectedFull
      ? `<div class="gem-dashboard">
          <section class="compare-section gem-planning-section">
            ${renderPlanOverview(planRows)}
            ${renderPlanCards(planRows, selectedFull.key, context.highlight, query)}
            ${renderPlanTable(planRows, selectedFull.key, context.highlight, query)}
            ${renderMarketPanel(context.highlight, query)}
          </section>
          ${renderDataset(selectedFull, selectedFiltered, context.highlight, query, context)}
        </div>`
      : renderEmpty();

    const allItems = datasets.flatMap((dataset) => dataset.items);
    document.getElementById("groupCount").textContent = datasets.length;
    document.getElementById("shotCount").textContent = allItems.length;
    document.getElementById("pendingCount").textContent = slowest ? `${weekCount(slowest.budget.weeks)}周` : "-";
    document.getElementById("folderName").textContent = slowest?.dataset.label || "-";
    document.getElementById("groupLabel").textContent = "账号";
    document.getElementById("shotLabel").textContent = "装备";
    document.getElementById("pendingLabel").textContent = "最慢计划";
    document.getElementById("folderLabel").textContent = "瓶颈号";
    document.getElementById("notice").hidden = true;
    context.renderTabs();
  }

  function handleClick(event, context) {
    if (event.target.closest("[data-gem-price-reset]")) {
      window.GemProgress.resetGemPrices();
      render(context);
      return true;
    }
    const accountButton = event.target.closest("[data-gem-account]");
    if (!accountButton) return false;
    activeGemDatasetKey = accountButton.dataset.gemAccount;
    render(context);
    return true;
  }

  function handleInput(event, context) {
    const priceInput = event.target.closest("[data-gem-price]");
    if (!priceInput) return false;
    window.clearTimeout(priceInputTimer);
    priceInputTimer = window.setTimeout(() => {
      window.GemProgress.updateGemPrice(priceInput.dataset.gemPrice, priceInput.value);
      render(context);
    }, 350);
    return true;
  }

  window.GemsView = {
    handleClick,
    handleInput,
    render,
  };
})();
