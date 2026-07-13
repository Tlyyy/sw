<script setup lang="ts">
import type { PetView } from "../domain/types";
const props = defineProps<{ pet: PetView; selected?: boolean; selectable?: boolean; checked?: boolean; actionable?: boolean }>();
const emit = defineEmits<{ select: [id: string]; toggle: [id: string] }>();
</script>
<template>
  <article class="pet-row" :class="{ selected, selectable, actionable }">
    <label v-if="selectable" class="row-check">
      <span class="visually-hidden">选择 {{ pet.accountId }} 的 {{ pet.name }}</span>
      <input type="checkbox" :checked="checked" @change="emit('toggle', pet.id)" />
    </label>
    <component
      :is="actionable ? 'button' : 'div'"
      class="pet-row-content"
      :class="{ 'pet-row-action': actionable }"
      :type="actionable ? 'button' : undefined"
      :aria-label="actionable ? `查看 ${pet.accountId} 的 ${pet.name}` : undefined"
      :aria-current="selected ? 'true' : undefined"
      @click="props.actionable && emit('select', pet.id)"
    >
      <div class="account-code">{{ pet.accountId }}</div>
      <div class="pet-identity"><strong>{{ pet.name }}</strong><span>{{ pet.role.primary }} · {{ pet.skillCount }} 技能</span></div>
      <div class="pet-tags"><span v-for="tag in pet.role.tags.slice(0, 3)" :key="tag" :class="pet.role.tone">{{ tag }}</span></div>
      <div class="metric"><span>攻</span><b>{{ pet.attack || "-" }}</b></div>
      <div class="metric"><span>速</span><b>{{ pet.speed || "-" }}</b></div>
      <div class="metric"><span>灵</span><b>{{ pet.spirit || "-" }}</b></div>
      <div class="metric"><span>血</span><b>{{ pet.hp || "-" }}</b></div>
      <div class="row-status" :class="pet.recognitionStatus">{{ pet.recognitionStatus === "confirmed" ? "已确认" : "待确认" }}</div>
    </component>
  </article>
</template>
