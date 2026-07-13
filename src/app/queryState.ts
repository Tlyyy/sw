import type { LocationQueryValue } from "vue-router";

export function queryText(value: LocationQueryValue | LocationQueryValue[] | undefined, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function queryChoice<T extends string>(
  value: LocationQueryValue | LocationQueryValue[] | undefined,
  choices: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && choices.includes(value as T) ? value as T : fallback;
}
