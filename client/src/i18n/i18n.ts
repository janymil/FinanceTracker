import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Preload translations by fetching them directly
const preloadTranslations = async () => {
  try {
    const [enRes, esRes, skRes] = await Promise.all([
      fetch('/locales/en-us/translation.json'),
      fetch('/locales/es-pe/translation.json'),
      fetch('/locales/sk-sk/translation.json')
    ]);

    const [enData, esData, skData] = await Promise.all([
      enRes.json(),
      esRes.json(),
      skRes.json()
    ]);

    return {
      'en-us': { translation: enData },
      'es-pe': { translation: esData },
      'sk-sk': { translation: skData }
    };
  } catch (error) {
    console.error('Failed to preload translations:', error);
    return {};
  }
};

// Initialize i18n with preloaded resources
const initializeI18n = async () => {
  const resources = await preloadTranslations();
  
  return i18n
    .use(initReactI18next)
    .init({
      lng: 'en-us',
      fallbackLng: 'en-us',
      debug: false,
      resources,
      
      interpolation: {
        escapeValue: false, // React already does escaping
      },
      
      // Supported languages
      supportedLngs: ['en-us', 'es-pe', 'sk-sk'],
      
      // Load exact language codes only
      load: 'currentOnly',
      
      // Don't clean up language codes - use exact matches
      cleanCode: false,
      
      // Disable automatic language normalization to prevent browser conflicts
      nonExplicitSupportedLngs: false,
      
      // React specific options
      react: {
        useSuspense: false, // Set to false to avoid loading states
      },
    });
};

// Initialize and export
initializeI18n();

export default i18n;