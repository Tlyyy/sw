<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import type { AccountId, InventoryBalance, InventorySnapshot } from "../domain/types";

interface InventorySnapshotDraft {
  effectiveDate: string;
  accounts: Record<AccountId, InventoryBalance>;
}

const accountOrder: AccountId[] = ["FC", "LG1", "LG2", "PT", "MYT"];
const props = defineProps<{
  open: boolean;
  initialDate: string;
  snapshots: InventorySnapshot[];
}>();
const emit = defineEmits<{
  close: [];
  save: [draft: InventorySnapshotDraft];
}>();

const dialog = ref<HTMLFormElement>();
const dateInput = ref<HTMLInputElement>();
const snapshotDate = ref("");
const submitted = ref(false);
const dirty = ref(false);
const seedDescription = ref("");
const rows = reactive<Record<AccountId, InventoryBalance>>(emptyRows());
const today = new Date().toLocaleDateString("en-CA");
let previouslyFocused: HTMLElement | null = null;
let previousBodyOverflow = "";

const matchingSnapshot = computed(() => props.snapshots.find((item) => item.effectiveDate === snapshotDate.value) || null);

function emptyRows(): Record<AccountId, InventoryBalance> {
  return Object.fromEntries(accountOrder.map((accountId) => [accountId, {
    dedicatedEggs: 0,
    regularEggs: 0,
    silverWan: 0,
  }])) as Record<AccountId, InventoryBalance>;
}

function copyRows(source: Record<AccountId, InventoryBalance>) {
  accountOrder.forEach((accountId) => Object.assign(rows[accountId], source[accountId]));
}

function seedRowsForDate(date: string) {
  const ordered = [...props.snapshots].sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate));
  const exact = ordered.find((item) => item.effectiveDate === date);
  if (exact) {
    copyRows(exact.accounts);
    seedDescription.value = `已载入 ${date} 的现有快照；保存会更新这一天的五号库存。`;
    return;
  }
  const prior = ordered.filter((item) => item.effectiveDate < date).at(-1);
  if (prior) {
    copyRows(prior.accounts);
    seedDescription.value = `已带入 ${prior.effectiveDate} 的前序库存，请逐项改成 ${date} 的实际总库存。`;
    return;
  }
  copyRows(emptyRows());
  seedDescription.value = props.snapshots.length
    ? "所选日期之前没有快照，15 项已清空，请按当天实际总库存填写。"
    : "这是第一份分类库存基线。旧系统只有蛋合计，无法判断专用或普通，因此请按实际库存填写。";
}

function resetDraft() {
  snapshotDate.value = props.initialDate || today;
  submitted.value = false;
  dirty.value = false;
  seedRowsForDate(snapshotDate.value);
}

function normalizedNumber(value: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function handleDateChange() {
  dirty.value = true;
  seedRowsForDate(snapshotDate.value);
}

function requestClose() {
  if (dirty.value && !confirm("这份库存快照还没有保存，确认放弃本次填写？")) return;
  dirty.value = false;
  emit("close");
}

function submit() {
  submitted.value = true;
  if (!snapshotDate.value) return;
  const payloadRows = emptyRows();
  accountOrder.forEach((accountId) => {
    payloadRows[accountId] = {
      dedicatedEggs: Math.round(normalizedNumber(rows[accountId].dedicatedEggs)),
      regularEggs: Math.round(normalizedNumber(rows[accountId].regularEggs)),
      silverWan: normalizedNumber(rows[accountId].silverWan),
    };
  });
  dirty.value = false;
  emit("save", { effectiveDate: snapshotDate.value, accounts: payloadRows });
}

function handleKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    requestClose();
    return;
  }
  if (event.key !== "Tab" || !dialog.value) return;
  const focusable = [...dialog.value.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled])")]
    .filter((item) => item.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1)!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

async function activateDialog() {
  previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  document.querySelector("#app")?.setAttribute("inert", "");
  await nextTick();
  dateInput.value?.focus();
}

function deactivateDialog(restoreFocus = true) {
  document.body.style.overflow = previousBodyOverflow;
  document.querySelector("#app")?.removeAttribute("inert");
  if (restoreFocus) void nextTick(() => previouslyFocused?.focus());
}

watch(() => props.open, async (open) => {
  if (open) {
    resetDraft();
    await activateDialog();
  } else {
    deactivateDialog();
  }
}, { immediate: true });

onBeforeUnmount(() => deactivateDialog(false));
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="snapshot-dialog-backdrop">
      <form ref="dialog" class="snapshot-dialog" role="dialog" aria-modal="true" aria-labelledby="inventory-dialog-title" @submit.prevent="submit" @keydown="handleKeydown">
        <header>
          <div>
            <h2 id="inventory-dialog-title">录入库存快照</h2>
            <p>一次记录 FC、LG1、LG2、PT、MYT；录入时间由系统自动保存。</p>
          </div>
          <button class="snapshot-dialog-close" type="button" aria-label="关闭库存快照录入" @click="requestClose">×</button>
        </header>

        <div class="snapshot-date-field">
          <label for="inventory-snapshot-date">库存所属日期</label>
          <input id="inventory-snapshot-date" ref="dateInput" v-model="snapshotDate" type="date" :max="today" aria-describedby="snapshot-date-help snapshot-seed-help" required @change="handleDateChange" />
          <small id="snapshot-date-help">可以补录过去日期；系统按实际日期与前一份快照比较。</small>
        </div>
        <p id="snapshot-seed-help" class="snapshot-seed-note" :class="{ warning: matchingSnapshot }">{{ seedDescription }}</p>
        <p v-if="submitted && !snapshotDate" class="snapshot-dialog-error" role="alert">请选择库存所属日期</p>

        <div class="snapshot-entry-scroll">
          <div class="snapshot-entry-table" role="table" aria-label="五账号库存录入">
            <div class="snapshot-entry-head" role="row">
              <span role="columnheader">账号</span>
              <span role="columnheader">专用蛋</span>
              <span role="columnheader">普通蛋</span>
              <span role="columnheader">银子 / 万</span>
            </div>
            <div v-for="accountId in accountOrder" :key="accountId" class="snapshot-entry-row" role="row">
              <strong role="cell" :class="`account-pill account-${accountId.toLowerCase()}`">{{ accountId }}</strong>
              <span role="cell"><input v-model.number="rows[accountId].dedicatedEggs" type="number" min="0" step="1" inputmode="numeric" :aria-label="`${accountId}专用蛋库存`" @input="dirty = true" /></span>
              <span role="cell"><input v-model.number="rows[accountId].regularEggs" type="number" min="0" step="1" inputmode="numeric" :aria-label="`${accountId}普通蛋库存`" @input="dirty = true" /></span>
              <span role="cell"><input v-model.number="rows[accountId].silverWan" type="number" min="0" step="0.01" inputmode="decimal" :aria-label="`${accountId}银子库存（万）`" @input="dirty = true" /></span>
            </div>
          </div>
        </div>

        <footer>
          <button class="button secondary" type="button" @click="requestClose">取消</button>
          <button class="button primary" type="submit">{{ matchingSnapshot ? "更新该日快照" : "保存五号快照" }}</button>
        </footer>
      </form>
    </div>
  </Teleport>
</template>
