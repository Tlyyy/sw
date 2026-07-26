<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { marketItems } from "../domain/gems";
import { shanghaiDateKey } from "../domain/plans";
import {
  accountIds,
  type AccountId,
  type InventoryBalance,
  type InventorySnapshotInput,
} from "../domain/types";
import { useCatalogStore } from "../stores/catalog";
import { useInventoryStore } from "../stores/inventory";
import { useSettingsStore } from "../stores/settings";
import { useUiStore, type RecordSheetMode } from "../stores/ui";
import { useVisualViewport } from "../composables/useVisualViewport";
import AppIcon from "./AppIcon.vue";

const route = useRoute();
const catalog = useCatalogStore();
const inventory = useInventoryStore();
const settings = useSettingsStore();
const ui = useUiStore();
const { keyboardOpen, visualViewportStyle } = useVisualViewport("record-sheet");

const sheet = ref<HTMLFormElement>();
const closeButton = ref<HTMLButtonElement>();
const effectiveDate = ref(shanghaiDateKey());
const expenseAccountId = ref<AccountId>(ui.recentAccount);
const expenseAmount = ref<number | null>(null);
const expenseNote = ref("");
const error = ref("");
const notice = ref("");
const inventorySeedNote = ref("");
const marketDrafts = reactive<Record<string, string>>({});
const inventoryRows = reactive<Record<AccountId, InventoryBalance>>(emptyInventoryRows());
let noticeTimer = 0;
let previouslyFocused: HTMLElement | null = null;
let previousBodyOverflow = "";
let previousRootOverflow = "";

const mode = computed(() => ui.recordSheetMode);
const parentSheetOpen = computed(() => ui.recordSheetOpen);
const market = computed(() => marketItems(catalog.data, settings.gemPriceOverrides));
const sourcePath = computed(() => (
  ui.recordSheetContext.sourcePath
  || ui.recordSheetContext.returnTo
  || route.fullPath
));
const sourceLabel = computed(() => {
  if (sourcePath.value.startsWith("/week")) return "补充到当前周报";
  if (sourcePath.value.startsWith("/plans/tasks")) return "从任务上下文录入";
  return "保存后回到刚才的位置";
});
const sheetTitle = computed(() => ({
  inventory: "记录今日信息",
  expense: "记录支出",
  market: "更新行情",
})[mode.value || "inventory"]);

function seedDrafts() {
  effectiveDate.value = ui.recordSheetContext.effectiveDate || shanghaiDateKey();
  expenseAccountId.value = ui.recordSheetContext.accountId || ui.recentAccount;
  expenseAmount.value = null;
  expenseNote.value = "";
  error.value = "";
  Object.keys(marketDrafts).forEach((name) => delete marketDrafts[name]);
  market.value.forEach((item) => {
    marketDrafts[item.name] = String(item.price);
  });
  seedInventoryRows();
}

function emptyInventoryRows(): Record<AccountId, InventoryBalance> {
  return Object.fromEntries(accountIds.map((accountId) => [accountId, {
    dedicatedEggs: 0,
    regularEggs: 0,
    silverWan: 0,
    innerShardCount: 0,
  }])) as Record<AccountId, InventoryBalance>;
}

function copyInventoryRows(source: Record<AccountId, InventoryBalance>) {
  accountIds.forEach((accountId) => {
    inventoryRows[accountId] = {
      dedicatedEggs: Number(source[accountId].dedicatedEggs || 0),
      regularEggs: Number(source[accountId].regularEggs || 0),
      silverWan: Number(source[accountId].silverWan || 0),
      innerShardCount: Number(source[accountId].innerShardCount || 0),
    };
  });
}

