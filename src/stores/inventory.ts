import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import {
  calculateInventoryDeltas,
  createInventoryExport,
  latestInventoryPair,
  parseInventoryExport,
  upsertInventorySnapshot,
} from "../domain/inventory";
import { accountIds } from "../domain/types";
import type { AccountId, BeastResource, InventorySnapshot, InventorySnapshotInput } from "../domain/types";

export const inventoryStorageKey = "sw.app.inventory.v2";
export const legacyInventoryStorageKey = "sw.app.inventory.v1";

export const useInventoryStore = defineStore("inventory", () => {
  const hydrated = ref(false);
  const snapshots = ref<InventorySnapshot[]>([]);

  const latestSnapshot = computed(() => latestInventoryPair(snapshots.value).latest);
  const previousSnapshot = computed(() => latestInventoryPair(snapshots.value).previous);
  const latestDeltas = computed(() => calculateInventoryDeltas(latestSnapshot.value, previousSnapshot.value));
  const planningResources = computed(() => Object.fromEntries(accountIds.map((accountId) => {
    const balance = latestSnapshot.value?.accounts[accountId];
    if (!balance) return [accountId, { silverWan: 0, eggCount: 0, innerShardCount: null, inventoryRecorded: false } satisfies BeastResource];
    return [accountId, {
      silverWan: balance.silverWan,
      eggCount: balance.dedicatedEggs + balance.regularEggs,
      innerShardCount: balance.innerShardCount,
    } satisfies BeastResource];
  })) as Record<AccountId, BeastResource>);

  function persist() {
    if (!hydrated.value || typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(inventoryStorageKey, JSON.stringify(createInventoryExport(snapshots.value)));
    } catch {
      // The in-memory state remains usable if browser storage is unavailable.
    }
  }

  function hydrate() {
    if (hydrated.value) return;
    try {
      const raw = typeof localStorage === "undefined"
        ? null
        : localStorage.getItem(inventoryStorageKey) || localStorage.getItem(legacyInventoryStorageKey);
      snapshots.value = raw ? parseInventoryExport(raw).snapshots : [];
    } catch {
      snapshots.value = [];
    }
    hydrated.value = true;
    persist();
  }

  function saveSnapshot(input: InventorySnapshotInput) {
    if (!hydrated.value) hydrate();
    snapshots.value = upsertInventorySnapshot(snapshots.value, input);
    const saved = snapshots.value.find((snapshot) => snapshot.effectiveDate === input.effectiveDate)!;
    persist();
    return saved;
  }

  function removeSnapshot(effectiveDate: string) {
    if (!hydrated.value) hydrate();
    const priorLength = snapshots.value.length;
    snapshots.value = snapshots.value.filter((snapshot) => snapshot.effectiveDate !== effectiveDate);
    if (snapshots.value.length !== priorLength) persist();
  }

  function exportData() {
    return JSON.stringify(exportState(), null, 2);
  }

  function exportState() {
    return createInventoryExport(snapshots.value);
  }

  function replaceState(value: unknown) {
    const parsed = parseInventoryExport(value);
    snapshots.value = parsed.snapshots;
    if (!hydrated.value) hydrated.value = true;
    persist();
  }

  function importData(value: string | unknown) {
    if (!hydrated.value) hydrate();
    // Parse completely before assignment so a bad import cannot partially
    // replace valid local data.
    replaceState(value);
  }

  function clear() {
    if (!hydrated.value) hydrate();
    snapshots.value = [];
    persist();
  }

  watch(snapshots, persist, { deep: true });

  return {
    hydrated,
    snapshots,
    latestSnapshot,
    previousSnapshot,
    latestDeltas,
    planningResources,
    hydrate,
    saveSnapshot,
    removeSnapshot,
    exportData,
    exportState,
    replaceState,
    importData,
    clear,
  };
});
