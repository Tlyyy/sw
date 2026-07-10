<script setup lang="ts">
import type { PetView } from "../domain/types";
defineProps<{ pet: PetView; selected?: boolean; selectable?: boolean; checked?: boolean }>();
defineEmits<{ select: [id: string]; toggle: [id: string] }>();
</script>
<template>
  <article class="pet-row" :class="{ selected, selectable }" @click="$emit('select', pet.id)">
    <label v-if="selectable" class="row-check" @click.stop><input type="checkbox" :checked="checked" @change="$emit('toggle', pet.id)" /></label>
    <div class="account-code">{{ pet.accountId }}</div>
    <div class="pet-identity"><strong>{{ pet.name }}</strong><span>{{ pet.role.primary }} · {{ pet.skillCount }} 技能</span></div>
    <div class="pet-tags"><span v-for="tag in pet.role.tags.slice(0, 3)" :key="tag" :class="pet.role.tone">{{ tag }}</span></div>
    <div class="metric"><span>攻</span><b>{{ pet.attack || "-" }}</b></div>
    <div class="metric"><span>速</span><b>{{ pet.speed || "-" }}</b></div>
    <div class="metric"><span>灵</span><b>{{ pet.spirit || "-" }}</b></div>
    <div class="metric"><span>血</span><b>{{ pet.hp || "-" }}</b></div>
    <div class="row-status" :class="pet.recognitionStatus">{{ pet.recognitionStatus === "confirmed" ? "已确认" : "待确认" }}</div>
  </article>
</template>
