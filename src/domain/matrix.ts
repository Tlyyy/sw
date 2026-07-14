import type { AccountId, PetView } from "./types";

export const matrixAccountIds = ["FC", "LG1", "LG2", "PT", "MYT"] as const satisfies readonly AccountId[];

export interface MatrixColumn { key: string; label: string; group: string; match: (row: PetView) => boolean }
export const matrixColumns: MatrixColumn[] = [
  { key: "huodou", label: "祸斗", group: "日常", match: (row) => row.name === "祸斗" },
  { key: "leisi", label: "雷司", group: "日常", match: (row) => row.name === "雷司" },
  { key: "jiutou", label: "九头", group: "日常", match: (row) => row.name === "九头鸟" },
  { key: "swordSnake", label: "剑气蛇", group: "PK：神兽蛇 / 小马", match: (row) => row.name === "神兽青蛇" && row.role.tags.includes("剑气") },
  { key: "magicSnake", label: "法蛇", group: "PK：神兽蛇 / 小马", match: (row) => row.name === "神兽青蛇" && row.role.primary === "普通法" },
  { key: "stealthSnake", label: "隐攻蛇", group: "PK：神兽蛇 / 小马", match: (row) => row.name === "神兽青蛇" && row.role.primary === "隐攻" },
  { key: "horse", label: "小马", group: "PK：神兽蛇 / 小马", match: (row) => row.name === "神兽龙马" },
  { key: "hanling", label: "寒翎", group: "PK：法系 / 特殊 / 物理", match: (row) => row.name === "寒翎" },
  { key: "princess", label: "公主", group: "PK：法系 / 特殊 / 物理", match: (row) => row.name === "沧海公主" },
  { key: "lobster", label: "龙虾", group: "PK：法系 / 特殊 / 物理", match: (row) => row.name === "龙虾骑士" },
  { key: "yunluo", label: "云萝", group: "PK：法系 / 特殊 / 物理", match: (row) => row.name === "云萝仙子" },
  { key: "child", label: "孩子", group: "PK：法系 / 特殊 / 物理", match: (row) => row.name === "孩子" || row.name === "5" },
  { key: "mingwei", label: "冥卫", group: "PK：速度", match: (row) => row.name === "冥卫" },
  { key: "tongzi", label: "童子", group: "PK：速度", match: (row) => row.name === "赤炎童子" },
  { key: "taohua", label: "桃花", group: "PK：速度", match: (row) => row.name === "桃花精灵" },
];
export const matrixGroups = ["日常", "PK：神兽蛇 / 小马", "PK：法系 / 特殊 / 物理", "PK：速度"];

export function matrixRow(rows: PetView[], group: string) {
  return matrixColumns.filter((column) => column.group === group).map((column) => ({
    column,
    accounts: matrixAccountIds.map((accountId) => {
      const candidates = rows.filter((row) => row.accountId === accountId && column.match(row));
      return candidates.sort((a, b) => (b.talent || 0) - (a.talent || 0) || b.attack - a.attack || b.spirit - a.spirit)[0];
    }),
  }));
}
