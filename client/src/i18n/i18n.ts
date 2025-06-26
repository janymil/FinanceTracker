import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Load translation resources directly
async function loadTranslations() {
  const resources: any = {};
  
  // Load all supported languages (mapping simplified codes to existing files)
  const languageMapping = {
    'en': 'en-us',
    'es': 'es-pe', 
    'sk': 'sk-sk'
  };
  const languages = ['en-us', 'es-pe', 'sk-sk'];
  
  for (const lang of languages) {
    try {
      const response = await fetch(`/locales/${lang}/translation.json`);
      if (response.ok) {
        const translations = await response.json();
        
        // Store under primary language key
        resources[lang] = {
          translation: translations
        };
        
        // Create simplified language mappings
        if (lang === 'en-us') {
          resources['en-US'] = { translation: translations };
          resources['en'] = { translation: translations };
        } else if (lang === 'es-pe') {
          resources['es-PE'] = { translation: translations };
          resources['es'] = { translation: translations };
        } else if (lang === 'sk-sk') {
          resources['sk-SK'] = { translation: translations };
          resources['sk'] = { translation: translations };
        }
        
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
      lng: 'en',
      supportedLngs: ['en', 'es', 'sk', 'en-us', 'es-pe', 'sk-sk'],
      fallbackLng: 'en',
      debug: true,
      
      resources,

      interpolation: {
        escapeValue: false,
      },

      react: {
        useSuspense: true, // Enable suspense to prevent rendering before translations load
      },
    });
}).catch(error => {
  console.error('Failed to initialize i18n:', error);
  // Fallback initialization without resources
  i18n
    .use(initReactI18next)
    .init({
      lng: 'en',
      supportedLngs: ['en', 'es', 'sk', 'en-us', 'es-pe', 'sk-sk'],
      fallbackLng: 'en',
      debug: true,
      interpolation: { escapeValue: false },
      react: { useSuspense: true },
    });
});

export default i18n;