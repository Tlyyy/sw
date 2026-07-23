<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import { canRecordInventoryDate } from "../domain/inventory";
import { accountIds } from "../domain/types";
import type { AccountId, InventoryBalance, InventorySnapshot } from "../domain/types";
import { shanghaiDateKey } from "../domain/plans";
import { useVisualViewport } from "../composables/useVisualViewport";
import AppIcon from "./AppIcon.vue";

interface InventorySnapshotDraft {
  effectiveDate: string;
  accounts: Record<AccountId, InventoryBalance>;
}

type InventoryFieldKey = "dedicatedEggs" | "regularEggs" | "silverWan" | "innerShardCount";

const inventoryFields: Array<{
  key: InventoryFieldKey;
  label: string;
  unit: string;
  step: number;
  inputMode: "numeric" | "decimal";
}> = [
  { key: "dedicatedEggs", label: "专用蛋", unit: "个", step: 1, inputMode: "numeric" },
  { key: "regularEggs", label: "普通蛋", unit: "个", step: 1, inputMode: "numeric" },
  { key: "silverWan", label: "银子", unit: "万", step: 0.01, inputMode: "decimal" },
  { key: "innerShardCount", label: "内丹碎片", unit: "片", step: 1, inputMode: "numeric" },
];

const accountOrder: AccountId[] = [...accountIds];
const props = defineProps<{
  open: boolean;
  initialDate: string;
  maxDate?: string;
  snapshots: InventorySnapshot[];
}>();
const emit = defineEmits<{
  close: [];
  save: [draft: InventorySnapshotDraft];
}>();

const dialog = ref<HTMLFormElement>();
const closeButton = ref<HTMLButtonElement>();
const dateInput = ref<HTMLInputElement>();
const snapshotDate = ref("");
const submitted = ref(false);
const dirty = ref(false);
const entryFieldFocused = ref(false);
const seedDescription = ref("");
const activeAccountIndex = ref(0);
const reviewedAccounts = ref<AccountId[]>([]);
const accountError = ref("");
const errorFieldKey = ref<InventoryFieldKey>();
const flowMessage = ref("");
const rows = reactive<Record<AccountId, InventoryBalance>>(emptyRows());
const {
  keyboardOpen,
  visualViewportStyle,
} = useVisualViewport("inventory-modal");
let previouslyFocused: HTMLElement | null = null;
let previousBodyOverflow = "";
let previousRootOverflow = "";
let fieldFocusTimer = 0;

const matchingSnapshot = computed(() => props.snapshots.find((item) => item.effectiveDate === snapshotDate.value) || null);
const maxDate = computed(() => props.maxDate || shanghaiDateKey());
const dateOutOfRange = computed(() => Boolean(snapshotDate.value) && !canRecordInventoryDate(snapshotDate.value, maxDate.value));
const activeAccountId = computed(() => accountOrder[activeAccountIndex.value]);
const previousAccountId = computed(() => accountOrder[activeAccountIndex.value - 1]);
const nextAccountId = computed(() => accountOrder[activeAccountIndex.value + 1]);

