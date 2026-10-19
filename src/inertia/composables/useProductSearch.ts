import { ref } from 'vue'

/**
 * The product search value, kept at module scope — a part of the app that is
 * never swapped out when Inertia navigates (the same idea as the dark-mode
 * state in the layout) — so the filter survives going to new/edit/delete and
 * back without being put in the URL.
 *
 * A genuine full page load (browser refresh, a plain `<a>`, a `location()`
 * redirect) resets it; that is accepted — the value is convenience, not state
 * worth persisting across sessions.
 */
const searchKey = ref('')

/**
 * Shared `searchKey` for the product list. Pass the server-rendered `q` so a
 * page rendered with a filter (e.g. a direct load of `/products/findbyname?q=…`)
 * wins over the kept one.
 */
export function useProductSearch(q?: string) {
  if (q !== undefined && q !== '') searchKey.value = q
  return searchKey
}
