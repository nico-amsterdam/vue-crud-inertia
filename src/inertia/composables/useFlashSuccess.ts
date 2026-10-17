import { usePage } from '@inertiajs/vue3'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

/**
 * One-shot success message flashed by the server (`inertia.flash` cookie).
 * The message auto-dismisses after a few seconds and can be closed manually.
 */
export function useFlashSuccess() {
  const page = usePage<{ flash?: { success?: string } }>()
  const message = computed(() => page.props.flash?.success ?? '')
  const visible = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  watch(message, (value) => {
    clearTimeout(timer)
    if (value) {
      visible.value = true
      timer = setTimeout(() => {
        visible.value = false
      }, 5000)
    } else {
      visible.value = false
    }
  }, { immediate: true })

  onBeforeUnmount(() => clearTimeout(timer))

  function dismiss() {
    visible.value = false
  }

  return { message, visible, dismiss }
}
