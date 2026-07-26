import { ref } from "vue";

export type AppearancePreference = "system" | "light" | "dark";

const storageKey = "sw.appearance.preference.v1";
const allowedPreferences: AppearancePreference[] = ["system", "light", "dark"];

function initialPreference(): AppearancePreference {
  if (typeof localStorage === "undefined") return "system";
  const stored = localStorage.getItem(storageKey) as AppearancePreference | null;
  return stored && allowedPreferences.includes(stored) ? stored : "system";
}

export const appearancePreference = ref<AppearancePreference>(initialPreference());

export function setAppearancePreference(value: AppearancePreference) {
  appearancePreference.value = value;
  try {
    localStorage.setItem(storageKey, value);
  } catch {
    // The active preference still works when private storage is unavailable.
  }
}

export function resolveAppearance(systemPrefersDark: boolean) {
  return appearancePreference.value === "system"
    ? (systemPrefersDark ? "dark" : "light")
    : appearancePreference.value;
}
