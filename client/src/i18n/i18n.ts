import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Load translation resources directly
async function loadTranslations() {
  const resources: any = {};
  
  // Load all supported languages
  const languages = ['en-us', 'es-pe', 'sk-sk'];
  
  for (const lang of languages) {
    try {
      const response = await fetch(`/locales/${lang}/translation.json`);
      if (response.ok) {
        const translations = await response.json();
        resources[lang] = {
          translation: translations
        };
        console.log(`Loaded translations for ${lang}:`, Object.keys(translations).length, 'keys');
      } else {
        console.error(`Failed to load translations for ${lang}:`, response.status);
      }
    } catch (error) {
      console.error(`Error loading translations for ${lang}:`, error);
    }
  }
  
  return resources;
}

// Initialize i18n with preloaded resources
loadTranslations().then(resources => {
  i18n
    .use(initReactI18next)
    .init({
      lng: 'en-us',
      supportedLngs: ['en-us', 'es-pe', 'sk-sk'],
      fallbackLng: 'en-us',
      debug: true,
      
      resources,

      interpolation: {
        escapeValue: false,
      },

      react: {
        useSuspense: false,
      },
    });
}).catch(error => {
  console.error('Failed to initialize i18n:', error);
  // Fallback initialization without resources
  i18n
    .use(initReactI18next)
    .init({
      lng: 'en-us',
      supportedLngs: ['en-us', 'es-pe', 'sk-sk'],
      fallbackLng: 'en-us',
      debug: true,
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
});

export default i18n;