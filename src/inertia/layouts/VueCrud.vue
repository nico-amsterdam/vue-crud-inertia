<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref, watch } from 'vue'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import { useLocale, useT } from '../composables/useLocale'
import { useFlashSuccess } from '../composables/useFlashSuccess'

const locale = useLocale()
const t = useT()
const { message: flashSuccess, visible: flashVisible, dismiss: dismissFlash } = useFlashSuccess()

const darkmode = ref(false)

function toggleDark() {
  darkmode.value = !darkmode.value
}

watch(darkmode, (value) => {
  document.body.classList.toggle('dark', value)
}, { immediate: true })
</script>

<template>
  <a href="#main" id="skip-link" class="skip-link">{{ t('Skip to main content') }}</a>
  <div class="container" :class="['lang-' + locale.lang]">
    <header class="page-header">
      <div class="branding">
        <img src="/images/vue-logo.png" alt="Vue logo" class="logo"/>
        <h1>Vue CRUD Inertia</h1>
        <span class="color-scheme">
          <LanguageSwitcher />
          <Icon v-if="!darkmode" aria-hidden="false" role="button" icon="tabler:sun" width="1.5em" :title="t('Toggle dark mode')" class="sun"
            @click="toggleDark" />
          <Icon v-if="darkmode" aria-hidden="false" role="button" icon="tabler:moon" width="1.5em" :title="t('Toggle dark mode')" class="moon"
            @click="toggleDark" />
        </span>
      </div>
    </header>
    <div v-if="flashVisible && flashSuccess" class="flash flash-success" role="status">
      <span>{{ flashSuccess }}</span>
      <button type="button" class="flash-dismiss" :aria-label="t('Dismiss')" @click="dismissFlash">×</button>
    </div>
    <slot />
  </div>
</template>

<style>
.logo {
  width: 50px;
  float: left;
  margin-right: 15px;
}

.branding .user {
  float:right;
}

.logout {
  margin-left: 5px
}

.exit-run {
  margin-right: 10px
}

.page-header h1 {
  display: inline-block
}

.color-scheme {
  margin-left: 30px;
  margin-right: 10px
}

.language-switcher {
  margin-right: 15px;
  vertical-align: middle
}

.flash {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin: 0 0 15px;
  padding: 10px 15px;
  border-radius: 4px
}

.flash-success {
  background-color: #dff0d8;
  color: #3c763d;
  border: 1px solid #d6e9c6
}

body.dark .flash-success {
  background-color: #1e3d2b;
  color: #a3d9a5;
  border-color: #2d5a3d
}

.flash-dismiss {
  background: none;
  border: none;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  color: inherit;
  padding: 0 4px
}
</style>
