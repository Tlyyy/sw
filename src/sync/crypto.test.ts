import { describe, expect, it } from "vitest";
import { syncCryptoConfig } from "../../instant.config";
import {
  canonicalStringify,
  decryptWorkspace,
  deriveCapability,
  deriveRootKey,
  encryptWorkspace,
  hashWorkspaceContent,
  isUsableRootKey,
  type WorkspaceCryptoMetadata,
} from "./crypto";

const metadata: WorkspaceCryptoMetadata = {
  capability: "test-capability",
  cryptoVersion: syncCryptoConfig.version,
  payloadVersion: syncCryptoConfig.payloadVersion,
  revision: 3,
  mutationId: "a271960e-bb30-4542-b39c-b6fd70c973db",
  writerId: "0f5a37b8-0386-44d2-8437-e2ff5339c38b",
  updatedAt: 1_789_000_000_000,
};

describe("encrypted workspace sync", () => {
  it("derives a stable capability while keeping the root key non-extractable", async () => {
    const rootKey = await deriveRootKey("correct horse battery staple");
    expect(isUsableRootKey(rootKey)).toBe(true);
    expect(await deriveCapability(rootKey)).toBe(await deriveCapability(rootKey));
    await expect(crypto.subtle.exportKey("raw", rootKey)).rejects.toBeDefined();

    const otherKey = await deriveRootKey("a different password");
    expect(await deriveCapability(otherKey)).not.toBe(await deriveCapability(rootKey));
  });

  it("round-trips data, uses a fresh IV, and authenticates metadata", async () => {
    const rootKey = await deriveRootKey("sync-password");
    const value = { inventory: [{ id: "LG2", count: 7 }], note: "只在浏览器内解密" };
    const first = await encryptWorkspace(rootKey, value, metadata);
    const second = await encryptWorkspace(rootKey, value, metadata);
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    await expect(decryptWorkspace(rootKey, first, metadata)).resolves.toEqual(value);
    await expect(decryptWorkspace(rootKey, await encryptWorkspace(rootKey, value, {
      ...metadata,
      cryptoVersion: syncCryptoConfig.legacyVersion,
    }), {
      ...metadata,
      cryptoVersion: syncCryptoConfig.legacyVersion,
    })).resolves.toEqual(value);
    await expect(decryptWorkspace(rootKey, first, { ...metadata, revision: 4 })).rejects.toBeDefined();
    await expect(decryptWorkspace(rootKey, first, {
      ...metadata,
      cryptoVersion: syncCryptoConfig.version + 1,
    })).rejects.toThrow("版本过新");
    const changedPrefix = first.ciphertext.startsWith("A") ? "B" : "A";
    await expect(decryptWorkspace(rootKey, { ...first, ciphertext: `${changedPrefix}${first.ciphertext.slice(1)}` }, metadata)).rejects.toBeDefined();
  });

  it("hashes canonical content independently of object key order", async () => {
    const left = { settings: { b: 2, a: 1 }, inventory: ["x", "y"] };
    const right = { inventory: ["x", "y"], settings: { a: 1, b: 2 } };
    expect(canonicalStringify(left)).toBe(canonicalStringify(right));
    expect(await hashWorkspaceContent(left)).toBe(await hashWorkspaceContent(right));
  });
});
