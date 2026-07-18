import { instantWorkspaceId } from "../../instant.config";
import { decryptWorkspace, deriveCapability } from "./crypto";
import { getSyncDatabase, resetSyncDatabase } from "./instant";
import { recordMetadata, type CloudWorkspace } from "./types";

export class InvalidCloudCredentialError extends Error {
  constructor() {
    super("云端密码不匹配");
    this.name = "InvalidCloudCredentialError";
  }
}

function structurallyValid(record: CloudWorkspace, expectedCapability: string) {
  return record.id === instantWorkspaceId
    && record.capability === expectedCapability
    && (record.cryptoVersion === 1 || record.cryptoVersion === 2)
    && record.payloadVersion === 1
    && typeof record.iv === "string"
    && typeof record.ciphertext === "string"
    && Number.isInteger(record.revision)
    && record.revision > 0
    && typeof record.mutationId === "string"
    && record.mutationId.length === 36
    && typeof record.writerId === "string"
    && record.writerId.length === 36
    && Number.isFinite(record.updatedAt);
}

export async function validateCloudCredential(rootKey: CryptoKey, options: { keepDatabase?: boolean } = {}) {
  const capability = await deriveCapability(rootKey);
  const database = getSyncDatabase();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let validated = false;
  try {
    const response = await Promise.race([
      database.queryOnce(
        { workspaces: { $: { where: { id: instantWorkspaceId } } } },
        { ruleParams: { capability } },
      ),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("连接云端超时")), 12_000);
      }),
    ]);
    const records = response.data.workspaces as CloudWorkspace[];
    if (records.length !== 1 || !structurallyValid(records[0], capability)) throw new InvalidCloudCredentialError();
    const record = records[0];
    try {
      const payload = await decryptWorkspace(rootKey, { iv: record.iv, ciphertext: record.ciphertext }, recordMetadata(record));
      validated = true;
      return { record, payload };
    } catch (error) {
      if (error instanceof Error && /版本过新/.test(error.message)) throw error;
      throw new InvalidCloudCredentialError();
    }
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
    // Login checks run while locked and should not retain a reactor. Rotation
    // deliberately keeps the freshly authenticated reactor for its CAS write.
    if (!options.keepDatabase || !validated) resetSyncDatabase(database);
  }
}
