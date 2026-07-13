import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { usePublishStore } from "./publish";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

describe("publish draft", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    setActivePinia(createPinia());
  });

  it("tracks generated content until the user edits, then preserves the manual draft", () => {
    const publish = usePublishStore();
    publish.hydrate();

    publish.syncGenerated("自动正文 A");
    expect(publish.draft).toBe("自动正文 A");
    expect(publish.hasManualEdits).toBe(false);

    publish.draft = "手动正文";
    publish.syncGenerated("自动正文 B");
    expect(publish.draft).toBe("手动正文");
    expect(publish.hasManualEdits).toBe(true);

    publish.regenerate("自动正文 B");
    expect(publish.draft).toBe("自动正文 B");
    expect(publish.hasManualEdits).toBe(false);
  });

  it("restores a manual draft after refresh", async () => {
    const first = usePublishStore();
    first.hydrate();
    first.syncGenerated("自动正文");
    first.draft = "刷新后仍保留";
    await nextTick();

    setActivePinia(createPinia());
    const restored = usePublishStore();
    restored.hydrate();
    expect(restored.draft).toBe("刷新后仍保留");
    expect(restored.hasManualEdits).toBe(true);
  });
});
