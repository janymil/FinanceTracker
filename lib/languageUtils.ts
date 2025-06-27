/**
 * Utility function to get language labels for OpenAI system messages
 * Supports all language code formats: en, es, sk, en-us, es-pe, sk-sk, en-US, es-PE, sk-SK
 */
export function getLanguageLabel(lang: string): string {
  const normalizedLang = lang.toLowerCase();
  
  // Handle all Spanish variants
  if (normalizedLang.startsWith('es')) {
    return 'Spanish';
  }
  // Handle all Slovak variants
  if (normalizedLang.startsWith('sk')) {
    return 'Slovak';
  }
  // Handle all English variants (default)
  return 'English';
}

/**
 * Get current language from i18next or fallback to English
 */
export function getCurrentLanguage(): string {
  // This will be imported where i18n is available
  return 'en-us'; // Fallback, will be overridden by actual i18n.language
}