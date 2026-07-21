import { describe, expect, it } from "vitest";
import { catalog } from "../data/catalog";
import { createWorkspaceBackup, parsePublishState, parseSettingsState, parseUiState, parseWorkspaceBackup } from "./state";

const taskDefaults = catalog.beastConfig.taskDefaultSettings;
const marketNames = catalog.gemMarketSnapshots.at(-1)!.items.map((item) => item.name);
const publishDefaults = {
  mode: "sale" as const,
  format: "markdown" as const,
  title: "标题",
  intro: "简介",
  includeStats: true,
  includeSkills: true,
  includeNotes: true,
  allShots: true,
};

describe("versioned local state", () => {
  it("migrates legacy settings, publish and UI state", () => {
    const settings = parseSettingsState({ version: 2, settings: { weeklyEggs: 9 } }, taskDefaults, marketNames);
    expect(settings.version).toBe(3);
    expect(settings.settings.weeklyEggs).toBe(9);
    expect(settings.settings.startDate).toBe(taskDefaults.startDate);
    expect(settings.gemPlan).toEqual({ targetLevel: "13", weeklyIncomeWan: 88 });

    const publish = parsePublishState({ selectedIds: ["a", "a"], options: { mode: "record" }, draft: "手改正文" }, publishDefaults);
    expect(publish).toMatchObject({ version: 2, selectedIds: ["a"], draft: "手改正文", generatedSource: "手改正文" });
    expect(publish.options.mode).toBe("record");

    const ui = parseUiState({ recentAccount: "FC", matrixDisplay: { skills: false } });
    expect(ui).toMatchObject({ version: 2, recentAccount: "FC", matrixDisplay: { stats: true, aptitudes: true, skills: false } });
  });

  it("rejects corrupt and unknown future state", () => {
    expect(() => parseSettingsState({ version: 4 }, taskDefaults, marketNames)).toThrow();
    expect(() => parsePublishState({ version: 2, selectedIds: [], options: { ...publishDefaults, mode: "invalid" }, draft: "", generatedSource: "" }, publishDefaults)).toThrow();
    expect(() => parsePublishState({ version: 3 }, publishDefaults)).toThrow();
    expect(() => parseUiState({ version: 2, accountScope: "BAD" })).toThrow();
    expect(() => parseUiState({ version: 3 })).toThrow();
  });

  it("round-trips a complete backup and rejects one bad partition", () => {
    const settings = parseSettingsState({ version: 2 }, taskDefaults, marketNames);
    const publish = parsePublishState({}, publishDefaults);
    const ui = parseUiState({});
    const backup = createWorkspaceBackup({ inventory: { version: 2, snapshots: [] }, settings, publish, ui }, () => new Date("2026-07-13T00:00:00Z"));
    expect(parseWorkspaceBackup(JSON.stringify(backup), taskDefaults, marketNames)).toEqual(backup);

    const corrupt = structuredClone(backup);
    corrupt.inventory = { version: 2, snapshots: [{ broken: true }] } as never;
    expect(() => parseWorkspaceBackup(corrupt, taskDefaults, marketNames)).toThrow();
  });
});
