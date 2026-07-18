import type { WorkspaceCryptoMetadata } from "./crypto";

export interface CloudWorkspace extends WorkspaceCryptoMetadata {
  id: string;
  iv: string;
  ciphertext: string;
}

export function recordMetadata(record: CloudWorkspace): WorkspaceCryptoMetadata {
  return {
    capability: record.capability,
    cryptoVersion: record.cryptoVersion,
    payloadVersion: record.payloadVersion,
    revision: record.revision,
    mutationId: record.mutationId,
    writerId: record.writerId,
    updatedAt: record.updatedAt,
  };
}
