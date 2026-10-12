import { getRequestConfig } from 'next-intl/server'

/**
 * next-intl request config — loads the Arabic message bundle.
 *
 * This app is single-locale (Arabic only, targeting Oman), so we don't use
 * i18n routing. The locale is hardcoded to 'ar' and messages are loaded from
 * `messages/ar.json`.
 */
export default getRequestConfig(async () => {
  const locale = 'ar'
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
