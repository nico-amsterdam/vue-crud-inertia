<script setup lang="ts">
import { Link, router } from '@inertiajs/vue3'
import type { ProductType } from '../../../types/product'
import { useT } from '../../composables/useLocale'
import { useSubmitting } from '../../composables/useSubmitting'

interface Props {
  product: ProductType
}

const props = defineProps<Props>()
const t = useT()
const { submitting, submit } = useSubmitting()

function remove() {
  submit((onFinish) => router.delete(`/products/${props.product.id}`, { onFinish }))
}
</script>

<template>
  <section>
    <h2>{{ t('Delete {0}', product.productName) }}</h2>
    <form v-on:submit.prevent="remove">
      <p>{{ t('Are you sure you want to delete this product?') }}</p>
      <button type="submit" class="btn btn-danger" :disabled="submitting">{{ t('Delete') }}</button>
      {{ ' ' }}
      <Link href="/products" class="btn btn-default">{{ t('Cancel') }}</Link>
    </form>
  </section>
</template>
