import { usePage } from '@inertiajs/vue3'
import { computed } from 'vue'
import { STANDARD_LANGUAGE } from '../../i18n/lang'
import { newLocale, type LocaleType } from '../../i18n/translations'

/**
 * The locale shared by the server (`createInertia({ share })`).
 * Reactive: it follows the Inertia page props.
 */
export function useLocale() {
  const page = usePage<{ locale?: { lang?: string } }>()
  return computed<LocaleType>(() => newLocale(page.props.locale?.lang ?? STANDARD_LANGUAGE))
}

/** Translate function for the current language: `t('Add product')`. */
export function useT() {
  const locale = useLocale()
  return (key: string, ...args: string[]): string => locale.value.t(key, ...args)
}
