import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Synchronous initialization with preloaded resources
i18n
  .use(initReactI18next)
  .init({
    lng: 'en-us',
    fallbackLng: 'en-us',
    debug: false,
    
    // Empty resources initially - will be populated by ResourceLoader
    resources: {},
    
    interpolation: {
      escapeValue: false,
    },
    
    supportedLngs: ['en-us', 'es-pe', 'sk-sk'],
    load: 'currentOnly',
    cleanCode: false,
    nonExplicitSupportedLngs: false,
    
    react: {
      useSuspense: false,
    },
  });

export default i18n;