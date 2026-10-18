<script setup lang="ts">
import { Link, router } from '@inertiajs/vue3'
import { ref } from 'vue'
import ProductForm from '../../components/ProductForm.vue'
import type { ProductErrorsType, ProductType } from '../../../types/product'
import { useT } from '../../composables/useLocale'
import { useCsrfHeaders, useSubmitting } from '../../composables/useSubmitting'

interface Props {
  product: ProductType
  errors?: ProductErrorsType
}

const props = defineProps<Props>()
const t = useT()

// copy the product so edits are not applied directly to the prop.
// structuredClone cannot clone the reactive prop proxy, and every field is a
// primitive (or null), so a shallow spread is a complete copy.
const product = ref<ProductType>({ ...props.product })
const { submitting, submit } = useSubmitting()
const csrfHeaders = useCsrfHeaders()

function update() {
  submit((onFinish) => router.patch(`/products/${product.value.id}`, product.value, { ...csrfHeaders.value, onFinish }))
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
