<script setup lang="ts">
import { useCatalogStore } from "../../stores/catalog";
import { useInventoryStore } from "../../stores/inventory";
import { useSettingsStore } from "../../stores/settings";

const catalog = useCatalogStore();
const inventory = useInventoryStore();
const settings = useSettingsStore();

inventory.hydrate();

function resetAllBusinessData() {
  settings.resetAllPlanningData();
  inventory.clear();
}

function confirmReset(message: string, action: () => void) {
  if (confirm(message)) action();
}
</script>

<template>
  <section class="page-intro"><div><h2>数据来源与状态</h2><p>静态事实保持只读；这里只管理来源说明、覆盖状态和业务数据重置。</p></div><RouterLink class="button" to="/assets/evidence">查看全部截图证据</RouterLink></section>
  <section class="settings-section">
    <div class="section-head"><div><h2>数据基线</h2><p>目录经过 Schema 校验，业务页面不能直接修改。</p></div><span>v{{ catalog.data.version }}</span></div>
    <div class="data-ledger"><div><strong>{{ catalog.data.accounts.length }}</strong><span>账号</span></div><div><strong>{{ catalog.pets.length }}</strong><span>宠物资产</span></div><div><strong>{{ catalog.data.evidence.filter((item) => item.kind === 'pet').length }}</strong><span>宠物截图</span></div><div><strong>{{ catalog.data.equipment.length }}</strong><span>装备</span></div><div><strong>{{ catalog.data.skills.length }}</strong><span>技能</span></div><div><strong>{{ catalog.data.evidence.length }}</strong><span>全部证据</span></div></div>
  </section>
  <section class="settings-section source-layers"><div class="section-head"><div><h2>资料分层</h2><p>证据、事实、维护记录和计算结果各自只承担一种职责。</p></div></div><article><b>1</b><div><strong>原始截图</strong><p>只读证据，不直接参与页面状态写入。</p></div></article><article><b>2</b><div><strong>校验目录</strong><p>宠物、装备、技能、宝石规则和默认行情。</p></div></article><article><b>3</b><div><strong>本地记录</strong><p>五号库存快照、宝石价格、辅助参数与任务状态。</p></div></article><article><b>4</b><div><strong>业务计算</strong><p>神兽缺口、库存变化、计划、推荐和发布内容从前三层派生。</p></div></article></section>
  <section class="danger-zone"><div><h2>重置全部业务维护数据</h2><p>删除库存快照，恢复宝石行情、辅助参数和任务状态；宠物、装备、截图和界面偏好不会删除。</p></div><button class="button danger" @click="confirmReset('确认重置全部业务维护数据并删除库存快照？此操作不会删除原始资料。', resetAllBusinessData)">重置业务数据</button></section>
</template>
