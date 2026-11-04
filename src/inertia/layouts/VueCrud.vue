<script setup lang="ts">
import { Icon } from '@iconify/vue/offline'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { usePage, router } from '@inertiajs/vue3'
import LanguageSwitcher from '@/inertia/components/LanguageSwitcher.vue'
import { useLocale, useT } from '@/inertia/composables/useLocale'
import { useFlashSuccess } from '@/inertia/composables/useFlashSuccess'
import { useAgentPairing } from '@/inertia/composables/useAgentPairing'
import { syncScreen as syncAgentScreen } from '@/inertia/lib/agentApi'
import type { UserType } from '@/routes/auth/common'

/*
 * Variables
 */

const locale = useLocale()
const t = useT()
const { message: flashSuccess, visible: flashVisible, dismiss: dismissFlash } = useFlashSuccess()
const page = usePage<{ authUser?: UserType | null, csrfToken?: string | null, agentEnabled?: boolean }>()
const authUser = computed(() => page.props.authUser ?? null)
// Shared prop comes from server.ts (AGENT_DISABLED=1 -> false). Default true so
// share() payloads that predate the flag keep showing the agent section.
const agentEnabled = computed(() => page.props.agentEnabled !== false)
const darkmode = ref(false)
const networkErrDialog = ref<HTMLDialogElement | null>(null)
const { pairingCode, pairingStage, agentActive, createPairingCode, copyPairingCode, removePairingCode } = useAgentPairing()

/*
 * Functions
 */

function syncScreen() {
  // Only paired sessions may sync: an unpaired browser firing this on every
  // navigation would churn a D1 app_state row nobody reads. `agentActive`
  // flips true inside createPairingCode() (via startAgent), which is awaited
  // before startAgentPairing's explicit syncScreen() below — so the current
  // screen is fresh at the moment the agent can first read it.
  if (!agentEnabled.value || !agentActive.value) return
  const comp = page.component
  const screen = comp.endsWith('/index') ? comp.slice(0, -6) : comp
  // Keep the :id parameter for edit/delete screens so agents can read it back.
  const idMatch = window.location.pathname.match(/\/products\/(\d+)\/(edit|delete)/)
  const params: Record<string, unknown> = idMatch ? { id: Number(idMatch[1]) } : {}
  syncAgentScreen(page.props.csrfToken, screen, params)
}

/*
 * Functions
 */

async function startAgentPairing() {
  await createPairingCode()
  syncScreen()
}

function toggleDark() {
  darkmode.value = !darkmode.value
}

function onNetworkError() {
  networkErrDialog.value?.showModal?.()
}

function closeNetworkError() {
  networkErrDialog.value?.close?.()
}

function onDialogBackdropClick(event: MouseEvent) {
  if (event.target === networkErrDialog.value) {
    closeNetworkError()
  }
}

/*
 * Initialisation
 */

router.on('navigate', syncScreen)
onMounted(() => {
  syncScreen()
  document.addEventListener('inertia:networkError', onNetworkError)
})

onUnmounted(() => {
  document.removeEventListener('inertia:networkError', onNetworkError)
})

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
          <button v-if="!darkmode" type="button" class="dark-mode-toggle" :title="t('Toggle dark mode')" @click="toggleDark">
            <Icon aria-hidden="true" icon="tabler:sun" width="1.5em" class="sun" />
          </button>
          <button v-if="darkmode" type="button" class="dark-mode-toggle" :title="t('Toggle dark mode')" @click="toggleDark">
            <Icon aria-hidden="true" icon="tabler:moon" width="1.5em" class="moon" />
          </button>
          <span v-if="authUser" class="user">
            <img v-if="authUser.avatar_url" :src="authUser.avatar_url" alt="" class="user-avatar" :title="(authUser.name || t('Avatar'))" />
            <a href="/auth/login" class="btn btn-default logout">➜] {{ t('Log out') }}</a>
          </span>
        </span>
        <div v-if="agentEnabled" class="agent-pairing">
          <template v-if="pairingStage === 'idle'">
            <button class="btn btn-default btn-xs" type="button" @click="startAgentPairing">{{ t('Start AI agent pairing') }}</button>
          </template>
          <template v-if="pairingStage === 'showing'">
            <span>
              <span class="text">{{ pairingCode }}</span>
            </span>
            <button class="btn btn-default btn-xs" type="button" @click="copyPairingCode">{{ t('Copy') }}</button>
            <button class="btn btn-default btn-xs" type="button" @click="removePairingCode" :disabled="!agentActive">{{ t('Stop pairing') }}</button>
          </template>
          <template v-if="pairingStage === 'copied'">
            <button class="btn btn-default btn-xs" type="button" @click="removePairingCode" :disabled="!agentActive">{{ t('Stop pairing') }}</button>
          </template>
        </div>
      </div>
    </header>
    <div class="flash flash-success" :class="{ 'flash--visible': flashVisible && flashSuccess }" role="status">
      <span>{{ flashSuccess }}</span>
      <button type="button" class="flash-dismiss" :aria-label="t('Dismiss')" @click="dismissFlash">×</button>
    </div>
    <slot />
    <dialog ref="networkErrDialog" id="networkErrDialog" @click="onDialogBackdropClick">
      <h2>{{ t('Network error') }}</h2>
      <p>{{ t('Offline? Check your connection') }}</p>
      <button type="button" @click="closeNetworkError">{{ t('Close') }}</button>
    </dialog>
  </div>
</template>

<style scoped>
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

.dark-mode-toggle {
  background: none;
  border: none;
  cursor: pointer;
  vertical-align: middle;
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
  margin: 0 0 5px;
  padding: 3px 15px;
  border-radius: 4px;
  /* Always rendered (hidden when there is no message) so the flash reserves
     its space and showing or dismissing it never shifts the content below. */
  visibility: hidden
}

.flash--visible {
  visibility: visible
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

.agent-pairing button {
  margin: 5px 5px 5px 0
}

.agent-pairing .text {
  margin: 5px 5px 0 0;
  vertical-align: sub;
}

</style>
