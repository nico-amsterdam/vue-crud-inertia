<script setup lang="ts">
import { Link, router } from '@inertiajs/vue3'
import { ref } from 'vue'
import type { ProductType } from '../../../types/product'

interface Props {
  product: ProductType | null
  errors?: {
    write?: string
  }
}

const props = defineProps<Props>()
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
    <h2>Delete {{ product?.productName ?? '???' }}</h2>
    <form v-on:submit.prevent="remove">
      <p>Are you sure you want to delete this product?</p>
      <button type="submit" class="btn btn-danger" v-if="!!product && product.id >= 0" :disabled="submitting">Delete</button>
      {{ ' ' }}
      <Link href="/products" class="btn btn-default">Cancel</Link>
    </form>
  </section>
</template>
