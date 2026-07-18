import { StoreInterface, type StoreInterfaceStoreName } from "@instantdb/core";

const memoryStores = new Map<string, Map<string, unknown>>();

export function clearMemoryStorage(appId: string) {
  const prefix = `${appId}:`;
  for (const [key, values] of memoryStores) {
    if (!key.startsWith(prefix)) continue;
    values.clear();
    memoryStores.delete(key);
  }
}

function clone<T>(value: T): T {
  return typeof structuredClone === "function" ? structuredClone(value) : value;
}

export class MemoryStorage extends StoreInterface {
  private readonly values: Map<string, unknown>;

  constructor(appId: string, storeName: StoreInterfaceStoreName) {
    super(appId, storeName);
    const key = `${appId}:${storeName}`;
    const existing = memoryStores.get(key) || new Map<string, unknown>();
    memoryStores.set(key, existing);
    this.values = existing;
  }

  async getItem(key: string) {
    return this.values.has(key) ? clone(this.values.get(key)) : null;
  }

  async removeItem(key: string) {
    this.values.delete(key);
  }

  async multiSet(keyValuePairs: Array<[string, unknown]>) {
    keyValuePairs.forEach(([key, value]) => this.values.set(key, clone(value)));
  }

  async getAllKeys() {
    return [...this.values.keys()];
  }
}
