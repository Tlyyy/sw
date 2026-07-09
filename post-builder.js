(function () {
  const sourceDatasets = window.datasets || [];
  const state = {
    mode: "sale",
    folder: "all",
    pet: "all",
    query: "",
    selectedOnly: false,
    format: "markdown",
    includeStats: true,
    includeSkills: true,
    includeNotes: true,
    allShots: true,
    selected: new Set(),
  };

  const elements = {
    folderFilters: document.querySelector("#folderFilters"),
    petFilters: document.querySelector("#petFilters"),
    recordList: document.querySelector("#recordList"),
    searchInput: document.querySelector("#searchInput"),
    selectedOnlyToggle: document.querySelector("#selectedOnlyToggle"),
    selectedCount: document.querySelector("#selectedCount"),
    selectedShotCount: document.querySelector("#selectedShotCount"),
    materialSummary: document.querySelector("#materialSummary"),
    outputSummary: document.querySelector("#outputSummary"),
    imageListSummary: document.querySelector("#imageListSummary"),
    imageList: document.querySelector("#imageList"),
    postTitle: document.querySelector("#postTitleInput"),
    intro: document.querySelector("#introInput"),
    includeStats: document.querySelector("#includeStatsInput"),
    includeSkills: document.querySelector("#includeSkillsInput"),
    includeNotes: document.querySelector("#includeNotesInput"),
    allShots: document.querySelector("#allShotsInput"),
    postOutput: document.querySelector("#postOutput"),
    copyPostButton: document.querySelector("#copyPostButton"),
    copyImageListButton: document.querySelector("#copyImageListButton"),
    copyStatus: document.querySelector("#copyStatus"),
  };

  const copyDefaults = {
    sale: {
      title: "【出售】幻唐志账号宠物资产说明",
      intro: "出售账号，下面是按现有截图整理的宠物资产说明。资产以截图和游戏内实际为准，主要展示宠物面板、资质、养成、技能、符、驭和觉醒情况。",
    },
    record: {
      title: "【记录贴】幻唐志宠物和技能图整理，慢慢补图",
      intro: "开个记录贴，主要发图，顺手记一下整理进度。现在先把宠物面板、技能、符、驭、觉醒这些信息按批次整理出来，后面继续补。",
    },
  };

  elements.postTitle.value = copyDefaults[state.mode].title;
  elements.intro.value = copyDefaults[state.mode].intro;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function highlight(value, query) {
    const text = escapeHtml(value);
    if (!query) return text;
    const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return text.replace(new RegExp(safe, "gi"), (match) => `<mark>${match}</mark>`);
  }

  function displayPetName(pet = "") {
    return pet.replace(/\(\d+\)/g, "").trim();
  }

  function isCountedSkill(skill = "") {
    return (
      skill !== "空" &&
      !skill.includes("(符)") &&
      !skill.includes("(驭)") &&
      !skill.includes("强化") &&
      !skill.includes("之心") &&
      !skill.startsWith("觉醒")
    );
  }

  function inheritedSkills(record, allRecords) {
    if (record.skills) return record.skills;
    const sourceId = record.same?.match(/同\s+(\d+)/)?.[1];
    return allRecords.find((item) => item.id === sourceId)?.skills || [];
  }

  function getRowValue(rows = [], label) {
    return rows.find(([name]) => name.includes(label))?.[1] || "";
  }

  function imagePath(shot, fallbackFolder) {
    return `./图片/${shot.folder || fallbackFolder}/${shot.file}`;
  }

  function buildGroups(dataset) {
    const groups = [];
    const byId = new Map();
    dataset.records.forEach((record) => {
      if (record.skipped) return;
      const sourceId = record.same?.match(/同\s+(\d+)/)?.[1];
      if (sourceId && byId.has(sourceId)) {
        byId.get(sourceId).shots.push({
          id: record.id,
          file: record.file,
          folder: record.sourceFolder || dataset.key,
          note: record.same,
        });
        return;
      }

      const group = {
        key: `${dataset.key}-${record.id}`,
        id: record.id,
        folderKey: dataset.key,
        folderLabel: dataset.label,
        pet: record.pet,
        petName: displayPetName(record.pet),
        meta: record.meta,
        heart: record.heart || "",
        stats: record.stats,
        skills: inheritedSkills(record, dataset.records),
        shots: [
          {
            id: record.id,
            file: record.file,
            folder: record.sourceFolder || dataset.key,
            note: "主截图",
          },
        ],
      };
      groups.push(group);
      byId.set(record.id, group);
    });
    return groups;
  }

  const groups = sourceDatasets.flatMap((dataset) => buildGroups(dataset));
  const petNames = [...new Set(groups.map((group) => group.petName))].sort((a, b) => a.localeCompare(b, "zh-CN"));

  function skillCount(group) {
    return group.skills.filter(isCountedSkill).length;
  }

  function fullSkills(group) {
    return group.skills.filter((skill) => skill !== "空");
  }

  function isBeast(group) {
    return group.petName.includes("神兽") || getRowValue(group.stats?.aptitude, "寿命") === "永生";
  }

  function talentText(group) {
    return group.meta.match(/天资：([^｜]+)/)?.[1] || "";
  }

  function bloodlineText(group) {
    return group.meta.match(/血脉：([^｜]+)/)?.[1] || "";
  }

  function numberFromPanel(group, label) {
    return Number(String(getRowValue(group.stats?.panel, label) || "").match(/\d+/)?.[0] || 0);
  }

  function selectedShots(group) {
    return state.allShots ? group.shots : group.shots.slice(0, 1);
  }

  function selectedGroups() {
    return groups.filter((group) => state.selected.has(group.key));
  }

  function imageItemsForGroups(targetGroups) {
    const seen = new Set();
    return targetGroups
      .flatMap((group) =>
        selectedShots(group).map((shot) => ({
          label: `${group.folderLabel}-${group.id} ${group.petName} ${shot.id}`,
          path: imagePath(shot, group.folderKey),
        }))
      )
      .filter((item) => {
        if (seen.has(item.path)) return false;
        seen.add(item.path);
        return true;
      });
  }

  function visibleGroups() {
    const query = state.query.trim().toLowerCase();
    return groups.filter((group) => {
      if (state.selectedOnly && !state.selected.has(group.key)) return false;
      if (state.folder !== "all" && group.folderKey !== state.folder) return false;
      if (state.pet !== "all" && group.petName !== state.pet) return false;
      if (!query) return true;
      return searchText(group).toLowerCase().includes(query);
    });
  }

  function searchText(group) {
    const statValues = group.stats
      ? [...group.stats.panel, ...group.stats.points, ...group.stats.aptitude, ...(group.stats.growth || [])].flat()
      : [];
    return [group.folderLabel, group.id, group.pet, group.meta, group.heart, ...group.skills, ...statValues, ...group.shots.map((shot) => shot.file)].join(" ");
  }

  function keySkills(group, limit = 7) {
    const keywords = [
      "高级必杀",
      "高级连击",
      "高级强力",
      "高级吸血",
      "高级偷袭",
      "高级隐身",
      "高级法术暴击",
      "高级法术连击",
      "高级灵蕴",
      "高级强壮",
      "高级防御",
      "高级敏捷",
      "涡轮火",
      "雷利风行",
      "分水神剑",
      "山崩地倾",
      "水刃斩",
      "幽冥之佑",
      "生死相依",
      "一马当先",
    ];
    const picked = group.skills.filter((skill) => skill !== "空" && keywords.some((keyword) => skill.includes(keyword)));
    const fallback = group.skills.filter((skill) => skill !== "空");
    return [...new Set(picked.length ? picked : fallback)].slice(0, limit);
  }

  function directionText(group) {
    const text = group.skills.join("、");
    const pet = group.petName;
    if (pet.includes("冥卫")) return "高速肉宠方向，重点看速度、防御和强壮配置。";
    if (pet.includes("桃花")) return "高速辅助向，适合看敏捷、隐身和生存技能。";
    if (pet.includes("青蛇") && /法术|法爆|法连|灵蕴|山崩/.test(text)) return "神兽青蛇法系路线，适合和物理青蛇分开对比。";
    if (pet.includes("青蛇")) return "神兽青蛇物理路线，后面可以单独拉一楼横向对比。";
    if (/法术|法爆|法连|灵蕴|涡轮火|雷利风行|分水神剑/.test(text)) return "法系配置，重点看法连、法暴、灵蕴和专属技能。";
    if (/必杀|连击|强力|吸血|偷袭|夜战|隐身/.test(text)) return "物理输出配置，重点看连击、必杀、强力、吸血和符驭搭配。";
    return "这组先归档，后面按同类宠物继续补对比。";
  }

  function statsSummary(group) {
    if (!group.stats) return "";
    const panel = group.stats.panel;
    return [
      ["气血", getRowValue(panel, "气血")],
      ["攻击", getRowValue(panel, "攻击")],
      ["防御", getRowValue(panel, "防御")],
      ["速度", getRowValue(panel, "速度")],
      ["灵力", getRowValue(panel, "灵力")],
    ]
      .filter(([, value]) => value)
      .map(([label, value]) => `${label} ${value}`)
      .join("，");
  }

  function shotDate(group) {
    const match = group.shots[0]?.file.match(/(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[1]}.${match[2]}.${match[3]}` : "未标日期";
  }

  function starterKeys() {
    const preferred = [
      "FC-23",
      "LG1-03",
      "LG2-09",
      "MYT-03",
      "PT-03",
      "LG2-05",
      "LG2-07",
      "PT-21",
      "PT-09",
      "FC-01",
    ];
    return preferred.filter((key) => groups.some((group) => group.key === key));
  }

  function allKeys() {
    return groups.map((group) => group.key);
  }

  function renderFolderFilters() {
    const buttons = [{ key: "all", label: "全部", count: groups.length }].concat(
      sourceDatasets.map((dataset) => ({
        key: dataset.key,
        label: dataset.label,
        count: groups.filter((group) => group.folderKey === dataset.key).length,
      }))
    );
    elements.folderFilters.innerHTML = buttons
      .map(
        (item) =>
          `<button class="filter-button${state.folder === item.key ? " active" : ""}" type="button" data-folder="${escapeHtml(item.key)}">${escapeHtml(item.label)} <span>${item.count}</span></button>`
      )
      .join("");
  }

  function renderPetFilters() {
    const visibleNames = state.folder === "all" ? petNames : [...new Set(groups.filter((group) => group.folderKey === state.folder).map((group) => group.petName))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    const items = ["all", ...visibleNames];
    elements.petFilters.innerHTML = items
      .map((name) => {
        const label = name === "all" ? "全部宠物" : name;
        return `<button class="pet-filter${state.pet === name ? " active" : ""}" type="button" data-pet="${escapeHtml(name)}">${escapeHtml(label)}</button>`;
      })
      .join("");
  }

  function renderRecordList() {
    const visible = visibleGroups();
    elements.materialSummary.textContent = `${visible.length} 组可见，已选 ${state.selected.size} 组。`;
    if (!visible.length) {
      elements.recordList.innerHTML = `<div class="empty-state">没有匹配的素材</div>`;
      return;
    }
    const query = state.query.trim();
    elements.recordList.innerHTML = visible
      .map((group) => {
        const checked = state.selected.has(group.key);
        const firstShot = group.shots[0];
        const image = imagePath(firstShot, group.folderKey);
        const skills = keySkills(group, 5);
        return `<article class="record-card${checked ? " selected" : ""}" data-key="${escapeHtml(group.key)}">
          <label class="record-check" aria-label="选择 ${escapeHtml(group.folderLabel)} ${escapeHtml(group.petName)}">
            <input type="checkbox" data-select="${escapeHtml(group.key)}" ${checked ? "checked" : ""} />
          </label>
          <div class="thumb-stack">
            <a class="thumb-main" href="${escapeHtml(image)}" target="_blank" rel="noreferrer">
              <img src="${escapeHtml(image)}" alt="${escapeHtml(group.folderLabel)} ${escapeHtml(group.petName)}" loading="lazy" />
            </a>
            <div class="shot-pills">
              ${group.shots.map((shot) => `<span class="shot-pill">${escapeHtml(shot.id)}</span>`).join("")}
            </div>
          </div>
          <div class="record-main">
            <div class="record-title">
              <h3>${highlight(group.petName, query)}</h3>
              <span class="record-key">${escapeHtml(group.folderLabel)}-${escapeHtml(group.id)}</span>
            </div>
            <p class="meta-line">${highlight(group.meta, query)}${group.heart ? ` / ${highlight(group.heart, query)}` : ""}</p>
            <div class="tag-row">
              <span class="tag strong">技能数 ${skillCount(group)}</span>
              <span class="tag green">${group.shots.length} 张图</span>
              <span class="tag gold">${escapeHtml(shotDate(group))}</span>
              ${isBeast(group) ? `<span class="tag strong">神兽</span>` : ""}
            </div>
            <div class="skill-line">
              ${skills.map((skill) => `<span class="skill-chip">${highlight(skill, query)}</span>`).join("")}
            </div>
            <p class="record-note">${escapeHtml(directionText(group))}</p>
          </div>
        </article>`;
      })
      .join("");
  }

  function renderSelectedStats() {
    const selected = selectedGroups();
    const shotCount = imageItemsForGroups(selected).length;
    elements.selectedCount.textContent = selected.length;
    elements.selectedShotCount.textContent = shotCount;
  }

  function selectedFolderSummary(selected) {
    return sourceDatasets
      .map((dataset) => {
        const items = selected.filter((group) => group.folderKey === dataset.key);
        if (!items.length) return null;
        const shots = imageItemsForGroups(items).length;
        const beasts = items.filter(isBeast).length;
        const sixSkills = items.filter((group) => skillCount(group) >= 6).length;
        return { dataset, items, shots, beasts, sixSkills };
      })
      .filter(Boolean);
  }

  function speciesSummary(selected) {
    return [...selected.reduce((map, group) => {
      map.set(group.petName, (map.get(group.petName) || 0) + 1);
      return map;
    }, new Map()).entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
      .map(([name, count]) => `${name} ${count}`);
  }

  function saleHighlights(selected) {
    const highlights = [];
    const beasts = selected.filter(isBeast);
    const sixSkill = selected.filter((group) => skillCount(group) >= 6);
    const speedRows = selected
      .map((group) => ({ group, speed: numberFromPanel(group, "速度") }))
      .filter((item) => item.speed)
      .sort((a, b) => b.speed - a.speed)
      .slice(0, 5);
    if (beasts.length) highlights.push(`神兽/永生宠 ${beasts.length} 组：${speciesSummary(beasts).join("、")}`);
    if (sixSkill.length) highlights.push(`6 技能资产 ${sixSkill.length} 组：${sixSkill.map((group) => `${group.folderLabel} ${group.petName}`).join("、")}`);
    if (speedRows.length) highlights.push(`速度靠前：${speedRows.map(({ group, speed }) => `${group.folderLabel} ${group.petName} 速度 ${speed}`).join("、")}`);
    return highlights;
  }

  function numberPanelText(group, title, rows = []) {
    if (!rows.length) return "";
    return `${title}：${rows.map(([label, value]) => `${label}${value}`).join("，")}`;
  }

  function assetLineMarkdown(group) {
    const lines = [];
    const shots = selectedShots(group);
    lines.push(`### ${group.folderLabel}-${group.id} ${group.petName}`);
    shots.forEach((shot, index) => {
      lines.push(`![${group.folderLabel} ${group.petName} 图${index + 1}](${imagePath(shot, group.folderKey)})`);
    });
    lines.push("");
    lines.push(`- 基础：${group.meta}${group.heart ? ` / ${group.heart}` : ""}`);
    lines.push(`- 资产标签：${[isBeast(group) ? "神兽/永生" : "", `${skillCount(group)} 技能`, bloodlineText(group), talentText(group)].filter(Boolean).join(" / ")}`);
    if (state.includeStats && group.stats) {
      lines.push(`- ${numberPanelText(group, "面板", group.stats.panel)}`);
      lines.push(`- ${numberPanelText(group, "资质/寿命", group.stats.aptitude)}`);
      if (group.stats.growth) lines.push(`- ${numberPanelText(group, "养成", group.stats.growth)}`);
    }
    if (state.includeSkills) lines.push(`- 完整技能：${fullSkills(group).join("、")}`);
    if (state.includeNotes) lines.push(`- 卖点备注：${directionText(group)}`);
    return lines.join("\n");
  }

  function assetLinePlain(group) {
    const lines = [];
    lines.push(`${group.folderLabel}-${group.id} ${group.petName}`);
    selectedShots(group).forEach((shot, index) => lines.push(`图${index + 1}：${imagePath(shot, group.folderKey)}`));
    lines.push(`基础：${group.meta}${group.heart ? ` / ${group.heart}` : ""}`);
    lines.push(`资产标签：${[isBeast(group) ? "神兽/永生" : "", `${skillCount(group)} 技能`, bloodlineText(group), talentText(group)].filter(Boolean).join(" / ")}`);
    if (state.includeStats && group.stats) {
      lines.push(numberPanelText(group, "面板", group.stats.panel));
      lines.push(numberPanelText(group, "资质/寿命", group.stats.aptitude));
      if (group.stats.growth) lines.push(numberPanelText(group, "养成", group.stats.growth));
    }
    if (state.includeSkills) lines.push(`完整技能：${fullSkills(group).join("、")}`);
    if (state.includeNotes) lines.push(`卖点备注：${directionText(group)}`);
    return lines.join("\n");
  }

  function groupSelectedByDate(selected) {
    return selected.reduce((map, group) => {
      const date = shotDate(group);
      if (!map.has(date)) map.set(date, []);
      map.get(date).push(group);
      return map;
    }, new Map());
  }

  function recordBlockMarkdown(group) {
    const lines = [];
    lines.push(`### ${group.folderLabel} / ${group.petName}`);
    selectedShots(group).forEach((shot, index) => {
      const path = imagePath(shot, group.folderKey);
      lines.push(`![${group.folderLabel} ${group.petName} ${index + 1}](${path})`);
    });
    lines.push("");
    lines.push(`- ${group.meta}${group.heart ? ` / ${group.heart}` : ""}`);
    if (state.includeStats) {
      const summary = statsSummary(group);
      if (summary) lines.push(`- 面板：${summary}`);
    }
    if (state.includeSkills) lines.push(`- 技能数 ${skillCount(group)}：${keySkills(group).join("、")}`);
    if (state.includeNotes) lines.push(`- 看点：${directionText(group)}`);
    return lines.join("\n");
  }

  function recordBlockPlain(group) {
    const lines = [];
    lines.push(`${group.folderLabel} / ${group.petName}`);
    selectedShots(group).forEach((shot, index) => {
      lines.push(`[图${index + 1}] ${imagePath(shot, group.folderKey)}`);
    });
    lines.push(`${group.meta}${group.heart ? ` / ${group.heart}` : ""}`);
    if (state.includeStats) {
      const summary = statsSummary(group);
      if (summary) lines.push(`面板：${summary}`);
    }
    if (state.includeSkills) lines.push(`技能数 ${skillCount(group)}：${keySkills(group).join("、")}`);
    if (state.includeNotes) lines.push(`看点：${directionText(group)}`);
    return lines.join("\n");
  }

  function generateRecordPost(selected, title, intro) {
    if (!selected.length) {
      return `${state.format === "markdown" ? `# ${title}` : title}\n\n${intro}\n\n先在左侧选择要发的截图。`;
    }

    const lines = [];
    lines.push(state.format === "markdown" ? `# ${title}` : title);
    lines.push("");
    lines.push(intro);
    lines.push("");
    lines.push(`目前已选 ${selected.length} 组记录，${imageItemsForGroups(selected).length} 张图。`);
    const grouped = groupSelectedByDate(selected);
    [...grouped.entries()].forEach(([date, dateGroups]) => {
      lines.push("");
      lines.push(state.format === "markdown" ? `## ${date}` : date);
      lines.push("");
      dateGroups.forEach((group) => {
        lines.push(state.format === "markdown" ? recordBlockMarkdown(group) : recordBlockPlain(group));
        lines.push("");
      });
    });
    lines.push("先这样，后面继续慢慢补图。");
    return lines.join("\n").trim();
  }

  function generateSalePost(selected, title, intro) {
    if (!selected.length) {
      return `${state.format === "markdown" ? `# ${title}` : title}\n\n${intro}\n\n先在左侧选择要写进出售说明的资产。`;
    }
    const shots = imageItemsForGroups(selected).length;
    const folderSummary = selectedFolderSummary(selected);
    const lines = [];
    lines.push(state.format === "markdown" ? `# ${title}` : title);
    lines.push("");
    lines.push(intro);
    lines.push("");
    lines.push(state.format === "markdown" ? "## 资产总览" : "资产总览");
    lines.push("");
    lines.push(`- 账号/目录：${folderSummary.map(({ dataset }) => dataset.label).join("、")}`);
    lines.push(`- 宠物记录：${selected.length} 组`);
    lines.push(`- 截图证明：${shots} 张`);
    lines.push(`- 宠物种类：${speciesSummary(selected).join("、")}`);
    lines.push(`- 技能结构：${[4, 5, 6].map((count) => `${count} 技能 ${selected.filter((group) => skillCount(group) === count).length} 组`).join("，")}`);
    const highlights = saleHighlights(selected);
    if (highlights.length) {
      lines.push("");
      lines.push(state.format === "markdown" ? "## 核心卖点" : "核心卖点");
      lines.push("");
      highlights.forEach((item) => lines.push(`- ${item}`));
    }
    lines.push("");
    lines.push(state.format === "markdown" ? "## 分账号资产" : "分账号资产");
    folderSummary.forEach(({ dataset, items, shots: folderShots, beasts, sixSkills }) => {
      lines.push("");
      lines.push(state.format === "markdown" ? `### ${dataset.label}` : dataset.label);
      lines.push(`- 小计：${items.length} 组宠物，${folderShots} 张截图，神兽/永生 ${beasts} 组，6 技能 ${sixSkills} 组。`);
      lines.push(`- 宠物：${speciesSummary(items).join("、")}`);
    });
    lines.push("");
    lines.push(state.format === "markdown" ? "## 完整宠物明细" : "完整宠物明细");
    folderSummary.forEach(({ dataset, items }) => {
      lines.push("");
      lines.push(state.format === "markdown" ? `## ${dataset.label} 明细` : `${dataset.label} 明细`);
      lines.push("");
      items.forEach((group) => {
        lines.push(state.format === "markdown" ? assetLineMarkdown(group) : assetLinePlain(group));
        lines.push("");
      });
    });
    lines.push(state.format === "markdown" ? "## 交易说明" : "交易说明");
    lines.push("");
    lines.push("- 以上内容根据本地截图识别记录整理，实际资产以游戏内查看为准。");
    lines.push("- 图片清单可单独复制，发帖时建议按账号/目录顺序上传。");
    lines.push("- 价格、区服、角色基础信息、联系方式可在发帖前手动补充。");
    return lines.join("\n").trim();
  }

  function generatePost() {
    const selected = selectedGroups();
    const defaults = copyDefaults[state.mode];
    const title = elements.postTitle.value.trim() || defaults.title;
    const intro = elements.intro.value.trim() || defaults.intro;
    return state.mode === "sale" ? generateSalePost(selected, title, intro) : generateRecordPost(selected, title, intro);
  }

  function selectedImagePaths() {
    return imageItemsForGroups(selectedGroups());
  }

  function renderOutput() {
    const selected = selectedGroups();
    const shotCount = selectedImagePaths().length;
    elements.outputSummary.textContent = selected.length ? `${selected.length} 组记录，${shotCount} 张图。` : "等待选择素材。";
    elements.postOutput.value = generatePost();

    const imagePaths = selectedImagePaths();
    elements.imageListSummary.textContent = imagePaths.length ? `${imagePaths.length} 张待上传图片。` : "等待选择素材。";
    elements.imageList.innerHTML = imagePaths.length
      ? imagePaths
          .map(
            (item) => `<div class="image-item">
              <code title="${escapeHtml(item.path)}">${escapeHtml(item.path)}</code>
              <a href="${escapeHtml(item.path)}" target="_blank" rel="noreferrer">打开</a>
            </div>`
          )
          .join("")
      : `<div class="empty-state">还没有图片</div>`;
  }

  function renderFormatTabs() {
    document.querySelectorAll("[data-format]").forEach((button) => {
      const active = button.dataset.format === state.format;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
  }

  function renderModeTabs() {
    document.querySelectorAll("[data-mode]").forEach((button) => {
      const active = button.dataset.mode === state.mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
  }

  function render() {
    renderFolderFilters();
    renderPetFilters();
    renderRecordList();
    renderSelectedStats();
    renderModeTabs();
    renderFormatTabs();
    renderOutput();
  }

  function fallbackCopyText(text) {
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.left = "-9999px";
    helper.style.top = "0";
    document.body.appendChild(helper);
    helper.focus();
    helper.select();
    const copied = document.execCommand("copy");
    helper.remove();
    return copied;
  }

  async function copyText(text, label) {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        copied = fallbackCopyText(text);
      } catch {
        copied = false;
      }
    }

    if (copied) {
      elements.copyStatus.textContent = `${label}已复制`;
    } else {
      elements.copyStatus.textContent = "复制失败，可以手动选中预览内容复制。";
    }
    window.clearTimeout(copyText.timer);
    copyText.timer = window.setTimeout(() => {
      elements.copyStatus.textContent = "";
    }, 2200);
  }

  function bindEvents() {
    elements.searchInput.addEventListener("input", (event) => {
      state.query = event.target.value;
      renderRecordList();
      renderSelectedStats();
    });

    elements.selectedOnlyToggle.addEventListener("change", (event) => {
      state.selectedOnly = event.target.checked;
      renderRecordList();
    });

    elements.folderFilters.addEventListener("click", (event) => {
      const button = event.target.closest("[data-folder]");
      if (!button) return;
      state.folder = button.dataset.folder;
      state.pet = "all";
      render();
    });

    elements.petFilters.addEventListener("click", (event) => {
      const button = event.target.closest("[data-pet]");
      if (!button) return;
      state.pet = button.dataset.pet;
      renderPetFilters();
      renderRecordList();
    });

    elements.recordList.addEventListener("change", (event) => {
      const input = event.target.closest("[data-select]");
      if (!input) return;
      const key = input.dataset.select;
      if (input.checked) state.selected.add(key);
      else state.selected.delete(key);
      renderRecordList();
      renderSelectedStats();
      renderOutput();
    });

    document.querySelectorAll("[data-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        const preset = button.dataset.preset;
        if (preset === "all") {
          state.selected = new Set(allKeys());
        }
        if (preset === "starter") {
          state.selected = new Set(starterKeys());
        }
        if (preset === "visible") {
          visibleGroups().forEach((group) => state.selected.add(group.key));
        }
        if (preset === "clear") {
          state.selected.clear();
        }
        render();
      });
    });

    document.querySelectorAll("[data-format]").forEach((button) => {
      button.addEventListener("click", () => {
        state.format = button.dataset.format;
        renderFormatTabs();
        renderOutput();
      });
    });

    document.querySelectorAll("[data-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        const previousMode = state.mode;
        state.mode = button.dataset.mode;
        if (elements.postTitle.value.trim() === copyDefaults[previousMode].title) {
          elements.postTitle.value = copyDefaults[state.mode].title;
        }
        if (elements.intro.value.trim() === copyDefaults[previousMode].intro) {
          elements.intro.value = copyDefaults[state.mode].intro;
        }
        if (state.mode === "sale" && state.selected.size === starterKeys().length) {
          state.selected = new Set(allKeys());
        }
        render();
      });
    });

    [
      [elements.includeStats, "includeStats"],
      [elements.includeSkills, "includeSkills"],
      [elements.includeNotes, "includeNotes"],
      [elements.allShots, "allShots"],
    ].forEach(([input, key]) => {
      input.addEventListener("change", () => {
        state[key] = input.checked;
        renderSelectedStats();
        renderOutput();
      });
    });

    elements.postTitle.addEventListener("input", renderOutput);
    elements.intro.addEventListener("input", renderOutput);

    elements.copyPostButton.addEventListener("click", () => copyText(elements.postOutput.value, "正文"));
    elements.copyImageListButton.addEventListener("click", () => {
      const text = selectedImagePaths()
        .map((item) => item.path)
        .join("\n");
      copyText(text || "还没有选择图片", "图片清单");
    });
  }

  state.selected = new Set(allKeys());
  bindEvents();
  render();
})();
