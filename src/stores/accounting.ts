import { ref, watch } from "vue";
import { defineStore } from "pinia";
import type {
  AccountingEntry,
  AccountingEntryStatus,
  AccountingResources,
} from "../domain/accounting";
import { accountingEntryFromLegacyTaskCompletion } from "../domain/accounting";
import type { AccountId, TaskCompletionRecord } from "../domain/types";
import {
  emptyAccountingState,
  parseAccountingState,
  type AccountingState,
} from "../persistence/state";

export const accountingStorageKey = "sw.app.accounting.v1";

export interface AddAccountingEntryInput {
  accountId: AccountId;
  effectiveDate: string;
  occurredAt: string;
  legs: AccountingEntry["legs"];
  taskId?: string;
  groupId?: string;
  source?: string;
  status?: AccountingEntryStatus;
  note?: string;
}

export interface AddTaskSettlementInput {
  accountId: AccountId;
  effectiveDate: string;
  occurredAt: string;
  taskId: string;
  source: "task-fixed" | "task-variable" | "task-progress";
  resources: AccountingResources;
  note?: string;
}

export interface AddTransferInput {
  fromAccountId: AccountId;
  toAccountId: AccountId;
  effectiveDate: string;
  occurredAt: string;
  resources: AccountingResources;
  note: string;
}

