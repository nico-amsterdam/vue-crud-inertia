<script setup lang="ts">
import { Link, router } from '@inertiajs/vue3'
import { ref } from 'vue'
import ProductForm from '../../components/ProductForm.vue'
import type { ProductErrorsType } from '../../../types/product'
import { useT } from '../../composables/useLocale'
import { useCsrfHeaders, useSubmitting } from '../../composables/useSubmitting'

interface Props {
  errors?: ProductErrorsType
}

withDefaults(defineProps<Props>(), {
  errors: () => ({ write: '' }),
})

const t = useT()

const { submitting, submit } = useSubmitting()
const csrfHeaders = useCsrfHeaders()
const product = ref({ id: null, productName: '', description: '', price: null, modifiedAt: null })

function createProduct() {
  submit((onFinish) => router.post('/products', product.value, { ...csrfHeaders.value, onFinish }))
}
</script>

<template>
  <section>
    <div v-if="errors.write" class="error">{{ errors.write }}</div>
    <h2>{{ t('Add product') }}</h2>
    <form v-on:submit.prevent="createProduct">
      <ProductForm v-model:the-product="product" :errors="errors"></ProductForm>
      <button type="submit" :disabled="submitting" class="btn btn-primary">{{ t('Create') }}</button>
      {{ ' ' }}
      <Link href="/products" class="btn btn-default">{{ t('Cancel') }}</Link>
    </form>
  </section>
</template>
