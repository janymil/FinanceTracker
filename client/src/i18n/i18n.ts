import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import languageDetector from './languageDetector';

i18n
  .use(HttpBackend)
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en-us',
    debug: false,
    
    interpolation: {
      escapeValue: false, // React already does escaping
    },
    
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },
    
    detection: {
      order: ['path', 'cookie', 'navigator'],
      caches: ['cookie'],
    },
    
    // Supported languages
    supportedLngs: ['en-us', 'es-pe', 'sk-sk'],
    
    // Don't preload all languages
    preload: false,
    
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