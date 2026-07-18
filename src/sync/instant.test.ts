import { beforeEach, describe, expect, it, vi } from "vitest";
import { instantAppId } from "../../instant.config";

const mocks = vi.hoisted(() => ({
  clearMemoryStorage: vi.fn(),
  init: vi.fn(),
}));

vi.mock("@instantdb/core", () => ({ init: mocks.init }));
vi.mock("../../instant.schema", () => ({ default: {} }));
vi.mock("./memoryStorage", () => ({
  clearMemoryStorage: mocks.clearMemoryStorage,
  MemoryStorage: class MemoryStorage {},
}));

describe("InstantDB sync client lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.init.mockReset();
    mocks.clearMemoryStorage.mockReset();
  });

  it("uses stable dedupe endpoints so shutdown cannot leave a stopped client cached", async () => {
    const first = { shutdown: vi.fn() };
    const second = { shutdown: vi.fn() };
    mocks.init.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const { getSyncDatabase, resetSyncDatabase } = await import("./instant");

    expect(getSyncDatabase()).toBe(first);
    expect(mocks.init).toHaveBeenCalledWith(expect.objectContaining({
      appId: instantAppId,
      apiURI: "https://api.instantdb.com",
      websocketURI: "wss://api.instantdb.com/runtime/session",
    }), expect.any(Function));

    expect(resetSyncDatabase(first as never)).toBe(true);
    expect(first.shutdown).toHaveBeenCalledTimes(1);
    expect(mocks.clearMemoryStorage).toHaveBeenCalledWith(instantAppId);
    expect(getSyncDatabase()).toBe(second);
    expect(mocks.init).toHaveBeenCalledTimes(2);
  });
});
