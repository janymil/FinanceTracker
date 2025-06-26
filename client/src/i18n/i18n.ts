import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { Resource } from 'i18next';

// Fetch translations directly and initialize i18n synchronously
const initializeI18n = async () => {
  try {
    // Fetch all translation files
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

    // Create properly typed resources
    const resources: Resource = {
      'en-us': { translation: enData },
      'es-pe': { translation: esData },
      'sk-sk': { translation: skData }
    };

    // Initialize i18n with fetched resources
    await i18n
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
        
        // Disable automatic language normalization
        nonExplicitSupportedLngs: false,
        
        // React specific options
        react: {
          useSuspense: false,
        },
      });

    console.log('i18n initialized successfully with resources:', Object.keys(i18n.store.data));
    return i18n;
  } catch (error) {
    console.error('Failed to initialize i18n:', error);
    
    // Initialize with empty resources as fallback
    await i18n
      .use(initReactI18next)
      .init({
        lng: 'en-us',
        fallbackLng: 'en-us',
        debug: false,
        resources: {},
        interpolation: {
          escapeValue: false,
        },
        react: {
          useSuspense: false,
        },
      });
    
    return i18n;
  }
};

// Initialize immediately
initializeI18n();

export default i18n;