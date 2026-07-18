import { instantAppId, instantWorkspaceId, syncCryptoConfig } from "../../instant.config";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface WorkspaceCryptoMetadata {
  capability: string;
  cryptoVersion: number;
  payloadVersion: number;
  revision: number;
  mutationId: string;
  writerId: string;
  updatedAt: number;
}

export interface EncryptedWorkspace {
  iv: string;
  ciphertext: string;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("加密数据编码无效");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function hkdfParams(info: string): HkdfParams {
  return {
    name: "HKDF",
    hash: "SHA-256",
    salt: encoder.encode(syncCryptoConfig.hkdfSalt),
    info: encoder.encode(info),
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, unknown>>((result, key) => {
      const child = (value as Record<string, unknown>)[key];
      if (child !== undefined) result[key] = canonicalize(child);
      return result;
    }, {});
  }
  return value;
}

export function canonicalStringify(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export async function deriveRootKey(password: string) {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const rootBits = new Uint8Array(await crypto.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt: encoder.encode(syncCryptoConfig.pbkdf2Salt),
    iterations: syncCryptoConfig.pbkdf2Iterations,
  }, passwordKey, 256));
  try {
    return await crypto.subtle.importKey("raw", rootBits, "HKDF", false, ["deriveBits", "deriveKey"]);
  } finally {
    rootBits.fill(0);
  }
}

export function isUsableRootKey(value: unknown): value is CryptoKey {
  return value instanceof CryptoKey
    && value.type === "secret"
    && value.extractable === false
    && value.algorithm.name === "HKDF"
    && value.usages.includes("deriveBits")
    && value.usages.includes("deriveKey");
}

export async function deriveCapability(rootKey: CryptoKey) {
  const bits = await crypto.subtle.deriveBits(hkdfParams("sw-sync/v1/capability"), rootKey, 256);
  return bytesToBase64Url(new Uint8Array(bits));
}

async function deriveEncryptionKey(rootKey: CryptoKey) {
  return crypto.subtle.deriveKey(
    hkdfParams("sw-sync/v1/encryption"),
    rootKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function additionalData(metadata: WorkspaceCryptoMetadata) {
  return encoder.encode(canonicalStringify({
    appId: instantAppId,
    workspaceId: instantWorkspaceId,
    ...metadata,
  }));
}

export async function encryptWorkspace(rootKey: CryptoKey, value: unknown, metadata: WorkspaceCryptoMetadata): Promise<EncryptedWorkspace> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptionKey = await deriveEncryptionKey(rootKey);
  const ciphertext = await crypto.subtle.encrypt({
    name: "AES-GCM",
    iv,
    additionalData: additionalData(metadata),
    tagLength: 128,
  }, encryptionKey, encoder.encode(JSON.stringify(value)));
  return {
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
  };
}

export async function decryptWorkspace(rootKey: CryptoKey, encrypted: EncryptedWorkspace, metadata: WorkspaceCryptoMetadata) {
  if (metadata.cryptoVersion < syncCryptoConfig.legacyVersion
    || metadata.cryptoVersion > syncCryptoConfig.version
    || metadata.payloadVersion !== syncCryptoConfig.payloadVersion) {
    throw new Error("云端数据版本过新，请先更新应用");
  }
  const encryptionKey = await deriveEncryptionKey(rootKey);
  const plaintext = await crypto.subtle.decrypt({
    name: "AES-GCM",
    iv: base64UrlToBytes(encrypted.iv),
    additionalData: additionalData(metadata),
    tagLength: 128,
  }, encryptionKey, base64UrlToBytes(encrypted.ciphertext));
  return JSON.parse(decoder.decode(plaintext)) as unknown;
}

export async function hashWorkspaceContent(value: unknown) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(canonicalStringify(value)));
  return bytesToBase64Url(new Uint8Array(digest));
}
