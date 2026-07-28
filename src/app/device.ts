import {
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  readonly,
  ref,
  type InjectionKey,
  type Ref,
} from "vue";

export const mobileAppMaxWidth = 980;
export const mobileAppMediaQuery = `(max-width: ${mobileAppMaxWidth}px)`;

export type AppDeviceMode = "mobile" | "desktop";
export type AppDeviceModeRef = Readonly<Ref<AppDeviceMode>>;

const appDeviceModeKey: InjectionKey<AppDeviceModeRef> = Symbol("app-device-mode");

export function resolveAppDeviceMode(matchesMobileLayout: boolean): AppDeviceMode {
  return matchesMobileLayout ? "mobile" : "desktop";
}

export function useViewportDeviceMode(): AppDeviceModeRef {
  const mediaQuery = window.matchMedia(mobileAppMediaQuery);
  const mode = ref<AppDeviceMode>(resolveAppDeviceMode(mediaQuery.matches));

  function syncMode(event: MediaQueryListEvent) {
    mode.value = resolveAppDeviceMode(event.matches);
  }

  onMounted(() => {
    mediaQuery.addEventListener("change", syncMode);
  });

  onBeforeUnmount(() => {
    mediaQuery.removeEventListener("change", syncMode);
  });

  return readonly(mode);
}

export function provideAppDeviceMode(mode: AppDeviceModeRef) {
  provide(appDeviceModeKey, mode);
}

export function useAppDeviceMode(): AppDeviceModeRef {
  const mode = inject(appDeviceModeKey);
  if (!mode) throw new Error("App device mode is only available below AppShell.");
  return mode;
}
