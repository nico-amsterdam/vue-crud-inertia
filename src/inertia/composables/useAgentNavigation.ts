import { router } from '@inertiajs/vue3'
import { ref } from 'vue'
import { pollNavigate } from '../lib/agentApi'

export function useAgentNavigation() {
  const active = ref(false)
  let timer: number | null = null

  async function poll() {
    const cmd = await pollNavigate()
    if (cmd?.screen) {
      const meta: Record<string, string> = cmd.params || {}
      let path = cmd.screen === 'products' ? '/products'
        : cmd.screen === 'products/new' ? '/products/new'
        : cmd.screen === 'products/edit' ? `/products/${meta.id}/edit`
        : cmd.screen === 'products/delete' ? `/products/${meta.id}/delete`
        : null
      if (path) router.visit(path)
    }
  }

  function start() {
    if (active.value) return
    active.value = true
    timer = window.setInterval(poll, 2000)
    poll()
  }

  function stop() {
    active.value = false
    if (timer) { clearInterval(timer); timer = null }
  }

  return { active, start, stop }
}