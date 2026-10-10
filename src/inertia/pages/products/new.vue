<script setup lang="ts">
import { Link, router } from '@inertiajs/vue3'
import { computed, ref } from 'vue'
import ProductForm from '../../components/ProductForm.vue'
import type { ProductType } from '../../../types/product'

interface Props {
  products?: ProductType[]
  errors?: {
    write?: string
  }
}

const props = withDefaults(defineProps<Props>(), {
  products: () => [],
  errors: () => ({ write: '' }),
})

const submitting = ref(false)
const product = ref({ id: null, productName: '', description: '', price: null, modifiedAt: null })

const productAlreadyExists = computed(() => {
  return !submitting.value && props.products.findIndex(p => p.productName === product.value.productName.trim()) >= 0
})

function createProduct() {
  if (productAlreadyExists.value) return
  submitting.value = true
  router.post('/products', product.value, {
    onFinish: () => {
      submitting.value = false
    },
  })
}
</script>

<template>
  <section>
    <div v-if="productAlreadyExists" id="errors-add-product" class="error">A product with this name already exists
    </div>
    <div v-if="errors.write" class="error">{{ errors.write }}</div>
    <h2>Add product</h2>
    <form v-on:submit.prevent="createProduct">
      <ProductForm v-model:the-product="product"></ProductForm>
      <button type="submit" :disabled="submitting" class="btn btn-primary">Create</button>
      {{ ' ' }}
      <Link href="/products" class="btn btn-default">Cancel</Link>
    </form>
  </section>
</template>
