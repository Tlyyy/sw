import { describe, expect, it } from "vitest";
import { clearMemoryStorage, MemoryStorage } from "./memoryStorage";

describe("Instant in-memory persistence", () => {
  it("clears every store for one app without touching another app", async () => {
    const appId = crypto.randomUUID();
    const otherAppId = crypto.randomUUID();
    const kv = new MemoryStorage(appId, "kv");
    const subscriptions = new MemoryStorage(appId, "querySubs");
    const other = new MemoryStorage(otherAppId, "kv");

    await kv.multiSet([["pendingMutations", { id: "stale-write" }]]);
    await subscriptions.multiSet([["subscription", true]]);
    await other.multiSet([["pendingMutations", { id: "keep" }]]);

    clearMemoryStorage(appId);

    expect(await kv.getAllKeys()).toEqual([]);
    expect(await subscriptions.getAllKeys()).toEqual([]);
    expect(await other.getItem("pendingMutations")).toEqual({ id: "keep" });
    clearMemoryStorage(otherAppId);
  });
});
