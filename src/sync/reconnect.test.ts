import { describe, expect, it, vi } from "vitest";
import { observeSyncRecovery, reconnectDelayMs, syncReconnectConfig, type SyncRecoverySignal } from "./reconnect";

class VisibilityTarget extends EventTarget {
  hidden = false;
}

describe("sync reconnect policy", () => {
  it("uses capped exponential backoff with bounded jitter", () => {
    const centered = () => 0.5;
    expect(reconnectDelayMs(0, centered)).toBe(1_500);
    expect(reconnectDelayMs(1, centered)).toBe(3_000);
    expect(reconnectDelayMs(2, centered)).toBe(6_000);
    expect(reconnectDelayMs(20, centered)).toBe(syncReconnectConfig.maxDelayMs);
    expect(reconnectDelayMs(0, () => -1)).toBe(1_200);
    expect(reconnectDelayMs(0, () => 2)).toBe(1_800);
  });

  it("requests recovery for network, foreground and bfcache transitions", () => {
    const windowTarget = new EventTarget();
    const documentTarget = new VisibilityTarget();
    const recoveries: SyncRecoverySignal[] = [];
    const onOffline = vi.fn();
    let now = 1_000;
    const stop = observeSyncRecovery(
      { onRecovery: (signal) => recoveries.push(signal), onOffline },
      { windowTarget, documentTarget, now: () => now },
    );

    windowTarget.dispatchEvent(new Event("online"));
    windowTarget.dispatchEvent(new Event("offline"));

    documentTarget.hidden = true;
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    now += syncReconnectConfig.backgroundRestartThresholdMs - 1;
    documentTarget.hidden = false;
    documentTarget.dispatchEvent(new Event("visibilitychange"));

    documentTarget.hidden = true;
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    now += syncReconnectConfig.backgroundRestartThresholdMs;
    documentTarget.hidden = false;
    documentTarget.dispatchEvent(new Event("visibilitychange"));

    const pageShow = new Event("pageshow");
    Object.defineProperty(pageShow, "persisted", { value: true });
    windowTarget.dispatchEvent(pageShow);

    expect(onOffline).toHaveBeenCalledTimes(1);
    expect(recoveries).toEqual([
      { reason: "online", forceCheck: true },
      { reason: "visible", forceCheck: false },
      { reason: "visible", forceCheck: true },
      { reason: "pageshow", forceCheck: true },
    ]);

    stop();
    windowTarget.dispatchEvent(new Event("online"));
    expect(recoveries).toHaveLength(4);
  });
});
