<script setup lang="ts">
import { Icon } from '@iconify/vue/offline'
import { computed, ref, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import { useLocale, useT } from '../composables/useLocale'
import { useFlashSuccess } from '../composables/useFlashSuccess'
import type { UserType } from '../../routes/auth/common'

const locale = useLocale()
const t = useT()
const { message: flashSuccess, visible: flashVisible, dismiss: dismissFlash } = useFlashSuccess()

const page = usePage<{ authUser?: UserType | null }>()
const authUser = computed(() => page.props.authUser ?? null)

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
          <span v-if="authUser" class="user">
            <img v-if="authUser.avatar_url" :src="authUser.avatar_url" alt="" class="user-avatar" :title="(authUser.name || t('Avatar'))" />
            <a href="/auth/login" class="btn btn-default logout">➜] {{ t('Log out') }}</a>
          </span>
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
/* Skip link for accessibility - WCAG 2.4.1 Bypass Blocks. Lives here because
   the <a class="skip-link"> element is part of this layout. The id selector
   beats `.retro a { background-color: transparent }` from bootstrap. */
#skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px 16px;
  z-index: 10000;
  text-decoration: none;
  font-weight: bold;
  font-size: 14px;
  transition: top 0.2s ease-in-out
}

#skip-link:focus {
  top: 0;
  outline: 2px solid #fff;
  outline-offset: 2px
}

.logo {
  width: 50px;
  float: left;
  margin-right: 15px;
}

.branding .user {
  float:right;
}

.user-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  vertical-align: middle;
  margin-right: 5px;
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
