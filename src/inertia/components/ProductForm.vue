<script setup lang="ts">
import { onMounted } from 'vue'
import type { ProductBaseType } from '../../types/product'
import { useT } from '../composables/useLocale'

interface Props {
  theProduct: ProductBaseType
}

defineProps<Props>()
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
    </div>
    <div class="form-group">
      <label for="edit-description">{{ t('Description') }}</label>
      <textarea class="form-control" id="edit-description" rows="3" v-model="theProduct.description"
        maxlength="300"></textarea>
    </div>
    <div class="form-group">
      <label for="edit-price">{{ t('Price') }}</label>
      <input type="number" min="0" step="0.01" class="form-control" id="edit-price" v-model="theProduct.price" />
    </div>
  </span>
</template>
