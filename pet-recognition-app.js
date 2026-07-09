      const compareKey = "COMPARE";
      const beastCostKey = "BEAST_COST";
      const matrixKey = "MATRIX";
      const gemKey = "GEMS";
      const basicKey = "BASIC";
      const sourceKey = "SOURCES";
      let activeKey = compareKey;
      let activeFolderKey = "FC";
      let activeMatrixSectionKey = "daily";
      let activeCompareMode = "focus";
      let activeBeastCostType = "all";
      let activeBeastCostRuleKey = "all";
      let beastCostChart = null;
      let chartLibraryPromise = null;
      let beastTaskInputTimer = null;
      let matrixDensity = "compact";
      const matrixDisplay = {
        stats: true,
        aptitude: true,
        skills: true,
      };
      const gemAccountDatasets = window.equipmentDatasets || [];
      const gemMarketSnapshotData = window.gemMarketSnapshots || [];

      const viewCopy = {
        [compareKey]: {
          title: "总览",
          description: "跨目录汇总定位、技能、面板和资质，适合先筛出值得继续看的宝宝。",
        },
        [beastCostKey]: {
          title: "神兽成本",
          description: "先看逐只缺口清单，再看按缺项汇总；所有金额单位都是万。",
        },
        [matrixKey]: {
          title: "矩阵对比",
          description: "按目录和固定宝宝类型铺开，适合快速看每个账号/目录缺什么、强在哪。",
        },
        [gemKey]: {
          title: "升级计划",
          description: "按账号规划宝石 13 段和神兽任务资金，先看排期，再看明细。",
        },
        [basicKey]: {
          title: "宠物资料",
          description: "按原始目录查看识别记录、截图来源、面板、资质和完整技能列表。",
        },
        [sourceKey]: {
          title: "基础资料",
          description: "查看截图证据、识别记录、基础数据和分析模块的分层结构。",
        },
      };

      function setViewCopy(key) {
        const copy = viewCopy[key] || viewCopy[compareKey];
        document.body.dataset.view = key;
        document.getElementById("viewTitle").textContent = key === basicKey ? `${copy.title}：${(datasets.find((item) => item.key === activeFolderKey) || datasets[0]).label}` : copy.title;
        document.getElementById("viewDescription").textContent = copy.description;
      }

      const inheritedSkills = (record, allRecords) => {
        if (record.skills) return record.skills;
        const sourceId = record.same.match(/同\s+(\d+)/)?.[1];
        return allRecords.find((item) => item.id === sourceId)?.skills || [];
      };

      const isPending = (text) => text.includes("待确认") || text.includes("疑似");
      const imagePath = (file, folder = activeFolderKey) => `./图片/${folder}/${file}`;
      const sourcePath = (source) => (source ? `./${String(source).replaceAll("\\", "/")}` : "");
      const shotImagePath = (shot) => sourcePath(shot.sourceImage || shot.legacySourceImage) || imagePath(shot.file, shot.folder);
      const isCountedSkill = (skill) =>
        skill !== "空" &&
        !skill.includes("(符)") &&
        !skill.includes("(驭)") &&
        !skill.includes("强化") &&
        !skill.includes("之心") &&
        !skill.startsWith("觉醒");

      const getRowValue = (rows = [], label) => rows.find(([name]) => name.includes(label))?.[1] || "";
      const parseFirstNumber = (value) => Number(String(value || "").match(/\d+/)?.[0] || 0);
      const cleanPetName = (pet) => pet.replace(/\(\d+\)/g, "");
      const displayPetName = (pet) => cleanPetName(pet).trim();
      const unique = (items) => [...new Set(items.filter(Boolean))];
      const displaySkillName = (skill) => String(skill || "").replace(/^小/, "低级");

      function heartClass(heart = "") {
        if (heart.includes("红")) return "heart-red";
        if (heart.includes("蓝")) return "heart-blue";
        if (heart.includes("橙")) return "heart-orange";
        if (heart.includes("紫")) return "heart-purple";
        if (heart.includes("绿")) return "heart-green";
        return "";
      }

      function renderHeartChip(heart, query = "") {
        if (!heart) return "";
        return `<span class="heart-chip ${heartClass(heart)}">${highlight(heart, query)}</span>`;
      }

      function skillToneClass(skill = "") {
        const normalized = normalizeMatrixSkill(skill);
        const text = `${skill} ${normalized}`;
        if (isPending(text)) return "skill-pending";
        if (text.includes("觉醒")) return "skill-awaken";
        if (text.includes("(驭)") || text.includes("（驭）")) return "skill-drive";
        if (text.includes("(符)") || text.includes("（符）")) return "skill-rune";
        if (text.includes("强化") || text.includes("之心")) return "skill-boost";
        if (["法术", "法暴", "法连", "灵蕴", "凝气", "涡轮火", "雷利风行", "分水神剑", "山崩地倾", "红莲业火", "葫芦仙法"].some((keyword) => text.includes(keyword))) return "skill-magic";
        if (["必杀", "连击", "强力", "吸血", "偷袭", "夜战", "狂暴", "攻坚", "追击", "水刃斩", "剑气四射", "生死相依", "一马当先"].some((keyword) => text.includes(keyword))) return "skill-output";
        if (["强壮", "抵御", "防御", "幸运", "神佑", "保命", "再生", "凝神", "反震", "自愈", "吸收", "幽冥之佑"].some((keyword) => text.includes(keyword))) return "skill-survive";
        return "skill-function";
      }

      function panelNumber(group, label) {
        return parseFirstNumber(getRowValue(group.stats?.panel, label));
      }

      function aptitudeValue(group, label) {
        return getRowValue(group.stats?.aptitude, label);
      }

      function currentAptitudeValue(value) {
        return String(value || "").split("/")[0] || "";
      }

      function currentAptitudeNumber(value) {
        return Number(currentAptitudeValue(value) || 0);
      }

      const beastBaseAptitudes = {
        神兽青蛇: { attack: 1500, defense: 1450, stamina: 1450, magic: 1500, speed: 1400 },
        神兽龙马: { attack: 1500, defense: 1500, stamina: 1450, magic: 1450, speed: 1400 },
      };

      function beastStage(row) {
        const base = beastBaseAptitudes[row.cleanName];
        if (!base) return "";
        const minDelta = beastStageDelta(row);
        if (minDelta >= 70) return "进阶2";
        if (minDelta >= 50) return "进阶1";
        return beastHasOrnament(row) ? "有饰品" : "";
      }

      function beastHasOrnament(row) {
        return row.cleanName !== "神兽龙马";
      }

      function beastStageDelta(row) {
        const base = beastBaseAptitudes[row.cleanName];
        if (!base) return null;
        const deltas = [
          currentAptitudeNumber(row.attackApt) - base.attack,
          currentAptitudeNumber(row.defenseApt) - base.defense,
          currentAptitudeNumber(row.staminaApt) - base.stamina,
          currentAptitudeNumber(row.magicApt) - base.magic,
          currentAptitudeNumber(row.speedApt) - base.speed,
        ];
        return Math.min(...deltas);
      }

      function beastStageFlags(row) {
        const minDelta = beastStageDelta(row);
        if (minDelta === null) {
          return { ornament: "", advance1: "", advance2: "", skin: "" };
        }
        return {
          ornament: beastHasOrnament(row) ? "有" : "",
          advance1: minDelta >= 50 ? "有" : "",
          advance2: minDelta >= 70 ? "有" : "",
          skin: "",
        };
      }

      function talentNumber(meta = "") {
        return parseFirstNumber(meta.match(/[优极]\((\d+)\)/)?.[1]);
      }

      function bloodlineText(meta = "") {
        return meta.match(/血脉：([^｜]+)/)?.[1] || "";
      }

      function keySkillText(skills) {
        const keywords = [
          "剑气",
          "高级必杀",
          "高级连击",
          "高级吸血",
          "高级偷袭",
          "高级强力",
          "高级夜战",
          "高级攻坚",
          "高级隐身",
          "法术",
          "法爆",
          "法连",
          "灵蕴",
          "涡轮火",
          "分水神剑",
          "雷利风行",
          "山崩地倾",
          "红莲业火",
          "葫芦仙法",
          "水刃斩",
          "生死相依",
          "幽冥之佑",
          "高级敏捷",
          "高级强壮",
          "高级防御",
        ];
        const picked = skills.filter((skill) => skill !== "空" && keywords.some((keyword) => skill.includes(keyword)));
        const primary = unique(picked).slice(0, 7);
        const fallback = unique(skills.filter((skill) => skill !== "空")).slice(0, 5);
        return (primary.length ? primary : fallback).map(displaySkillName).join("、");
      }

      function isBookPending(row) {
        if (row.skills.filter((skill) => skill === "空").length >= 4) return true;

        const petName = cleanPetName(row.pet);
        const isBeast = row.pet.includes("神兽") || aptitudeValue(row, "寿命") === "永生";
        if (!isBeast || petName !== "神兽青蛇") return false;

        const countedSkillCount = row.skills.filter(isCountedSkill).length;
        const text = row.skills.join("、");
        const hasCoreDirectionSkill = [
          "高级必杀",
          "高级连击",
          "高级强力",
          "高级偷袭",
          "高级法术暴击",
          "高级法术连击",
          "高级灵蕴",
          "剑气四射",
          "高级隐身",
        ].some((skill) => text.includes(skill));
        return countedSkillCount <= 5 && !hasCoreDirectionSkill;
      }

      function isPendingBookRow(row) {
        return row?.analysis?.primary === "待打书";
      }

      function classifyComparisonRow(row) {
        const text = row.skills.join("、");
        const isBeast = row.pet.includes("神兽") || aptitudeValue(row, "寿命") === "永生";
        const petName = cleanPetName(row.pet);
        if (isBookPending(row)) {
          return {
            primary: "待打书",
            tone: "pending",
            tags: unique(["待打书", isBeast ? "神兽" : ""]),
            advice: "技能未成型或空位较多，按待打书半成品看，先不按最终定位评价强弱。",
          };
        }
        const forcedRole = petName === "桃花精灵" ? "千速" : ["赤炎童子", "冥卫"].includes(petName) ? "卡速" : "";
        if (forcedRole) {
          return {
            primary: forcedRole,
            tone: "speed",
            tags: unique([forcedRole, isBeast ? "神兽" : ""]),
            advice: forcedRole === "千速" ? "按千速功能宠比较，重点看速度面板、生存和速度资质。" : "按卡速功能宠比较，重点看速度、生存、抗性和敏捷投入。",
          };
        }
        const hasSword = text.includes("剑气四射");
        const hasSpecialMagic = ["涡轮火", "分水神剑", "雷利风行", "山崩地倾", "葫芦仙法"].some((skill) => text.includes(skill));
        const hasNormalMagic = ["红莲业火"].some((skill) => text.includes(skill));
        const hasMagicSkill = hasSpecialMagic || hasNormalMagic || text.includes("法术") || text.includes("法连") || text.includes("法爆") || text.includes("灵蕴");
        const hasAdvancedStealth = text.includes("高级隐身");

        if (petName === "沧海公主") {
          return {
            primary: "特殊单攻",
            tone: "physical",
            tags: unique(["特殊单攻", isBeast ? "神兽" : ""]),
            advice: "按特殊单攻宝宝比较，重点看攻击面板、核心输出技能和生存补强。",
          };
        }

        if (petName === "神兽青蛇" && hasMagicSkill) {
          return {
            primary: "普通法",
            tone: "magic",
            tags: unique(["普通法", "神兽"]),
            advice: "神兽青蛇带法系技能，按普通法宝宝比较法连/法暴/灵蕴、灵力和法资。",
          };
        }

        if (hasAdvancedStealth && row.speed < 1400) {
          return {
            primary: "隐攻",
            tone: "physical",
            tags: unique(["隐攻", isBeast ? "神兽" : "", hasSword ? "剑气" : ""]),
            advice: "带高级隐身且不是千速，按隐攻宝宝比较攻击面板、必杀/连击/偷袭和生存。",
          };
        }

        const magicScore =
          (row.spirit >= 1200 ? 2 : 0) +
          (text.includes("法术") || text.includes("法连") || text.includes("法爆") ? 2 : 0) +
          (text.includes("灵蕴") ? 1 : 0) +
          (hasSpecialMagic || hasNormalMagic ? 2 : 0);
        const physicalScore =
          (row.attack >= 1800 ? 2 : 0) +
          (text.includes("高级必杀") ? 1 : 0) +
          (text.includes("高级连击") ? 1 : 0) +
          (text.includes("高级吸血") ? 1 : 0) +
          (text.includes("高级偷袭") ? 1 : 0) +
          (text.includes("高级强力") || text.includes("高级攻坚") ? 1 : 0) +
          (hasSword ? 2 : 0);

        const tags = [];
        let primary = "待归类";
        let tone = "";
        let advice = "记录字段完整度够用，建议结合队伍缺口再定用途。";

        if (row.speed >= 1400) {
          primary = "千速";
          tone = "speed";
          advice = "速度面板达到高速段，优先按千速/高速功能宠比较生存和速度资质。";
        } else if (row.speed >= 850 && row.attack < 1300 && row.spirit < 800) {
          primary = row.speed >= 1000 ? "千速" : "卡速";
          tone = "speed";
          advice = "速度明显高于常规输出宠，适合按卡速功能宠看抗性、血量和敏捷投入。";
        } else if (magicScore >= physicalScore && magicScore >= 3) {
          primary = hasSpecialMagic ? "特殊法" : "普通群法";
          tone = "magic";
          advice = "法系方向，重点看法连/法暴/灵蕴、灵力面板、法资与成品技能完整度。";
        } else if (physicalScore >= 3) {
          primary = hasSword ? "剑气" : "全力单攻";
          tone = "physical";
          advice = hasSword ? "物理剑气方向，重点比较攻击面板、必杀/强力/攻坚和剑气来源。" : "物理单攻方向，重点比较攻击面板、必杀/连击/吸血/偷袭完整度。";
        } else if (hasNormalMagic || text.includes("高级敏捷")) {
          primary = row.speed >= 850 ? "卡速" : "普通群法";
          tone = row.speed >= 850 ? "speed" : "magic";
          advice = row.speed >= 850 ? "可按卡速功能位观察，速度未到千速但有敏捷或功能技能。" : "有群法/法系技能信号，但面板更像低投入或未成型。";
        }

        tags.push(primary);
        if (isBeast) tags.push("神兽");
        if (primary !== "千速" && row.speed >= 1000) tags.push("千速");
        if (primary !== "卡速" && row.speed >= 850 && row.speed < 1000) tags.push("卡速");
        if (primary !== "剑气" && hasSword) tags.push("剑气");

        return { primary, tone, tags: unique(tags), advice };
      }

      function buildComparisonRows() {
        return datasets.flatMap((dataset) =>
          buildGroups(dataset.records).map((group) => {
            const row = {
              ...group,
              datasetKey: dataset.key,
              datasetLabel: dataset.label,
              source: dataset.source,
              cleanName: cleanPetName(group.pet),
              skillCount: group.skills.filter(isCountedSkill).length,
              keySkills: keySkillText(group.skills),
              hp: panelNumber(group, "气血"),
              attack: panelNumber(group, "攻击"),
              defense: panelNumber(group, "防御"),
              speed: panelNumber(group, "速度"),
              spirit: panelNumber(group, "灵力"),
              talent: talentNumber(group.meta),
              bloodline: bloodlineText(group.meta),
              life: aptitudeValue(group, "寿命"),
              speedApt: aptitudeValue(group, "速度资质"),
              attackApt: aptitudeValue(group, "攻击资质"),
              defenseApt: aptitudeValue(group, "防御资质"),
              staminaApt: aptitudeValue(group, "体力资质"),
              magicApt: aptitudeValue(group, "法力资质"),
            };
            row.beastStage = beastStage(row);
            row.beastStages = beastStageFlags(row);
            row.beastCost = beastCostSummary(row);
            row.analysis = classifyComparisonRow(row);
            row.searchText = [
              row.datasetLabel,
              row.pet,
              row.cleanName,
              row.meta,
              row.heart || "",
              row.skillCount,
              row.keySkills,
              row.analysis.primary,
              row.analysis.tags.join(" "),
              row.beastStage,
              row.beastCost?.detail || "",
              row.beastCost ? formatWan(row.beastCost.totalWan) : "",
              row.analysis.advice,
              ...row.shots.flatMap((shot) => [shot.id, shot.file, shot.note]),
              ...statsSearchText(row.stats),
              ...row.skills,
            ]
              .join(" ")
              .toLowerCase();
            return row;
          })
        );
      }

      function topRows(rows, metric, limit = 3) {
        return [...rows].sort((a, b) => b[metric] - a[metric] || b.talent - a.talent).slice(0, limit);
      }

      function roleCount(rows, names) {
        return rows.filter((row) => names.includes(row.analysis.primary) || row.analysis.tags.some((tag) => names.includes(tag))).length;
      }

      function renderRoleTags(row, query) {
        return `<div class="role-tags">${row.analysis.tags
          .map((tag) => {
            const cls = tag.includes("待打书") ? "pending-book" : tag.includes("法") ? "magic" : tag.includes("剑气") || tag.includes("单攻") || tag.includes("隐攻") ? "physical" : tag.includes("速") ? "speed" : tag.includes("神兽") ? "beast" : "";
            return `<span class="role-tag ${cls}">${highlight(tag, query)}</span>`;
          })
          .join("")}</div>`;
      }

      function renderMetricLine(row) {
        return `<div class="metric-line">
          <span>攻 <b>${row.attack || "-"}</b></span>
          <span>速 <b>${row.speed || "-"}</b></span>
          <span>灵 <b>${row.spirit || "-"}</b></span>
          <span>血 <b>${row.hp || "-"}</b></span>
        </div>`;
      }

      function renderRoleCards(rows, query) {
        const cardData = [
          {
            title: "法宝宝",
            count: roleCount(rows, ["特殊法", "普通群法", "普通法"]),
            detail: topRows(rows.filter((row) => ["特殊法", "普通群法", "普通法"].includes(row.analysis.primary)), "spirit")
              .map((row) => `${row.datasetLabel} ${displayPetName(row.pet)}(${row.spirit})`)
              .join("；") || "暂无",
          },
          {
            title: "物理宝宝",
            count: roleCount(rows, ["剑气", "全力单攻", "特殊单攻", "隐攻"]),
            detail: topRows(rows.filter((row) => ["剑气", "全力单攻", "特殊单攻", "隐攻"].includes(row.analysis.primary)), "attack")
              .map((row) => `${row.datasetLabel} ${displayPetName(row.pet)}(${row.attack})`)
              .join("；") || "暂无",
          },
          {
            title: "卡速 / 千速",
            count: roleCount(rows, ["卡速", "千速"]),
            detail: topRows(rows.filter((row) => row.analysis.tags.includes("卡速") || row.analysis.tags.includes("千速")), "speed")
              .map((row) => `${row.datasetLabel} ${displayPetName(row.pet)}(${row.speed})`)
              .join("；") || "暂无",
          },
          {
            title: "神兽",
            count: roleCount(rows, ["神兽"]),
            detail: topRows(rows.filter((row) => row.analysis.tags.includes("神兽")), "talent")
              .map((row) => `${row.datasetLabel} ${displayPetName(row.pet)}(${row.talent || "无天资"})`)
              .join("；") || "暂无",
          },
        ];

        return `<div class="compare-cards">${cardData
          .map(
            (card) => `<article class="compare-card">
              <strong>${card.count}</strong>
              <span>${card.title}</span>
              <p>${highlight(card.detail, query)}</p>
            </article>`
          )
          .join("")}</div>`;
      }

      function renderInsights(rows, query) {
        const magicTop = topRows(rows.filter((row) => ["特殊法", "普通群法", "普通法"].includes(row.analysis.primary)), "spirit", 4);
        const physicalTop = topRows(rows.filter((row) => ["剑气", "全力单攻", "特殊单攻", "隐攻"].includes(row.analysis.primary)), "attack", 4);
        const speedTop = topRows(rows.filter((row) => row.analysis.tags.includes("卡速") || row.analysis.tags.includes("千速")), "speed", 4);
        const beastTop = topRows(rows.filter((row) => row.analysis.tags.includes("神兽")), "talent", 4);
        const lines = [
          ["法系候选", magicTop.map((row) => `${row.datasetLabel} ${displayPetName(row.pet)}：灵力 ${row.spirit}，${row.analysis.primary}`).join("；")],
          ["物理候选", physicalTop.map((row) => `${row.datasetLabel} ${displayPetName(row.pet)}：攻击 ${row.attack}，${row.analysis.primary}`).join("；")],
          ["速度候选", speedTop.map((row) => `${row.datasetLabel} ${displayPetName(row.pet)}：速度 ${row.speed}，${row.analysis.primary}`).join("；")],
          ["神兽候选", beastTop.map((row) => `${row.datasetLabel} ${displayPetName(row.pet)}：天资 ${row.talent || "-"}，${row.bloodline || "无血脉"}`).join("；")],
        ];

        return `<div class="insight-list">${lines
          .map(([title, body]) => `<div class="insight"><b>${title}</b><span>${highlight(body || "暂无", query)}</span></div>`)
          .join("")}</div>`;
      }

      function compareSpeciesData(rows) {
        const byName = new Map();
        rows.forEach((row) => {
          if (!byName.has(row.cleanName)) byName.set(row.cleanName, []);
          byName.get(row.cleanName).push(row);
        });
        return [...byName.entries()]
          .map(([name, items]) => ({
            name,
            items,
            folders: unique(items.map((item) => item.datasetLabel)).join("、"),
            roles: unique(items.flatMap((item) => item.analysis.tags)).join("、"),
            bestTalent: topRows(items, "talent", 1)[0],
            bestAttack: topRows(items, "attack", 1)[0],
            bestSpeed: topRows(items, "speed", 1)[0],
            bestSpirit: topRows(items, "spirit", 1)[0],
          }))
          .sort((a, b) => b.items.length - a.items.length || b.bestTalent.talent - a.bestTalent.talent)
          .slice(0, 12);
      }

      function renderCompareModeTabs(rows) {
        const counts = {
          focus: "4类",
          folders: unique(rows.map((row) => row.datasetLabel)).length,
          records: rows.length,
          species: compareSpeciesData(rows).length,
        };
        const modes = [
          ["focus", "推荐清单"],
          ["folders", "目录概览"],
          ["records", "全记录"],
          ["species", "同名对比"],
        ];
        return `<div class="compare-mode-tabs" role="group" aria-label="总览模式">
          ${modes
          .map(([key, label]) => `<button class="compare-mode-tab${activeCompareMode === key ? " active" : ""}" type="button" data-compare-mode="${key}" aria-pressed="${activeCompareMode === key}">${label}<span>${counts[key]}</span></button>`)
          .join("")}</div>`;
      }

      function compareMetricForRow(row) {
        if (row.analysis.tags.includes("神兽") && row.talent) return { label: "天资", value: row.talent };
        if (["特殊法", "普通群法", "普通法"].includes(row.analysis.primary)) return { label: "灵力", value: row.spirit };
        if (["剑气", "全力单攻", "特殊单攻", "隐攻"].includes(row.analysis.primary)) return { label: "攻击", value: row.attack };
        if (row.analysis.tags.includes("卡速") || row.analysis.tags.includes("千速")) return { label: "速度", value: row.speed };
        return { label: "技能", value: row.skillCount || "-" };
      }

      function renderCompareCandidate(row, metric, metricLabel, query) {
        const value = row[metric] || "-";
        return `<article class="compare-candidate">
          <div>
            <div class="compare-candidate-title">
              <span class="tag">${row.datasetLabel}</span>
              <strong>${highlight(displayPetName(row.pet), query)}</strong>
            </div>
            <div class="compare-candidate-meta">
              ${renderRoleTags(row, query)}
              ${renderMetricLine(row)}
              <div class="compare-candidate-skills">${highlight(row.keySkills || "暂无关键技能", query)}</div>
            </div>
          </div>
          <div class="compare-candidate-score">
            <span>${metricLabel}</span>
            <b>${highlight(String(value), query)}</b>
          </div>
        </article>`;
      }

      function renderCompareFocusCards(rows, query) {
        const usableRows = rows.filter((row) => !isPendingBookRow(row));
        const groups = [
          {
            title: "法系先看",
            count: roleCount(rows, ["特殊法", "普通群法", "普通法"]),
            rows: topRows(usableRows.filter((row) => ["特殊法", "普通群法", "普通法"].includes(row.analysis.primary)), "spirit", 4),
            metric: "spirit",
            metricLabel: "灵力",
          },
          {
            title: "物理先看",
            count: roleCount(rows, ["剑气", "全力单攻", "特殊单攻", "隐攻"]),
            rows: topRows(usableRows.filter((row) => ["剑气", "全力单攻", "特殊单攻", "隐攻"].includes(row.analysis.primary)), "attack", 4),
            metric: "attack",
            metricLabel: "攻击",
          },
          {
            title: "速度先看",
            count: roleCount(rows, ["卡速", "千速"]),
            rows: topRows(usableRows.filter((row) => row.analysis.tags.includes("卡速") || row.analysis.tags.includes("千速")), "speed", 4),
            metric: "speed",
            metricLabel: "速度",
          },
          {
            title: "神兽先看",
            count: roleCount(rows, ["神兽"]),
            rows: topRows(usableRows.filter((row) => row.analysis.tags.includes("神兽")), "talent", 4),
            metric: "talent",
            metricLabel: "天资",
          },
        ];
        return `<div class="compare-focus-grid">${groups
          .map(
            (group) => `<article class="compare-focus-card">
              <div class="compare-focus-head">
                <h3>${group.title}</h3>
                <span class="compare-focus-count">${group.count} 只</span>
              </div>
              <div class="compare-candidate-list">
                ${group.rows.length ? group.rows.map((row) => renderCompareCandidate(row, group.metric, group.metricLabel, query)).join("") : '<div class="same">暂无匹配记录</div>'}
              </div>
            </article>`
          )
          .join("")}</div>`;
      }

      function renderFolderBestLine(label, row, metric, metricLabel, query) {
        if (!row) return `<div class="compare-best-row"><b>${label}</b><span>暂无</span></div>`;
        return `<div class="compare-best-row"><b>${label}</b><span>${highlight(displayPetName(row.pet), query)}｜${metricLabel} ${highlight(String(row[metric] || "-"), query)}｜${highlight(row.analysis.primary, query)}</span></div>`;
      }

      function renderFolderOverviewCards(rows, query) {
        return `<div class="compare-folder-grid">${datasets
          .map((dataset) => {
            const items = rows.filter((row) => row.datasetKey === dataset.key);
            const usable = items.filter((row) => !isPendingBookRow(row));
            const magic = topRows(usable.filter((row) => ["特殊法", "普通群法", "普通法"].includes(row.analysis.primary)), "spirit", 1)[0];
            const physical = topRows(usable.filter((row) => ["剑气", "全力单攻", "特殊单攻", "隐攻"].includes(row.analysis.primary)), "attack", 1)[0];
            const speed = topRows(usable.filter((row) => row.analysis.tags.includes("卡速") || row.analysis.tags.includes("千速")), "speed", 1)[0];
            return `<article class="compare-folder-card">
              <div class="compare-folder-head">
                <h3>${dataset.label}</h3>
                <span class="compare-folder-count">${items.length} 组</span>
              </div>
              <div class="compare-folder-stats">
                <span class="compare-mini-stat">神兽 <b>${items.filter((row) => row.analysis.tags.includes("神兽")).length}</b></span>
                <span class="compare-mini-stat">待确认 <b>${items.filter((row) => row.skills.some(isPending)).length}</b></span>
                <span class="compare-mini-stat">截图 <b>${items.reduce((sum, row) => sum + row.shots.length, 0)}</b></span>
              </div>
              <div class="compare-folder-best">
                ${renderFolderBestLine("法系", magic, "spirit", "灵力", query)}
                ${renderFolderBestLine("物理", physical, "attack", "攻击", query)}
                ${renderFolderBestLine("速度", speed, "speed", "速度", query)}
              </div>
            </article>`;
          })
          .join("")}</div>`;
      }

      function renderCompareRecordCards(rows, query) {
        return `<div class="compare-record-list">${rows
          .map((row) => {
            const pendingBook = isPendingBookRow(row);
            const score = compareMetricForRow(row);
            return `<article class="compare-record-card">
              <div>
                <div class="compare-record-title">
                  <span class="tag">${row.datasetLabel}</span>
                  <strong>${highlight(displayPetName(row.pet), query)}</strong>
                </div>
                <div class="compare-record-meta">
                  ${renderRoleTags(row, query)}
                  ${pendingBook ? '<span class="matrix-empty">待打书</span>' : renderMetricLine(row)}
                  <div class="compare-record-skills">${pendingBook ? "空位较多，先按半成品看" : highlight(row.keySkills || "暂无关键技能", query)}</div>
                </div>
              </div>
              <div class="compare-record-score">
                <span>${score.label}</span>
                <b>${highlight(String(score.value), query)}</b>
              </div>
            </article>`;
          })
          .join("")}</div>`;
      }

      function renderSpeciesCards(rows, query) {
        return `<div class="compare-species-grid">${compareSpeciesData(rows)
          .map(
            (item) => `<article class="compare-species-card">
              <div class="compare-species-head">
                <h3>${highlight(item.name, query)}</h3>
                <span class="compare-folder-count">${item.items.length} 组</span>
              </div>
              <div class="compare-species-stats">
                <span class="compare-mini-stat">${highlight(item.folders, query)}</span>
                <span class="compare-mini-stat">${highlight(item.roles || "未归类", query)}</span>
              </div>
              <div class="compare-species-best">
                ${renderFolderBestLine("天资", item.bestTalent, "talent", "天资", query)}
                ${renderFolderBestLine("攻击", item.bestAttack, "attack", "攻击", query)}
                ${renderFolderBestLine("速度", item.bestSpeed, "speed", "速度", query)}
                ${renderFolderBestLine("灵力", item.bestSpirit, "spirit", "灵力", query)}
              </div>
            </article>`
          )
          .join("")}</div>`;
      }

      function renderBeastMissingCompact(row, query = "") {
        if (!row?.beastCost) return "";
        return row.beastCost.missing.length ? `<span class="beast-missing-text">${highlight(row.beastCost.detail, query)}</span>` : '<span class="beast-complete">已齐</span>';
      }

      function renderBeastEstimateCompact(row, query = "") {
        const estimates = row?.beastCost?.estimates || [];
        if (!estimates.length) return '<span class="matrix-empty">-</span>';
        return `<div class="beast-matrix-missing-list">${estimates
          .map((rule) => `<span class="beast-matrix-chip estimate">${highlight(rule.label, query)} ${formatWan(rule.priceWan)}</span>`)
          .join("")}</div>`;
      }

      function beastCostRows(rows) {
        return rows.filter((row) => row.beastCost);
      }

      function beastCostTotals(beasts) {
        const totalWan = beasts.reduce((sum, row) => sum + row.beastCost.totalWan, 0);
        const estimatedWan = beasts.reduce((sum, row) => sum + row.beastCost.estimatedWan, 0);
        return {
          totalWan,
          estimatedWan,
          totalWithEstimate: totalWan + estimatedWan,
          totalEggs: beasts.reduce((sum, row) => sum + row.beastCost.eggCount, 0),
          maxRow: [...beasts].sort((a, b) => b.beastCost.totalWithEstimate - a.beastCost.totalWithEstimate || b.talent - a.talent)[0],
        };
      }

      function beastCostFocusedTotals(beasts, ruleKey) {
        if (ruleKey === "all") return beastCostTotals(beasts);
        const totalWan = beasts.reduce((sum, row) => sum + row.beastCost.missing.filter((rule) => rule.key === ruleKey).reduce((ruleSum, rule) => ruleSum + rule.priceWan, 0), 0);
        const estimatedWan = beasts.reduce((sum, row) => sum + row.beastCost.estimates.filter((rule) => rule.key === ruleKey).reduce((ruleSum, rule) => ruleSum + rule.priceWan, 0), 0);
        return {
          totalWan,
          estimatedWan,
          totalWithEstimate: totalWan + estimatedWan,
          totalEggs: beasts.reduce((sum, row) => sum + row.beastCost.missing.filter((rule) => rule.key === ruleKey).reduce((ruleSum, rule) => ruleSum + rule.eggCount, 0), 0),
          maxRow: beasts[0],
        };
      }

      function beastCostRuleStats(beasts) {
        return beastCostRules.map((rule) => {
          const count = beasts.filter((row) => row.beastCost.missing.some((item) => item.key === rule.key)).length;
          return {
            ...rule,
            kind: "confirmed",
            count,
            totalWan: count * rule.priceWan,
            totalEggs: count * rule.eggCount,
          };
        });
      }

      function beastEstimateRuleStats(beasts) {
        return beastEstimateRules.map((rule) => {
          const count = beasts.filter((row) => row.beastCost.estimates.some((item) => item.key === rule.key)).length;
          return {
            ...rule,
            kind: "estimate",
            count,
            totalWan: count * rule.priceWan,
            totalEggs: 0,
          };
        });
      }

      function renderBeastStageChips(row) {
        const flags = row.beastStages || {};
        return `<div class="beast-stage-list">${beastCostRules
          .filter((rule) => beastRuleApplies(row, rule))
          .map((rule) => `<span class="beast-stage-chip ${flags[rule.key] ? "done" : "missing"}">${rule.label}${flags[rule.key] ? "有" : "缺"}</span>`)
          .join("")}</div>`;
      }

      function renderBeastCostFallback(ruleStats) {
        const maxWan = Math.max(...ruleStats.map((item) => item.totalWan), 1);
        return ruleStats
          .map(
            (item) => `<div class="beast-bar-row">
              <b>${item.label}</b>
              <div class="beast-bar-track" aria-hidden="true"><div class="beast-bar-fill" style="width: ${(item.totalWan / maxWan) * 100}%"></div></div>
              <span>${formatWan(item.totalWan)}</span>
            </div>`
          )
          .join("");
      }

      function destroyBeastCostChart() {
        if (beastCostChart) {
          beastCostChart.destroy();
          beastCostChart = null;
        }
      }

      function ensureChartLibrary() {
        if (window.Chart) return Promise.resolve(window.Chart);
        if (chartLibraryPromise) return chartLibraryPromise;
        chartLibraryPromise = new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js";
          script.async = true;
          script.onload = () => (window.Chart ? resolve(window.Chart) : reject(new Error("Chart.js 未加载")));
          script.onerror = () => reject(new Error("Chart.js 加载失败"));
          document.head.appendChild(script);
        });
        return chartLibraryPromise;
      }

      function renderBeastCostChart(ruleStats) {
        const canvas = document.getElementById("beastCostChart");
        const fallback = document.getElementById("beastCostFallback");
        if (!canvas || !fallback) {
          destroyBeastCostChart();
          return;
        }
        fallback.innerHTML = renderBeastCostFallback(ruleStats);
        fallback.hidden = false;
        canvas.hidden = false;
        canvas.style.visibility = "hidden";
        window.__beastCostChartReady = false;
        ensureChartLibrary()
          .then((Chart) => {
            if (!document.body.contains(canvas)) return;
            destroyBeastCostChart();
            beastCostChart = new Chart(canvas, {
              type: "bar",
              data: {
                labels: ruleStats.map((item) => item.label),
                datasets: [
                  {
                    label: "成本（万）",
                    data: ruleStats.map((item) => item.totalWan),
                    backgroundColor: ["#165a92", "#0f8f85", "#b87514", "#6957b8", "#c8652a", "#b94a48"],
                    borderRadius: 6,
                  },
                ],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (context) => `${context.dataset.label}: ${formatWan(context.parsed.y)}`,
                    },
                  },
                },
                scales: {
                  x: { grid: { display: false } },
                  y: { beginAtZero: true, ticks: { callback: (value) => `${value}万` } },
                },
              },
            });
            window.__beastCostChartReady = true;
            fallback.hidden = true;
            canvas.style.visibility = "visible";
            canvas.hidden = false;
          })
          .catch(() => {
            destroyBeastCostChart();
            window.__beastCostChartReady = false;
            canvas.style.visibility = "";
            canvas.hidden = true;
            fallback.hidden = false;
          });
      }

      function renderComparisonTable(rows, query, className = "") {
        return `<div class="table-wrap ${className}">
          <table class="compare-table" aria-label="横向记录明细">
            <thead>
              <tr>
                <th scope="col">目录</th>
                <th scope="col">宠物</th>
                <th scope="col">定位</th>
                <th scope="col">技能</th>
                <th scope="col">面板</th>
                <th scope="col">天资 / 心 / 血脉</th>
                <th scope="col">资质</th>
                <th scope="col">建议</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map((row) => {
                  const pendingBook = isPendingBookRow(row);
                  return `<tr>
                    <td><span class="tag">${row.datasetLabel}</span></td>
                    <td>
                      <div class="pet-name">${highlight(displayPetName(row.pet), query)}</div>
                    </td>
                    <td>${renderRoleTags(row, query)}</td>
                    <td>
                      ${
                        pendingBook
                          ? '<span class="matrix-empty">-</span>'
                          : `<div class="tag">技能数 ${row.skillCount}</div>
                      <div class="key-skills">${highlight(row.keySkills, query)}</div>`
                      }
                    </td>
                    <td>${pendingBook ? '<span class="matrix-empty">-</span>' : renderMetricLine(row)}</td>
                    <td><div class="metric-line"><span>天资 <b>${row.talent || "-"}</b></span>${row.heart ? renderHeartChip(row.heart, query) : `<span>${highlight("未记心色", query)}</span>`}<span>${highlight(row.bloodline || "-", query)}</span></div></td>
                    <td>${pendingBook ? '<span class="matrix-empty">-</span>' : highlight(`攻资 ${currentAptitudeValue(row.attackApt) || "-"}｜法资 ${currentAptitudeValue(row.magicApt) || "-"}｜速资 ${currentAptitudeValue(row.speedApt) || "-"}｜寿命 ${row.life || "-"}`, query)}</td>
                    <td class="advice">${highlight(row.analysis.advice, query)}</td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>`;
      }

      function renderSpeciesTable(rows, query) {
        const species = compareSpeciesData(rows);
        return `<div class="table-wrap compare-desktop-table">
          <table class="compare-table" aria-label="同名宠物对比">
            <thead>
              <tr>
                <th scope="col">同名宠物</th>
                <th scope="col">出现目录</th>
                <th scope="col">定位覆盖</th>
                <th scope="col">最高天资</th>
                <th scope="col">最高攻击</th>
                <th scope="col">最高速度</th>
                <th scope="col">最高灵力</th>
              </tr>
            </thead>
            <tbody>
              ${species
                .map(
                  (item) => `<tr>
                    <td><span class="pet-name">${highlight(item.name, query)}</span><div class="sources">${item.items.length} 组记录</div></td>
                    <td>${highlight(item.folders, query)}</td>
                    <td>${highlight(item.roles, query)}</td>
                    <td>${highlight(`${item.bestTalent.datasetLabel} ${item.bestTalent.talent || "-"}`, query)}</td>
                    <td>${highlight(`${item.bestAttack.datasetLabel} ${item.bestAttack.attack || "-"}`, query)}</td>
                    <td>${highlight(`${item.bestSpeed.datasetLabel} ${item.bestSpeed.speed || "-"}`, query)}</td>
                    <td>${highlight(`${item.bestSpirit.datasetLabel} ${item.bestSpirit.spirit || "-"}`, query)}</td>
                  </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>`;
      }

      function renderCompareModeContent(rows, query) {
        if (!["focus", "folders", "records", "species"].includes(activeCompareMode)) activeCompareMode = "focus";
        if (activeCompareMode === "folders") {
          return `<section class="compare-section">
            <div class="compare-head">
              <div>
                <h2>目录概览</h2>
                <p>按目录汇总数量、神兽、待确认和每类最高候选。</p>
              </div>
            </div>
            ${renderFolderOverviewCards(rows, query)}
          </section>`;
        }
        if (activeCompareMode === "records") {
          return `<section class="compare-section">
            <div class="compare-head">
              <div>
                <h2>全记录</h2>
                <p>保留目录、定位、关键技能、面板与资质，按当前搜索结果展示。</p>
              </div>
            </div>
            ${renderCompareRecordCards(rows, query)}
            ${renderComparisonTable(rows, query, "compare-desktop-table")}
          </section>`;
        }
        if (activeCompareMode === "species") {
          return `<section class="compare-section">
            <div class="compare-head">
              <div>
                <h2>同名对比</h2>
                <p>按宠物名聚合，直接看出现目录和最高天资、攻击、速度、灵力。</p>
              </div>
            </div>
            ${renderSpeciesCards(rows, query)}
            ${renderSpeciesTable(rows, query)}
          </section>`;
        }
        return `<section class="compare-section">
          <div class="compare-head">
            <div>
              <h2>推荐清单</h2>
              <p>按法系、物理、速度、神兽拆开，只展示每类优先看的候选。</p>
            </div>
          </div>
          ${renderCompareFocusCards(rows, query)}
        </section>`;
      }

      function renderCompareEmpty(query) {
        return `<section class="empty-state">
          <h2>没有匹配的总览结果</h2>
          <p>当前搜索：<code>${highlight(query, query)}</code>。可搜索目录、宠物名、技能名或定位标签。</p>
        </section>`;
      }

      function renderCompare() {
        destroyBeastCostChart();
        setViewCopy(compareKey);
        const allRows = buildComparisonRows();
        const query = document.getElementById("searchInput").value.trim();
        const queryLower = query.toLowerCase();
        const visible = queryLower ? allRows.filter((row) => row.searchText.includes(queryLower)) : allRows;
        const pending = visible.filter((row) => row.skills.some(isPending)).length;

        document.getElementById("records").innerHTML = visible.length
          ? `<div class="compare-view compare-mode-view">
              ${renderCompareModeTabs(visible)}
              ${renderCompareModeContent(visible, query)}
            </div>`
          : renderCompareEmpty(query);

        document.getElementById("groupCount").textContent = visible.length;
        document.getElementById("shotCount").textContent = visible.reduce((sum, row) => sum + row.shots.length, 0);
        document.getElementById("pendingCount").textContent = pending;
        document.getElementById("folderName").textContent = unique(visible.map((row) => row.datasetLabel)).length || 0;
        document.getElementById("groupLabel").textContent = "横向记录组";
        document.getElementById("shotLabel").textContent = "截图来源";
        document.getElementById("pendingLabel").textContent = "含待确认记录组";
        document.getElementById("folderLabel").textContent = "覆盖目录数";
        document.getElementById("notice").hidden = true;
        renderTabs();
      }

      function renderBeastCostEmpty(query) {
        return `<section class="empty-state">
          <h2>没有匹配的神兽成本结果</h2>
          <p>当前搜索：<code>${highlight(query, query)}</code>。可搜索目录、神兽名、饰品、进阶、皮肤或金额。</p>
        </section>`;
      }

      function renderBeastCostTable(beasts, query) {
        const rows = [...beasts].sort((a, b) => b.beastCost.totalWithEstimate - a.beastCost.totalWithEstimate || b.talent - a.talent);
        return `<div class="table-wrap beast-detail-table">
          <table class="compare-table" aria-label="神兽成本详细核对">
            <thead>
              <tr>
                <th scope="col">目录</th>
                <th scope="col">神兽</th>
                <th scope="col">当前完成</th>
                <th scope="col">还差什么</th>
                <th scope="col">缺蛋</th>
                <th scope="col">确认差价</th>
                <th scope="col">预估项</th>
                <th scope="col">预估差价</th>
                <th scope="col">预估合计</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (row) => `<tr>
                    <td><span class="tag">${row.datasetLabel}</span></td>
                    <td><span class="pet-name">${highlight(displayPetName(row.pet), query)}</span><div class="sources">${highlight(row.bloodline || "无血脉", query)}</div></td>
                    <td>${renderBeastStageChips(row)}</td>
                    <td>${renderBeastMissingCompact(row, query)}</td>
                    <td>${row.beastCost.eggCount ? `${row.beastCost.eggCount} 个` : "-"}</td>
                    <td><strong>${formatWan(row.beastCost.totalWan)}</strong></td>
                    <td>${renderBeastEstimateCompact(row, query)}</td>
                    <td><strong>${row.beastCost.estimatedWan ? formatWan(row.beastCost.estimatedWan) : "-"}</strong></td>
                    <td><strong>${formatWan(row.beastCost.totalWithEstimate)}</strong></td>
                  </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>`;
      }

      function renderBeastTaskSettings(state) {
        const settings = state.settings;
        return `<div class="beast-task-settings">
          <div class="beast-task-field">
            <label for="taskStartDate">起算日期</label>
            <input id="taskStartDate" type="date" value="${settings.startDate}" data-task-setting="startDate" />
          </div>
          <div class="beast-task-field">
            <label for="taskThisWeekEggs">本周还拿蛋</label>
            <input id="taskThisWeekEggs" type="number" min="0" step="0.5" value="${settings.thisWeekEggs}" data-task-setting="thisWeekEggs" />
          </div>
          <div class="beast-task-field">
            <label for="taskWeeklyEggs">每周拿蛋</label>
            <input id="taskWeeklyEggs" type="number" min="0" step="0.5" value="${settings.weeklyEggs}" data-task-setting="weeklyEggs" />
          </div>
          <div class="beast-task-field">
            <label for="taskThisWeekInnerShards">本周锁片</label>
            <input id="taskThisWeekInnerShards" type="number" min="0" step="1" value="${settings.thisWeekInnerShards}" data-task-setting="thisWeekInnerShards" />
          </div>
          <div class="beast-task-field">
            <label for="taskWeeklyInnerShards">每周锁片</label>
            <input id="taskWeeklyInnerShards" type="number" min="0" step="1" value="${settings.weeklyInnerShards}" data-task-setting="weeklyInnerShards" />
          </div>
          <div class="beast-task-field">
            <label for="taskEggPrice">蛋价 / 万</label>
            <input id="taskEggPrice" type="number" min="0" step="0.1" value="${settings.eggPriceWan}" data-task-setting="eggPriceWan" />
          </div>
          <div class="beast-task-field plan-note">
            <label>计划口径</label>
            <input value="周一到周日结算" readonly />
          </div>
        </div>`;
      }

      function renderBeastTaskResources(state) {
        return `<div class="beast-task-resource-grid">
          <div class="beast-resource-header">
            <span>账号</span>
            <span>银子</span>
            <span>神兽蛋</span>
            <span>内丹锁片</span>
            <span>折算合计</span>
          </div>
          ${beastCostFolderOrder
          .map((folderKey) => {
            const resource = state.resources[folderKey] || beastTaskDefaultResources[folderKey];
            const availableWan = numericOrDefault(resource.silverWan, 0) + numericOrDefault(resource.eggCount, 0) * numericOrDefault(state.settings.eggPriceWan, beastEggPriceWan);
            return `<div class="beast-task-resource">
              <div class="beast-resource-title">
                <strong>${folderKey}</strong>
                <span>当前资源</span>
              </div>
              <label class="beast-resource-row">
                <span class="beast-resource-label">银子</span>
                <span class="beast-resource-control">
                  <input type="number" min="0" step="0.5" value="${resource.silverWan}" aria-label="${folderKey} 银子" data-task-resource="${folderKey}" data-task-resource-field="silverWan" />
                  <span class="beast-resource-unit">万</span>
                </span>
              </label>
              <label class="beast-resource-row">
                <span class="beast-resource-label">神兽蛋</span>
                <span class="beast-resource-control">
                  <input type="number" min="0" step="0.5" value="${resource.eggCount}" aria-label="${folderKey} 神兽蛋" data-task-resource="${folderKey}" data-task-resource-field="eggCount" />
                  <span class="beast-resource-unit">个</span>
                </span>
              </label>
              <label class="beast-resource-row">
                <span class="beast-resource-label">锁片</span>
                <span class="beast-resource-control">
                  <input type="number" min="0" step="1" value="${resource.innerShardCount}" aria-label="${folderKey} 神兽内丹锁片" data-task-resource="${folderKey}" data-task-resource-field="innerShardCount" />
                  <span class="beast-resource-unit">片</span>
                </span>
              </label>
              <div class="beast-resource-total">
                <span>折算合计</span>
                <b>${formatWan(availableWan)}</b>
              </div>
              <div class="beast-resource-formula">银子 + 神兽蛋 x ${formatWan(state.settings.eggPriceWan)}；锁片单独排期</div>
            </div>`;
          })
          .join("")}</div>`;
      }

      function formatBeastTaskAmount(task) {
        return task.resourceType === "innerShard" ? `${task.shardCount}片` : formatWan(task.priceWan);
      }

      function formatBeastTaskDefault(task) {
        return task.resourceType === "innerShard" ? `默认 ${task.baseShardCount}片` : `默认 ${formatWan(task.basePriceWan)}`;
      }

      function renderBeastTaskAccount(plan) {
        const remainingCount = plan.tasks.filter((task) => !task.done).length;
        const doneCount = plan.tasks.length - remainingCount;
        const progress = plan.tasks.length ? (doneCount / plan.tasks.length) * 100 : 0;
        const nextTasks = plan.tasks
          .filter((task) => !task.done)
          .slice(0, 2)
          .map((task) => `${taskTypeLabel(task.typeKey)} ${task.action.label} ${formatBeastTaskAmount(task)}`);
        const shardMeta = plan.missingShardCount ? `<span>还差锁片 ${plan.missingShardCount}片</span>` : "";
        return `<details class="beast-task-account">
          <summary class="beast-task-account-head">
            <div class="beast-task-account-title">
              <h3>${plan.folderKey}</h3>
              <span>${nextTasks.length ? nextTasks.join(" / ") : "已全部完成"}</span>
            </div>
            <div class="beast-task-account-meta">
              <span>当前折算 ${formatWan(plan.availableWan)}</span>
              <span>锁片 ${plan.availableShards}/${beastInnerShardRequirement}</span>
              <span>剩余 ${remainingCount}/${plan.tasks.length} 项</span>
              <span>还需 ${formatWan(plan.remainingWan)}</span>
              ${shardMeta}
            </div>
            <div class="beast-task-finish">预计完成 ${plan.finishDate}</div>
            <span class="beast-task-toggle" aria-hidden="true"></span>
            <div class="beast-task-account-progress"><span style="width: ${progress}%"></span></div>
          </summary>
          <div class="beast-task-list">
            ${plan.tasks
              .map((task) => {
                const typeLabel = taskTypeLabel(task.typeKey);
                const rowClass = task.done ? " done" : "";
                const amountControl =
                  task.resourceType === "innerShard"
                    ? `<span class="beast-task-price beast-task-fixed-amount">${task.shardCount}片</span>`
                    : `<input class="beast-task-price" type="number" min="0" step="0.5" value="${task.priceWan}" aria-label="${plan.folderKey} ${typeLabel} ${task.action.label} 成本" data-task-price="${task.id}" />`;
                return `<div class="beast-task-item${rowClass}">
                  <label class="beast-task-check" title="完成后后续日期会重算">
                    <input type="checkbox" ${task.done ? "checked" : ""} data-task-done="${task.id}" aria-label="${plan.folderKey} ${typeLabel} ${displayPetName(task.row.pet)} ${task.action.label} 标记完成" />
                  </label>
                  <div class="beast-task-name">
                    <b>${typeLabel} / ${task.action.label}</b>
                    <span>${displayPetName(task.row.pet)} · ${task.row.analysis.primary} · ${formatBeastTaskDefault(task)}</span>
                  </div>
                  <span class="role-tag ${task.action.kind === "预估" ? "pending-book" : "beast"} beast-task-kind">${task.action.kind}</span>
                  ${amountControl}
                  <span class="beast-task-date${task.done ? " done" : ""}">${task.dueDate}</span>
                </div>`;
              })
              .join("")}
          </div>
        </details>`;
      }

      function renderBeastTaskPlan(typedRows) {
        const state = loadBeastTaskState();
        const accountPlans = buildBeastTaskAccountPlans(typedRows, state);
        const latestFinish = accountPlans.map((plan) => plan.finishDate).sort().pop() || state.settings.startDate;
        const totalTasks = accountPlans.reduce((sum, plan) => sum + plan.tasks.length, 0);
        const doneTasks = accountPlans.reduce((sum, plan) => sum + plan.tasks.filter((task) => task.done).length, 0);
        const totalRemaining = accountPlans.reduce((sum, plan) => sum + plan.remainingWan, 0);
        const totalMissingShards = accountPlans.reduce((sum, plan) => sum + plan.missingShardCount, 0);
        const weeklyWan = numericOrDefault(state.settings.weeklyEggs, 0) * numericOrDefault(state.settings.eggPriceWan, beastEggPriceWan);
        const weeklyShards = numericOrDefault(state.settings.weeklyInnerShards, 0);
        return `<section class="compare-section beast-task-section">
          <div class="compare-head">
            <div>
              <h2>神兽任务工作台</h2>
              <p>先做任务排期，再用下面的成本矩阵核对。小马会先凑幻神兽内丹到五技能，再进入打书。</p>
            </div>
            <div class="beast-task-actions">
              <button class="beast-task-reset" type="button" data-beast-task-reset>重置任务修改</button>
            </div>
          </div>
          <div class="beast-task-command">
            <div class="beast-task-overview">
              <div class="beast-task-summary-card"><strong>${latestFinish}</strong><span>全部预计完成</span><p>按当前开关和本地任务状态计算。</p></div>
              <div class="beast-task-summary-card"><strong>${formatWan(totalRemaining)}</strong><span>剩余银蛋成本</span><p>另缺锁片 ${totalMissingShards} 片。</p></div>
              <div class="beast-task-summary-card"><strong>${doneTasks}/${totalTasks}</strong><span>任务完成数</span><p>洗护符和打书可随时勾掉。</p></div>
              <div class="beast-task-summary-card"><strong>${formatWan(weeklyWan)}</strong><span>每周新增能力</span><p>${state.settings.weeklyEggs} 个蛋 / 周，锁片 ${weeklyShards} 片 / 周。</p></div>
            </div>
            <div class="beast-task-config-panel schedule-panel">
              <h3>排期参数</h3>
              ${renderBeastTaskSettings(state)}
            </div>
          </div>
          <div class="beast-task-config-panel resource-panel">
            <h3>当前资源</h3>
            ${renderBeastTaskResources(state)}
          </div>
          <section class="beast-task-account-section">
            <div class="beast-task-list-head">
              <div>
                <h3>账号任务列表</h3>
                <p>${accountPlans.length} 个账号，按剩余任务和预计日期持续重算。</p>
              </div>
              <div class="beast-task-list-stats">
                <span>未完成 ${totalTasks - doneTasks}</span>
                <span>已完成 ${doneTasks}</span>
                <span>账号 ${accountPlans.length}</span>
              </div>
            </div>
            <div class="beast-task-account-list">${accountPlans.map(renderBeastTaskAccount).join("")}</div>
          </section>
        </section>`;
      }

      function beastCostTypedRows(beasts) {
        const snakeCounts = new Map();
        return beasts
          .map((row) => {
            let typeKey = "";
            if (row.cleanName === "神兽青蛇") {
              const nextCount = (snakeCounts.get(row.datasetKey) || 0) + 1;
              snakeCounts.set(row.datasetKey, nextCount);
              typeKey = nextCount === 1 ? "snake1" : nextCount === 2 ? "snake2" : "";
            } else if (row.cleanName === "神兽龙马") {
              typeKey = "horse";
            }
            if (!typeKey) return null;
            applyBeastCostEstimates(row, typeKey);
            return { row, typeKey };
          })
          .filter(Boolean);
      }

      function filteredBeastCostTypedRows(typedRows) {
        return activeBeastCostType === "all" ? typedRows : typedRows.filter((item) => item.typeKey === activeBeastCostType);
      }

      function beastCostRuleDisplayLabel(rule) {
        if (!rule) return "全部缺项";
        if (rule.kind === "estimate") return rule.label;
        return rule.key === "strengthen" ? rule.label : `缺${rule.label}`;
      }

      function beastCostRuleMatches(row, ruleKey) {
        if (ruleKey === "all") return true;
        return Boolean(row.beastCost?.missing.some((item) => item.key === ruleKey) || row.beastCost?.estimates.some((item) => item.key === ruleKey));
      }

      function filterBeastCostTypedRowsByRule(typedRows) {
        return activeBeastCostRuleKey === "all" ? typedRows : typedRows.filter(({ row }) => beastCostRuleMatches(row, activeBeastCostRuleKey));
      }

      function renderBeastCostRuleFilters(ruleStats, totalCount) {
        const totalActive = activeBeastCostRuleKey === "all" ? " active" : "";
        return `<div class="beast-cost-focus-bar" role="group" aria-label="成本缺项筛选">
          <button class="beast-cost-focus${totalActive}" type="button" data-beast-cost-rule="all" aria-pressed="${activeBeastCostRuleKey === "all"}">
            <strong>全部缺项</strong>
            <span>${totalCount} 只</span>
          </button>
          ${ruleStats
            .map((item) => {
              const active = activeBeastCostRuleKey === item.key ? " active" : "";
              const disabled = item.count ? "" : " disabled";
              return `<button class="beast-cost-focus${active}${disabled}" type="button" data-beast-cost-rule="${item.key}" aria-pressed="${activeBeastCostRuleKey === item.key}" ${item.count ? "" : "disabled"}>
                <strong>${beastCostRuleDisplayLabel(item)}</strong>
                <span>${item.count} 只 · ${formatWan(item.totalWan)}</span>
              </button>`;
            })
            .join("")}
        </div>`;
      }

      function renderBeastCostTypeTabs(typedRows) {
        const countFor = (key) => (key === "all" ? typedRows.length : typedRows.filter((item) => item.typeKey === key).length);
        const tabs = [["all", "全部"], ...beastCostTypeDefs.map((item) => [item.key, item.label])];
        return `<div class="beast-cost-type-tabs" role="group" aria-label="神兽成本类型">
          ${tabs
          .map(([key, label]) => `<button class="beast-cost-type-tab${activeBeastCostType === key ? " active" : ""}" type="button" data-beast-cost-type="${key}" aria-pressed="${activeBeastCostType === key}">${label}<span>${countFor(key)}</span></button>`)
          .join("")}</div>`;
      }

      function beastCostSearchText(row) {
        return [
          row.searchText,
          row.beastCost?.estimateDetail || "",
          row.beastCost?.estimatedWan ? formatWan(row.beastCost.estimatedWan) : "",
          row.beastCost?.totalWithEstimate ? formatWan(row.beastCost.totalWithEstimate) : "",
          "确认差价 不确认预估 预估合计 打书 洗护符 护符",
        ]
          .join(" ")
          .toLowerCase();
      }

      function beastCostMatrixMap(typedRows) {
        const map = new Map(beastCostTypeDefs.map((type) => [type.key, new Map()]));
        typedRows.forEach(({ row, typeKey }) => {
          if (!map.has(typeKey)) map.set(typeKey, new Map());
          map.get(typeKey).set(row.datasetKey, row);
        });
        return map;
      }

      function renderBeastMatrixMissingList(row, query, ruleKey = "all") {
        const allMissing = row.beastCost?.missing || [];
        const missing = ruleKey === "all" ? allMissing : allMissing.filter((rule) => rule.key === ruleKey);
        return missing.length
          ? `<div class="beast-matrix-missing-list">${missing.map((rule) => `<span class="beast-matrix-chip">${highlight(rule.label, query)}</span>`).join("")}</div>`
          : ruleKey === "all"
            ? '<span class="beast-matrix-complete">已齐</span>'
            : "";
      }

      function renderBeastMatrixEstimateList(row, query, ruleKey = "all") {
        const allEstimates = row.beastCost?.estimates || [];
        const estimates = ruleKey === "all" ? allEstimates : allEstimates.filter((rule) => rule.key === ruleKey);
        if (!estimates.length) return "";
        return `<div class="beast-matrix-missing-list">${estimates
          .map((rule) => `<span class="beast-matrix-chip estimate">${highlight(rule.label, query)} ${formatWan(rule.priceWan)}</span>`)
          .join("")}</div>`;
      }

      function renderBeastDecisionCard(type, folderKey, row, query) {
        if (!row) {
          return `<article class="beast-decision-card empty">
            <div class="beast-decision-head">
              <span class="tag">${folderKey}</span>
              <strong>${type.label}</strong>
            </div>
            <p>当前筛选下无匹配神兽。</p>
          </article>`;
        }
        const rowTotals = activeBeastCostRuleKey === "all" ? row.beastCost : beastCostFocusedTotals([row], activeBeastCostRuleKey);
        const totalTone = rowTotals.totalWithEstimate >= 800 ? " high" : rowTotals.totalWithEstimate >= 400 ? " mid" : "";
        const missingHtml = renderBeastMatrixMissingList(row, query, activeBeastCostRuleKey);
        const estimateHtml = renderBeastMatrixEstimateList(row, query, activeBeastCostRuleKey);
        return `<article class="beast-decision-card${totalTone}">
          <div class="beast-decision-head">
            <span class="tag">${folderKey}</span>
            <div>
              <strong>${type.label} · ${highlight(displayPetName(row.pet), query)}</strong>
              <span>${highlight(row.analysis.primary, query)} · ${highlight(row.bloodline || "无血脉", query)}</span>
            </div>
          </div>
          <div class="beast-decision-missing">
            ${missingHtml || estimateHtml ? `${missingHtml}${estimateHtml}` : '<span class="beast-matrix-complete">已齐</span>'}
          </div>
          <div class="beast-decision-metrics">
            <span><b>${rowTotals.eggCount || rowTotals.totalEggs || 0}</b><em>缺蛋</em></span>
            <span><b>${formatWan(rowTotals.totalWan)}</b><em>确认</em></span>
            <span><b>${rowTotals.estimatedWan ? formatWan(rowTotals.estimatedWan) : "-"}</b><em>预估</em></span>
            <span><b>${formatWan(rowTotals.totalWithEstimate)}</b><em>合计</em></span>
          </div>
        </article>`;
      }

      function renderBeastCostMatrix(typedRows, query) {
        const activeTypes = activeBeastCostType === "all" ? beastCostTypeDefs : beastCostTypeDefs.filter((type) => type.key === activeBeastCostType);
        const matrix = beastCostMatrixMap(typedRows);
        const visibleTypes = activeTypes.filter((type) => activeBeastCostRuleKey === "all" || (matrix.get(type.key)?.size || 0));
        if (!visibleTypes.length) {
          return `<div class="beast-decision-empty">
            <h3>当前筛选没有匹配项</h3>
            <p>可以切回“全部缺项”，或换一个类型/缺项筛选继续看。</p>
          </div>`;
        }
        return `<div class="beast-decision-board">
          ${visibleTypes
            .map((type) => {
              const byFolder = matrix.get(type.key) || new Map();
              const typeRows = beastCostFolderOrder.map((folderKey) => byFolder.get(folderKey)).filter(Boolean);
              const typeTotal = beastCostFocusedTotals(typeRows, activeBeastCostRuleKey).totalWithEstimate;
              const folderKeys = activeBeastCostRuleKey === "all" ? beastCostFolderOrder : beastCostFolderOrder.filter((folderKey) => byFolder.has(folderKey));
              return `<section class="beast-decision-type">
                <div class="beast-decision-type-head">
                  <div>
                    <h3>${type.label}</h3>
                    <p>${type.pet}</p>
                  </div>
                  <strong>${formatWan(typeTotal)}</strong>
                </div>
                <div class="beast-decision-grid">
                  ${folderKeys.map((folderKey) => renderBeastDecisionCard(type, folderKey, byFolder.get(folderKey), query)).join("")}
                </div>
              </section>`;
            })
            .join("")}
        </div>`;
      }

      function renderBeastCostGapChips(row, query) {
        const missing = row.beastCost?.missing || [];
        if (!missing.length) return '<span class="beast-cost-complete-chip">已齐</span>';
        return missing
          .map(
            (rule) => `<span class="beast-cost-missing-chip">
              <b>${highlight(rule.label, query)}</b>
              <span>${rule.eggCount ? `${rule.eggCount}蛋` : "固定价"}</span>
              <strong>${formatWan(rule.priceWan)}</strong>
            </span>`
          )
          .join("");
      }

      function renderBeastCostCards(beasts, query) {
        const rows = [...beasts].sort((a, b) => b.beastCost.totalWan - a.beastCost.totalWan || b.talent - a.talent);
        return `<div class="beast-cost-list">${rows
          .map((row) => {
            const totalWan = row.beastCost.totalWan;
            const amountClass = totalWan ? "" : " complete";
            const eggText = row.beastCost.eggCount ? `缺 ${row.beastCost.eggCount} 个神兽蛋` : "不缺神兽蛋";
            const owned = beastOwnedLabels(row).join("、") || "暂无";
            return `<article class="beast-cost-card">
              <div class="beast-cost-main">
                <div class="beast-cost-name-row">
                  <span class="tag">${row.datasetLabel}</span>
                  <strong class="beast-cost-name">${highlight(displayPetName(row.pet), query)}</strong>
                </div>
                <div class="beast-cost-meta">
                  <span>${highlight(row.bloodline || "无血脉", query)}</span>
                  <span>已完成 ${highlight(owned, query)}</span>
                </div>
                <div class="beast-cost-stage-line">${renderBeastStageChips(row)}</div>
              </div>
              <div class="beast-cost-gap">
                <span class="beast-cost-label">还差</span>
                <div class="beast-cost-missing-grid">${renderBeastCostGapChips(row, query)}</div>
              </div>
              <div class="beast-cost-amount${amountClass}">
                <span>差价</span>
                <b>${formatWan(totalWan)}</b>
                <em>${eggText}</em>
              </div>
            </article>`;
          })
          .join("")}</div>`;
      }

      function renderBeastCost() {
        setViewCopy(beastCostKey);
        const allRows = buildComparisonRows();
        const query = document.getElementById("searchInput").value.trim();
        const queryLower = query.toLowerCase();
        const allTypedRows = beastCostTypedRows(beastCostRows(allRows));
        const typedRows = queryLower ? allTypedRows.filter(({ row }) => beastCostSearchText(row).includes(queryLower)) : allTypedRows;
        const typeTypedRows = filteredBeastCostTypedRows(typedRows);
        const baseBeasts = typeTypedRows.map((item) => item.row);
        const ruleStats = beastCostRuleStats(baseBeasts);
        const estimateStats = beastEstimateRuleStats(baseBeasts);
        const chartStats = [...ruleStats, ...estimateStats];
        const displayTypedRows = filterBeastCostTypedRowsByRule(typeTypedRows);
        const displayBeasts = displayTypedRows.map((item) => item.row);
        const totals = beastCostFocusedTotals(displayBeasts, activeBeastCostRuleKey);
        const activeRule = chartStats.find((item) => item.key === activeBeastCostRuleKey);
        const focusText = activeBeastCostRuleKey === "all" ? "全部缺项" : beastCostRuleDisplayLabel(activeRule);

        document.getElementById("records").innerHTML = typedRows.length
          ? `<div class="beast-dashboard">
              ${renderBeastTaskPlan(typeTypedRows)}
              <section class="compare-section beast-cost-section">
                <div class="compare-head">
                  <div>
                    <h2>成本决策面板</h2>
                    <p>先用缺项筛选定位成本来源，再按账号和类型判断优先级。当前聚焦：${focusText}。</p>
                  </div>
                </div>
                ${renderBeastCostTypeTabs(typedRows)}
                ${renderBeastCostRuleFilters(chartStats, baseBeasts.length)}
                ${renderBeastCostMatrix(displayTypedRows, query)}
              </section>
              <section class="beast-layout">
                <div class="beast-panel">
                  <div class="beast-panel-head">
                    <h3>成本拆分</h3>
                    <span>确认 + 预估</span>
                  </div>
                  <div class="beast-chart-box">
                    <canvas id="beastCostChart" aria-label="神兽缺口成本拆分图"></canvas>
                    <div id="beastCostFallback" class="beast-bar-list"></div>
                  </div>
                </div>
                <div class="beast-panel">
                  <div class="beast-panel-head">
                    <h3>计算规则</h3>
                    <span>单位：万</span>
                  </div>
                  <div class="beast-rule-list">
                    ${chartStats
                      .map(
                        (item) => `<button class="beast-rule-item${item.kind === "estimate" ? " estimate" : ""}${activeBeastCostRuleKey === item.key ? " active" : ""}" type="button" data-beast-cost-rule="${item.key}" aria-pressed="${activeBeastCostRuleKey === item.key}">
                          <b>${item.count}</b>
                          <span>${beastCostRuleDisplayLabel(item)}</span>
                          <p>${item.kind === "estimate" ? `${item.count} 个，${formatWan(item.totalWan)}，单个 ${formatWan(item.priceWan)}` : item.eggCount ? `${item.totalEggs} 个神兽蛋，${formatWan(item.totalWan)}` : `${formatWan(item.totalWan)}，单个 ${formatWan(item.priceWan)}`}</p>
                        </button>`
                      )
                      .join("")}
                  </div>
                </div>
              </section>
              <details class="compare-section beast-cost-section beast-table-section beast-detail-disclosure">
                <summary class="beast-detail-summary">
                  <div>
                    <h2>详细核对</h2>
                    <p>${displayBeasts.length} 条记录，和当前类型/缺项筛选同源，按预估合计从高到低排序。</p>
                  </div>
                  <span>展开表格</span>
                </summary>
                ${renderBeastCostTable(displayBeasts, query)}
              </details>
            </div>`
          : renderBeastCostEmpty(query);

        requestAnimationFrame(() => renderBeastCostChart(chartStats));
        document.getElementById("groupCount").textContent = formatWan(totals.totalWan);
        document.getElementById("shotCount").textContent = totals.totalEggs;
        document.getElementById("pendingCount").textContent = formatWan(totals.estimatedWan);
        document.getElementById("folderName").textContent = formatWan(totals.totalWithEstimate);
        document.getElementById("groupLabel").textContent = "确认差价";
        document.getElementById("shotLabel").textContent = "还差神兽蛋";
        document.getElementById("pendingLabel").textContent = "不确认预估";
        document.getElementById("folderLabel").textContent = "预估合计";
        document.getElementById("notice").hidden = true;
        renderTabs();
      }

      const matrixColumns = [
        { key: "huodou", label: "祸斗", group: "日常", match: (row) => row.cleanName === "祸斗" },
        { key: "leisi", label: "雷司", group: "日常", match: (row) => row.cleanName === "雷司" },
        { key: "jiutou", label: "九头", group: "日常", match: (row) => row.cleanName === "九头鸟" },
        { key: "swordSnake", label: "剑气蛇", match: (row) => row.cleanName === "神兽青蛇" && (row.analysis.primary === "剑气" || row.analysis.tags.includes("剑气")) },
        { key: "stealthSnake", label: "追影蛇", match: (row) => row.cleanName === "神兽青蛇" && row.analysis.primary === "隐攻" },
        { key: "magicSnake", label: "法蛇", match: (row) => row.cleanName === "神兽青蛇" && row.analysis.primary === "普通法" },
        { key: "hanling", label: "寒凌", match: (row) => row.cleanName === "寒翎" },
        { key: "horse", label: "小马", match: (row) => row.cleanName === "神兽龙马" },
        { key: "mingwei", label: "冥卫", match: (row) => row.cleanName === "冥卫" },
        { key: "princess", label: "公主", match: (row) => row.cleanName === "沧海公主" },
        { key: "lobster", label: "龙虾", match: (row) => row.cleanName === "龙虾骑士" },
        { key: "yunluo", label: "云罗", match: (row) => row.cleanName === "云萝仙子" },
        { key: "tongzi", label: "童子", match: (row) => row.cleanName === "赤炎童子" },
        { key: "taohua", label: "桃花", match: (row) => row.cleanName === "桃花精灵" },
        { key: "child", label: "孩子", match: (row) => row.cleanName === "孩子" || /^5$/.test(row.cleanName) },
      ];

      const matrixSections = [
        { key: "daily", title: "日常", columns: matrixColumns.filter((column) => column.group === "日常") },
        { key: "beast", title: "PK：神兽蛇 / 小马", columns: matrixColumns.filter((column) => ["swordSnake", "stealthSnake", "magicSnake", "horse"].includes(column.key)) },
        { key: "pkCore", title: "PK：法系 / 特殊 / 物理", columns: matrixColumns.filter((column) => ["hanling", "princess", "lobster", "yunluo", "child"].includes(column.key)) },
        { key: "speed", title: "PK：速度", columns: matrixColumns.filter((column) => ["mingwei", "tongzi", "taohua"].includes(column.key)) },
      ];

      const matrixOrder = ["FC", "LG1", "PT", "LG2", "MYT"];
      const skillSortGroups = [
        [
          "高级法术暴击",
          "高级法术连击",
          "高级法术波动",
          "高级灵蕴",
          "高级凝气",
          "红莲业火",
          "高级必杀",
          "高级连击",
          "高级强力",
          "高级吸血",
          "高级偷袭",
          "高级夜战",
          "高级追击",
          "高级气势",
          "高级狂暴",
          "高级冲击",
          "高级先驱",
          "一马当先",
        ],
        [
          "高级强壮",
          "高级抵御",
          "高级防御",
          "高级幸运",
          "高级神佑复生",
          "高级保命",
          "高级再生",
          "高级凝神",
          "高级反震",
          "高级报复",
          "高级自愈",
          "高级水系吸收",
          "高级火系吸收",
          "高级土系吸收",
          "高级雷系吸收",
          "物抗强化",
          "双抗之心",
          "抵御强化",
        ],
        [
          "高级审判",
          "高级感知",
          "高级攻坚",
          "高级驱鬼",
          "高级隐身",
          "高级敏捷",
          "高级勇敢",
          "高级飞行",
          "高级毒",
          "感知强化",
          "隐身强化",
          "法连强化",
          "护盾",
          "混沌",
          "围剿",
          "连环",
          "恃势",
          "坚守",
          "剑锋",
          "升龙",
          "顺闪",
          "先锋",
          "迁怒",
          "刺杀",
          "乘胜",
          "涡轮火",
          "雷利风行",
          "山崩地倾",
          "分水神剑",
          "水刃斩",
          "幽冥之佑",
          "葫芦仙法",
          "剑气四射",
          "生死相依",
        ],
      ];
      const skillSortRank = new Map(skillSortGroups.flatMap((group, groupIndex) => group.map((skill, skillIndex) => [skill, groupIndex * 100 + skillIndex])));
      const matrixSkillOrder = [
        "高级法术暴击",
        "高级法术连击",
        "高级法术波动",
        "高级灵蕴",
        "高级强壮",
        "高级抵御",
        "高级凝气",
        "涡轮火",
        "雷利风行",
        "分水神剑",
        "山崩地倾",
        "红莲业火",
        "葫芦仙法",
        "高级必杀",
        "高级连击",
        "高级强力",
        "高级吸血",
        "高级偷袭",
        "高级夜战",
        "高级追击",
        "高级气势",
        "高级反震",
        "高级报复",
        "高级攻坚",
        "高级隐身",
        "高级感知",
        "高级敏捷",
        "高级防御",
        "高级勇敢",
        "高级幸运",
        "高级神佑复生",
        "高级再生",
        "高级凝神",
        "高级飞行",
        "高级审判",
        "高级狂暴",
        "高级冲击",
        "高级保命",
        "高级毒",
        "高级自愈",
        "高级先驱",
        "高级水系吸收",
        "高级火系吸收",
        "水刃斩",
        "生死相依",
        "幽冥之佑",
        "一马当先",
        "物抗强化",
        "感知强化",
        "隐身强化",
        "法连强化",
        "双抗之心",
        "抵御强化",
      ];

      function matrixScore(row, columnKey) {
        if (["huodou", "magicSnake", "jiutou", "jingluan"].includes(columnKey) || row.analysis.primary.includes("法")) return row.spirit || 0;
        if (["mingwei", "taohua", "tongzi"].includes(columnKey) || row.analysis.primary.includes("速")) return row.speed || 0;
        if (columnKey === "horse") return row.talent || 0;
        return row.attack || row.talent || 0;
      }

      function renderMatrixBlock(title, items) {
        const visibleItems = items.filter((item) => item.value);
        if (!visibleItems.length) return "";
        return `<div class="matrix-block">
          <div class="matrix-block-title">${title}</div>
          <div class="matrix-items">
            ${visibleItems.map((item) => `<div class="matrix-item"><span>${item.label}</span><b>${item.value}</b></div>`).join("")}
          </div>
        </div>`;
      }

      function matrixVisibleSkill(skill) {
        return skill !== "空" && !skill.includes("(驭)") && !skill.startsWith("觉醒");
      }

      function normalizeMatrixSkill(skill) {
        const base = skill
          .replace(/[（(](符|驭)[）)]/g, "")
          .replace(/^高级法爆$/, "高级法术暴击")
          .replace(/^小法爆$/, "小法术暴击")
          .replace(/^高级法连$/, "高级法术连击")
          .replace(/^小法连$/, "小法术连击")
          .trim();
        const aliases = {
          小法术暴击: "高级法术暴击",
          小法术连击: "高级法术连击",
          小灵蕴: "高级灵蕴",
          小强壮: "高级强壮",
          小抵御: "高级抵御",
          小凝神: "高级凝神",
          小幸运: "高级幸运",
          小再生: "高级再生",
          小敏捷: "高级敏捷",
          小神佑: "高级神佑复生",
          小吸血: "高级吸血",
          小夜战: "高级夜战",
          小偷袭: "高级偷袭",
          小感知: "高级感知",
          小审判: "高级审判",
          小驱鬼: "高级驱鬼",
          小报复: "高级报复",
          小追击: "高级追击",
          小气势: "高级气势",
          高级水吸收: "高级水系吸收",
          高级火吸收: "高级火系吸收",
          高级土吸收: "高级土系吸收",
          高级雷吸收: "高级雷系吸收",
          小水吸收: "高级水系吸收",
          小火吸收: "高级火系吸收",
          小土吸收: "高级土系吸收",
          小雷吸收: "高级雷系吸收",
          小反震: "高级反震",
        };
        return aliases[base] || base;
      }

      function skillSortValue(skill) {
        const normalized = normalizeMatrixSkill(skill);
        const rank = skillSortRank.get(normalized);
        if (rank !== undefined) return rank;
        const matrixIndex = matrixSkillOrder.indexOf(normalized);
        if (matrixIndex !== -1) return 3000 + matrixIndex;
        if (normalized.startsWith("觉醒")) return 5000;
        if (normalized === "空") return 6000;
        return 4000 + normalized.charCodeAt(0);
      }

      function sortSkillsByFixedOrder(skills) {
        return [...skills].sort((a, b) => skillSortValue(a) - skillSortValue(b) || normalizeMatrixSkill(a).localeCompare(normalizeMatrixSkill(b), "zh-Hans-CN"));
      }

      const matrixBoostSlot = "__matrix_boost__";

      function isMatrixBoostSkill(skill) {
        const normalized = normalizeMatrixSkill(skill);
        return normalized.includes("强化") || normalized.includes("之心");
      }

      function matrixSlotSortValue(slot) {
        return slot === matrixBoostSlot ? skillSortValue("物抗强化") : skillSortValue(slot);
      }

      function displayMatrixSlot(slot) {
        return slot === matrixBoostSlot ? "强化" : displaySkillName(slot);
      }

      function matrixSkillRank(skill) {
        return skillSortValue(skill);
      }

      function buildMatrixSkillSlots(rows, section, options = {}) {
        const skills = rows
          .filter((row) => !isPendingBookRow(row) && section.columns.some((column) => column.match(row)))
          .flatMap((row) => row.skills)
          .filter(matrixVisibleSkill)
          .map(normalizeMatrixSkill);
        const hasBoostSkills = options.combineBoosts && skills.some(isMatrixBoostSkill);
        const visibleSkills = unique(skills).filter((skill) => !hasBoostSkills || !isMatrixBoostSkill(skill));
        const slots = hasBoostSkills ? [...visibleSkills, matrixBoostSlot] : visibleSkills;
        return slots.sort((a, b) => matrixSlotSortValue(a) - matrixSlotSortValue(b) || displayMatrixSlot(a).localeCompare(displayMatrixSlot(b), "zh-Hans-CN"));
      }

      function renderMatrixSkillBlock(best, skillSlots) {
        if (!skillSlots.length) return "";
        const bySlot = new Map();
        best.skills.filter(matrixVisibleSkill).forEach((skill) => {
          const normalized = normalizeMatrixSkill(skill);
          if (!bySlot.has(normalized)) bySlot.set(normalized, skill);
        });
        return `<div class="matrix-block">
          <div class="matrix-block-title">技能</div>
          <div class="matrix-skill-grid">
            ${skillSlots
              .map((slot) => {
                const skill = bySlot.get(slot);
                return `<div class="matrix-skill-cell${skill ? ` ${skillToneClass(skill)}` : " empty"}">${skill ? displaySkillName(skill) : "-"}</div>`;
              })
              .join("")}
          </div>
        </div>`;
      }

      function renderMatrixCell(rows, column, skillSlots) {
        if (!rows.length) return `<span class="matrix-empty">-</span>`;
        const best = [...rows].sort((a, b) => matrixScore(b, column.key) - matrixScore(a, column.key) || b.talent - a.talent)[0];
        if (best.analysis.primary === "待打书") {
          return `<div class="matrix-cell">
            <div class="matrix-main">待打书</div>
          </div>`;
        }
        const stageItems = best.beastStages && beastBaseAptitudes[best.cleanName]
          ? beastStageRows.map(([label, getter]) => ({ label, value: getter(best) || "-" }))
          : [];
        const statItems = [
          { label: "心", value: best.heart ? renderHeartChip(best.heart) : "未记" },
          ...stageItems,
          { label: "气血", value: best.hp || "-" },
          { label: "攻击", value: best.attack || "-" },
          { label: "防御", value: best.defense || "-" },
          { label: "速度", value: best.speed || "-" },
          { label: "灵力", value: best.spirit || "-" },
        ];
        const aptitudeItems = [
          { label: "攻资", value: best.attackApt || "-" },
          { label: "防资", value: best.defenseApt || "-" },
          { label: "体资", value: best.staminaApt || "-" },
          { label: "法资", value: best.magicApt || "-" },
          { label: "速资", value: best.speedApt || "-" },
          { label: "寿命", value: best.life || "-" },
        ];
        return `<div class="matrix-cell">
          ${matrixDisplay.stats ? renderMatrixBlock("属性", statItems) : ""}
          ${matrixDisplay.aptitude ? renderMatrixBlock("资质", aptitudeItems) : ""}
          ${matrixDisplay.skills ? renderMatrixSkillBlock(best, skillSlots) : ""}
        </div>`;
      }

      function pickMatrixBest(rows, column) {
        if (!rows.length) return null;
        return [...rows].sort((a, b) => matrixScore(b, column.key) - matrixScore(a, column.key) || b.talent - a.talent)[0];
      }

      function matrixRecordByFolder(rows, column) {
        return new Map(
          matrixOrder.map((folderKey) => [
            folderKey,
            pickMatrixBest(rows.filter((row) => row.datasetKey === folderKey && column.match(row)), column),
          ])
        );
      }

      function matrixSkillMap(record) {
        const bySlot = new Map();
        if (!record || isPendingBookRow(record)) return bySlot;
        record.skills.filter(matrixVisibleSkill).forEach((skill) => {
          const normalized = normalizeMatrixSkill(skill);
          if (!bySlot.has(normalized)) bySlot.set(normalized, skill);
        });
        return bySlot;
      }

      function matrixBoostValue(record) {
        if (!record || isPendingBookRow(record)) return "";
        return sortSkillsByFixedOrder(unique(record.skills.filter(matrixVisibleSkill).filter(isMatrixBoostSkill)))
          .map(displaySkillName)
          .join("、");
      }

      const beastStageRows = [
        ["饰品", (record) => record.beastStages?.ornament],
        ["进阶1", (record) => record.beastStages?.advance1],
        ["进阶2", (record) => record.beastStages?.advance2],
        ["皮肤", (record) => record.beastStages?.skin],
      ];

      function hasBeastStageRecord(recordsByFolder) {
        return [...recordsByFolder.values()].some((record) => record?.beastStages && beastBaseAptitudes[record.cleanName]);
      }

      function renderMatrixDetailRow(label, recordsByFolder, valueGetter, rowHeader, rowSpan, className = "") {
        return `<tr class="${className}">
          ${rowHeader ? `<th class="matrix-row-head" scope="rowgroup" rowspan="${rowSpan}">${rowHeader}</th>` : ""}
          <th class="matrix-field-head" scope="row">${label}</th>
          ${matrixOrder
            .map((folderKey) => {
              const record = recordsByFolder.get(folderKey);
              const value = record ? valueGetter(record, folderKey) : "";
              const pendingVisibleLabels = ["定位", "饰品", "进阶1", "进阶2", "皮肤"];
              if (isPendingBookRow(record) && !pendingVisibleLabels.includes(label)) {
                return `<td class="matrix-data-cell"><span class="matrix-empty">-</span></td>`;
              }
              const rendered = label === "心" && value ? renderHeartChip(value) : value;
              return `<td class="matrix-data-cell">${rendered || '<span class="matrix-empty">-</span>'}</td>`;
            })
            .join("")}
        </tr>`;
      }

      function renderMatrixSkillRow(slot, recordsByFolder, rowHeader, rowSpan, className = "") {
        return `<tr class="${className}">
          ${rowHeader ? `<th class="matrix-row-head" scope="rowgroup" rowspan="${rowSpan}">${rowHeader}</th>` : ""}
          <th class="matrix-field-head" scope="row">${displayMatrixSlot(slot)}</th>
          ${matrixOrder
            .map((folderKey) => {
              const record = recordsByFolder.get(folderKey);
              const skill = slot === matrixBoostSlot ? matrixBoostValue(record) : matrixSkillMap(record).get(slot);
              return `<td class="matrix-data-cell">${skill ? `<span class="matrix-skill-value ${slot === matrixBoostSlot ? "skill-boost" : skillToneClass(skill)}">${slot === matrixBoostSlot ? skill : displaySkillName(skill)}</span>` : '<span class="matrix-empty">-</span>'}</td>`;
            })
            .join("")}
        </tr>`;
      }

      function matrixHasSkillSlot(slot, recordsByFolder) {
        return [...recordsByFolder.values()].some((record) => {
          if (!record || isPendingBookRow(record)) return false;
          return slot === matrixBoostSlot ? Boolean(matrixBoostValue(record)) : matrixSkillMap(record).has(slot);
        });
      }

      function aptitudeLimit(value) {
        if (!value) return "";
        return String(value).split("/").pop();
      }

      function renderMatrixCategoryRows(rows, column) {
        const recordsByFolder = matrixRecordByFolder(rows, column);
        const stageRows = hasBeastStageRecord(recordsByFolder) ? beastStageRows : [];
        const statRows = matrixDisplay.stats
          ? [
              ["定位", (record) => record.analysis.primary],
              ...stageRows,
              ["气血", (record) => record.hp],
              ["攻击", (record) => record.attack],
              ["防御", (record) => record.defense],
              ["速度", (record) => record.speed],
              ["灵力", (record) => record.spirit],
            ]
          : [];
        const aptitudeRows = matrixDisplay.aptitude
          ? [
              ["心", (record) => record.heart || "未记"],
              ["攻资", (record) => aptitudeLimit(record.attackApt)],
              ["防资", (record) => aptitudeLimit(record.defenseApt)],
              ["体资", (record) => aptitudeLimit(record.staminaApt)],
              ["法资", (record) => aptitudeLimit(record.magicApt)],
              ["速资", (record) => aptitudeLimit(record.speedApt)],
              ["寿命", (record) => record.life],
            ]
          : [];
        const skillSlots = matrixDisplay.skills
          ? buildMatrixSkillSlots(rows.filter(column.match), { columns: [column] }, { combineBoosts: stageRows.length > 0 }).filter((slot) => matrixHasSkillSlot(slot, recordsByFolder))
          : [];
        const rowSpan = Math.max(1, statRows.length + aptitudeRows.length + skillSlots.length);
        const outputRows = [];
        let isFirst = true;

        statRows.forEach(([label, getter], index) => {
          outputRows.push(renderMatrixDetailRow(label, recordsByFolder, getter, isFirst ? column.label : "", rowSpan, `matrix-stat-row ${isFirst ? "matrix-category-start" : index === 0 ? "matrix-block-start" : ""}`));
          isFirst = false;
        });
        aptitudeRows.forEach(([label, getter], index) => {
          outputRows.push(renderMatrixDetailRow(label, recordsByFolder, getter, isFirst ? column.label : "", rowSpan, `matrix-aptitude-row ${isFirst ? "matrix-category-start" : index === 0 ? "matrix-block-start" : ""}`));
          isFirst = false;
        });
        skillSlots.forEach((slot, index) => {
          outputRows.push(renderMatrixSkillRow(slot, recordsByFolder, isFirst ? column.label : "", rowSpan, `matrix-skill-row ${isFirst ? "matrix-category-start" : index === 0 ? "matrix-block-start" : ""}`));
          isFirst = false;
        });

        if (!outputRows.length) {
          outputRows.push(renderMatrixDetailRow("内容", recordsByFolder, () => "", column.label, 1, "matrix-category-start"));
        }
        return outputRows.join("");
      }

      function renderMatrixSection(rows, section) {
        const minWidth = Math.max(760, 204 + matrixOrder.length * 148);
        return `<div class="table-wrap">
          <table class="matrix-table ${matrixDensity}" style="--matrix-min-width: ${minWidth}px" aria-label="${section.title}矩阵对比">
            <thead>
              <tr>
                <th scope="col">类型</th>
                <th scope="col">项目</th>
                ${matrixOrder.map((folderKey) => `<th scope="col">${folderKey}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${section.columns.map((column) => renderMatrixCategoryRows(rows, column)).join("")}
            </tbody>
          </table>
        </div>`;
      }

      function renderMatrixTable(rows) {
        const activeSection = matrixSections.find((section) => section.key === activeMatrixSectionKey) || matrixSections[0];
        activeMatrixSectionKey = activeSection.key;
        return `<div class="matrix-sections">
          <div class="matrix-toolbar">
            <div class="matrix-tabs" role="tablist" aria-label="矩阵分组">
              ${matrixSections
                .map((section) => {
                  const active = section.key === activeSection.key ? " active" : "";
                  return `<button class="matrix-tab${active}" type="button" role="tab" data-matrix-section="${section.key}" aria-selected="${section.key === activeSection.key}">
                    ${section.title}<span>${section.columns.length}</span>
                  </button>`;
                })
                .join("")}
            </div>
            <div class="matrix-toggles" aria-label="矩阵显示开关">
              <label class="matrix-toggle"><input type="checkbox" data-matrix-toggle="stats" ${matrixDisplay.stats ? "checked" : ""} />属性</label>
              <label class="matrix-toggle"><input type="checkbox" data-matrix-toggle="aptitude" ${matrixDisplay.aptitude ? "checked" : ""} />资质</label>
              <label class="matrix-toggle"><input type="checkbox" data-matrix-toggle="skills" ${matrixDisplay.skills ? "checked" : ""} />技能</label>
            </div>
            <div class="matrix-density" aria-label="矩阵密度">
              <button class="${matrixDensity === "compact" ? "active" : ""}" type="button" data-matrix-density="compact" aria-pressed="${matrixDensity === "compact"}">紧凑</button>
              <button class="${matrixDensity === "comfortable" ? "active" : ""}" type="button" data-matrix-density="comfortable" aria-pressed="${matrixDensity === "comfortable"}">舒展</button>
            </div>
          </div>
          <section class="matrix-section">
            <h3 class="matrix-section-title">${activeSection.title}</h3>
            ${renderMatrixSection(rows, activeSection)}
          </section>
        </div>`;
      }

      function renderMatrix() {
        destroyBeastCostChart();
        setViewCopy(matrixKey);
        const allRows = buildComparisonRows();
        const query = document.getElementById("searchInput").value.trim();
        const queryLower = query.toLowerCase();
        const visible = queryLower ? allRows.filter((row) => row.searchText.includes(queryLower)) : allRows;
        const pending = visible.filter((row) => row.skills.some(isPending)).length;

        document.getElementById("records").innerHTML = visible.length
          ? `<div class="compare-view">
              <section class="compare-section">
                <div class="compare-head">
                  <div>
                    <h2>矩阵对比</h2>
                    <p>按目录和固定宝宝类型铺开，属性、资质、技能分行对齐，方便直接横向比较每个账号的差异。</p>
                  </div>
                </div>
                ${renderMatrixTable(visible)}
              </section>
            </div>`
          : renderCompareEmpty(query);

        document.getElementById("groupCount").textContent = visible.length;
        document.getElementById("shotCount").textContent = visible.reduce((sum, row) => sum + row.shots.length, 0);
        document.getElementById("pendingCount").textContent = pending;
        document.getElementById("folderName").textContent = matrixColumns.length;
        document.getElementById("groupLabel").textContent = "矩阵记录组";
        document.getElementById("shotLabel").textContent = "截图来源";
        document.getElementById("pendingLabel").textContent = "含待确认记录组";
        document.getElementById("folderLabel").textContent = "矩阵列数";
        document.getElementById("notice").hidden = true;
        renderTabs();
      }

      function buildGroups(allRecords) {
        const groups = [];
        const byId = new Map();
        allRecords.forEach((record) => {
          if (record.skipped) return;
          const sourceId = record.same?.match(/同\s+(\d+)/)?.[1];
          if (sourceId && byId.has(sourceId)) {
            byId.get(sourceId).shots.push({
              id: record.id,
              file: record.file,
              folder: record.sourceFolder,
              sourceImage: record.sourceImage,
              sourceDate: record.sourceDate,
              sourceType: record.sourceType,
              legacySourceImage: record.legacySourceImage,
              note: record.same,
            });
            return;
          }

          const group = {
            id: record.id,
            pet: record.pet,
            meta: record.meta,
            heart: record.heart,
            stats: record.stats,
            skills: inheritedSkills(record, allRecords),
            shots: [
              {
                id: record.id,
                file: record.file,
                folder: record.sourceFolder,
                sourceImage: record.sourceImage,
                sourceDate: record.sourceDate,
                sourceType: record.sourceType,
                legacySourceImage: record.legacySourceImage,
                note: "主截图",
              },
            ],
          };
          groups.push(group);
          byId.set(record.id, group);
        });
        return groups;
      }

      function highlight(text, query) {
        if (!query) return text;
        const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return text.replace(new RegExp(safe, "gi"), (match) => `<mark>${match}</mark>`);
      }

      function statsSearchText(stats) {
        if (!stats) return [];
        return [...stats.panel, ...stats.points, ...stats.aptitude, ...(stats.growth || [])].flat();
      }

      function renderNumberPanel(title, rows, query) {
        return `<section class="number-panel">
          <h3>${title}</h3>
          ${rows.map(([label, value]) => `<div class="number-row"><span>${highlight(label, query)}</span><span>${highlight(value, query)}</span></div>`).join("")}
        </section>`;
      }

      function renderStats(stats, query) {
        if (!stats) return "";
        return `<div class="numbers">
          ${renderNumberPanel("面板", stats.panel, query)}
          ${renderNumberPanel("属性点", stats.points, query)}
          ${renderNumberPanel("资质 / 寿命", stats.aptitude, query)}
          ${stats.growth ? renderNumberPanel("养成情况", stats.growth, query) : ""}
        </div>`;
      }

      function renderGroup(group, query = "") {
        const pending = group.skills.some(isPending);
        const skillCount = group.skills.filter(isCountedSkill).length;
        const shotsHtml = group.shots
          .map(
            (shot) => `<div class="shot">
              <span class="shot-id">${shot.id}</span>
              <img src="${shotImagePath(shot)}" alt="${displayPetName(group.pet)} ${shot.file}" loading="lazy" />
              <div class="file">${highlight(shot.file, query)}</div>
            </div>`
          )
          .join("");
        const skillHtml = `<div class="skills">${group.skills
          .filter((skill) => skill !== "空")
          .map((skill) => {
            const classes = ["skill", skillToneClass(skill)];
            if (isPending(skill)) classes.push("pending");
            return `<div class="${classes.join(" ")}">${highlight(displaySkillName(skill), query)}</div>`;
          })
          .join("")}</div>`;

        return `<article class="record" data-search="${[
          group.id,
          group.pet,
          group.meta,
          group.heart || "",
          `技能数 ${skillCount}`,
          ...group.shots.flatMap((shot) => [shot.id, shot.file, shot.note]),
          ...statsSearchText(group.stats),
          ...group.skills,
        ].join(" ")}">
          <div class="shots">
            ${shotsHtml}
          </div>
          <div class="info">
            <div class="record-head">
              <div class="pet">
                <h2>${highlight(displayPetName(group.pet), query)}</h2>
                <p><span>${highlight(group.meta, query)}</span>${group.heart ? renderHeartChip(group.heart, query) : ""}</p>
              </div>
              <span class="index">${group.id}</span>
            </div>
            <div class="skill-meta">
              <div class="tag ${pending ? "warning" : ""}">${pending ? "含待确认" : "已识别"}</div>
              <div class="tag">技能数 ${skillCount}</div>
            </div>
            <p class="sources">截图来源：${group.shots.map((shot) => highlight(`${shot.id} ${shot.file}`, query)).join("；")}</p>
            ${renderStats(group.stats, query)}
            ${skillHtml}
          </div>
        </article>`;
      }

      function gemViewContext() {
        const beastBudgets = buildGemBeastBudgetByAccount();
        return {
          beastBudgets,
          destroyBeastCostChart,
          highlight,
          renderTabs,
          setViewCopy,
          viewKey: gemKey,
        };
      }

      function buildGemBeastBudgetByAccount() {
        const state = loadBeastTaskState();
        const typedRows = beastCostTypedRows(beastCostRows(buildComparisonRows()));
        const accountPlans = buildBeastTaskAccountPlans(typedRows, state);
        return Object.fromEntries(
          beastCostFolderOrder.map((folderKey) => {
            const plan = accountPlans.find((item) => item.folderKey === folderKey);
            const resource = plan?.resource || state.resources[folderKey] || beastTaskDefaultResources[folderKey] || {};
            const eggPriceWan = numericOrDefault(state.settings.eggPriceWan, beastEggPriceWan);
            const availableWan = plan?.availableWan ?? numericOrDefault(resource.silverWan, 0) + numericOrDefault(resource.eggCount, 0) * eggPriceWan;
            const remainingWan = plan?.remainingWan || 0;
            const requiredWan = Math.max(0, remainingWan - availableWan);
            const tasks = plan?.tasks || [];
            return [
              folderKey,
              {
                accountKey: folderKey,
                taskWan: remainingWan,
                availableWan,
                requiredWan,
                taskSilver: Math.round(remainingWan * 10000),
                availableSilver: Math.round(availableWan * 10000),
                requiredSilver: Math.round(requiredWan * 10000),
                missingShardCount: plan?.missingShardCount || 0,
                taskCount: tasks.length,
                doneTaskCount: tasks.filter((task) => task.done).length,
                unfinishedTaskCount: tasks.filter((task) => !task.done).length,
                finishDate: plan?.finishDate || "已完成",
              },
            ];
          })
        );
      }

      function renderGems() {
        window.GemsView.render(gemViewContext());
      }

      function renderTabs() {
        const compareActive = activeKey === compareKey ? " active" : "";
        const beastCostActive = activeKey === beastCostKey ? " active" : "";
        const matrixActive = activeKey === matrixKey ? " active" : "";
        const gemActive = activeKey === gemKey ? " active" : "";
        const basicActive = activeKey === basicKey ? " active" : "";
        const sourceActive = activeKey === sourceKey ? " active" : "";
        const comparisonRows = buildComparisonRows();
        const compareCount = comparisonRows.length;
        const beastCostCount = beastCostRows(comparisonRows).length;
        const gemCount = gemAccountDatasets.reduce((sum, dataset) => sum + dataset.items.length, 0);
        const basicCount = datasets.reduce((sum, dataset) => sum + buildGroups(dataset.records).length, 0);
        const basicTabs = document.getElementById("basicTabs");
        document.getElementById("tabs").innerHTML = [
          `<button class="tab${compareActive}" type="button" role="tab" data-folder="${compareKey}" aria-selected="${activeKey === compareKey}" tabindex="${activeKey === compareKey ? "0" : "-1"}">总览<span>${compareCount}</span></button>`,
          `<button class="tab${basicActive}" type="button" role="tab" data-folder="${basicKey}" aria-selected="${activeKey === basicKey}" tabindex="${activeKey === basicKey ? "0" : "-1"}">宠物资料<span>${basicCount}</span></button>`,
          `<button class="tab${gemActive}" type="button" role="tab" data-folder="${gemKey}" aria-selected="${activeKey === gemKey}" tabindex="${activeKey === gemKey ? "0" : "-1"}">升级计划<span>${gemCount}</span></button>`,
          `<button class="tab${beastCostActive}" type="button" role="tab" data-folder="${beastCostKey}" aria-selected="${activeKey === beastCostKey}" tabindex="${activeKey === beastCostKey ? "0" : "-1"}">神兽成本<span>${beastCostCount}</span></button>`,
          `<button class="tab${matrixActive}" type="button" role="tab" data-folder="${matrixKey}" aria-selected="${activeKey === matrixKey}" tabindex="${activeKey === matrixKey ? "0" : "-1"}">矩阵对比<span>${matrixColumns.length}</span></button>`,
          `<button class="tab${sourceActive}" type="button" role="tab" data-folder="${sourceKey}" aria-selected="${activeKey === sourceKey}" tabindex="${activeKey === sourceKey ? "0" : "-1"}">基础资料<span>${datasets.length}</span></button>`,
        ]
          .join("");
        basicTabs.hidden = activeKey !== basicKey;
        basicTabs.innerHTML =
          activeKey === basicKey
            ? datasets
                .map((dataset) => {
                  const active = dataset.key === activeFolderKey ? " active" : "";
                  return `<button class="tab${active}" type="button" role="tab" data-basic-folder="${dataset.key}" aria-selected="${dataset.key === activeFolderKey}" tabindex="${dataset.key === activeFolderKey ? "0" : "-1"}">${dataset.label}<span>${dataset.imageCount}</span></button>`;
                })
                .join("")
            : "";
      }

      function renderEmpty(dataset) {
        return `<section class="empty-state">
          <h2>${dataset.label} 待识别</h2>
          <p>来源目录：<code>${dataset.source}</code></p>
          <p>当前发现 ${dataset.imageCount} 张图片。后续开始识别时，会按统一结构记录：同宝宝合并、技能数、心色、养成情况、面板数值、资质寿命和技能列表；技能数规则所有文件夹一致。</p>
        </section>`;
      }

      function renderSources() {
        destroyBeastCostChart();
        setViewCopy(sourceKey);
        const petShotCount = datasets.reduce((sum, dataset) => sum + dataset.imageCount, 0);
        const gemShotCount = gemAccountDatasets.reduce((sum, dataset) => sum + dataset.items.length, 0);
        const marketCount = gemMarketSnapshotData.reduce((sum, snapshot) => sum + snapshot.items.length, 0);
        const query = document.getElementById("searchInput").value.trim();
        const cards = [
          {
            title: "原始截图",
            count: petShotCount + gemShotCount + gemMarketSnapshotData.length,
            detail: "图片/原始截图/{角色|公共}/{宠物|宝石|宝石行情}/{YYYY-MM-DD}/；旧目录已收进 图片/旧目录。",
          },
          {
            title: "识别记录",
            count: datasets.length,
            detail: "图片/识别记录/{角色}/宠物.md 与 宝石.md",
          },
          {
            title: "基础数据",
            count: gemShotCount + marketCount,
            detail: "data/equipment.raw.js、data/gem-levels.js、data/gem-market.raw.js；宠物数据仍在 pet-recognition-data.js，并已补 sourceImage 字段。",
          },
          {
            title: "分析与视图",
            count: 2,
            detail: "analysis/gem-progress.js 负责宝石累计与银币估算；views/gems-view.js 负责宝石页面展示。",
          },
        ].filter((card) => !query || [card.title, card.detail, card.count].join(" ").toLowerCase().includes(query.toLowerCase()));

        document.getElementById("records").innerHTML = `<div class="compare-view compare-mode-view">
          <section class="compare-section">
            <div class="compare-head">
              <div>
                <h2>资料分层</h2>
                <p>截图是证据，基础数据记录事实，分析模块负责计算，视图只展示结果。旧目录保留为兼容来源。</p>
              </div>
            </div>
            <div class="compare-folder-grid">
              ${cards
                .map(
                  (card) => `<article class="compare-folder-card">
                    <div class="compare-folder-head">
                      <h3>${highlight(card.title, query)}</h3>
                      <span class="compare-folder-count">${card.count}</span>
                    </div>
                    <p class="sources">${highlight(card.detail, query)}</p>
                  </article>`
                )
                .join("")}
            </div>
          </section>
        </div>`;

        document.getElementById("groupCount").textContent = datasets.length;
        document.getElementById("shotCount").textContent = petShotCount + gemShotCount + gemMarketSnapshotData.length;
        document.getElementById("pendingCount").textContent = gemShotCount + marketCount;
        document.getElementById("folderName").textContent = "sourceImage";
        document.getElementById("groupLabel").textContent = "角色";
        document.getElementById("shotLabel").textContent = "截图";
        document.getElementById("pendingLabel").textContent = "宝石数据";
        document.getElementById("folderLabel").textContent = "图片字段";
        document.getElementById("notice").hidden = true;
        renderTabs();
      }

      function render() {
        if (activeKey === compareKey) {
          renderCompare();
          return;
        }
        if (activeKey === beastCostKey) {
          renderBeastCost();
          return;
        }
        if (activeKey === matrixKey) {
          renderMatrix();
          return;
        }
        if (activeKey === gemKey) {
          renderGems();
          return;
        }
        if (activeKey === sourceKey) {
          renderSources();
          return;
        }
        destroyBeastCostChart();
        setViewCopy(basicKey);
        const dataset = datasets.find((item) => item.key === activeFolderKey) || datasets[0];
        const groups = buildGroups(dataset.records);
        const query = document.getElementById("searchInput").value.trim();
        const queryLower = query.toLowerCase();
        const visible = groups.filter((group) => {
          if (!queryLower) return true;
          const text = [
            group.id,
            group.pet,
            group.meta,
            group.heart || "",
            `技能数 ${group.skills.filter(isCountedSkill).length}`,
            ...group.shots.flatMap((shot) => [shot.id, shot.file, shot.note]),
            ...statsSearchText(group.stats),
            ...group.skills,
          ]
            .join(" ")
            .toLowerCase();
          return text.includes(queryLower);
        });
        document.getElementById("records").innerHTML = groups.length ? visible.map((group) => renderGroup(group, query)).join("") : renderEmpty(dataset);
        document.getElementById("groupCount").textContent = visible.length;
        document.getElementById("shotCount").textContent = groups.length ? visible.reduce((sum, group) => sum + group.shots.length, 0) : dataset.imageCount;
        document.getElementById("pendingCount").textContent = groups.filter((group) => group.skills.some(isPending)).length;
        document.getElementById("folderName").textContent = dataset.label;
        document.getElementById("groupLabel").textContent = "宠物记录组";
        document.getElementById("shotLabel").textContent = "截图来源";
        document.getElementById("pendingLabel").textContent = "含待确认记录组";
        document.getElementById("folderLabel").textContent = "当前目录";
        document.getElementById("notice").hidden = true;
        renderTabs();
      }

      function persistBeastTaskControlEvent(event) {
        const taskSetting = event.target.closest("[data-task-setting]");
        const taskResource = event.target.closest("[data-task-resource]");
        const taskDone = event.target.closest("[data-task-done]");
        const taskPrice = event.target.closest("[data-task-price]");
        if (!taskSetting && !taskResource && !taskDone && !taskPrice) return false;
        updateBeastTaskState((state) => {
          if (taskSetting) {
            const key = taskSetting.dataset.taskSetting;
            state.settings[key] = key === "startDate" ? taskSetting.value : numericOrDefault(taskSetting.value, state.settings[key]);
          }
          if (taskResource) {
            const folderKey = taskResource.dataset.taskResource;
            const field = taskResource.dataset.taskResourceField;
            if (!state.resources[folderKey]) state.resources[folderKey] = { ...beastTaskDefaultResources[folderKey] };
            state.resources[folderKey][field] = numericOrDefault(taskResource.value, state.resources[folderKey][field]);
          }
          if (taskDone) {
            const id = taskDone.dataset.taskDone;
            state.overrides[id] = { ...(state.overrides[id] || {}), done: taskDone.checked };
          }
          if (taskPrice) {
            const id = taskPrice.dataset.taskPrice;
            state.overrides[id] = { ...(state.overrides[id] || {}), priceWan: numericOrDefault(taskPrice.value, 0) };
          }
        });
        return true;
      }

      document.getElementById("searchInput").addEventListener("input", render);
      document.getElementById("tabs").addEventListener("click", (event) => {
        const tab = event.target.closest("[data-folder]");
        if (!tab) return;
        const nextKey = tab.dataset.folder;
        if (nextKey === compareKey && activeKey !== compareKey) activeCompareMode = "focus";
        activeKey = nextKey;
        document.getElementById("searchInput").value = "";
        render();
      });
      document.getElementById("basicTabs").addEventListener("click", (event) => {
        const tab = event.target.closest("[data-basic-folder]");
        if (!tab) return;
        activeFolderKey = tab.dataset.basicFolder;
        document.getElementById("searchInput").value = "";
        render();
      });
      document.getElementById("records").addEventListener("click", (event) => {
        if (activeKey === gemKey && window.GemsView.handleClick(event, gemViewContext())) return;
        const compareTab = event.target.closest("[data-compare-mode]");
        const beastCostTab = event.target.closest("[data-beast-cost-type]");
        const beastCostRule = event.target.closest("[data-beast-cost-rule]");
        const taskReset = event.target.closest("[data-beast-task-reset]");
        const tab = event.target.closest("[data-matrix-section]");
        const density = event.target.closest("[data-matrix-density]");
        if (!compareTab && !beastCostTab && !beastCostRule && !taskReset && !tab && !density) return;
        if (compareTab) {
          activeCompareMode = compareTab.dataset.compareMode;
          renderCompare();
          return;
        }
        if (beastCostTab) {
          activeBeastCostType = beastCostTab.dataset.beastCostType;
          renderBeastCost();
          return;
        }
        if (beastCostRule) {
          activeBeastCostRuleKey = beastCostRule.dataset.beastCostRule;
          renderBeastCost();
          return;
        }
        if (taskReset) {
          resetBeastTaskState();
          renderBeastCost();
          return;
        }
        if (tab) activeMatrixSectionKey = tab.dataset.matrixSection;
        if (density) matrixDensity = density.dataset.matrixDensity;
        renderMatrix();
      });
      document.getElementById("records").addEventListener("change", (event) => {
        if (persistBeastTaskControlEvent(event)) {
          renderBeastCost();
          return;
        }
        const toggle = event.target.closest("[data-matrix-toggle]");
        if (!toggle) return;
        matrixDisplay[toggle.dataset.matrixToggle] = toggle.checked;
        renderMatrix();
      });
      document.getElementById("records").addEventListener("input", (event) => {
        if (activeKey === gemKey && window.GemsView.handleInput(event, gemViewContext())) return;
        if (!event.target.closest("[data-task-setting], [data-task-resource], [data-task-price]")) return;
        if (!persistBeastTaskControlEvent(event)) return;
        window.clearTimeout(beastTaskInputTimer);
        beastTaskInputTimer = window.setTimeout(() => {
          if (activeKey === beastCostKey) renderBeastCost();
        }, 450);
      });
      render();
