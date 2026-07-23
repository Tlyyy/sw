<script setup lang="ts">
import { ref } from "vue";
import { appMark, appName } from "../app/brand";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const password = ref("");
const remember = ref(false);
async function submit() { if (await auth.login(password.value, remember.value)) password.value = ""; }
</script>

<template>
  <slot v-if="auth.isUnlocked" />
  <main v-else class="auth-screen">
    <div v-if="auth.restoring" class="auth-dialog auth-restoring" role="status">
      <div class="auth-brand"><span>{{ appMark }}</span><div><h1>{{ appName }}</h1><p>正在恢复云同步解锁密钥…</p></div></div>
    </div>
    <form v-else class="auth-dialog" @submit.prevent="submit">
      <div class="auth-brand"><span>{{ appMark }}</span><div><h1>{{ appName }}</h1><p>五账号进展与记录</p></div></div>
      <label class="field"><span>访问密码</span><input v-model="password" type="password" autocomplete="current-password" autofocus required /></label>
      <label class="check"><input v-model="remember" type="checkbox" /> 在本机记住云同步密钥 7 天</label>
      <p class="auth-network-note">首次登录或主动退出后需要联网验证；已记住密钥的设备可以离线恢复。</p>
      <p v-if="auth.error" class="form-error">{{ auth.error }}</p>
      <p v-if="auth.warning" class="form-warning">{{ auth.warning }}</p>
      <button class="button primary full" :disabled="auth.busy">{{ auth.busy ? "正在安全解锁…" : "继续" }}</button>
    </form>
  </main>
</template>
