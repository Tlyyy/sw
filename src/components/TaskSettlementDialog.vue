<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { ScheduledTask } from "../domain/plans";
import {
  calculateTaskEggPurchase,
  createTaskSettlementDraft,
  summarizeTaskSettlementDraft,
  validateTaskSettlementDraft,
  type TaskSettlementDraft,
  type TaskSettlementValidationField,
} from "../domain/taskSettlement";
import type { InventoryBalance } from "../domain/types";
import AppIcon from "./AppIcon.vue";

interface TaskSettlementPayload {
  draft: TaskSettlementDraft;
  occurredAt: string;
  effectiveDate: string;
  note: string;
  complete: boolean;
  reuseExisting: boolean;
}

const props = withDefaults(defineProps<{
  task: ScheduledTask;
  eggUnitPriceWan: number;
  inventory?: InventoryBalance | null;
  progressTotalWan?: number;
  existingEntryCount?: number;
  existingSummary?: string;
}>(), {
  inventory: null,
  progressTotalWan: 0,
  existingEntryCount: 0,
  existingSummary: "",
});

const emit = defineEmits<{
  cancel: [];
  confirm: [payload: TaskSettlementPayload];
}>();

const dialog = ref<HTMLFormElement>();
const initialFocus = ref<HTMLInputElement>();
const draft = ref<TaskSettlementDraft>(createTaskSettlementDraft(
  props.task,
  props.inventory,
  props.eggUnitPriceWan,
));
const occurredAtLocal = ref(shanghaiDateTimeLocal());
const note = ref("");
const submitted = ref(false);
const timeError = ref("");
const reuseExisting = ref(props.task.actionKey !== "talisman" && props.existingEntryCount > 0);
let previouslyFocused: HTMLElement | null = null;
let previousBodyOverflow = "";
let previousRootOverflow = "";
let appWasInert = false;

const isProgress = computed(() => draft.value.mode === "progress");
const isVariable = computed(() => draft.value.mode === "variable");
const isFixedEgg = computed(() => draft.value.mode === "fixed" && props.task.eggCount > 0);
const isFixedShard = computed(() => draft.value.mode === "fixed" && props.task.resourceType === "innerShard");
const isFixedSilver = computed(() => draft.value.mode === "fixed" && !isFixedEgg.value && !isFixedShard.value);
const canReuseExisting = computed(() => !isProgress.value && props.existingEntryCount > 0);
const validation = computed(() => validateTaskSettlementDraft(
  props.task,
  draft.value,
  props.eggUnitPriceWan,
));
const visibleIssues = computed(() => submitted.value && !reuseExisting.value ? validation.value.issues : []);
const uniqueIssueMessages = computed(() => [...new Set(visibleIssues.value.map((issue) => issue.message))]);
const eggTotal = computed(() => numericValue(draft.value.dedicatedEggs) + numericValue(draft.value.regularEggs));
const eggPurchase = computed(() => calculateTaskEggPurchase(
  props.task,
  {
    dedicatedEggs: numericValue(draft.value.dedicatedEggs),
    regularEggs: numericValue(draft.value.regularEggs),
  },
  props.eggUnitPriceWan,
));
const eggUnitPriceLabel = computed(() => amountLabel(eggPurchase.value.unitPriceWan));
const eggSilverLabel = computed(() => amountLabel(eggPurchase.value.silverWan));
const safeSummaryDraft = computed<TaskSettlementDraft>(() => ({
  ...draft.value,
  silverWan: finiteNumberOrNull(draft.value.silverWan),
  dedicatedEggs: numericValue(draft.value.dedicatedEggs),
  regularEggs: numericValue(draft.value.regularEggs),
  innerShardCount: numericValue(draft.value.innerShardCount),
}));
const settlementSummary = computed(() => summarizeTaskSettlementDraft(safeSummaryDraft.value));
const priorProgressWan = computed(() => (
  Number.isFinite(props.progressTotalWan) ? Math.max(0, props.progressTotalWan) : 0
));
const projectedProgressWan = computed(() => (
  priorProgressWan.value + Math.max(0, finiteNumberOrNull(draft.value.silverWan) ?? 0)
));
const dialogTitle = computed(() => {
  if (isProgress.value) return "记录洗护符进度";
  if (isVariable.value) return "完成打书并记账";
  return "确认任务消耗";
});
const guidance = computed(() => {
  if (reuseExisting.value) return "这次只恢复任务完成状态，沿用已有实际流水；不会新增支出，也不会修改库存。";
  if (isProgress.value) return "洗护符可以分多天记录；本次保存后，库存仍以你手工录入的快照为准。";
  if (isVariable.value) return "填写这次打书真实花掉的银子；系统只记录用途，不会自动修改库存。";
  if (isFixedEgg.value && eggPurchase.value.shortageEggs > 0) {
    return `固定需 ${props.task.eggCount} 个；本次实际用 ${eggPurchase.value.usedEggs} 个，缺 ${eggPurchase.value.shortageEggs} 个`
      + `，按 ${eggUnitPriceLabel.value} 万/个由系统自动计 ${eggSilverLabel.value} 万。即使当前余额为 0，也请填今天真实用掉的蛋；只记流水，不改库存。`;
  }
  if (isFixedEgg.value) return "最近库存只用于给出初始建议；请确认本次真实用掉的蛋，哪怕它今天获得后已经花掉。只记流水，不会自动扣库存。";
  return "固定消耗已带入，确认只记录流水，不会自动修改库存。";
});

