<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref, watch } from 'vue'

const darkmode = ref(false)

function toggleDark() {
  darkmode.value = !darkmode.value
}

watch(darkmode, (value) => {
  document.body.classList.toggle('dark', value)
}, { immediate: true })
</script>

<template>
  <a href="#main" id="skip-link" class="skip-link">Skip to main content</a>
  <div class="container" :class="['lang-en']">
    <header class="page-header">
      <div class="branding">
        <img src="https://vuejs.org/images/logo.png" alt="Vue logo" class="logo"/>
        <h1>Product CRUD</h1>
        <span class="color-scheme">
          <Icon v-if="!darkmode" aria-hidden="false" role="button" icon="tabler:sun" width="1.5em" title="Toggle dark mode" class="sun"
            @click="toggleDark" />
          <Icon v-if="darkmode" aria-hidden="false" role="button" icon="tabler:moon" width="1.5em" title="Toggle dark mode" class="moon"
            @click="toggleDark" />
        </span>
      </div>
    </header>
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
</style>