function emptyRows(): Record<AccountId, InventoryBalance> {
  return Object.fromEntries(accountOrder.map((accountId) => [accountId, {
    dedicatedEggs: 0,
    regularEggs: 0,
    silverWan: 0,
    innerShardCount: 0,
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
    ? "所选日期之前没有快照，五个账号的库存已清空，请按当天实际总库存填写。"
    : "这是第一份分类库存基线。旧系统只有蛋合计，无法判断专用或普通，因此请按实际库存填写。";
}

function resetDraft() {
  const requestedDate = props.initialDate || maxDate.value;
  snapshotDate.value = canRecordInventoryDate(requestedDate, maxDate.value) ? requestedDate : maxDate.value;
  submitted.value = false;
  dirty.value = false;
  activeAccountIndex.value = 0;
  reviewedAccounts.value = [];
  accountError.value = "";
  errorFieldKey.value = undefined;
  flowMessage.value = "";
  entryFieldFocused.value = false;
  seedRowsForDate(snapshotDate.value);
}

function normalizedNumber(value: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function handleDateChange() {
  dirty.value = true;
  activeAccountIndex.value = 0;
  reviewedAccounts.value = [];
  accountError.value = "";
  errorFieldKey.value = undefined;
  flowMessage.value = "";
  if (dateOutOfRange.value) {
    seedDescription.value = `库存日期不能晚于 ${maxDate.value}。`;
    return;
  }
  seedRowsForDate(snapshotDate.value);
}

function requestClose() {
  if (dirty.value && !confirm("这份库存快照还没有保存，确认放弃本次填写？")) return;
  dirty.value = false;
  emit("close");
}

function isReviewed(accountId: AccountId) {
  return reviewedAccounts.value.includes(accountId);
}

function markAccountDirty(accountId: AccountId) {
  dirty.value = true;
  reviewedAccounts.value = reviewedAccounts.value.filter((item) => item !== accountId);
  accountError.value = "";
  errorFieldKey.value = undefined;
  flowMessage.value = "";
}

function invalidField(accountId: AccountId) {
  return inventoryFields.find((field) => {
    const value = rows[accountId][field.key] as unknown;
    return value === "" || value === null || value === undefined || !Number.isFinite(Number(value)) || Number(value) < 0;
  });
}

async function focusField(fieldKey: InventoryFieldKey) {
  await nextTick();
  dialog.value?.querySelector<HTMLInputElement>(`[data-inventory-field="${fieldKey}"]`)?.focus({ preventScroll: true });
}

function validateAccount(accountId: AccountId) {
  const invalid = invalidField(accountId);
  if (!invalid) {
    accountError.value = "";
    errorFieldKey.value = undefined;
    return true;
  }
  accountError.value = `${accountId} 的${invalid.label}还没有确认；如果库存为零，请明确填写 0。`;
  errorFieldKey.value = invalid.key;
  void focusField(invalid.key);
  return false;
}

async function selectAccount(index: number, keepEditing = entryFieldFocused.value || keyboardOpen.value) {
  if (index < 0 || index >= accountOrder.length) return;
  window.clearTimeout(fieldFocusTimer);
  activeAccountIndex.value = index;
  accountError.value = "";
  errorFieldKey.value = undefined;
  await nextTick();
  if (keepEditing) {
    dialog.value?.querySelector<HTMLInputElement>("[data-inventory-field='dedicatedEggs']")?.focus({ preventScroll: true });
  }
}

async function goNextAccount() {
  const accountId = activeAccountId.value;
  if (!validateAccount(accountId)) return;
  if (!reviewedAccounts.value.includes(accountId)) reviewedAccounts.value = [...reviewedAccounts.value, accountId];
  const nextIndex = activeAccountIndex.value + 1;
  if (nextIndex >= accountOrder.length) return;
  flowMessage.value = `${accountId} 已核对，继续 ${accountOrder[nextIndex]}。`;
  await selectAccount(nextIndex);
}

async function goPreviousAccount() {
  await selectAccount(activeAccountIndex.value - 1);
}

function submit() {
  submitted.value = true;
  if (!snapshotDate.value || dateOutOfRange.value) return;
  const current = activeAccountId.value;
  if (!validateAccount(current)) return;
  if (!reviewedAccounts.value.includes(current)) reviewedAccounts.value = [...reviewedAccounts.value, current];
  const unreviewed = accountOrder.filter((accountId) => !reviewedAccounts.value.includes(accountId));
  if (unreviewed.length) {
    flowMessage.value = `还需核对 ${unreviewed.join("、")}；已带入的数值不会自动视为今日确认。`;
    void selectAccount(accountOrder.indexOf(unreviewed[0]), false);
    return;
  }
  const payloadRows = emptyRows();
  accountOrder.forEach((accountId) => {
    payloadRows[accountId] = {
      dedicatedEggs: Math.round(normalizedNumber(rows[accountId].dedicatedEggs)),
      regularEggs: Math.round(normalizedNumber(rows[accountId].regularEggs)),
      silverWan: normalizedNumber(rows[accountId].silverWan),
      innerShardCount: Math.round(normalizedNumber(rows[accountId].innerShardCount ?? Number.NaN)),
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
  previousRootOverflow = document.documentElement.style.overflow;
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
  document.querySelector("#app")?.setAttribute("inert", "");
  await nextTick();
  const usesTouchKeyboard = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  if (usesTouchKeyboard) closeButton.value?.focus({ preventScroll: true });
  else dateInput.value?.focus();
}

function deactivateDialog(restoreFocus = true) {
  document.body.style.overflow = previousBodyOverflow;
  document.documentElement.style.overflow = previousRootOverflow;
  document.querySelector("#app")?.removeAttribute("inert");
  if (restoreFocus) void nextTick(() => previouslyFocused?.focus());
}

function keepEntryFieldVisible(event: FocusEvent) {
  entryFieldFocused.value = true;
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (!target) return;
  window.clearTimeout(fieldFocusTimer);
  fieldFocusTimer = window.setTimeout(() => {
    if (dialog.value?.contains(target)) target.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, 280);
}

watch(() => props.open, async (open) => {
  if (open) {
    resetDraft();
    await activateDialog();
  } else {
    deactivateDialog();
  }
}, { immediate: true });

onBeforeUnmount(() => {
  window.clearTimeout(fieldFocusTimer);
  deactivateDialog(false);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="snapshot-dialog-backdrop"
      :class="{ 'keyboard-open': keyboardOpen }"
      :style="visualViewportStyle"
    >
      <form ref="dialog" class="snapshot-dialog" role="dialog" aria-modal="true" aria-labelledby="inventory-dialog-title" tabindex="-1" @submit.prevent="submit" @keydown="handleKeydown">
        <header>
          <div>
            <h2 id="inventory-dialog-title">录入库存快照</h2>
            <p>逐账号核对，最后统一保存。</p>
          </div>
          <button ref="closeButton" class="snapshot-dialog-close" type="button" aria-label="关闭库存快照录入" @click="requestClose"><AppIcon name="close" /></button>
        </header>

        <div class="snapshot-date-field">
          <label for="inventory-snapshot-date">库存所属日期</label>
          <input id="inventory-snapshot-date" ref="dateInput" v-model="snapshotDate" type="date" :max="maxDate" aria-describedby="snapshot-date-help snapshot-seed-help" required @change="handleDateChange" />
          <small id="snapshot-date-help">可以补录过去日期；系统按实际日期与前一份快照比较。</small>
        </div>
        <p id="snapshot-seed-help" class="snapshot-seed-note" :class="{ warning: matchingSnapshot }">{{ seedDescription }}</p>
        <p v-if="submitted && !snapshotDate" class="snapshot-dialog-error" role="alert">请选择库存所属日期</p>
        <p v-else-if="submitted && dateOutOfRange" class="snapshot-dialog-error" role="alert">库存日期不能晚于 {{ maxDate }}</p>

        <div class="snapshot-account-stepper" role="tablist" aria-label="选择要核对的账号">
          <button
            v-for="(accountId, index) in accountOrder"
            :id="`snapshot-account-tab-${accountId}`"
            :key="accountId"
            class="snapshot-account-tab"
            :class="{ active: index === activeAccountIndex, reviewed: isReviewed(accountId) }"
            type="button"
            role="tab"
            :aria-controls="`snapshot-account-panel-${accountId}`"
            :aria-selected="index === activeAccountIndex"
            :aria-label="`${accountId} 账号，${isReviewed(accountId) ? '已核对' : index === activeAccountIndex ? '当前账号' : '待核对'}`"
            @click="selectAccount(index)"
          >
            <strong>{{ accountId }}</strong>
            <small>{{ isReviewed(accountId) ? "已核对" : index === activeAccountIndex ? "当前" : "待核" }}</small>
          </button>
        </div>

        <div class="snapshot-entry-scroll">
          <fieldset
            :id="`snapshot-account-panel-${activeAccountId}`"
            class="snapshot-account-panel"
            role="tabpanel"
            :aria-labelledby="`snapshot-account-tab-${activeAccountId}`"
          >
            <legend class="visually-hidden">{{ activeAccountId }} 账号库存</legend>
            <header class="snapshot-account-heading">
              <strong :class="`account-pill account-${activeAccountId.toLowerCase()}`">{{ activeAccountId }}</strong>
              <div>
                <h3>{{ activeAccountId }} 当前库存</h3>
                <p>第 {{ activeAccountIndex + 1 }} / {{ accountOrder.length }} 个账号 · 已带入上次数据，只修改变化项</p>
              </div>
            </header>

            <div class="snapshot-account-fields">
              <label v-for="(field, fieldIndex) in inventoryFields" :key="field.key" class="snapshot-account-field">
                <span><strong>{{ field.label }}</strong><small>/ {{ field.unit }}</small></span>
                <input
                  v-model.number="rows[activeAccountId][field.key]"
                  type="number"
                  min="0"
                  :step="field.step"
                  :inputmode="field.inputMode"
                  :enterkeyhint="fieldIndex < inventoryFields.length - 1 ? 'next' : 'done'"
                  :data-inventory-field="field.key"
                  :aria-label="`${activeAccountId}${field.label}库存${field.key === 'silverWan' ? '（万）' : ''}`"
                  :aria-invalid="errorFieldKey === field.key ? 'true' : undefined"
                  :aria-describedby="errorFieldKey === field.key ? 'snapshot-account-error' : undefined"
                  @focus="keepEntryFieldVisible"
                  @blur="entryFieldFocused = false"
                  @input="markAccountDirty(activeAccountId)"
                />
              </label>
            </div>

            <p v-if="accountError" id="snapshot-account-error" class="snapshot-account-error" role="alert">{{ accountError }}</p>
            <p v-else class="snapshot-account-help">库存为 0 时直接填写 0；离开本账号前会进行核对。</p>
            <p class="snapshot-flow-message" aria-live="polite">{{ flowMessage }}</p>
          </fieldset>
        </div>

        <footer>
          <button class="button secondary" type="button" @click="activeAccountIndex === 0 ? requestClose() : goPreviousAccount()">
            {{ activeAccountIndex === 0 ? "取消" : `上一个 · ${previousAccountId}` }}
          </button>
          <button v-if="nextAccountId" class="button primary" type="button" @click="goNextAccount">
            下一账号 · {{ nextAccountId }}
          </button>
          <button v-else class="button primary" type="submit">
            {{ matchingSnapshot ? "更新五号快照" : "保存五号快照" }}
          </button>
        </footer>
      </form>
    </div>
  </Teleport>
</template>

<style scoped>
.snapshot-dialog {
  container: inventory-dialog / inline-size;
  width: min(720px, 100%);
  max-width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.snapshot-dialog:focus { outline: 0; }

.snapshot-entry-scroll {
  flex: 1 1 auto;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.snapshot-dialog > footer {
  position: static;
  flex: 0 0 auto;
  width: 100%;
  min-width: 0;
}

.snapshot-dialog > footer .button {
  min-width: 0;
}

.snapshot-date-field {
  min-width: 0;
  color: var(--radar-ink);
  background: var(--radar-surface-2);
}

.snapshot-date-field > label {
  color: var(--radar-ink);
}

.snapshot-date-field small {
  color: var(--radar-muted);
}

.snapshot-date-field input {
  color: var(--radar-ink);
  background: #ffffff;
  color-scheme: light;
}

.snapshot-account-stepper {
  flex: 0 0 auto;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--radar-line);
  background: var(--radar-surface-2);
}

.snapshot-account-tab {
  min-width: 0;
  min-height: 50px;
  display: grid;
  place-items: center;
  gap: 2px;
  padding: 5px 3px;
  border: 1px solid var(--radar-line-strong);
  border-radius: 7px;
  color: var(--radar-muted);
  background: #ffffff;
}

.snapshot-account-tab strong {
  overflow: hidden;
  max-width: 100%;
  color: var(--radar-ink);
  font-size: 15px;
  line-height: 1.15;
  text-overflow: ellipsis;
}

.snapshot-account-tab small {
  font-size: 10px;
  font-weight: 800;
  line-height: 1.1;
}

.snapshot-account-tab.active {
  border-color: var(--radar-cyan-strong);
  color: var(--radar-cyan-strong);
  background: var(--radar-cyan-soft);
  box-shadow: inset 0 -2px var(--radar-cyan-strong);
}

.snapshot-account-tab.reviewed:not(.active) {
  border-color: rgba(24, 143, 98, .42);
  color: var(--radar-success);
  background: rgba(24, 143, 98, .07);
}

.snapshot-account-panel {
  min-inline-size: 0;
  width: 100%;
  max-width: 100%;
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 18px 20px 20px;
  border: 0;
}

.snapshot-account-heading {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.snapshot-account-heading > div {
  min-width: 0;
}

.snapshot-account-heading h3 {
  color: var(--radar-ink);
  font-size: 19px;
  line-height: 1.25;
}

.snapshot-account-heading p {
  margin-top: 3px;
  color: var(--radar-muted);
  font-size: 12px;
  line-height: 1.4;
}

.snapshot-account-fields {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.snapshot-account-field {
  min-width: 0;
  display: grid;
  gap: 6px;
  color: var(--radar-ink);
}

.snapshot-account-field > span {
  min-width: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.snapshot-account-field > span strong {
  font-size: 14px;
}

.snapshot-account-field > span small {
  color: var(--radar-muted);
  font-size: 12px;
  font-weight: 700;
}

.snapshot-account-field input {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  height: 50px;
  padding: 0 12px;
  border: 1px solid var(--radar-line-strong);
  border-radius: 7px;
  color: var(--radar-ink);
  background: #ffffff;
  font-size: 18px !important;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  -webkit-text-size-adjust: 100%;
}

.snapshot-account-field input:focus {
  border-color: var(--radar-cyan-strong);
  outline: 3px solid rgba(10, 138, 133, .16);
  outline-offset: 1px;
}

.snapshot-account-field input[aria-invalid="true"] {
  border-color: var(--radar-danger);
  outline-color: rgba(190, 52, 52, .14);
}

.snapshot-account-error,
.snapshot-account-help,
.snapshot-flow-message {
  margin: 0;
  color: var(--radar-muted);
  font-size: 12px;
  line-height: 1.45;
}

.snapshot-account-error {
  color: var(--radar-danger);
  font-weight: 800;
}

.snapshot-flow-message {
  min-height: 18px;
  color: var(--radar-cyan-strong);
  font-weight: 800;
}

@container inventory-dialog (max-width: 390px) {
  .snapshot-account-fields {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .snapshot-dialog-backdrop {
    inset: var(--inventory-modal-top, 0px) auto auto var(--inventory-modal-left, 0px);
    width: var(--inventory-modal-width, 100vw);
    height: var(--inventory-modal-height, 100dvh);
    padding: max(8px, env(safe-area-inset-top)) 0 0;
    background: rgba(17, 24, 39, .58);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }

  .snapshot-dialog {
    width: 100%;
    max-height: calc(var(--inventory-modal-height, 100dvh) - max(8px, env(safe-area-inset-top)));
    border-radius: 8px 8px 0 0;
  }

  .snapshot-dialog-backdrop.keyboard-open {
    padding-top: 0;
  }

  .snapshot-dialog-backdrop.keyboard-open .snapshot-dialog {
    max-height: var(--inventory-modal-height, 100dvh);
    border-radius: 0;
  }

  .snapshot-dialog > header {
    min-width: 0;
    padding: 11px 12px;
  }

  .snapshot-dialog > header > div {
    min-width: 0;
  }

  .snapshot-dialog-backdrop.keyboard-open .snapshot-dialog > header {
    min-height: 56px;
    padding-block: 7px;
  }

  .snapshot-dialog-backdrop.keyboard-open .snapshot-dialog > header p,
  .snapshot-dialog-backdrop.keyboard-open .snapshot-date-field,
  .snapshot-dialog-backdrop.keyboard-open .snapshot-seed-note {
    display: none;
  }

  .snapshot-date-field {
    grid-template-columns: auto minmax(0, 1fr);
    gap: 7px 10px;
    padding: 9px 12px;
  }

  .snapshot-date-field input {
    width: 100%;
    min-width: 0;
  }

  .snapshot-date-field small {
    grid-column: 1 / -1;
    min-width: 0;
  }

  .snapshot-seed-note {
    padding: 8px 12px;
  }

  .snapshot-account-stepper {
    gap: 5px;
    padding: 8px;
  }

  .snapshot-account-tab {
    min-height: 46px;
    border-radius: 6px;
  }

  .snapshot-account-panel {
    gap: 11px;
    padding: 12px;
  }

  .snapshot-account-heading {
    gap: 9px;
  }

  .snapshot-account-heading h3 {
    font-size: 17px;
  }

  .snapshot-account-heading p {
    font-size: 11px;
  }

  .snapshot-account-fields {
    gap: 10px;
  }

  .snapshot-dialog > footer {
    grid-template-columns: minmax(0, .86fr) minmax(0, 1.14fr);
    gap: 8px;
    padding: 10px 10px max(10px, env(safe-area-inset-bottom));
  }

  .snapshot-dialog-backdrop.keyboard-open .snapshot-dialog > footer {
    padding-bottom: 10px;
  }

  .snapshot-dialog > footer .button {
    overflow: hidden;
    padding-inline: 8px;
    font-size: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .snapshot-dialog-backdrop.keyboard-open .snapshot-account-heading p,
  .snapshot-dialog-backdrop.keyboard-open .snapshot-account-help {
    display: none;
  }
}
</style>
