import { ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import type { UserType } from '@/routes/auth/common'
import { useAgentNavigation } from './useAgentNavigation'
import { createPairing, removePairing } from '@/inertia/lib/agentApi'

/**
 * Owns the agent-pairing UI state for the VueCrud layout: the displayed
 * pairing code, the agent polling status, and the create/copy/remove actions.
 * Extracted from VueCrud.vue to keep the layout readable.
 */
export function useAgentPairing() {
  const page = usePage<{ authUser?: UserType | null; csrfToken?: string | null }>()
  const { active: agentActive, start: startAgent, stop: stopAgent } = useAgentNavigation()

  const pairingCode = ref<string | null>(null)
  const pairingStage = ref<'idle' | 'showing' | 'copied'>('idle') // idle = only start btn; showing = code+copy+remove; copied = remove only

  async function createPairingCode() {
    const code = await createPairing(page.props.csrfToken)
    if (code !== null) {
      pairingCode.value = code
      pairingStage.value = 'showing'
      startAgent()
    }
  }

  async function copyPairingCode() {
    if (!pairingCode.value) return
    try {
      await navigator.clipboard.writeText(pairingCode.value)
    } catch {
      // Clipboard API is unavailable (e.g. plain HTTP without a secure context);
      // fall back to the legacy execCommand copy path.
      const ta = document.createElement('textarea')
      ta.value = pairingCode.value
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    pairingCode.value = null
    pairingStage.value = 'copied'
  }

  async function removePairingCode() {
    await removePairing(page.props.csrfToken)
    pairingCode.value = null
    pairingStage.value = 'idle'
    stopAgent()
  }

  return {
    pairingCode,
    pairingStage,
    agentActive,
    createPairingCode,
    copyPairingCode,
    removePairingCode,
  }
}
