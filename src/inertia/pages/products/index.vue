<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { InfiniteScroll, router, Link } from '@inertiajs/vue3'
import { computed, onMounted, ref, watch } from 'vue'
import type { ProductType } from '../../../types/product'
import { useT } from '../../composables/useLocale'
import { useRefresh } from '../../composables/useSubmitting'

interface Props {
  products: ProductType[]
  /** More than 100 products: the server filters (name prefix) and paginates. */
  serverFilter?: boolean
  /** The name-prefix filter applied by the server (`/products/findbyname`). */
  q?: string
}

const props = withDefaults(defineProps<Props>(), {
  serverFilter: false,
  q: '',
})

const t = useT()

const searchKey = ref(props.q)
const productList = computed(() => props.products)
const filteredProducts = computed(() => {
  if (props.serverFilter) {
    // The server already filtered on the starting letters of the name.
    return productList.value
  }
  return productList.value.filter(product =>
    product.productName.toLowerCase().indexOf(searchKey.value.toLowerCase()) !== -1
    || product.description.toLowerCase().indexOf(searchKey.value.toLowerCase()) !== -1
    || (product.price && product.price.toString().indexOf(searchKey.value) !== -1))
})

let searchTimer: ReturnType<typeof setTimeout> | undefined

watch(searchKey, (value) => {
  if (!props.serverFilter) return
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (value === '') {
      router.get('/products', {}, { replace: true })
    } else {
      router.get('/products/findbyname', { q: value }, { replace: true })
    }
  }, 300)
})

const { refresh } = useRefresh()

onMounted(() => {
  document.getElementById('search-element')?.focus()
})
</script>

<template>
  <main id="main" class="product-list">
    <div class="form-actions">
      <Link class="btn btn-default" href="/products/new">
        <Icon icon="tabler:plus" :title="t('Add product')" class="plussign" />
        {{ t('Add product') }}
      </Link>
      <button type="button" class="btn refresh" :title="t('Refresh list')" @click="refresh">
        <Icon flip="horizontal" icon="tabler:refresh" />
      </button>
    </div>
    <div class="filters row">
      <div class="form-group product-search">
        <label for="search-element">{{ t('Search') }}</label>
        <input v-model="searchKey" class="form-control" id="search-element"
          :aria-description="serverFilter
            ? t('Filter products by the starting letters of the product name')
            : t('Filter products by name, description or price')" />
      </div>
    </div>
    <InfiniteScroll data="products" :buffer="200" as="div" preserve-url>
      <table class="table">
        <thead>
          <tr>
            <th scope="col">{{ t('Name') }}</th>
            <th scope="col">{{ t('Description') }}</th>
            <th scope="col" class="price">{{ t('Price') }}</th>
            <th scope="col" class="table-actions">{{ t('Actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in filteredProducts" :key="product.id">
            <td>
              <Link :href="`/products/${product.id}/edit`">{{ product.productName }}</Link>
            </td>
            <td>
              {{ product.description }}
            </td>
            <td class="price">
              {{ product.price === null ? '–' : `${product.price} €` }}
            </td>
            <td class="table-actions">
              <Link class="btn btn-warning btn-xs" :href="`/products/${product.id}/edit`">{{ t('Edit') }}</Link>
              {{ ' ' }}
              <Link class="btn btn-danger btn-xs" :href="`/products/${product.id}/delete`">{{ t('Delete') }}</Link>
            </td>
          </tr>
        </tbody>
        <tfoot id="search-results-footer">
          <tr id="announceResults" aria-live="assertive" aria-atomic="true">
            <td v-if="productList.length === 0 && !(serverFilter && searchKey)" id="noResults" colspan="4">{{ t('No products available') }}</td>
            <td v-else-if="filteredProducts.length === 0" id="noResults" colspan="4">{{ t('No products match your search') }}</td>
          </tr>
        </tfoot>
      </table>
      <template #loading>
        <div class="infinite-scroll-loading" role="status" :aria-label="t('Loading')"></div>
      </template>
    </InfiniteScroll>
  </main>
</template>

<style>
/* Skip link for accessibility - WCAG 2.4.1 Bypass Blocks */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px 16px;
  z-index: 10000;
  text-decoration: none;
  font-weight: bold;
  font-size: 14px;
  transition: top 0.2s ease-in-out
}

.skip-link:focus {
  top: 0;
  outline: 2px solid #fff;
  outline-offset: 2px
}

.form-group {
  max-width: 500px
}

.form-actions {
  padding: 10px 0
}

.plussign {
  vertical-align: bottom;
  font-size: 24px
}

.refresh {
  float: right;
  background: none;
  border: none;
  padding: 0
}

.btn.refresh:active {
  box-shadow: none
}

.refresh svg {
  font-size: 24px;
  margin: 5px 5px 0 5px
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

.refresh:active svg {
  color: lightblue;
  animation: spin 500ms linear 1
}

.refresh:not(:active) svg {
  /* keep color for 0.5 seconds */
  transition: color 500ms step-end
}

@media (min-width: 992px) {

  body .product-list .table .price {
    padding-right: 28px;
    width: 130px
  }
}

@media (min-width: 1200px) {

  body .product-list .table .price {
    padding-right: 58px;
    width: 160px
  }
}

.lang-en .table-actions {
  width: 112px
}

.lang-es .table-actions {
  width: 132px
}

.product-list .table .price {
  width: 102px;
  text-align: right
}

.infinite-scroll-loading {
  display: flex;
  justify-content: center;
  padding: 8px 0
}

.infinite-scroll-loading::after {
  content: "";
  width: 20px;
  height: 20px;
  border: 3px solid #ccc;
  border-top-color: #337ab7;
  border-radius: 50%;
  animation: spin 800ms linear infinite
}
</style>
