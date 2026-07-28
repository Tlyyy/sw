<script setup lang="ts">
import DataCenterNav from "../../../features/data/DataCenterNav.vue";
import { useSettingsPage } from "../../../features/settings/useSettingsPage";
const page = useSettingsPage();
</script>

<template>
  <div class="page-wrap settings-page mobile-settings-page" data-platform-page="mobile">
    <DataCenterNav />
    <header class="mobile-settings-hero">
      <small>本机与云端</small>
      <h1>界面、同步与备份</h1>
      <p>设置会自动保存，联网时加密同步。</p>
    </header>

    <section class="settings-section cloud-sync-section mobile-sync-card" :class="`is-${page.cloudSync.statusTone}`">
      <header><div><h2>自动云同步</h2><p>{{ page.lastSyncText.value }}</p></div><strong><span class="cloud-sync-dot"></span>{{ page.cloudSync.statusLabel }}</strong></header>
      <p v-if="page.cloudSync.errorMessage" role="alert">{{ page.cloudSync.errorMessage }}</p>
      <p v-else>库存、核算、行情、任务、发布草稿和偏好会使用访问密码加密。</p>
      <div v-if="page.cloudSync.hasConflict"><button class="button" type="button" @click="page.cloudSync.useRemoteVersion">使用云端</button><button class="button" type="button" @click="page.cloudSync.keepLocalVersion">用本机覆盖</button></div>
      <button v-else class="button" type="button" :disabled="page.cloudSync.isBusy" @click="page.cloudSync.retry">{{ page.cloudSync.isBusy ? "同步中…" : "立即检查" }}</button>
    </section>

    <section class="settings-section password-rotation-section mobile-setting-group" :class="{ 'is-required': page.cloudSync.passwordRotationRequired }">
      <header><h2>{{ page.cloudSync.passwordRotationRequired ? "必须更换访问密码" : "更换访问密码" }}</h2></header>
      <p>更换后云端数据会用新密码重新加密，其他设备也必须使用新密码。</p>
      <form class="password-rotation-form" @submit.prevent="page.rotatePassword">
        <label><span>新密码（至少 {{ page.minimumPasswordLength }} 个字符）</span><input v-model="page.nextPassword.value" type="password" autocomplete="new-password" :minlength="page.minimumPasswordLength" required></label>
        <label><span>再次输入新密码</span><input v-model="page.confirmPassword.value" type="password" autocomplete="new-password" :minlength="page.minimumPasswordLength" required></label>
        <button class="button primary" type="submit" :disabled="page.auth.changingPassword || page.cloudSync.status !== 'synced'">更换并重新加密</button>
      </form>
      <p v-if="page.auth.passwordChangeError || page.passwordNotice.value" role="status">{{ page.auth.passwordChangeError || page.passwordNotice.value }}</p>
    </section>

    <section class="settings-section mobile-setting-group">
      <header><h2>外观与默认显示</h2></header>
      <div class="appearance-picker" role="radiogroup" aria-label="外观模式"><button v-for="option in page.appearanceOptions" :key="option.value" type="button" role="radio" :aria-checked="page.appearancePreference.value === option.value" :class="{ active: page.appearancePreference.value === option.value }" @click="page.setAppearancePreference(option.value)">{{ option.label }}</button></div>
      <div class="mobile-setting-fields">
        <label><span>默认账号</span><select v-model="page.ui.recentAccount" aria-label="默认账号"><option v-for="item in page.catalog.data.accounts" :key="item.id" :value="item.id">{{ item.id }}</option></select></label>
        <label><span>对比表密度</span><select v-model="page.ui.matrixDensity" aria-label="对比表密度"><option value="compact">紧凑</option><option value="comfortable">舒展</option></select></label>
      </div>
      <fieldset><legend>宠物对比表</legend><label><input v-model="page.ui.matrixDisplay.stats" type="checkbox">属性</label><label><input v-model="page.ui.matrixDisplay.aptitudes" type="checkbox">资质</label><label><input v-model="page.ui.matrixDisplay.skills" type="checkbox">技能</label></fieldset>
    </section>

    <section class="settings-section mobile-setting-group">
      <header><h2>工作状态与完整备份</h2></header>
      <p>{{ page.publish.selectedIds.length }} 组宠物已加入发布清单；本机有 {{ page.inventory.snapshots.length }} 份库存快照。</p>
      <div class="mobile-backup-actions"><button class="button" @click="page.confirmAction('确认清空发布页已选宠物？', page.publish.clear)">清空发布选择</button><button class="button" type="button" @click="page.exportWorkspace">导出完整 JSON</button><button class="button" type="button" @click="page.backupInput.value?.click()">恢复备份</button><input :ref="page.setBackupInput" hidden type="file" accept="application/json,.json" @change="page.importWorkspace"></div>
      <strong aria-live="polite">{{ page.backupNotice.value }}</strong>
    </section>

    <section class="danger-zone"><div><h2>界面与登录</h2><p>不影响库存、任务和核算数据。</p></div><button class="button" @click="page.confirmAction('确认恢复默认界面偏好？', page.ui.resetPreferences)">恢复界面默认值</button><button class="button" @click="page.auth.logout">退出登录</button></section>
  </div>
</template>

<style scoped>
.mobile-settings-page{width:100%;padding:6px 12px 112px}.mobile-settings-hero{padding:12px 2px}.mobile-settings-hero small{color:#c44d00;font-size:11px;font-weight:850}.mobile-settings-hero h1{font-size:24px}.mobile-settings-hero p{color:#697386;font-size:11px}.mobile-settings-page>.settings-section{margin:0 0 10px;padding:14px;border:1px solid rgba(60,60,67,.15);border-radius:22px;background:#fff}.mobile-settings-page>.settings-section>header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.mobile-settings-page h2{font-size:17px}.mobile-settings-page p{color:#697386;font-size:11px;line-height:1.5}.mobile-sync-card>header strong{font-size:11px}.mobile-sync-card>.button{width:100%;margin-top:10px}.mobile-setting-group{display:grid;gap:10px}.mobile-setting-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px}.mobile-setting-fields label,.password-rotation-form label{display:grid;gap:5px}.mobile-setting-fields span,.password-rotation-form span{font-size:10px;color:#697386}.mobile-settings-page input,.mobile-settings-page select{min-height:50px;font-size:17px}.mobile-settings-page fieldset{display:flex;flex-wrap:wrap;gap:12px;border:0}.mobile-settings-page legend{width:100%;font-size:11px;font-weight:800}.mobile-settings-page fieldset label{display:flex;align-items:center;gap:5px;font-size:12px}.mobile-settings-page fieldset input{min-height:0}.mobile-backup-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.mobile-backup-actions button:first-child{grid-column:1/-1}.mobile-settings-page .button{min-height:50px}
.mobile-setting-fields span,
.password-rotation-form span { font-size: 11px; }
</style>
