<script setup lang="ts">
import { Link, router } from '@inertiajs/vue3'
import { ref } from 'vue'
import ProductForm from '../../components/ProductForm.vue'
import type { ProductType } from '../../../types/product'

interface Props {
  product: ProductType
  errors?: {
    write?: string
  }
}

const props = defineProps<Props>()

// deep-clone the product so edits are not applied directly to the prop
const product = ref<ProductType>(JSON.parse(JSON.stringify(props.product)))
const submitting = ref(false)

function update() {
  if (!product.value || product.value.id < 0) return
  submitting.value = true
  router.patch(`/products/${product.value.id}`, product.value, {
    onFinish: () => {
      submitting.value = false
    },
  })
}
</script>

<template>
  <section>
    <div v-if="errors?.write" class="error">{{ errors.write }}</div>
    <h2>Edit product</h2>
    <form v-on:submit.prevent="update">
      <ProductForm v-model:the-product="product" v-if="!!product"></ProductForm>
      <button type="submit" class="btn btn-primary" v-if="!!product && product.id >= 0">Save</button>
      {{ ' ' }}
      <Link href="/products" class="btn btn-default">Cancel</Link>
    </form>
  </section>
</template>
