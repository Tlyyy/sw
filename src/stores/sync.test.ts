import type { ConnectionStatus } from "@instantdb/core";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncDatabase } from "../sync/instant";
import { syncReconnectConfig } from "../sync/reconnect";
import { useSyncStore } from "./sync";

const instant = vi.hoisted(() => ({
  getSyncDatabase: vi.fn(),
  resetSyncDatabase: vi.fn(),
}));

vi.mock("../sync/instant", () => instant);
vi.mock("../sync/crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../sync/crypto")>();
  return {
    ...actual,
    deriveCapability: vi.fn(async () => "test-capability"),
    hashWorkspaceContent: vi.fn(async () => "test-hash"),
  };
});

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

type QueryResponse = { data: { workspaces: unknown[] }; error?: { message: string } };

function createFakeDatabase() {
  let connectionCallback: ((status: ConnectionStatus) => void) | undefined;
  let queryCallback: ((response: QueryResponse) => void) | undefined;
  const txNode: Record<string, unknown> = {};
  txNode.ruleParams = vi.fn(() => txNode);
  txNode.update = vi.fn((value: unknown) => ({ value }));
  const raw = {
    subscribeConnectionStatus: vi.fn((callback: typeof connectionCallback) => {
      connectionCallback = callback;
      return vi.fn();
    }),
    subscribeQuery: vi.fn((_query: unknown, callback: typeof queryCallback, _options: unknown) => {
      queryCallback = callback;
      return vi.fn();
    }),
    queryOnce: vi.fn(async () => ({ data: { workspaces: [] } })),
    transact: vi.fn(async () => ({ status: "synced" as const })),
    tx: { workspaces: new Proxy({}, { get: () => txNode }) },
    shutdown: vi.fn(),
  };
  return {
    db: raw as unknown as SyncDatabase,
    raw,
    emitConnection: (status: ConnectionStatus) => connectionCallback?.(status),
    emitRows: (rows: unknown[] = []) => queryCallback?.({ data: { workspaces: rows } }),
  };
}

class FakeDocument extends EventTarget {
  hidden = false;
}

let networkState: { onLine: boolean };
let fakeDocument: FakeDocument;
let fakeWindow: EventTarget;
let databases: ReturnType<typeof createFakeDatabase>[];

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.stubGlobal("localStorage", new MemoryStorage());
  networkState = { onLine: true };
  fakeDocument = new FakeDocument();
  fakeWindow = Object.assign(new EventTarget(), {
    setTimeout: (...args: Parameters<typeof setTimeout>) => globalThis.setTimeout(...args),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(id),
  });
  vi.stubGlobal("navigator", networkState);
  vi.stubGlobal("document", fakeDocument);
  vi.stubGlobal("window", fakeWindow);
  setActivePinia(createPinia());
  databases = [];
  instant.getSyncDatabase.mockReset();
  instant.resetSyncDatabase.mockReset();
  instant.getSyncDatabase.mockImplementation(() => {
    const fixture = createFakeDatabase();
    databases.push(fixture);
    return fixture.db;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function startStore() {
  const store = useSyncStore();
  await store.start({} as CryptoKey);
  expect(databases).toHaveLength(1);
  return store;
}

async function advanceToWatchdogReconnect() {
  await vi.advanceTimersByTimeAsync(20_000);
  await vi.advanceTimersByTimeAsync(syncReconnectConfig.baseDelayMs);
}

describe("sync store mobile recovery", () => {
  it("rebuilds a connection that never authenticates", async () => {
    const store = await startStore();
    await advanceToWatchdogReconnect();
    expect(databases).toHaveLength(2);
    store.stop();
  });

  it("lets the InstantDB client recover a closed socket before the watchdog intervenes", async () => {
    const store = await startStore();
    databases[0].emitConnection("authenticated");
    databases[0].emitConnection("closed");
    await vi.advanceTimersByTimeAsync(19_999);
    expect(databases).toHaveLength(1);
    databases[0].emitConnection("authenticated");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(databases).toHaveLength(1);
    store.stop();
  });

  it("does not loop automatically after the server rejects initialization", async () => {
    const store = await startStore();
    databases[0].emitConnection("errored");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(databases).toHaveLength(1);
    expect(store.status).toBe("error");
    store.stop();
  });

  it("lets InstantDB recover when the network returns and rebuilds only after the watchdog", async () => {
    const store = await startStore();
    databases[0].emitConnection("authenticated");
    networkState.onLine = false;
    fakeWindow.dispatchEvent(new Event("offline"));
    databases[0].emitConnection("closed");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(databases).toHaveLength(1);

    networkState.onLine = true;
    fakeWindow.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(databases).toHaveLength(1);
    await advanceToWatchdogReconnect();
    expect(databases).toHaveLength(2);
    store.stop();
  });

  it("health-checks a resumed authenticated session and rebuilds it when the check hangs", async () => {
    const store = await startStore();
    databases[0].emitConnection("authenticated");
    databases[0].raw.queryOnce.mockImplementation(() => new Promise(() => undefined));

    fakeDocument.hidden = true;
    fakeDocument.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(syncReconnectConfig.backgroundRestartThresholdMs);
    fakeDocument.hidden = false;
    fakeDocument.dispatchEvent(new Event("visibilitychange"));

    await advanceToWatchdogReconnect();
    expect(databases[0].raw.queryOnce).toHaveBeenCalledTimes(1);
    expect(databases).toHaveLength(2);
    store.stop();
  });

  it("removes recovery listeners and timers after sync stops", async () => {
    const store = await startStore();
    databases[0].emitConnection("closed");
    store.stop();
    networkState.onLine = false;
    fakeWindow.dispatchEvent(new Event("offline"));
    networkState.onLine = true;
    fakeWindow.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(databases).toHaveLength(1);
  });
});
