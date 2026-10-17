<script setup lang="ts">
import { Link, router } from '@inertiajs/vue3'
import { ref } from 'vue'
import ProductForm from '../../components/ProductForm.vue'
import type { ProductErrorsType, ProductType } from '../../../types/product'
import { useT } from '../../composables/useLocale'
import { useSubmitting } from '../../composables/useSubmitting'

interface Props {
  product: ProductType
  errors?: ProductErrorsType
}

const props = defineProps<Props>()
const t = useT()

// deep-clone the product so edits are not applied directly to the prop
const product = ref<ProductType>(structuredClone(props.product))
const { submitting, submit } = useSubmitting()

function update() {
  submit((onFinish) => router.patch(`/products/${product.value.id}`, product.value, { onFinish }))
}
</script>

<template>
  <section>
    <h2>{{ t('Edit product') }}</h2>
    <div v-if="errors?.write" class="error">{{ errors.write }}</div>
    <form v-on:submit.prevent="update">
      <ProductForm v-model:the-product="product" :errors="errors"></ProductForm>
      <button type="submit" class="btn btn-primary" :disabled="submitting">{{ t('Save') }}</button>
      {{ ' ' }}
      <Link href="/products" class="btn btn-default">{{ t('Cancel') }}</Link>
    </form>
  </section>
</template>
