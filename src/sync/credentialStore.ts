import { isUsableRootKey } from "./crypto";

const databaseName = "sw-auth-credentials-v1";
const storeName = "credentials";

export interface StoredCredential {
  id: string;
  key: CryptoKey;
  mode: "session" | "remember";
  createdAt: number;
  expiresAt: number | null;
}

let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("当前浏览器不支持安全密钥存储"));
  databasePromise ||= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onerror = () => reject(request.error || new Error("无法打开安全密钥存储"));
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
  });
  return databasePromise;
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("安全密钥存储操作失败"));
  });
}

function waitForTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("安全密钥存储事务失败"));
    transaction.onabort = () => reject(transaction.error || new Error("安全密钥存储事务已取消"));
  });
}

export async function saveCredential(value: StoredCredential) {
  if (!isUsableRootKey(value.key)) throw new Error("密钥格式无效");
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).put(value);
  await waitForTransaction(transaction);
}

export async function loadCredential(id: string) {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readonly");
  const value = await requestResult(transaction.objectStore(storeName).get(id)) as StoredCredential | undefined;
  if (!value || !isUsableRootKey(value.key)) return null;
  return value;
}

export async function deleteCredential(id: string) {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).delete(id);
  await waitForTransaction(transaction);
}

export async function cleanupCredentials(keepIds: string[], now = Date.now()) {
  const database = await openDatabase();
  const readTransaction = database.transaction(storeName, "readonly");
  const values = await requestResult(readTransaction.objectStore(storeName).getAll()) as StoredCredential[];
  const keep = new Set(keepIds);
  // localStorage is shared by tabs but each tab takes its own snapshot of the
  // active handle. Never delete another tab's newly saved remembered key just
  // because it was absent from this snapshot; explicit logout/password change
  // removes known keys. Only expired remembered keys and obsolete session keys
  // are safe to collect here.
  const stale = values.filter((value) => (value.expiresAt !== null && value.expiresAt <= now)
    || (value.mode === "session" && !keep.has(value.id)));
  if (!stale.length) return;
  const writeTransaction = database.transaction(storeName, "readwrite");
  stale.forEach((value) => writeTransaction.objectStore(storeName).delete(value.id));
  await waitForTransaction(writeTransaction);
}