function seedInventoryRows() {
  const ordered = [...inventory.snapshots].sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate));
  const exact = ordered.find((item) => item.effectiveDate === effectiveDate.value);
  if (exact) {
    copyInventoryRows(exact.accounts);
    inventorySeedNote.value = `已载入 ${effectiveDate.value} 的现有库存；保存会更新这一天。`;
    return;
  }
  const prior = ordered.filter((item) => item.effectiveDate < effectiveDate.value).at(-1);
  if (prior) {
    copyInventoryRows(prior.accounts);
    inventorySeedNote.value = `已带入 ${prior.effectiveDate} 的前序库存，请只改当天变化。`;
    return;
  }
  copyInventoryRows(emptyInventoryRows());
  inventorySeedNote.value = "这是第一份五账号库存基线，请按实际库存填写。";
}

function showNotice(message: string) {
  notice.value = message;
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    notice.value = "";
  }, 3_200);
}

function activateSheet() {
  previouslyFocused ||= document.activeElement instanceof HTMLElement ? document.activeElement : null;
  previousBodyOverflow = document.body.style.overflow;
  previousRootOverflow = document.documentElement.style.overflow;
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
  document.querySelector("#app")?.setAttribute("inert", "");
  void nextTick(() => closeButton.value?.focus({ preventScroll: true }));
}

function deactivateSheet(restoreFocus = false) {
  document.body.style.overflow = previousBodyOverflow;
  document.documentElement.style.overflow = previousRootOverflow;
  document.querySelector("#app")?.removeAttribute("inert");
  if (restoreFocus) {
    void nextTick(() => previouslyFocused?.focus({ preventScroll: true }));
    previouslyFocused = null;
  }
}

function selectMode(nextMode: RecordSheetMode) {
  error.value = "";
  ui.setRecordSheetMode(nextMode);
}

function closeSheet() {
  ui.closeRecordSheet();
}

function saveInventorySnapshot() {
  const normalizedAccounts = Object.fromEntries(accountIds.map((accountId) => {
    const row = inventoryRows[accountId];
    return [accountId, {
      dedicatedEggs: Math.max(0, Math.round(Number(row.dedicatedEggs) || 0)),
      regularEggs: Math.max(0, Math.round(Number(row.regularEggs) || 0)),
      silverWan: Math.max(0, Number(row.silverWan) || 0),
      innerShardCount: Math.max(0, Math.round(Number(row.innerShardCount) || 0)),
    }];
  })) as InventorySnapshotInput["accounts"];
  const draft: InventorySnapshotInput = {
    effectiveDate: effectiveDate.value,
    accounts: normalizedAccounts,
  };
  const updating = inventory.snapshots.some((item) => item.effectiveDate === draft.effectiveDate);
  inventory.saveSnapshot(draft);
  showNotice(`${updating ? "已更新" : "已保存"} ${draft.effectiveDate} 的五号库存`);
  closeSheet();
}

function saveExpense() {
  const record = settings.addSilverExpense({
    effectiveDate: effectiveDate.value,
    accountId: expenseAccountId.value,
    amountWan: Number(expenseAmount.value),
    note: expenseNote.value,
  });
  if (!record) {
    error.value = "请填写有效日期、金额和用途";
    return;
  }
  ui.recentAccount = expenseAccountId.value;
  showNotice(`已记录 ${expenseAccountId.value} 的 ${Number(record.amountWan.toFixed(2)).toLocaleString("zh-CN")} 万银子支出`);
  closeSheet();
}

function saveMarket() {
  const candidate = market.value.map((item) => ({
    name: item.name,
    price: Number(marketDrafts[item.name]),
  }));
  const recorded = settings.recordGemPrices("manual", candidate);
  if (!recorded) {
    error.value = "六项行情都必须是大于 0 的整数";
    return;
  }
  candidate.forEach((item) => settings.setGemPrice(item.name, item.price));
  showNotice("当前六项宝石行情已记录");
  closeSheet();
}

function submitCurrent() {
  if (mode.value === "inventory") saveInventorySnapshot();
  if (mode.value === "expense") saveExpense();
  if (mode.value === "market") saveMarket();
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeSheet();
    return;
  }
  if (event.key !== "Tab" || !sheet.value) return;
  const focusable = [...sheet.value.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled])")]
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

watch(() => ui.recordSheetOpen, (open) => {
  if (!open) return;
  if (ui.recordSheetMode === null) ui.setRecordSheetMode("inventory");
  seedDrafts();
});

