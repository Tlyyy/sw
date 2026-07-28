<script setup lang="ts">
import DataCenterNav from "../../../features/data/DataCenterNav.vue";
import GemMarketUploader from "../../../features/data/GemMarketUploader.vue";
import GemPriceTrendChart from "../../../features/data/GemPriceTrendChart.vue";
import { useDataMarketPage } from "../../../features/data/useDataMarketPage";

const page = useDataMarketPage();
</script>

<template>
  <div class="page-wrap data-center-page desktop-data-market-page" data-platform-page="desktop">
    <DataCenterNav />
    <section class="page-intro"><div><p>PC 行情工作台</p><h2>宝石行情维护</h2><span>上传识别、六项并行校正、记录与趋势核对集中在一个宽屏工作区。</span></div><button class="button" @click="page.confirmReset">恢复截图价</button></section>
    <GemMarketUploader :items="page.market.value" @apply="page.applyRecognizedPrices" />
    <section class="data-maintenance-section">
      <div class="section-head"><div><h2>当前生效价格</h2><p>{{ page.catalog.data.gemMarketSnapshots.at(-1)?.sourceDate }} · 银币/颗</p></div><div class="market-record-actions"><span v-if="page.recordNotice.value" aria-live="polite">{{ page.recordNotice.value }}</span><strong>{{ page.market.value.filter((item) => item.edited).length }} 项覆盖</strong><button class="button" type="button" @click="page.recordCurrentPrices">记录当前价格</button></div></div>
      <div class="data-maintenance-table market-maintenance"><div class="table-head"><span>宝石</span><span>截图基准</span><span>当前价格</span><span>状态</span></div><label v-for="item in page.market.value" :key="item.name"><strong>{{ item.name }}</strong><span>{{ item.basePrice }}</span><input type="number" min="1" step="1" :value="page.draft.marketPriceDrafts[item.name] ?? item.price" :aria-label="`${item.name}当前价格`" @input="page.draft.marketPriceDrafts[item.name]=($event.target as HTMLInputElement).value"><em :class="{ edited: item.edited }">{{ item.edited ? "已覆盖" : "截图价" }}</em></label></div>
    </section>
    <section class="gem-trend-section">
      <div class="section-head"><div><h2>宝石价格趋势</h2><p>每次确认截图会自动记录；手动修改后可主动记录一条快照。</p></div><strong>{{ page.settings.gemPriceHistory.length }} 条历史记录</strong></div>
      <GemPriceTrendChart :points="page.priceTrend.value" :names="page.marketNames.value" />
      <p v-if="page.priceTrend.value.length === 1" class="trend-empty-note">记录第二次行情后，这里会形成可比较的价格曲线。</p>
      <div class="gem-history-table" aria-label="宝石行情历史记录"><div class="table-head"><span>记录时间</span><span>来源</span><span v-for="name in page.marketNames.value" :key="name">{{ name }}</span><span>操作</span></div><div v-for="point in [...page.priceTrend.value].reverse()" :key="point.id" class="gem-history-row"><strong>{{ point.source === "baseline" ? page.baseMarketSnapshot.value.sourceDate : page.formatHistoryTime(point.capturedAt) }}</strong><em :class="`source-${point.source}`">{{ point.source === "baseline" ? "截图基准" : point.source === "screenshot" ? "截图识别" : "手动记录" }}</em><span v-for="name in page.marketNames.value" :key="name">{{ point.items.find((item) => item.name === name)?.price ?? "—" }}</span><button v-if="point.source !== 'baseline'" type="button" class="text-button danger-text" :aria-label="`删除${page.formatHistoryTime(point.capturedAt)}行情记录`" @click="page.settings.removeGemPriceHistory(point.id)">删除</button><span v-else>—</span></div></div>
    </section>
  </div>
</template>

<style scoped>
.desktop-data-market-page{padding-top:10px;padding-bottom:56px}.desktop-data-market-page>.page-intro p{color:var(--color-accent-strong);font-size:11px;font-weight:850}.desktop-data-market-page>.page-intro span{color:var(--color-text-muted);font-size:12px}
</style>
