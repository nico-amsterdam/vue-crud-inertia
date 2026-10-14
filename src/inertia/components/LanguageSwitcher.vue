<script setup lang="ts">
import { useLocale, useT } from '../composables/useLocale'

const locale = useLocale()
const t = useT()

function switchLanguage(event: Event) {
  const lang = (event.target as HTMLSelectElement).value
  // Full page load: the server stores the choice in the `lang` cookie,
  // so the language also survives visits that drop the query parameter.
  window.location.href = `${window.location.pathname}?lang=${lang}`
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
