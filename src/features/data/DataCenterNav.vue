<template>
  <nav class="subnav data-center-nav" aria-label="数据中心分区">
    <RouterLink to="/data/inventory" aria-label="库存快照"><span class="subnav-label-full">库存快照</span><span class="subnav-label-short" aria-hidden="true">库存</span></RouterLink>
    <RouterLink to="/data/market" aria-label="宝石行情"><span class="subnav-label-full">宝石行情</span><span class="subnav-label-short" aria-hidden="true">宝石价</span></RouterLink>
    <RouterLink to="/data/sources" aria-label="数据来源"><span class="subnav-label-full">数据来源</span><span class="subnav-label-short" aria-hidden="true">来源</span></RouterLink>
    <RouterLink to="/settings" aria-label="本地设置与备份"><span class="subnav-label-full">本地设置与备份</span><span class="subnav-label-short" aria-hidden="true">设置</span></RouterLink>
  </nav>
</template>
