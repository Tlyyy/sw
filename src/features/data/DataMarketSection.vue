<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useCatalogStore } from "../../stores/catalog";
import { useSettingsStore } from "../../stores/settings";
import { marketItems } from "../../domain/gems";
import { buildGemPriceTrend } from "../../domain/gemPriceHistory";
import GemMarketUploader from "./GemMarketUploader.vue";
import GemPriceTrendChart from "./GemPriceTrendChart.vue";

const catalog = useCatalogStore();
const settings = useSettingsStore();
const recordNotice = ref("");
const priceDrafts = reactive<Record<string, string>>({});

const market = computed(() => marketItems(catalog.data, settings.gemPriceOverrides));
const baseMarketSnapshot = computed(() => catalog.data.gemMarketSnapshots.at(-1)!);
const marketNames = computed(() => baseMarketSnapshot.value.items.map((item) => item.name));
const priceTrend = computed(() => buildGemPriceTrend(baseMarketSnapshot.value, settings.gemPriceHistory));

function applyRecognizedPrices(prices: Array<{ name: string; price: number }>) {
  const recorded = settings.recordGemPrices("screenshot", prices);
  if (recorded) {
    prices.forEach((item) => settings.setGemPrice(item.name, item.price));
    Object.keys(priceDrafts).forEach((name) => delete priceDrafts[name]);
  }
  recordNotice.value = recorded ? "截图价格已应用并记入行情历史" : "应用失败：请确认六项价格均为大于 0 的有效数字";
}

function recordCurrentPrices() {
  const candidate = market.value.map(({ name, price }) => ({ name, price: priceDrafts[name] === undefined ? price : Number(priceDrafts[name]) }));
  const recorded = settings.recordGemPrices("manual", candidate);
  if (recorded) {
    candidate.forEach((item) => settings.setGemPrice(item.name, item.price));
    Object.keys(priceDrafts).forEach((name) => delete priceDrafts[name]);
  }
  recordNotice.value = recorded ? "当前六项价格已记录" : "记录失败：六项价格必须都是大于 0 的有效数字";
}

function resetGemPrices() {
  settings.resetGemPrices();
  Object.keys(priceDrafts).forEach((name) => delete priceDrafts[name]);
  recordNotice.value = "已恢复六项截图基准价";
}

function formatHistoryTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function confirmReset(message: string, action: () => void) {
  if (confirm(message)) action();
}
</script>

<template>
  <section class="page-intro">
    <div><h2>宝石行情维护</h2><p>上传、识别、校正和手动改价只在这里进行，计划页面只读取结果。</p></div>
    <button class="button" @click="confirmReset('确认恢复六项宝石的截图基准价？', resetGemPrices)">恢复截图价</button>
  </section>
  <GemMarketUploader :items="market" @apply="applyRecognizedPrices" />
  <section class="data-maintenance-section">
    <div class="section-head"><div><h2>当前生效价格</h2><p>{{ catalog.data.gemMarketSnapshots.at(-1)?.sourceDate }} · 银币/颗</p></div><div class="market-record-actions"><span v-if="recordNotice" aria-live="polite">{{ recordNotice }}</span><strong>{{ market.filter((item) => item.edited).length }} 项覆盖</strong><button class="button" type="button" @click="recordCurrentPrices">记录当前价格</button></div></div>
    <div class="data-maintenance-table market-maintenance">
      <div class="table-head"><span>宝石</span><span>截图基准</span><span>当前价格</span><span>状态</span></div>
      <label v-for="item in market" :key="item.name">
        <strong>{{ item.name }}</strong>
        <span>{{ item.basePrice }}</span>
        <input type="number" min="1" step="1" :value="priceDrafts[item.name] ?? item.price" :aria-label="`${item.name}当前价格`" @input="priceDrafts[item.name] = ($event.target as HTMLInputElement).value" />
        <em :class="{ edited: item.edited }">{{ item.edited ? "已覆盖" : "截图价" }}</em>
      </label>
    </div>
  </section>
  <section class="gem-trend-section">
    <div class="section-head">
      <div><h2>宝石价格趋势</h2><p>每次确认截图会自动记录；手动修改后可主动记录一条快照。</p></div>
      <strong>{{ settings.gemPriceHistory.length }} 条历史记录</strong>
    </div>
    <GemPriceTrendChart :points="priceTrend" :names="marketNames" />
    <p v-if="priceTrend.length === 1" class="trend-empty-note">记录第二次行情后，这里会形成可比较的价格曲线。</p>
    <div class="gem-history-table" aria-label="宝石行情历史记录">
      <div class="table-head"><span>记录时间</span><span>来源</span><span v-for="name in marketNames" :key="name">{{ name }}</span><span>操作</span></div>
      <div v-for="point in [...priceTrend].reverse()" :key="point.id" class="gem-history-row">
        <strong>{{ point.source === "baseline" ? baseMarketSnapshot.sourceDate : formatHistoryTime(point.capturedAt) }}</strong>
        <em :class="`source-${point.source}`">{{ point.source === "baseline" ? "截图基准" : point.source === "screenshot" ? "截图识别" : "手动记录" }}</em>
        <span v-for="name in marketNames" :key="name">{{ point.items.find((item) => item.name === name)?.price ?? "—" }}</span>
        <button v-if="point.source !== 'baseline'" type="button" class="text-button danger-text" :aria-label="`删除${formatHistoryTime(point.capturedAt)}行情记录`" @click="settings.removeGemPriceHistory(point.id)">删除</button>
        <span v-else>—</span>
      </div>
    </div>
  </section>
</template>
