/**
 * Utility function to get language labels for OpenAI system messages
 */
export function getLanguageLabel(lang: string): string {
  switch (lang) {
    case 'es-pe': return 'Latin American Spanish';
    case 'sk-sk': return 'Slovak';
    case 'en-us':
    default: return 'American English';
  }
}

/**
 * Get current language from i18next or fallback to English
 */
export function getCurrentLanguage(): string {
  // This will be imported where i18n is available
  return 'en-us'; // Fallback, will be overridden by actual i18n.language
}