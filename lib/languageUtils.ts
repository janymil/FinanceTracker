/**
 * Normalize language code to full locale format
 * Supports all language code formats: en, es, sk, en-us, es-pe, sk-sk, en-US, es-PE, sk-SK
 */
export function normalizeLanguageCode(lang: string): string {
  if (!lang) return 'en-us';
  
  const normalizedLang = lang.toLowerCase();
  
  // Handle all Spanish variants
  if (normalizedLang.startsWith('es')) {
    return 'es-pe';
  }
  // Handle all Slovak variants
  if (normalizedLang.startsWith('sk')) {
    return 'sk-sk';
  }
  // Handle all English variants (default)
  return 'en-us';
}

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
 * Works both in client and server environments
 */
export function getCurrentLanguage(): string {
  // For browser environment, use localStorage first, then default
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('preferredLanguage');
    if (saved) {
      return saved;
    }
    // Check URL path for language
    const path = window.location.pathname;
    if (path.startsWith('/es')) return 'es';
    if (path.startsWith('/sk')) return 'sk';
    if (path.startsWith('/en')) return 'en';
  }
  return 'en';
}

/**
 * Get normalized language code for API requests
 * Converts current language to backend-compatible format
 */
export function getCurrentLanguageForAPI(): string {
  const currentLang = getCurrentLanguage();
  return normalizeLanguageCode(currentLang);
}