function numericValue(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function finiteNumberOrNull(value: unknown) {
  if (value === null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function amountLabel(value: number) {
  return Number(value.toFixed(2)).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

function shanghaiDateTimeLocal(now = Date.now()) {
  const shanghai = new Date(now + 8 * 60 * 60 * 1_000);
  return `${shanghai.getUTCFullYear()}-${twoDigits(shanghai.getUTCMonth() + 1)}-${twoDigits(shanghai.getUTCDate())}`
    + `T${twoDigits(shanghai.getUTCHours())}:${twoDigits(shanghai.getUTCMinutes())}`;
}

function parseShanghaiDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const epoch = Date.UTC(year, month - 1, day, hour - 8, minute);
  const check = new Date(epoch + 8 * 60 * 60 * 1_000);
  if (
    check.getUTCFullYear() !== year
    || check.getUTCMonth() + 1 !== month
    || check.getUTCDate() !== day
    || check.getUTCHours() !== hour
    || check.getUTCMinutes() !== minute
  ) return null;
  return {
    occurredAt: new Date(epoch).toISOString(),
    effectiveDate: `${yearText}-${monthText}-${dayText}`,
  };
}

function fieldHasIssue(field: TaskSettlementValidationField) {
  return visibleIssues.value.some((issue) => issue.field === field);
}

function resetDraft() {
  draft.value = createTaskSettlementDraft(props.task, props.inventory, props.eggUnitPriceWan);
  reuseExisting.value = canReuseExisting.value;
  occurredAtLocal.value = shanghaiDateTimeLocal();
  note.value = "";
  submitted.value = false;
  timeError.value = "";
}

function requestCancel() {
  emit("cancel");
}

function submit(complete: boolean) {
  submitted.value = true;
  const occurrence = parseShanghaiDateTime(occurredAtLocal.value);
  timeError.value = occurrence ? "" : "请选择有效的发生时间";
  if ((!reuseExisting.value && !validation.value.valid) || !occurrence) return;

  emit("confirm", {
    draft: { ...draft.value },
    occurredAt: occurrence.occurredAt,
    effectiveDate: occurrence.effectiveDate,
    note: note.value.trim().slice(0, 80),
    complete,
    reuseExisting: reuseExisting.value,
  });
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    requestCancel();
    return;
  }
  if (event.key !== "Tab" || !dialog.value) return;
  const focusable = [...dialog.value.querySelectorAll<HTMLElement>(
    "button:not([disabled]), input:not([disabled]), textarea:not([disabled])",
  )].filter((item) => item.offsetParent !== null);
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

async function focusDialog() {
  await nextTick();
  initialFocus.value?.focus();
}

async function activateDialog() {
  previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  previousBodyOverflow = document.body.style.overflow;
  previousRootOverflow = document.documentElement.style.overflow;
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
  const app = document.querySelector("#app");
  appWasInert = Boolean(app?.hasAttribute("inert"));
  app?.setAttribute("inert", "");
  await focusDialog();
}

function deactivateDialog(restoreFocus = true) {
  document.body.style.overflow = previousBodyOverflow;
  document.documentElement.style.overflow = previousRootOverflow;
  if (!appWasInert) document.querySelector("#app")?.removeAttribute("inert");
  if (restoreFocus) void nextTick(() => previouslyFocused?.focus());
}

watch(() => props.task.id, async () => {
  resetDraft();
  await focusDialog();
});

watch(
  [
    () => draft.value.dedicatedEggs,
    () => draft.value.regularEggs,
    () => props.eggUnitPriceWan,
  ],
  () => {
    if (isFixedEgg.value) draft.value.silverWan = eggPurchase.value.silverWan;
  },
);

watch(() => draft.value.silverWan, (value) => {
  if (finiteNumberOrNull(value) !== 0) draft.value.zeroConfirmed = false;
});

onMounted(() => {
  reuseExisting.value = canReuseExisting.value;
  void activateDialog();
});
onBeforeUnmount(() => deactivateDialog());
</script>

<template>
  <Teleport to="body">
    <div class="task-settlement-backdrop" @click.self="requestCancel">
      <form
        ref="dialog"
        class="task-settlement-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-settlement-title"
        aria-describedby="task-settlement-guidance"
        novalidate
        @submit.prevent="submit(isProgress ? false : true)"
        @keydown="handleKeydown"
      >
        <header class="task-settlement-header">
          <div>
            <p>{{ task.accountId }} · {{ task.typeLabel }}</p>
            <h2 id="task-settlement-title">{{ dialogTitle }}</h2>
            <span>{{ task.actionLabel }} · {{ task.kind }}</span>
          </div>
          <button class="task-settlement-close" type="button" aria-label="取消并关闭任务结算" @click="requestCancel">
            <AppIcon name="close" />
          </button>
        </header>

        <div class="task-settlement-body">
          <p id="task-settlement-guidance" class="task-settlement-guidance">
            <AppIcon name="analysis" aria-hidden="true" />
            <span>{{ guidance }}</span>
          </p>

          <section v-if="canReuseExisting" class="task-existing-settlement" aria-labelledby="task-existing-title">
            <header>
              <div><p>已有实际流水</p><h3 id="task-existing-title">{{ existingEntryCount }} 笔记录可沿用</h3></div>
              <strong>{{ existingSummary }}</strong>
            </header>
            <label>
              <input v-model="reuseExisting" :value="true" type="radio" name="settlement-source" />
              <span><b>沿用已有流水</b><small>只恢复完成状态，不再新增支出</small></span>
            </label>
            <label>
              <input v-model="reuseExisting" :value="false" type="radio" name="settlement-source" />
              <span><b>本次确实又有新支出</b><small>继续填写或确认下面这笔新增消耗</small></span>
            </label>
          </section>

          <section v-if="!reuseExisting" class="task-settlement-section" aria-labelledby="task-cost-title">
            <header>
              <div><p>本次消耗</p><h3 id="task-cost-title">{{ task.actionLabel }}</h3></div>
              <strong>{{ settlementSummary }}</strong>
            </header>

            <label v-if="isFixedSilver" class="task-settlement-field">
              <span>固定银子 / 万</span>
              <input
                ref="initialFocus"
                :value="draft.silverWan ?? 0"
                type="number"
                inputmode="decimal"
                readonly
                aria-readonly="true"
              />
              <small>固定金额只需确认，不可在这里修改。</small>
            </label>

            <div v-else-if="isFixedEgg" class="task-egg-fields">
              <label class="task-settlement-field">
                <span>本次实际使用专用蛋 / 个</span>
                <input
                  ref="initialFocus"
                  v-model.number="draft.dedicatedEggs"
                  type="number"
                  min="0"
                  step="1"
                  inputmode="numeric"
                  :aria-invalid="fieldHasIssue('dedicatedEggs')"
                  aria-describedby="task-egg-total"
                />
                <small>填本次真实用掉的数量，不受当前库存余额限制。</small>
              </label>
              <label class="task-settlement-field">
                <span>本次实际使用普通蛋 / 个</span>
                <input
                  v-model.number="draft.regularEggs"
                  type="number"
                  min="0"
                  step="1"
                  inputmode="numeric"
                  :aria-invalid="fieldHasIssue('regularEggs')"
                  aria-describedby="task-egg-total"
                />
                <small>今天先获得、后用掉的蛋也要记在这里。</small>
              </label>
              <p id="task-egg-total" :class="['task-egg-total', { invalid: submitted && eggTotal > task.eggCount }]">
                实际使用 <b>{{ eggTotal }}</b> + 自动补购 <b>{{ eggPurchase.shortageEggs }}</b>
                = {{ eggTotal + eggPurchase.shortageEggs }} / {{ task.eggCount }} 个
              </p>
              <label class="task-settlement-field task-extra-silver">
                <span>自动补购银子 / 万</span>
                <input
                  :value="draft.silverWan ?? 0"
                  type="number"
                  inputmode="decimal"
                  readonly
                  aria-readonly="true"
                />
                <small>
                  缺 {{ eggPurchase.shortageEggs }} 个 × {{ eggUnitPriceLabel }} 万/个
                  = {{ eggSilverLabel }} 万，由系统自动计算；只记银子支出，不修改库存。
                </small>
              </label>
            </div>

            <label v-else-if="isFixedShard" class="task-settlement-field">
              <span>固定内丹碎片 / 片</span>
              <input
                ref="initialFocus"
                :value="draft.innerShardCount"
                type="number"
                inputmode="numeric"
                readonly
                aria-readonly="true"
              />
              <small>固定数量只需确认，不会直接修改库存。</small>
            </label>

            <div v-else class="task-actual-silver">
              <label class="task-settlement-field">
                <span>{{ isProgress ? "本次实际银子 / 万" : "实际银子 / 万" }}</span>
                <input
                  ref="initialFocus"
                  v-model.number="draft.silverWan"
                  type="number"
                  min="0"
                  step="0.01"
                  inputmode="decimal"
                  placeholder="请输入实际花费"
                  :aria-invalid="fieldHasIssue('silverWan')"
                  aria-describedby="task-zero-confirm"
                />
              </label>
              <label v-if="finiteNumberOrNull(draft.silverWan) === 0" id="task-zero-confirm" class="task-zero-confirm">
                <input v-model="draft.zeroConfirmed" type="checkbox" />
                <span>确认本次确实没有花费银子</span>
              </label>
              <p v-if="isProgress" class="task-progress-total">
                此前累计 <b>{{ priorProgressWan.toLocaleString("zh-CN") }} 万</b>
                <span aria-hidden="true">→</span>
                保存后累计 <strong>{{ projectedProgressWan.toLocaleString("zh-CN") }} 万</strong>
              </p>
            </div>
          </section>

          <section v-if="!reuseExisting" class="task-settlement-section task-settlement-meta" aria-labelledby="task-record-title">
            <header><div><p>记录信息</p><h3 id="task-record-title">发生时间与备注</h3></div></header>
            <label class="task-settlement-field">
              <span>发生时间</span>
              <input
                v-model="occurredAtLocal"
                type="datetime-local"
                step="60"
                :aria-invalid="Boolean(timeError)"
                aria-describedby="task-time-help"
              />
              <small id="task-time-help">
                填真实发生时间：若任务发生在当天库存录入前，请填购买或消耗时的时间，才能正确归入当日实际所得。
              </small>
            </label>
            <label class="task-settlement-field">
              <span>备注（可选）</span>
              <textarea v-model="note" rows="2" maxlength="80" placeholder="例如：第 2 次洗护符"></textarea>
              <small>{{ note.length }} / 80</small>
            </label>
          </section>

          <div v-if="uniqueIssueMessages.length || timeError" class="task-settlement-errors" role="alert" aria-live="assertive">
            <strong>请检查后再保存</strong>
            <ul>
              <li v-for="message in uniqueIssueMessages" :key="message">{{ message }}</li>
              <li v-if="timeError">{{ timeError }}</li>
            </ul>
          </div>
        </div>

        <footer class="task-settlement-footer">
          <button class="settlement-button secondary" type="button" @click="requestCancel">取消</button>
          <template v-if="isProgress">
            <button class="settlement-button progress" type="submit">仅记录本次</button>
            <button class="settlement-button primary" type="button" @click="submit(true)">记录本次并完成</button>
          </template>
          <button v-else class="settlement-button primary" type="submit">{{ reuseExisting ? "沿用记录并完成" : "完成并记账" }}</button>
        </footer>
      </form>
    </div>
  </Teleport>
</template>

<style scoped>
.task-settlement-backdrop {
  position: fixed;
  inset: 0;
  z-index: 140;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(7, 22, 29, .68);
  backdrop-filter: blur(5px);
}

.task-settlement-dialog {
  position: relative;
  width: min(640px, 100%);
  max-height: min(880px, calc(100dvh - 40px));
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  border: 1px solid var(--radar-line);
  border-radius: 18px;
  color: var(--radar-ink);
  background: #f6f8f8;
  box-shadow: 0 28px 80px rgba(0, 0, 0, .34);
}

.task-settlement-header {
  min-height: 88px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 15px 18px;
  border-bottom: 1px solid var(--radar-line);
  background: #ffffff;
}

.task-settlement-header > div { min-width: 0; }
.task-settlement-header p {
  color: var(--radar-cyan-strong);
  font-size: 11px;
  font-weight: 850;
  letter-spacing: .08em;
}
.task-settlement-header h2 {
  margin-top: 1px;
  font-size: 22px;
  line-height: 1.22;
  letter-spacing: -.025em;
}
.task-settlement-header span {
  display: block;
  margin-top: 3px;
  color: var(--radar-muted);
  font-size: 12px;
  font-weight: 700;
}

.task-settlement-close {
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border: 1px solid var(--radar-line);
  border-radius: 50%;
  color: var(--radar-muted);
  background: #ffffff;
}
.task-settlement-close:hover { color: var(--radar-ink); background: var(--radar-surface-2); }
.task-settlement-close :deep(svg) { width: 19px; height: 19px; }

.task-settlement-body {
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 14px;
  -webkit-overflow-scrolling: touch;
}

.task-settlement-guidance {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 9px;
  margin: 0 0 12px;
  padding: 11px 12px;
  border: 1px solid color-mix(in srgb, var(--radar-cyan) 30%, var(--radar-line));
  border-radius: 11px;
  color: var(--radar-cyan-strong);
  background: color-mix(in srgb, var(--radar-cyan-soft) 72%, #ffffff);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.5;
}
.task-settlement-guidance :deep(svg) { width: 19px; height: 19px; margin-top: 1px; }

.task-existing-settlement {
  overflow: hidden;
  margin-bottom: 12px;
  border: 1px solid color-mix(in srgb, var(--radar-cyan) 35%, var(--radar-line));
  border-radius: 13px;
  background: #ffffff;
}
.task-existing-settlement > header {
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 13px;
  border-bottom: 1px solid var(--radar-line);
  background: var(--radar-cyan-soft);
}
.task-existing-settlement > header p { color: var(--radar-cyan-strong); font-size: 10px; font-weight: 800; }
.task-existing-settlement > header h3 { margin-top: 1px; font-size: 16px; }
.task-existing-settlement > header > strong { max-width: 54%; color: var(--radar-cyan-strong); font-size: 11px; line-height: 1.4; text-align: right; }
.task-existing-settlement > label {
  min-height: 58px;
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 8px 13px;
  border-bottom: 1px solid var(--radar-line);
}
.task-existing-settlement > label:last-child { border-bottom: 0; }
.task-existing-settlement > label:has(input:checked) { background: color-mix(in srgb, var(--radar-cyan-soft) 55%, #ffffff); }
.task-existing-settlement input { width: 22px; height: 22px; accent-color: var(--radar-cyan); }
.task-existing-settlement label > span { display: grid; gap: 1px; }
.task-existing-settlement label b { font-size: 13px; }
.task-existing-settlement label small { color: var(--radar-muted); font-size: 11px; line-height: 1.35; }

.task-settlement-section {
  overflow: hidden;
  border: 1px solid var(--radar-line);
  border-radius: 13px;
  background: #ffffff;
}
.task-settlement-section + .task-settlement-section { margin-top: 12px; }
.task-settlement-section > header {
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 13px;
  border-bottom: 1px solid var(--radar-line);
  background: var(--radar-surface-2);
}
.task-settlement-section > header p {
  color: var(--radar-muted);
  font-size: 10px;
  font-weight: 800;
}
.task-settlement-section > header h3 { margin-top: 1px; font-size: 16px; }
.task-settlement-section > header > strong {
  max-width: 58%;
  color: var(--radar-cyan-strong);
  font-size: 11px;
  line-height: 1.45;
  text-align: right;
}

.task-settlement-field {
  display: grid;
  gap: 6px;
  padding: 12px 13px;
}
.task-settlement-field + .task-settlement-field { border-top: 1px solid var(--radar-line); }
.task-settlement-field > span {
  color: var(--radar-ink);
  font-size: 12px;
  font-weight: 800;
}
.task-settlement-field small {
  color: var(--radar-muted);
  font-size: 11px;
  line-height: 1.4;
}
.task-settlement-field input,
.task-settlement-field textarea {
  width: 100%;
  min-height: 48px;
  padding: 10px 12px;
  border: 1px solid var(--radar-line-strong);
  border-radius: 9px;
  color: var(--radar-ink);
  background: #ffffff;
  font: inherit;
  font-size: 16px;
  line-height: 1.35;
}
.task-settlement-field textarea {
  min-height: 70px;
  resize: vertical;
}
.task-settlement-field input[readonly] {
  color: var(--radar-cyan-strong);
  background: var(--radar-cyan-soft);
  font-weight: 850;
}
.task-settlement-field :is(input, textarea):focus {
  border-color: var(--radar-cyan);
  outline: 3px solid color-mix(in srgb, var(--radar-cyan) 20%, transparent);
}
.task-settlement-field :is(input, textarea)[aria-invalid="true"] {
  border-color: var(--radar-danger);
  outline-color: color-mix(in srgb, var(--radar-danger) 20%, transparent);
}

.task-egg-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.task-egg-fields > label:nth-child(2) { border-top: 0; border-left: 1px solid var(--radar-line); }
.task-egg-total {
  grid-column: 1 / -1;
  margin: 0;
  padding: 9px 13px;
  border-top: 1px solid var(--radar-line);
  color: var(--radar-muted);
  background: #fafbfb;
  font-size: 12px;
  font-weight: 750;
  text-align: center;
}
.task-egg-total b { color: var(--radar-success); font-size: 15px; }
.task-egg-total.invalid { color: var(--radar-danger); background: #fff4f3; }
.task-egg-total.invalid b { color: var(--radar-danger); }
.task-extra-silver { grid-column: 1 / -1; border-top: 1px solid var(--radar-line); }

.task-actual-silver > .task-settlement-field { padding-bottom: 10px; }
.task-zero-confirm {
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 13px 12px;
  padding: 8px 10px;
  border: 1px solid #e3c17d;
  border-radius: 9px;
  color: #7a4a00;
  background: #fff8e8;
  font-size: 13px;
  font-weight: 750;
}
.task-zero-confirm input {
  flex: 0 0 22px;
  width: 22px;
  height: 22px;
  accent-color: var(--radar-cyan);
}
.task-progress-total {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0;
  padding: 10px 13px;
  border-top: 1px solid var(--radar-line);
  color: var(--radar-muted);
  background: #fafbfb;
  font-size: 12px;
}
.task-progress-total b { color: var(--radar-ink); }
.task-progress-total strong { color: #9a5a00; }

.task-settlement-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.task-settlement-meta > header { grid-column: 1 / -1; }
.task-settlement-meta > label + label { border-top: 0; border-left: 1px solid var(--radar-line); }

.task-settlement-errors {
  margin-top: 12px;
  padding: 11px 13px;
  border: 1px solid color-mix(in srgb, var(--radar-danger) 45%, var(--radar-line));
  border-radius: 10px;
  color: var(--radar-danger);
  background: #fff5f4;
  font-size: 12px;
}
.task-settlement-errors strong { display: block; margin-bottom: 4px; }
.task-settlement-errors ul { margin: 0; padding-left: 18px; line-height: 1.55; }

.task-settlement-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 14px max(12px, env(safe-area-inset-bottom));
  border-top: 1px solid var(--radar-line);
  background: #ffffff;
}
.settlement-button {
  min-width: 112px;
  min-height: 48px;
  padding: 0 15px;
  border: 1px solid var(--radar-line-strong);
  border-radius: 10px;
  color: var(--radar-ink);
  background: #ffffff;
  font: inherit;
  font-size: 14px;
  font-weight: 850;
  touch-action: manipulation;
}
.settlement-button:hover { background: var(--radar-surface-2); }
.settlement-button.progress {
  border-color: var(--radar-cyan);
  color: var(--radar-cyan-strong);
  background: var(--radar-cyan-soft);
}
.settlement-button.primary {
  border-color: #9e4707;
  color: #ffffff;
  background: var(--brand-orange);
}
.settlement-button.primary:hover { filter: brightness(.96); }

@media (max-width: 720px) {
  .task-settlement-backdrop {
    align-items: end;
    padding: max(8px, env(safe-area-inset-top)) 0 0;
    background: rgba(7, 22, 29, .6);
  }
  .task-settlement-dialog {
    width: 100%;
    max-height: calc(100dvh - max(8px, env(safe-area-inset-top)));
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
    border-radius: 20px 20px 0 0;
  }
  .task-settlement-dialog::before {
    position: absolute;
    top: 7px;
    left: 50%;
    width: 38px;
    height: 4px;
    border-radius: 999px;
    background: #c7d0ce;
    content: "";
    transform: translateX(-50%);
  }
  .task-settlement-header {
    min-height: 82px;
    padding: 18px 14px 11px;
  }
  .task-settlement-header h2 { font-size: 21px; }
  .task-settlement-body { padding: 11px 12px 14px; }
  .task-settlement-section > header {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }
  .task-settlement-section > header > strong {
    max-width: none;
    text-align: left;
  }
  .task-existing-settlement > header {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }
  .task-existing-settlement > header > strong {
    max-width: none;
    text-align: left;
  }
  .task-settlement-meta { grid-template-columns: 1fr; }
  .task-settlement-meta > header { grid-column: 1; }
  .task-settlement-meta > label + label { border-top: 1px solid var(--radar-line); border-left: 0; }
  .task-settlement-footer {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 10px 12px max(12px, env(safe-area-inset-bottom));
  }
  .settlement-button { min-width: 0; min-height: 50px; padding-inline: 9px; }
  .task-settlement-footer > .primary:nth-child(3) { grid-column: 1 / -1; }
}

@media (max-width: 440px) {
  .task-settlement-body { padding-inline: 10px; }
  .task-egg-fields { grid-template-columns: 1fr; }
  .task-egg-fields > label:nth-child(2) { border-top: 1px solid var(--radar-line); border-left: 0; }
  .task-progress-total { flex-wrap: wrap; }
  .task-settlement-footer { gap: 7px; }
  .settlement-button { font-size: 13px; }
}

@media (prefers-reduced-motion: reduce) {
  .task-settlement-backdrop { backdrop-filter: none; }
}
</style>
