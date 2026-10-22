<script setup lang="ts">
import { setLocale, useLocale, useT } from '../composables/useLocale'

const locale = useLocale()
const t = useT()

// Client-side switch: all translations ship with the bundle, so this needs no
// page reload. `setLocale` stores the choice in the `lang` cookie (the same
// one the server middleware would write), so the language also survives
// visits that drop the query parameter and subsequent full page loads.
function switchLanguage(event: Event) {
  setLocale((event.target as HTMLSelectElement).value)
}
</script>

<template>
  <select id="choose-lang" name="language" class="language-switcher" :value="locale.lang"
    :aria-label="t('Choose site language')" @change="switchLanguage">
    <option value="en" lang="en">English</option>
    <option value="es" lang="es">Español</option>
    <option value="fr" lang="fr">Français</option>
    <option value="de" lang="de">Deutsch</option>
  </select>
</template>
