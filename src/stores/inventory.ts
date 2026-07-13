import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import {
  calculateInventoryDeltas,
  createInventoryExport,
  latestInventoryPair,
  parseInventoryExport,
  upsertInventorySnapshot,
} from "../domain/inventory";
import type { InventorySnapshot, InventorySnapshotInput } from "../domain/types";
import { catalog } from "../data/catalog";
import { useSettingsStore } from "./settings";

export const inventoryStorageKey = "sw.app.inventory.v1";

export const useInventoryStore = defineStore("inventory", () => {
  const settings = useSettingsStore();
  const hydrated = ref(false);
  const snapshots = ref<InventorySnapshot[]>([]);

  const latestSnapshot = computed(() => latestInventoryPair(snapshots.value).latest);
  const previousSnapshot = computed(() => latestInventoryPair(snapshots.value).previous);
  const latestDeltas = computed(() => calculateInventoryDeltas(latestSnapshot.value, previousSnapshot.value));

  function persist() {
    if (!hydrated.value || typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(inventoryStorageKey, JSON.stringify(createInventoryExport(snapshots.value)));
    } catch {
      // The in-memory state remains usable if browser storage is unavailable.
    }
  }

  function syncLegacyResources(snapshot: InventorySnapshot | null) {
    if (!snapshot) return;
    Object.entries(snapshot.accounts).forEach(([accountId, balance]) => {
      const id = accountId as keyof typeof settings.resources;
      settings.setResource(id, "eggCount", balance.dedicatedEggs + balance.regularEggs);
      settings.setResource(id, "silverWan", balance.silverWan);
    });
  }

  function resetLegacyInventoryFields() {
    Object.entries(catalog.beastConfig.taskDefaultResources).forEach(([accountId, resource]) => {
      const id = accountId as keyof typeof settings.resources;
      settings.setResource(id, "eggCount", resource.eggCount);
      settings.setResource(id, "silverWan", resource.silverWan);
    });
  }

  function hydrate() {
    if (hydrated.value) return;
    // Inventory is layered on top of legacy planning state; hydrate it first so
    // an authoritative latest snapshot cannot be overwritten later in startup.
    settings.hydrate();
    try {
      const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(inventoryStorageKey);
      snapshots.value = raw ? parseInventoryExport(raw).snapshots : [];
    } catch {
      snapshots.value = [];
    }
    hydrated.value = true;
    syncLegacyResources(latestSnapshot.value);
    persist();
  }

  function saveSnapshot(input: InventorySnapshotInput) {
    if (!hydrated.value) hydrate();
    snapshots.value = upsertInventorySnapshot(snapshots.value, input);
    const saved = snapshots.value.find((snapshot) => snapshot.effectiveDate === input.effectiveDate)!;
    if (latestSnapshot.value?.effectiveDate === saved.effectiveDate) syncLegacyResources(saved);
    persist();
    return saved;
  }

  function removeSnapshot(effectiveDate: string) {
    if (!hydrated.value) hydrate();
    const priorLength = snapshots.value.length;
    snapshots.value = snapshots.value.filter((snapshot) => snapshot.effectiveDate !== effectiveDate);
    if (snapshots.value.length !== priorLength) {
      if (latestSnapshot.value) syncLegacyResources(latestSnapshot.value);
      else resetLegacyInventoryFields();
    }
    persist();
  }

  function exportData() {
    return JSON.stringify(createInventoryExport(snapshots.value), null, 2);
  }

  function importData(value: string | unknown) {
    if (!hydrated.value) hydrate();
    // Parse completely before assignment so a bad import cannot partially
    // replace valid local data.
    const parsed = parseInventoryExport(value);
    snapshots.value = parsed.snapshots;
    if (latestSnapshot.value) syncLegacyResources(latestSnapshot.value);
    else resetLegacyInventoryFields();
    persist();
  }

  function clear() {
    if (!hydrated.value) hydrate();
    snapshots.value = [];
    resetLegacyInventoryFields();
    persist();
  }

  watch(snapshots, persist, { deep: true });

  return {
    hydrated,
    snapshots,
    latestSnapshot,
    previousSnapshot,
    latestDeltas,
    hydrate,
    saveSnapshot,
    removeSnapshot,
    exportData,
    importData,
    clear,
  };
});