export interface AddAdjustmentInput {
  accountId: AccountId;
  effectiveDate: string;
  occurredAt: string;
  direction: "increase" | "decrease";
  resources: AccountingResources;
  note: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function entryId(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${suffix}`;
}

function hasResourceAmount(resources: AccountingResources) {
  return resources.silverWan > 0
    || resources.dedicatedEggs > 0
    || resources.regularEggs > 0
    || (resources.innerShards || 0) > 0;
}

export const useAccountingStore = defineStore("accounting", () => {
  const hydrated = ref(false);
  const entries = ref<AccountingEntry[]>([]);

  function persist() {
    if (!hydrated.value || typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(accountingStorageKey, JSON.stringify(exportState()));
    } catch {
      // Keep the validated in-memory ledger usable if browser storage is unavailable.
    }
  }

  function setState(value: AccountingState) {
    entries.value = clone(value.entries);
  }

  function hydrate() {
    if (hydrated.value) return;
    try {
      const raw = typeof localStorage === "undefined"
        ? null
        : localStorage.getItem(accountingStorageKey);
      setState(parseAccountingState(raw ? JSON.parse(raw) : emptyAccountingState()));
    } catch {
      setState(emptyAccountingState());
    }
    hydrated.value = true;
    persist();
  }

  function exportState(): AccountingState {
    return parseAccountingState({ version: 1, entries: clone(entries.value) });
  }

  function replaceState(value: unknown) {
    setState(parseAccountingState(value));
    if (!hydrated.value) hydrated.value = true;
    persist();
  }

  function addEntries(input: AddAccountingEntryInput[], now = () => new Date()) {
    if (!hydrated.value) hydrate();
    const recordedAt = now().toISOString();
    const created = input.map((item) => ({
      id: entryId(item.source || "accounting"),
      ...clone(item),
      status: item.status || "confirmed",
      recordedAt,
    } satisfies AccountingEntry));
    const parsed = parseAccountingState({
      version: 1,
      entries: [...entries.value, ...created],
    });
    entries.value = parsed.entries;
    persist();
    return created;
  }

  function addEntry(input: AddAccountingEntryInput, now = () => new Date()) {
    return addEntries([input], now)[0];
  }

  function addTaskSettlement(input: AddTaskSettlementInput, now = () => new Date()) {
    return addEntry({
      accountId: input.accountId,
      effectiveDate: input.effectiveDate,
      occurredAt: input.occurredAt,
      taskId: input.taskId,
      source: input.source,
      note: input.note?.trim().slice(0, 120),
      legs: [{
        kind: "expense",
        resources: clone(input.resources),
      }],
    }, now);
  }

  function hasTaskAuthority(taskId: string) {
    if (!hydrated.value) hydrate();
    return entries.value.some((entry) => (
      entry.taskId === taskId && (entry.status || "confirmed") !== "draft"
    ));
  }

  /**
   * Preserve a pre-ledger completion before its legacy settings record is
   * removed. The persisted entry is deliberately identical to the virtual
   * legacy entry used by accounting normalization.
   */
  function materializeLegacyTaskCompletion(record: TaskCompletionRecord) {
    if (!hydrated.value) hydrate();
    if (hasTaskAuthority(record.taskId)) return null;
    const materialized = accountingEntryFromLegacyTaskCompletion(record);
    const parsed = parseAccountingState({
      version: 1,
      entries: [...entries.value, materialized],
    });
    entries.value = parsed.entries;
    persist();
    return materialized;
  }

  function addTransfer(input: AddTransferInput, now = () => new Date()) {
    if (input.fromAccountId === input.toAccountId || !hasResourceAmount(input.resources)) return null;
    const groupId = entryId("transfer-group");
    const note = input.note.trim().slice(0, 120);
    if (!note) return null;
    const created = addEntries([{
      accountId: input.fromAccountId,
      effectiveDate: input.effectiveDate,
      occurredAt: input.occurredAt,
      groupId,
      source: "transfer",
      note,
      legs: [{ kind: "transfer-out", resources: clone(input.resources) }],
    }, {
      accountId: input.toAccountId,
      effectiveDate: input.effectiveDate,
      occurredAt: input.occurredAt,
      groupId,
      source: "transfer",
      note,
      legs: [{ kind: "transfer-in", resources: clone(input.resources) }],
    }], now);
    return { groupId, entries: created };
  }

  function addAdjustment(input: AddAdjustmentInput, now = () => new Date()) {
    if (!hasResourceAmount(input.resources)) return null;
    const note = input.note.trim().slice(0, 120);
    if (!note) return null;
    return addEntry({
      accountId: input.accountId,
      effectiveDate: input.effectiveDate,
      occurredAt: input.occurredAt,
      source: "adjustment",
      note,
      legs: [{
        kind: input.direction === "increase"
          ? "adjustment-increase"
          : "adjustment-decrease",
        resources: clone(input.resources),
      }],
    }, now);
  }

  function setEntriesStatus(predicate: (entry: AccountingEntry) => boolean, status: AccountingEntryStatus, now = () => new Date()) {
    if (!hydrated.value) hydrate();
    const recordedAt = now().toISOString();
    let changed = false;
    entries.value = entries.value.map((entry) => {
      if (!predicate(entry) || (entry.status || "confirmed") === status) return entry;
      changed = true;
      return { ...entry, status, recordedAt };
    });
    if (changed) persist();
    return changed;
  }

  function voidEntry(id: string, now = () => new Date()) {
    const target = entries.value.find((entry) => entry.id === id);
    if (!target) return false;
    return setEntriesStatus(
      (entry) => entry.id === id || Boolean(target.groupId && entry.groupId === target.groupId),
      "void",
      now,
    );
  }

  function voidTaskEntries(taskId: string, now = () => new Date()) {
    return setEntriesStatus((entry) => entry.taskId === taskId, "void", now);
  }

  function taskEntries(taskId: string) {
    return entries.value.filter((entry) => (
      entry.taskId === taskId && (entry.status || "confirmed") === "confirmed"
    ));
  }

  function clear() {
    if (!hydrated.value) hydrate();
    entries.value = [];
    persist();
  }

  watch(entries, persist, { deep: true });

  return {
    hydrated,
    entries,
    hydrate,
    exportState,
    replaceState,
    addEntry,
    addTaskSettlement,
    hasTaskAuthority,
    materializeLegacyTaskCompletion,
    addTransfer,
    addAdjustment,
    voidEntry,
    voidTaskEntries,
    taskEntries,
    clear,
  };
});
