export const syncReconnectConfig = {
  baseDelayMs: 1_500,
  maxDelayMs: 30_000,
  backgroundRestartThresholdMs: 30_000,
} as const;

export type SyncRecoverySignal = {
  reason: "online" | "visible" | "pageshow";
  forceCheck: boolean;
};

interface SimpleEventTarget {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

interface VisibilityEventTarget extends SimpleEventTarget {
  readonly hidden: boolean;
}

interface RecoveryEnvironment {
  windowTarget: SimpleEventTarget;
  documentTarget: VisibilityEventTarget;
  now: () => number;
}

interface RecoveryCallbacks {
  onRecovery: (signal: SyncRecoverySignal) => void;
  onOffline: () => void;
  onHidden?: () => void;
}

export function reconnectDelayMs(attempt: number, random: () => number = Math.random) {
  const normalizedAttempt = Math.max(0, Math.floor(attempt));
  const exponential = Math.min(
    syncReconnectConfig.maxDelayMs,
    syncReconnectConfig.baseDelayMs * (2 ** Math.min(normalizedAttempt, 10)),
  );
  const jitter = 0.8 + Math.min(1, Math.max(0, random())) * 0.4;
  return Math.min(syncReconnectConfig.maxDelayMs, Math.round(exponential * jitter));
}

export function observeSyncRecovery(
  callbacks: RecoveryCallbacks,
  environment?: Partial<RecoveryEnvironment>,
) {
  const windowTarget = environment?.windowTarget ?? window;
  const documentTarget = environment?.documentTarget ?? document;
  const now = environment?.now ?? Date.now;
  let hiddenAt = documentTarget.hidden ? now() : null;

  const handleOnline: EventListener = () => callbacks.onRecovery({ reason: "online", forceCheck: true });
  const handleOffline: EventListener = () => callbacks.onOffline();
  const handleVisibility: EventListener = () => {
    if (documentTarget.hidden) {
      hiddenAt = now();
      callbacks.onHidden?.();
      return;
    }
    const backgroundDuration = hiddenAt === null ? 0 : Math.max(0, now() - hiddenAt);
    hiddenAt = null;
    callbacks.onRecovery({
      reason: "visible",
      forceCheck: backgroundDuration >= syncReconnectConfig.backgroundRestartThresholdMs,
    });
  };
  const handlePageShow: EventListener = (event) => {
    if ((event as PageTransitionEvent).persisted) {
      callbacks.onRecovery({ reason: "pageshow", forceCheck: true });
    }
  };

  windowTarget.addEventListener("online", handleOnline);
  windowTarget.addEventListener("offline", handleOffline);
  windowTarget.addEventListener("pageshow", handlePageShow);
  documentTarget.addEventListener("visibilitychange", handleVisibility);

  return () => {
    windowTarget.removeEventListener("online", handleOnline);
    windowTarget.removeEventListener("offline", handleOffline);
    windowTarget.removeEventListener("pageshow", handlePageShow);
    documentTarget.removeEventListener("visibilitychange", handleVisibility);
  };
}
