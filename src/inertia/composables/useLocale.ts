import { usePage } from '@inertiajs/vue3'
import { computed, ref } from 'vue'
import { LANG_COOKIE, STANDARD_LANGUAGE } from '../../i18n/lang'
import { newLocale, type LocaleType } from '../../i18n/translations'

/** Shape of the props the server always shares (`createInertia({ share })`). */
type SharedProps = {
  locale?: { lang?: string }
  errors?: Record<string, string>
}

/**
 * A language chosen on the client. Set by `setLocale` — it wins over the
 * server-shared locale until the module state is dropped (app reload).
 */
const clientLang = ref<LocaleType | null>(null)

/**
 * The locale shared by the server (`createInertia({ share })`), or the
 * client-side choice made by `setLocale` (which wins so the switcher needs
 * no page reload — the server's `lang` cookie mirrors that choice, so later
 * visits share the same language anyway). Languages arriving from the server
 * always cause full page loads (the `?lang=` links and OAuth redirects), so
 * a stale client choice never has to be invalidated.
 */
export function useLocale() {
  const page = usePage<SharedProps>()
  return computed<LocaleType>(
    () => clientLang.value ?? newLocale(page.props.locale?.lang ?? STANDARD_LANGUAGE),
  )
}

/** Translate function for the current language: `t('Add product')`. */
export function useT() {
  const locale = useLocale()
  return (key: string, ...args: string[]): string => locale.value.t(key, ...args)
}

/**
 * Switch languages without a page reload. Keeps the locale in sync with the
 * server by mirroring the `lang` cookie the language middleware would set
 * (same path, lifetime and SameSite policy), and updates `<html lang="en">`,
 * which the server only writes during the initial render.
 *
 * Displayed validation errors are also dropped: the server translates them,
 * so they would stay in the previous language after the switch.
 */
export function setLocale(lang: string): void {
  if (lang === (clientLang.value?.lang ?? usePage<SharedProps>().props.locale?.lang)) return
  clientLang.value = newLocale(lang)
  // The shared props are reactive (Inertia keeps the page object reactive,
  // and the page components read `errors` from it), so every component
  // guarded by `v-if="errors…"` re-renders with the errors gone.
  usePage<SharedProps>().props.errors = {}
  document.cookie = `${LANG_COOKIE}=${encodeURIComponent(lang)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
  document.documentElement.lang = lang
}