watch(parentSheetOpen, (open, wasOpen) => {
  if (open) activateSheet();
  else if (wasOpen) deactivateSheet(!ui.recordSheetOpen);
}, { immediate: true });

onBeforeUnmount(() => {
  window.clearTimeout(noticeTimer);
  deactivateSheet(false);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="ios26-sheet">
      <div
        v-if="parentSheetOpen"
        class="ios26-record-backdrop"
        :class="{ 'is-keyboard-open': keyboardOpen }"
        :style="visualViewportStyle"
        @click.self="closeSheet"
      >
        <form
          ref="sheet"
          class="ios26-record-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios26-record-title"
          @submit.prevent="submitCurrent"
          @keydown="handleKeydown"
        >
          <div class="ios26-sheet-grabber" aria-hidden="true"></div>
          <header class="ios26-record-head">
            <button ref="closeButton" class="ios26-sheet-text-button" type="button" @click="closeSheet">取消</button>
            <div>
              <h2 id="ios26-record-title">{{ sheetTitle }}</h2>
              <p>{{ sourceLabel }}</p>
            </div>
            <button class="ios26-sheet-text-button primary" type="submit">完成</button>
          </header>

          <div class="ios26-record-segments" aria-label="录入类型">
            <button type="button" :class="{ active: mode === 'inventory' }" @click="selectMode('inventory')">
              <AppIcon name="assets" />
              <span>库存</span>
            </button>
            <button type="button" :class="{ active: mode === 'expense' }" @click="selectMode('expense')">
              <AppIcon name="analysis" />
              <span>支出</span>
            </button>
            <button type="button" :class="{ active: mode === 'market' }" @click="selectMode('market')">
              <AppIcon name="report" />
              <span>行情</span>
            </button>
          </div>

          <div v-if="mode === 'inventory'" class="ios26-record-body ios26-inventory-body">
            <div class="ios26-inventory-meta">
              <label class="ios26-sheet-field">
                <span>库存所属日期</span>
                <input v-model="effectiveDate" type="date" :max="shanghaiDateKey()" required @change="seedInventoryRows" />
              </label>
              <p>{{ inventorySeedNote }}</p>
            </div>
            <div class="ios26-inventory-table" aria-label="五账号库存批量录入">
              <div class="ios26-inventory-head">
                <span>账号</span>
                <span>专用蛋</span>
                <span>普通蛋</span>
                <span>银子/万</span>
                <span>碎片</span>
              </div>
              <div v-for="accountId in accountIds" :key="accountId" class="ios26-inventory-row">
                <strong>{{ accountId }}</strong>
                <input v-model.number="inventoryRows[accountId].dedicatedEggs" type="number" inputmode="numeric" min="0" step="1" :aria-label="`${accountId} 专用蛋`" required />
                <input v-model.number="inventoryRows[accountId].regularEggs" type="number" inputmode="numeric" min="0" step="1" :aria-label="`${accountId} 普通蛋`" required />
                <input v-model.number="inventoryRows[accountId].silverWan" type="number" inputmode="decimal" min="0" step="0.01" :aria-label="`${accountId} 银子`" required />
                <input v-model.number="inventoryRows[accountId].innerShardCount" type="number" inputmode="numeric" min="0" step="1" :aria-label="`${accountId} 碎片`" required />
              </div>
            </div>
          </div>

          <div v-else-if="mode === 'expense'" class="ios26-record-body">
            <label class="ios26-sheet-field">
              <span>所属日期</span>
              <input v-model="effectiveDate" type="date" :max="shanghaiDateKey()" required />
            </label>
            <fieldset class="ios26-account-picker">
              <legend>账号</legend>
              <div>
                <button
                  v-for="accountId in accountIds"
                  :key="accountId"
                  type="button"
                  :class="{ active: expenseAccountId === accountId }"
                  @click="expenseAccountId = accountId"
                >{{ accountId }}</button>
              </div>
            </fieldset>
            <label class="ios26-sheet-field">
              <span>支出金额 <small>万银子</small></span>
              <input v-model.number="expenseAmount" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0.00" required />
            </label>
            <label class="ios26-sheet-field">
              <span>用途</span>
              <input v-model="expenseNote" type="text" placeholder="例如：购买普通蛋" required />
            </label>
          </div>

          <div v-else-if="mode === 'market'" class="ios26-record-body">
            <p class="ios26-sheet-intro">按当前游戏行情确认六项价格，保存后计划测算会立即使用新价格。</p>
            <div class="ios26-market-grid">
              <label v-for="item in market" :key="item.name">
                <span>{{ item.name }}</span>
                <span class="ios26-market-input">
                  <input v-model="marketDrafts[item.name]" type="number" inputmode="numeric" min="1" step="1" required />
                  <small>银币</small>
                </span>
              </label>
            </div>
          </div>

          <p v-if="error" class="ios26-record-error" role="alert">{{ error }}</p>
          <footer class="ios26-record-footer">
            <button class="ios26-record-save" type="submit">
              {{ mode === "inventory" ? "保存五号库存" : mode === "expense" ? "保存支出并返回" : "保存行情并返回" }}
            </button>
          </footer>
        </form>
      </div>
    </Transition>

    <Transition name="ios26-toast">
      <p v-if="notice" class="ios26-record-toast" role="status">{{ notice }}</p>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ios26-record-backdrop {
  position: fixed;
  top: var(--record-sheet-top, 0);
  left: var(--record-sheet-left, 0);
  z-index: 410;
  width: var(--record-sheet-width, 100vw);
  height: var(--record-sheet-height, 100dvh);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 20px;
  background: rgba(8, 12, 20, 0.3);
  backdrop-filter: blur(8px);
}

.ios26-record-sheet {
  --ios26-record-title-size: 17px;
  --ios26-record-label-size: 13px;
  --ios26-record-input-size: 16px;
  --ios26-record-input-weight: 600;
  --ios26-record-meta-size: 12px;
  --ios26-record-control-height: 50px;

  width: min(100%, 560px);
  max-height: min(88dvh, 780px);
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 28px;
  background: rgba(248, 249, 252, 0.94);
  box-shadow: 0 22px 70px rgba(14, 25, 48, 0.24);
  color: #111827;
}

.ios26-record-sheet button:focus {
  outline: 0;
}

.ios26-sheet-grabber {
  width: 36px;
  height: 5px;
  margin: 8px auto 2px;
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.18);
}

.ios26-record-head {
  position: sticky;
  top: 0;
  z-index: 2;
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) 58px;
  align-items: center;
  min-height: 62px;
  padding: 4px 10px 8px;
  border-bottom: 1px solid rgba(17, 24, 39, 0.08);
  background: rgba(248, 249, 252, 0.9);
  backdrop-filter: blur(18px) saturate(150%);
}

