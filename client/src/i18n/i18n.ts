import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files directly
import enTranslations from '../../public/locales/en-us/translation.json';
import esTranslations from '../../public/locales/es-pe/translation.json';
import skTranslations from '../../public/locales/sk-sk/translation.json';

// Static resources object
const resources = {
  'en-us': {
    translation: enTranslations
  },
  'es-pe': {
    translation: esTranslations
  },
  'sk-sk': {
    translation: skTranslations
  }
};

i18n
  .use(initReactI18next)
  .init({
    lng: 'en-us', // Set default explicitly
    fallbackLng: 'en-us',
    debug: true,
    
    // Use static resources instead of HTTP backend
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

export default i18n;