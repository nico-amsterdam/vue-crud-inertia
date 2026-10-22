<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { useT } from '../../composables/useLocale'

interface Props {
  /** The requested URL path, quoted in the explanation. */
  path?: string
}

defineProps<Props>()
const t = useT()
</script>

<template>
  <!-- A missing page speaks plain language, not "404": the user sees what was
       searched for and a way out. Reached by opening an unknown URL directly
       (rendered server-side) or by an Inertia visit that answers 404. -->
  <section>
    <h2>{{ t('Page not found') }}</h2>
    <p v-if="path">
      {{ t('The address "{0}" does not exist or has been removed.', path) }}
    </p>
    <p>{{ t('Check the address or go back to the start page.') }}</p>
    <Link href="/" class="btn btn-default">{{ t('Back to start') }}</Link>
  </section>
</template>
