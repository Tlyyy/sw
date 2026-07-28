<script setup lang="ts">
import DataCenterNav from "../../../features/data/DataCenterNav.vue";
import GemMarketUploader from "../../../features/data/GemMarketUploader.vue";
import GemPriceTrendChart from "../../../features/data/GemPriceTrendChart.vue";
import { useDataMarketPage } from "../../../features/data/useDataMarketPage";

const page = useDataMarketPage();
</script>

<template>
  <div class="page-wrap data-center-page mobile-data-market-page" data-platform-page="mobile">
    <DataCenterNav />
    <header><div><small>数据中心</small><h1>宝石行情</h1><p>拍照识别或逐项校正六种宝石价格。</p></div><button type="button" @click="page.confirmReset">恢复截图价</button></header>
    <GemMarketUploader :items="page.market.value" @apply="page.applyRecognizedPrices" />
    <section class="mobile-market-card">
      <div class="mobile-section-title"><div><h2>当前生效价格</h2><p>{{ page.catalog.data.gemMarketSnapshots.at(-1)?.sourceDate }} · 银币/颗</p></div><b>{{ page.market.value.filter((item) => item.edited).length }} 项覆盖</b></div>
      <div class="market-maintenance"><label v-for="item in page.market.value" :key="item.name"><span><strong>{{ item.name }}</strong><small>基准 {{ item.basePrice }}</small></span><input type="number" min="1" step="1" :value="page.draft.marketPriceDrafts[item.name] ?? item.price" :aria-label="`${item.name}当前价格`" @input="page.draft.marketPriceDrafts[item.name]=($event.target as HTMLInputElement).value"><em :class="{ edited: item.edited }">{{ item.edited ? "已覆盖" : "截图价" }}</em></label></div>
      <p v-if="page.recordNotice.value" class="mobile-market-notice" aria-live="polite">{{ page.recordNotice.value }}</p>
      <button class="mobile-record-prices" type="button" @click="page.recordCurrentPrices">记录当前价格</button>
    </section>
    <details class="mobile-trend-card">
      <summary><span><strong>价格趋势</strong><small>{{ page.settings.gemPriceHistory.length }} 条历史记录</small></span><b>展开 ›</b></summary>
      <GemPriceTrendChart :points="page.priceTrend.value" :names="page.marketNames.value" />
      <div class="mobile-history-list" aria-label="宝石行情历史记录"><article v-for="point in [...page.priceTrend.value].reverse()" :key="point.id"><header><strong>{{ point.source === "baseline" ? page.baseMarketSnapshot.value.sourceDate : page.formatHistoryTime(point.capturedAt) }}</strong><span>{{ point.source === "baseline" ? "截图基准" : point.source === "screenshot" ? "截图识别" : "手动记录" }}</span></header><p>{{ point.items.map((item)=>`${item.name} ${item.price}`).join(" · ") }}</p><button v-if="point.source !== 'baseline'" type="button" :aria-label="`删除${page.formatHistoryTime(point.capturedAt)}行情记录`" @click="page.settings.removeGemPriceHistory(point.id)">删除</button></article></div>
    </details>
  </div>
</template>

<style scoped>
.mobile-data-market-page{width:100%;padding:6px 12px 112px}.mobile-data-market-page>header{display:flex;align-items:end;justify-content:space-between;padding:12px 2px}.mobile-data-market-page>header small{color:#c44d00;font-size:11px;font-weight:800}.mobile-data-market-page>header h1{font-size:24px}.mobile-data-market-page>header p{color:#697386;font-size:11px}.mobile-data-market-page>header button{min-height:42px;border:0;color:#c44d00;background:transparent}.mobile-market-card,.mobile-trend-card{overflow:hidden;margin-top:10px;border:1px solid rgba(60,60,67,.15);border-radius:12px;background:white}.mobile-section-title{display:flex;align-items:center;justify-content:space-between;padding:12px;border-bottom:1px solid rgba(60,60,67,.1)}.mobile-section-title h2{font-size:16px}.mobile-section-title p,.mobile-section-title b{color:#697386;font-size:11px}.mobile-market-card .market-maintenance{display:grid}.mobile-market-card .market-maintenance label{min-height:58px;display:grid;grid-template-columns:minmax(0,1fr) 112px 58px;align-items:center;gap:7px;padding:8px 12px;border-bottom:1px solid rgba(60,60,67,.1)}.mobile-market-card label>span{display:grid}.mobile-market-card label small,.mobile-market-card label em{color:#8b95a5;font-size:11px}.mobile-market-card input{min-width:0;min-height:42px}.mobile-market-notice{padding:9px 12px;color:#06705f;font-size:11px;background:#eaf8f4}.mobile-record-prices{width:calc(100% - 20px);min-height:46px;margin:10px;border:0;border-radius:9px;color:white;font-weight:750;background:#c44d00}.mobile-trend-card>summary{min-height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;list-style:none}.mobile-trend-card>summary span{display:grid}.mobile-trend-card>summary small,.mobile-trend-card>summary>b{color:#697386;font-size:11px}.mobile-trend-card :deep(.gem-trend-chart){margin:10px}.mobile-history-list article{position:relative;padding:10px 12px;border-top:1px solid rgba(60,60,67,.1)}.mobile-history-list header{display:flex;justify-content:space-between}.mobile-history-list header span,.mobile-history-list p{color:#697386;font-size:11px}.mobile-history-list p{margin-top:5px;line-height:1.5}.mobile-history-list article>button{min-height:36px;margin-top:6px;border:0;color:#bd351f;background:transparent}
</style>
