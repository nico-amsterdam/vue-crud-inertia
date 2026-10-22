<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { useT } from '../../composables/useLocale'

const t = useT()
</script>

<template>
  <!-- The visible face of an unexpected server error. Technical details are
       never exposed: the server logs them, this page only apologizes and
       offers a way back. Same rendering rules as errors/notfound.vue. -->
  <section>
    <h2>{{ t('Something went wrong') }}</h2>
    <p>{{ t('An unexpected error occurred on the server. Please try again later.') }}</p>
    <Link href="/" class="btn btn-default">{{ t('Back to start') }}</Link>
  </section>
</template>
