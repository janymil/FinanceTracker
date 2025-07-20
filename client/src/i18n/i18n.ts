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
      // Load main translation file
      const response = await fetch(`/locales/${lang}/translation.json`);
      // Load features translation file
      const featuresResponse = await fetch(`/locales/${lang}/features.json`);
      
      if (response.ok) {
        const translations = await response.json();
        let featuresTranslations = {};
        
        // Load features translations if available
        if (featuresResponse.ok) {
          featuresTranslations = await featuresResponse.json();
          // Merge features translations into main translations to maintain structure
          Object.assign(translations, featuresTranslations);
        } else {
          console.error(`Failed to load features translations for ${lang}:`, featuresResponse.status);
        }
        
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
        

      } else {
        console.error(`Failed to load translations for ${lang}:`, response.status);
      }
    } catch (error) {
      console.error(`Error loading translations for ${lang}:`, error);
    }
  }
  
  return resources;
}

// Initialize i18n only once with proper error handling
let isInitialized = false;

async function initializeI18n() {
  if (isInitialized) {
    console.warn('i18n already initialized, skipping...');
    return;
  }

  try {
    const resources = await loadTranslations();
    
    await i18n
      .use(initReactI18next)
      .init({
        lng: 'en',
        supportedLngs: ['en', 'es', 'sk', 'en-us', 'es-pe', 'sk-sk', 'en-US', 'es-PE', 'sk-SK'],
        fallbackLng: 'en',
        debug: false,
        
        resources,

        interpolation: {
          escapeValue: false,
        },

        react: {
          useSuspense: false,
        },
      });
    
    isInitialized = true;
    console.log('i18n initialized successfully');
  } catch (error) {
    console.error('Failed to initialize i18n:', error);
    
    // Fallback initialization without resources
    await i18n
      .use(initReactI18next)
      .init({
        lng: 'en',
        supportedLngs: ['en', 'es', 'sk', 'en-us', 'es-pe', 'sk-sk', 'en-US', 'es-PE', 'sk-SK'],
        fallbackLng: 'en',
        debug: false,
        interpolation: { escapeValue: false },
        react: { useSuspense: false },
      });
    
    isInitialized = true;
    console.log('i18n initialized with fallback');
  }
}

// Initialize on module load
initializeI18n();

export default i18n;