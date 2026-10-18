<script setup lang="ts">
import { onMounted } from 'vue'
import type { ProductBaseType, ProductErrorsType } from '../../types/product'
import { useT } from '../composables/useLocale'

interface Props {
  theProduct: ProductBaseType
  errors?: ProductErrorsType
}

withDefaults(defineProps<Props>(), {
  errors: () => ({}),
})
const t = useT()

onMounted(() => {
  document.getElementById('edit-name')?.focus()
})
</script>

<template>
  <span>
    <input type="hidden" id="modifiedAt" v-model="theProduct.modifiedAt" />
    <div class="form-group">
      <label for="edit-name">{{ t('Name') }}</label>
      <input class="form-control" id="edit-name" v-model="theProduct.productName" required maxlength="20" />
      <div v-if="errors.productName" class="error">{{ errors.productName }}</div>
    </div>
    <div class="form-group">
      <label for="edit-description">{{ t('Description') }}</label>
      <textarea class="form-control" id="edit-description" rows="3" v-model="theProduct.description"
        maxlength="300"></textarea>
      <div v-if="errors.description" class="error">{{ errors.description }}</div>
    </div>
    <div class="form-group">
      <label for="edit-price">{{ t('Price') }}</label>
      <input type="number" min="0" step="0.01" class="form-control" id="edit-price" v-model="theProduct.price" />
      <div v-if="errors.price" class="error">{{ errors.price }}</div>
    </div>
  </span>
</template>

<style scoped>
.form-group {
  max-width: 500px
}
</style>
