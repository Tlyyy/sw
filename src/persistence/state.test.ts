import { describe, expect, it } from "vitest";
import { catalog } from "../data/catalog";
import {
  createWorkspaceBackup,
  emptyAccountingState,
  parseAccountingState,
  parsePublishState,
  parseSettingsState,
  parseUiState,
  parseWorkspaceBackup,
} from "./state";

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
    expect(settings.version).toBe(4);
    expect(settings.settings.weeklyEggs).toBe(9);
    expect(settings.settings.startDate).toBe(taskDefaults.startDate);
    expect(settings.gemPlan).toEqual({ targetLevel: "13", weeklyIncomeWan: 88 });
    expect(settings.taskCompletions).toEqual([]);
    expect(settings.silverExpenses).toEqual([]);

    const publish = parsePublishState({ selectedIds: ["a", "a"], options: { mode: "record" }, draft: "手改正文" }, publishDefaults);
    expect(publish).toMatchObject({ version: 2, selectedIds: ["a"], draft: "手改正文", generatedSource: "手改正文" });
    expect(publish.options.mode).toBe("record");

    const ui = parseUiState({ recentAccount: "FC", matrixDisplay: { skills: false } });
    expect(ui).toMatchObject({ version: 2, recentAccount: "FC", matrixDisplay: { stats: true, aptitudes: true, skills: false } });
  });

  it("rejects corrupt and unknown future state", () => {
    expect(() => parseSettingsState({ version: 5 }, taskDefaults, marketNames)).toThrow();
    expect(() => parsePublishState({ version: 2, selectedIds: [], options: { ...publishDefaults, mode: "invalid" }, draft: "", generatedSource: "" }, publishDefaults)).toThrow();
    expect(() => parsePublishState({ version: 3 }, publishDefaults)).toThrow();
    expect(() => parseUiState({ version: 2, accountScope: "BAD" })).toThrow();
    expect(() => parseUiState({ version: 3 })).toThrow();
  });

  it("adds empty activity ledgers when migrating validated v3 settings", () => {
    const current = parseSettingsState({ version: 2 }, taskDefaults, marketNames);
    const previous = {
      ...current,
      version: 3 as const,
    } as Record<string, unknown>;
    delete previous.taskCompletions;
    delete previous.silverExpenses;

    expect(parseSettingsState(previous, taskDefaults, marketNames)).toMatchObject({
      version: 4,
      taskCompletions: [],
      silverExpenses: [],
    });
  });

  it("migrates a v1 backup with an empty independent accounting ledger", () => {
    const settings = parseSettingsState({ version: 2 }, taskDefaults, marketNames);
    const publish = parsePublishState({}, publishDefaults);
    const ui = parseUiState({});
    const legacy = {
      format: "sw-workspace-backup" as const,
      version: 1 as const,
      exportedAt: "2026-07-13T00:00:00.000Z",
      inventory: { version: 2 as const, snapshots: [] },
      settings,
      publish,
      ui,
    };

    expect(parseWorkspaceBackup(legacy, taskDefaults, marketNames)).toEqual({
      ...legacy,
      version: 2,
      accounting: emptyAccountingState(),
    });
  });

  it("round-trips a complete v2 backup and rejects one bad partition", () => {
    const settings = parseSettingsState({ version: 2 }, taskDefaults, marketNames);
    const publish = parsePublishState({}, publishDefaults);
    const ui = parseUiState({});
    const accounting = {
      version: 1 as const,
      entries: [{
        id: "expense-1",
        accountId: "FC" as const,
        effectiveDate: "2026-07-13",
        occurredAt: "2026-07-13T01:00:00.000Z",
        recordedAt: "2026-07-13T01:01:00.000Z",
        source: "test",
        status: "confirmed" as const,
        note: "实际支出",
        legs: [{
          kind: "expense" as const,
          resources: {
            silverWan: 18,
            dedicatedEggs: 0,
            regularEggs: 0,
            innerShards: 0,
          },
        }],
      }],
    };
    const backup = createWorkspaceBackup({
      inventory: { version: 2, snapshots: [] },
      settings,
      publish,
      ui,
      accounting,
    }, () => new Date("2026-07-13T00:00:00Z"));
    expect(parseWorkspaceBackup(JSON.stringify(backup), taskDefaults, marketNames)).toEqual(backup);

    const corrupt = structuredClone(backup);
    corrupt.inventory = { version: 2, snapshots: [{ broken: true }] } as never;
    expect(() => parseWorkspaceBackup(corrupt, taskDefaults, marketNames)).toThrow();
  });

  it("rejects impossible accounting dates and incomplete account transfers", () => {
    const baseEntry = {
      id: "entry-1",
      accountId: "FC",
      effectiveDate: "2026-07-23",
      occurredAt: "2026-07-23T01:00:00.000Z",
      recordedAt: "2026-07-23T01:01:00.000Z",
      status: "confirmed",
      legs: [{
        kind: "expense",
        resources: {
          silverWan: 10,
          dedicatedEggs: 0,
          regularEggs: 0,
          innerShards: 0,
        },
      }],
    };

    expect(() => parseAccountingState({
      version: 1,
      entries: [{ ...baseEntry, effectiveDate: "2026-99-99" }],
    })).toThrow();
    expect(() => parseAccountingState({
      version: 1,
      entries: [{
        ...baseEntry,
        groupId: "transfer-1",
        legs: [{ ...baseEntry.legs[0], kind: "transfer-out" }],
      }],
    })).toThrow("账号转移的两端不完整");
  });
});
