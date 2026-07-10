<script setup lang="ts">
import { computed } from "vue";
import type { AccountId, AccountPlan } from "../domain/types";
import { formatCurrency } from "../domain/gems";
import { useCatalogStore } from "../stores/catalog";
import { useUiStore } from "../stores/ui";

const props = defineProps<{ plans: AccountPlan[]; selected?: AccountId; totalFunds?: number }>();
const catalog = useCatalogStore();
const ui = useUiStore();
const order: AccountId[] = ["FC", "LG1", "LG2", "PT", "MYT"];
const tones: Record<AccountId, string> = {
  FC: "#1f5f9f",
  LG1: "#6e48a2",
  LG2: "#c65d05",
  PT: "#bd3828",
  MYT: "#16704f",
};

const rows = computed(() => order.map((accountId) => ({
  accountId,
  plan: props.plans.find((item) => item.accountId === accountId),
  equipmentCount: catalog.data.equipment.filter((item) => item.accountId === accountId).length,
  displaySilver: props.selected === accountId ? (props.totalFunds || 0) : (props.plans.find((item) => item.accountId === accountId)?.gemRequiredSilver || 0),
})));

function selectAccount(accountId: AccountId) {
  ui.accountScope = accountId;
  ui.recentAccount = accountId;
}
</script>

<template>
  <section class="account-deck" aria-label="五账号概览">
    <RouterLink
      v-for="row in rows"
      :key="row.accountId"
      :to="`/accounts/${row.accountId}`"
      class="account-orbit-card"
      :class="{ selected: selected === row.accountId }"
      :style="{ '--account-tone': tones[row.accountId] }"
      @click="selectAccount(row.accountId)"
    >
      <span class="account-seal" aria-hidden="true"><i>{{ row.accountId }}</i></span>
      <span class="account-orbit-copy">
        <strong>{{ row.accountId }}</strong>
        <b>{{ formatCurrency(row.displaySilver) }}</b>
        <small><em>{{ row.equipmentCount }}</em> 件装备</small>
      </span>
      <span class="account-week">第 {{ row.plan?.finishWeek || 0 }} 周</span>
    </RouterLink>
  </section>
</template>
