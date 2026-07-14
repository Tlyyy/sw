<script setup lang="ts">
import { ref } from "vue";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const password = ref("");
const remember = ref(false);
async function submit() { if (await auth.login(password.value, remember.value)) password.value = ""; }
</script>

<template>
  <slot v-if="auth.isUnlocked" />
  <main v-else class="auth-screen">
    <form class="auth-dialog" @submit.prevent="submit">
      <div class="auth-brand"><span>项</span><div><h1>项目台账</h1><p>进度与资源汇总</p></div></div>
      <label class="field"><span>访问密码</span><input v-model="password" type="password" autocomplete="current-password" autofocus required /></label>
      <label class="check"><input v-model="remember" type="checkbox" /> 本机记住 7 天</label>
      <p v-if="auth.error" class="form-error">{{ auth.error }}</p>
      <button class="button primary full" :disabled="auth.busy">{{ auth.busy ? "校验中…" : "继续" }}</button>
    </form>
  </main>
</template>
