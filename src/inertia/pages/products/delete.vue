<script setup lang="ts">
import { Link, router } from '@inertiajs/vue3'
import { ref } from 'vue'
import type { ProductType } from '../../../types/product'
import { useT } from '../../composables/useLocale'

interface Props {
  product: ProductType | null
  errors?: {
    write?: string
  }
}

const props = defineProps<Props>()
const t = useT()
const submitting = ref(false)

function remove() {
  if (!props.product || props.product.id < 0) return
  submitting.value = true
  router.delete(`/products/${props.product.id}`, {
    onFinish: () => {
      submitting.value = false
    },
  })
}
</script>

<template>
  <section>
    <div v-if="errors?.write" class="error">{{ errors.write }}</div>
    <h2>{{ t('Delete {0}', product?.productName ?? '???') }}</h2>
    <form v-on:submit.prevent="remove">
      <p>{{ t('Are you sure you want to delete this product?') }}</p>
      <button type="submit" class="btn btn-danger" v-if="!!product && product.id >= 0" :disabled="submitting">{{
        t('Delete') }}</button>
      {{ ' ' }}
      <Link href="/products" class="btn btn-default">{{ t('Cancel') }}</Link>
    </form>
  </section>
</template>
