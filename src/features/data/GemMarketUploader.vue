<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { recognizeGemMarketScreenshot, type GemMarketOcrResult } from "./gemMarketOcr";

interface MarketItem {
  name: string;
  price: number;
}

const props = defineProps<{ items: MarketItem[] }>();
const emit = defineEmits<{ apply: [prices: Array<{ name: string; price: number }>] }>();

const fileInput = ref<HTMLInputElement>();
const previewUrl = ref("");
const fileName = ref("");
const dragging = ref(false);
const running = ref(false);
const progress = ref(0);
const progressLabel = ref("");
const error = ref("");
const applied = ref(false);
const rows = ref<GemMarketOcrResult[]>([]);
const inputSource = ref<"file" | "paste">("file");

const allValid = computed(() => rows.value.length === 6 && rows.value.every((item) => Number(item.price) > 0));
const lowCount = computed(() => rows.value.filter((item) => item.level === "low").length);
const engineDegraded = computed(() => rows.value.length > 0 && rows.value.every((item) => item.engine === "template"));
const engineLabel = computed(() => engineDegraded.value ? "强力模型未启用 · 兼容识别" : "PP-OCRv6 强力识别");

function clearPreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = "";
}

async function readFile(file?: File, source: "file" | "paste" = "file") {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    error.value = "请选择 PNG、JPG 或 WebP 图片。";
    return;
  }

  clearPreview();
  previewUrl.value = URL.createObjectURL(file);
  inputSource.value = source;
  fileName.value = source === "paste" ? `剪贴板图片 · ${file.name || "image"}` : file.name;
  rows.value = [];
  error.value = "";
  applied.value = false;
  running.value = true;
  progress.value = 0;
  progressLabel.value = "正在读取截图";

  try {
    rows.value = await recognizeGemMarketScreenshot(file, (state) => {
      progress.value = Math.round(state.progress * 100);
      progressLabel.value = state.label;
    });
  } catch (cause) {
    console.error(cause);
    error.value = cause instanceof Error ? cause.message : "识别失败，请确认截图只包含表头和六行宝石价格。";
  } finally {
    running.value = false;
  }
}

function chooseFile() {
  if (!running.value) fileInput.value?.click();
}

function onInput(event: Event) {
  const target = event.target as HTMLInputElement;
  void readFile(target.files?.[0]);
  target.value = "";
}

function onDrop(event: DragEvent) {
  dragging.value = false;
  void readFile(event.dataTransfer?.files?.[0]);
}

function onPaste(event: ClipboardEvent) {
  if (running.value) return;
  const itemFile = Array.from(event.clipboardData?.items || [])
    .find((item) => item.kind === "file" && item.type.startsWith("image/"))
    ?.getAsFile();
  const file = itemFile || Array.from(event.clipboardData?.files || []).find((candidate) => candidate.type.startsWith("image/"));
  if (!file) return;
  event.preventDefault();
  void readFile(file, "paste");
}

function applyPrices() {
  if (!allValid.value) return;
  emit("apply", rows.value.map((item) => ({ name: item.name, price: Number(item.price) })));
  applied.value = true;
}

onMounted(() => window.addEventListener("paste", onPaste));
onBeforeUnmount(() => {
  window.removeEventListener("paste", onPaste);
  clearPreview();
});
</script>

<template>
  <section class="gem-ocr-panel">
    <header class="gem-ocr-head">
      <div>
        <h2>从行情截图更新价格</h2>
        <p>截图只在当前浏览器中处理。请上传包含表头和六行价格的完整行情表。</p>
      </div>
      <span class="local-processing">PP-OCRv6 · 截图不上传</span>
    </header>

    <div class="gem-ocr-workspace">
      <button
        class="gem-dropzone"
        :class="{ dragging, populated: previewUrl }"
        type="button"
        :disabled="running"
        @click="chooseFile"
        @dragenter.prevent="dragging = true"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="onInput" />
        <img v-if="previewUrl" :src="previewUrl" alt="待识别的宝石行情截图" />
        <span v-else class="dropzone-mark">OCR</span>
        <span>
          <strong>{{ fileName || "拖入、点击或直接粘贴截图" }}</strong>
          <small>{{ previewUrl ? (inputSource === "paste" ? "已从剪贴板读取 · 点击可重新选择" : "点击可重新选择") : "Ctrl / Cmd + V · PNG / JPG / WebP" }}</small>
        </span>
      </button>

      <div class="gem-ocr-status" aria-live="polite">
        <template v-if="running">
          <div class="ocr-progress"><i :style="{ width: `${progress}%` }"></i></div>
          <strong>{{ progressLabel }}</strong>
          <span>{{ progress }}%</span>
          <small>模型只在当前浏览器运行，不会发送截图。首次使用需要加载约 60 MB。</small>
        </template>
        <template v-else-if="error">
          <strong class="error-text">识别未完成</strong>
          <p>{{ error }}</p>
          <button class="button" type="button" @click="chooseFile">重新选择</button>
        </template>
        <template v-else-if="rows.length">
          <strong>已识别 {{ rows.length }} 项价格</strong>
          <span :class="{ 'warning-text': lowCount || engineDegraded }">{{ engineLabel }} · {{ lowCount ? `${lowCount} 项需要重点核对` : "结果清晰" }}</span>
          <small>确认前可以直接修改任何数字。</small>
        </template>
        <template v-else>
          <strong>识别后不会立即覆盖</strong>
          <span>核对六项结果，再统一应用。</span>
          <small>保留表头和六行即可，缩放、留边和轻度压缩会自动适配。</small>
        </template>
      </div>
    </div>

    <div v-if="rows.length" class="gem-ocr-results">
      <div class="gem-result-head"><span>宝石</span><span>当前价格</span><span>识别价格</span><span>可信度</span></div>
      <label v-for="row in rows" :key="row.name" class="gem-result-row" :class="`confidence-${row.level}`">
        <strong>{{ row.name }}</strong>
        <span>{{ props.items.find((item) => item.name === row.name)?.price ?? "—" }}</span>
        <input v-model.number="row.price" type="number" min="1" max="999999" inputmode="numeric" :aria-label="`${row.name}识别价格`" />
        <span class="confidence-label">{{ row.price ? `${row.confidence}%` : "未识别" }}</span>
      </label>
      <footer>
        <p v-if="lowCount">黄色或红色项目请对照原图检查，系统不会自动替你确认。</p>
        <p v-else>六项价格均已识别，仍建议快速对照一次原图。</p>
        <button class="button primary" type="button" :disabled="!allValid" @click="applyPrices">
          {{ applied ? "已应用到全部计划" : "确认并应用六项价格" }}
        </button>
      </footer>
    </div>
  </section>
</template>
