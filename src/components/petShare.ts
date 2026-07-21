import type { AccountId, EvidenceSource, PetView, StatValue } from "../domain/types";
import { publicAsset } from "../utils/publicAsset";
import { createPetBatchShareImage } from "./petBatchShareImage";
import { createPetDetailShareImage, type PetDetailShareData } from "./petDetailShareImage";

const accountImageTone: Record<AccountId, string> = {
  FC: "#12678f",
  LG1: "#6446a6",
  LG2: "#8a5a00",
  PT: "#a33838",
  MYT: "#28764a",
};

function valueFor(rows: StatValue[], label: string, fallback = "—") {
  return rows.find(([name]) => name === label)?.[1] || fallback;
}

function aptitudeUpperLimit(label: string, value: string) {
  if (!label.includes("资质")) return value;
  return value.split(/[\/／]/).at(-1)?.trim() || value;
}

export function buildPetDetailShareData(
  pet: PetView,
  primaryEvidence: EvidenceSource | undefined,
  generatedAt: string,
): PetDetailShareData {
  return {
    accountId: pet.accountId,
    accountTone: accountImageTone[pet.accountId],
    petName: pet.name,
    levelLabel: pet.level ? `${pet.level}级` : "等级待确认",
    role: pet.role.primary,
    meta: pet.meta,
    advice: pet.role.advice,
    tags: pet.role.tags,
    capturedAt: primaryEvidence?.capturedAt || generatedAt.slice(0, 10),
    screenshotUrl: primaryEvidence ? publicAsset(primaryEvidence.sourcePath) : undefined,
    stats: [
      { label: "气血", value: String(pet.hp || valueFor(pet.panel, "气血")) },
      { label: "攻击", value: String(pet.attack || valueFor(pet.panel, "攻击")) },
      { label: "防御", value: String(pet.defense || valueFor(pet.panel, "防御")) },
      { label: "速度", value: String(pet.speed || valueFor(pet.panel, "速度")) },
      { label: "灵力", value: String(pet.spirit || valueFor(pet.panel, "灵力")) },
    ],
    aptitudes: pet.aptitudes.slice(0, 6).map(([label, value]) => ({
      label,
      value: aptitudeUpperLimit(label, value),
    })),
    skills: pet.skills.filter((skill) => skill !== "空"),
  };
}

export function petShareFileName(pet: PetView, prefix = "") {
  const safePetName = pet.name.replace(/[\\/:*?"<>|]/g, "-");
  return `${prefix}${pet.accountId}-${safePetName}-宠物档案.png`;
}

export async function createPetShareFile(
  pet: PetView,
  primaryEvidence: EvidenceSource | undefined,
  generatedAt: string,
  prefix = "",
) {
  const blob = await createPetDetailShareImage(buildPetDetailShareData(pet, primaryEvidence, generatedAt));
  return new File([blob], petShareFileName(pet, prefix), { type: "image/png" });
}

export function petBatchShareFileName(generatedAt: string, count: number) {
  return `宠物合集-${generatedAt.slice(0, 10)}-${count}只.png`;
}

export async function createPetBatchShareFile(
  pets: PetView[],
  evidenceById: ReadonlyMap<string, EvidenceSource>,
  generatedAt: string,
  onProgress?: (current: number, total: number) => void,
) {
  const shareData = pets.map((pet) => buildPetDetailShareData(
    pet,
    evidenceById.get(pet.evidenceIds[0]),
    generatedAt,
  ));
  const blob = await createPetBatchShareImage(shareData, {
    dataDate: generatedAt.slice(0, 10),
    onProgress,
  });
  return new File([blob], petBatchShareFileName(generatedAt, pets.length), { type: "image/png" });
}
