import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files directly
import enUS from '../../public/locales/en-us/translation.json';
import esPE from '../../public/locales/es-pe/translation.json';
import skSK from '../../public/locales/sk-sk/translation.json';

const resources = {
  'en-us': {
    translation: enUS
  },
  'es-pe': {
    translation: esPE
  },
  'sk-sk': {
    translation: skSK
  }
};

i18n
  .use(initReactI18next)
  .init({
    lng: 'en-us', // Default language
    fallbackLng: 'en-us',
    debug: true,
    
    resources,
    
    interpolation: {
      escapeValue: false, // React already does escaping
    },
    
    // Supported languages
    supportedLngs: ['en-us', 'es-pe', 'sk-sk'],
    
    // React specific options
    react: {
      useSuspense: false, // Set to false to avoid loading states
    },
  });

export default i18n;