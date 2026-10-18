import { ref, computed } from 'vue'
import { router, usePage } from '@inertiajs/vue3'

/**
 * Tracks an Inertia form submission: sets `submitting` while the visit is
 * in flight and resets it in `onFinish` (success or failure).
 *
 * ```ts
 * const { submitting, submit } = useSubmitting()
 * function save() {
 *   submit((onFinish) => router.post('/things', data, { onFinish }))
 * }
 * ```
 */
export function useSubmitting() {
  const submitting = ref(false)

  function submit(visit: (onFinish: () => void) => void) {
    submitting.value = true
    visit(() => {
      submitting.value = false
    })
  }

  return { submitting, submit }
}

/** Reusable `router.reload()` helper. */
export function useRefresh() {
  return {
    refresh: () => router.reload(),
  }
}

/**
 * `headers` for state-changing Inertia visits: the server verifies the
 * `x-csrf-token` header against the token in the signed session cookie.
 *
 * ```ts
 * router.post('/things', data, { headers: csrfHeaders.value })
 * ```
 */
export function useCsrfHeaders() {
  const page = usePage<{ csrfToken?: string }>()
  return computed(() => ({ headers: { 'x-csrf-token': page.props.csrfToken ?? '' } }))
}
