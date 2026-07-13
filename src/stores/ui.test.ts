import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { legacyUiStorageKey, uiStorageKey, useUiStore } from "./ui";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

describe("UI store persistence", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    setActivePinia(createPinia());
  });

  it("migrates unversioned preferences and ignores corrupt enum values", () => {
    localStorage.setItem(legacyUiStorageKey, JSON.stringify({ recentAccount: "FC", matrixDisplay: { skills: false } }));
    const migrated = useUiStore();
    migrated.hydrate();
    expect(migrated.recentAccount).toBe("FC");
    expect(migrated.matrixDisplay.skills).toBe(false);
    expect(JSON.parse(localStorage.getItem(uiStorageKey) || "null").version).toBe(2);

    setActivePinia(createPinia());
    localStorage.clear();
    localStorage.setItem(uiStorageKey, JSON.stringify({ version: 2, accountScope: "BAD" }));
    const fallback = useUiStore();
    fallback.hydrate();
    expect(fallback.accountScope).toBe("ALL");
    expect(fallback.recentAccount).toBe("LG2");
  });
});