.ios26-record-head > div {
  min-width: 0;
  text-align: center;
}

.ios26-record-head h2,
.ios26-record-head p {
  margin: 0;
}

.ios26-record-head h2 {
  font-size: var(--ios26-record-title-size);
  line-height: 1.25;
  letter-spacing: -0.02em;
}

.ios26-record-head p {
  margin-top: 2px;
  overflow: hidden;
  color: #6b7280;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ios26-sheet-text-button {
  min-height: 44px;
  border: 0;
  color: #526070;
  background: transparent;
  font: inherit;
  font-size: 15px;
}

.ios26-sheet-text-button.primary {
  color: var(--ios26-accent, #d35c00);
  font-weight: 750;
}

.ios26-sheet-head-spacer {
  width: 58px;
}

.ios26-record-segments {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  margin: 14px 16px 12px;
  padding: 4px;
  border: 1px solid rgba(17, 24, 39, 0.07);
  border-radius: 15px;
  background: rgba(118, 118, 128, 0.1);
}

.ios26-record-segments button {
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  border-radius: 11px;
  color: #667085;
  background: transparent;
  font: inherit;
  font-size: 13px;
  font-weight: 720;
}

.ios26-record-segments button.active {
  color: #ffffff;
  background: var(--ios26-accent, #d35c00);
  box-shadow: 0 4px 12px rgba(160, 66, 0, 0.17);
}

.ios26-record-segments svg {
  width: 18px;
  height: 18px;
}

.ios26-record-picker {
  display: grid;
  gap: 1px;
  margin: 0 16px 18px;
  overflow: hidden;
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 20px;
  background: rgba(17, 24, 39, 0.08);
}

.ios26-record-picker > button {
  min-height: 78px;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 20px;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 0;
  color: #111827;
  background: rgba(255, 255, 255, 0.92);
  text-align: left;
}

.ios26-record-picker > button > span:nth-child(2) {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.ios26-record-picker strong {
  font-size: 15px;
}

.ios26-record-picker small {
  color: #667085;
  font-size: 12px;
  line-height: 1.35;
}

.ios26-record-picker-icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: #007aff;
  background: rgba(0, 122, 255, 0.1);
}

.ios26-record-body {
  display: grid;
  gap: 14px;
  padding: 4px 16px 18px;
}

.ios26-inventory-body {
  gap: 10px;
}

.ios26-inventory-meta {
  display: grid;
  grid-template-columns: minmax(0, 150px) minmax(0, 1fr);
  align-items: end;
  gap: 12px;
}

.ios26-inventory-meta p {
  margin: 0 0 4px;
  color: #7b8492;
  font-size: var(--ios26-record-meta-size);
  line-height: 1.45;
}

.ios26-inventory-table {
  overflow: hidden;
  border: 1px solid rgba(17, 24, 39, 0.09);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
}

.ios26-inventory-head,
.ios26-inventory-row {
  display: grid;
  grid-template-columns: 48px repeat(4, minmax(0, 1fr));
  align-items: center;
  gap: 5px;
  padding: 7px 8px;
}

.ios26-inventory-head {
  min-height: 34px;
  color: #7b8492;
  background: rgba(118, 118, 128, 0.07);
  font-size: 11px;
  font-weight: 720;
  text-align: center;
}

.ios26-inventory-row {
  min-height: 64px;
  border-top: 1px solid rgba(17, 24, 39, 0.07);
}

.ios26-inventory-row strong {
  color: #263244;
  font-size: var(--ios26-record-label-size);
}

.ios26-inventory-row input {
  min-width: 0;
  width: 100%;
  height: var(--ios26-record-control-height);
  padding: 0 5px;
  border: 1px solid rgba(17, 24, 39, 0.1);
  border-radius: 10px;
  color: #111827;
  background: #ffffff;
  font: inherit;
  font-size: var(--ios26-record-input-size);
  font-weight: var(--ios26-record-input-weight);
  text-align: center;
}

.ios26-sheet-field,
.ios26-account-picker,
.ios26-market-grid label {
  margin: 0;
  border: 0;
}

.ios26-sheet-field {
  display: grid;
  gap: 7px;
}

.ios26-sheet-field > span,
.ios26-account-picker legend,
.ios26-market-grid label > span:first-child {
  color: #465366;
  font-size: var(--ios26-record-label-size);
  font-weight: 720;
}

.ios26-sheet-field > span small {
  color: #8a94a3;
  font-size: var(--ios26-record-meta-size);
  font-weight: 600;
}

.ios26-sheet-field input,
.ios26-market-input {
  height: var(--ios26-record-control-height);
  min-height: var(--ios26-record-control-height);
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(17, 24, 39, 0.1);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.92);
}

.ios26-sheet-field input {
  display: block;
  padding: 0 14px;
  color: #111827;
  font: inherit;
  font-size: var(--ios26-record-input-size);
  font-weight: var(--ios26-record-input-weight);
}

.ios26-account-picker > div {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
  margin-top: 7px;
}

.ios26-account-picker button {
  min-width: 0;
  min-height: 44px;
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 12px;
  color: #596579;
  background: rgba(255, 255, 255, 0.76);
  font: inherit;
  font-size: var(--ios26-record-label-size);
  font-weight: 800;
}

.ios26-account-picker button.active {
  border-color: rgba(211, 92, 0, 0.3);
  color: var(--ios26-accent, #d35c00);
  background: rgba(211, 92, 0, 0.08);
}

.ios26-sheet-intro {
  margin: 0;
  color: #667085;
  font-size: var(--ios26-record-meta-size);
  line-height: 1.5;
}

.ios26-market-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.ios26-market-grid label {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.ios26-market-input {
  min-width: 0;
  display: flex;
  align-items: center;
  padding: 0 11px;
}

.ios26-market-input input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  color: #111827;
  background: transparent;
  font: inherit;
  font-size: var(--ios26-record-input-size);
  font-weight: var(--ios26-record-input-weight);
}

.ios26-market-input small {
  color: #8a94a3;
  font-size: var(--ios26-record-meta-size);
}

.ios26-record-error {
  margin: 0 16px 10px;
  padding: 10px 12px;
  border-radius: 12px;
  color: #b42318;
  background: #fff1f0;
  font-size: 13px;
}

.ios26-record-footer {
  position: sticky;
  bottom: 0;
  padding: 10px 16px max(14px, env(safe-area-inset-bottom));
  border-top: 1px solid rgba(17, 24, 39, 0.07);
  background: rgba(248, 249, 252, 0.9);
  backdrop-filter: blur(18px) saturate(150%);
}

.ios26-record-save {
  width: 100%;
  min-height: 50px;
  border: 0;
  border-radius: 15px;
  color: #fff;
  background: var(--ios26-accent, #d35c00);
  font: inherit;
  font-size: 16px;
  font-weight: 780;
  box-shadow: 0 8px 20px rgba(160, 66, 0, 0.2);
}

.ios26-record-toast {
  position: fixed;
  z-index: 460;
  left: 50%;
  bottom: calc(94px + env(safe-area-inset-bottom));
  max-width: min(calc(100vw - 32px), 420px);
  margin: 0;
  padding: 11px 16px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 999px;
  color: #fff;
  background: rgba(20, 27, 39, 0.88);
  box-shadow: 0 12px 30px rgba(8, 12, 20, 0.2);
  backdrop-filter: blur(18px);
  font-size: 13px;
  font-weight: 700;
  text-align: center;
  transform: translateX(-50%);
}

.ios26-sheet-enter-active,
.ios26-sheet-leave-active {
  transition: opacity 180ms ease;
}

.ios26-sheet-enter-active .ios26-record-sheet,
.ios26-sheet-leave-active .ios26-record-sheet {
  transition: transform 260ms cubic-bezier(0.22, 0.82, 0.3, 1);
}

.ios26-sheet-enter-from,
.ios26-sheet-leave-to {
  opacity: 0;
}

.ios26-sheet-enter-from .ios26-record-sheet,
.ios26-sheet-leave-to .ios26-record-sheet {
  transform: translateY(32px);
}

.ios26-toast-enter-active,
.ios26-toast-leave-active {
  transition: opacity 160ms ease, transform 200ms ease;
}

.ios26-toast-enter-from,
.ios26-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}

@media (min-width: 981px) {
  .ios26-record-backdrop {
    align-items: center;
  }
}

@media (max-width: 560px) {
  .ios26-record-backdrop {
    padding: 0;
  }

  .ios26-record-sheet {
    width: 100%;
    height: min(83dvh, 780px);
    max-height: var(--record-sheet-height, 100dvh);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
    border-radius: 28px 28px 0 0;
  }

  .ios26-sheet-grabber,
  .ios26-record-head,
  .ios26-record-segments,
  .ios26-record-error,
  .ios26-record-footer {
    flex: 0 0 auto;
  }

  .ios26-record-body {
    min-height: 0;
    flex: 1 1 auto;
    align-content: start;
    grid-auto-rows: max-content;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .ios26-record-body::-webkit-scrollbar {
    display: none;
  }
}
</style>
