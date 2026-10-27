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
      // Load courses translation file
      const coursesResponse = await fetch(`/locales/${lang}/courses.json`);
      
      if (response.ok) {
        const translations = await response.json();
        let featuresTranslations = {};
        
        // Load features translations if available
        if (featuresResponse.ok) {
          featuresTranslations = await featuresResponse.json();
          // Merge features translations into main translations to maintain structure
          Object.assign(translations, featuresTranslations);
        }

        /*
         * Courses page strings.
         *
         * `Courses.tsx` used `useTranslation('courses')`, asking i18next for a *namespace* named
         * "courses". This loader only ever builds one namespace ("translation"), so the page
         * rendered `courses.title`, `courses.subtitle` and `courses.stats.*` verbatim in all
         * three languages. The keys live in their own small file and are merged into the default
         * namespace, exactly like `features.json` above, so the page asks for `courses.title`.
         */
        if (coursesResponse.ok) {
          Object.assign(translations, await coursesResponse.json());
        }

        // One call for both optional files: `scripts/check-logging.ts` holds client/src to a
        // console budget that may not grow, and a missing file is one build problem, not two.
        const optionalFilesDown = [
          featuresResponse.ok ? null : `features (${featuresResponse.status})`,
          coursesResponse.ok ? null : `courses (${coursesResponse.status})`,
        ].filter(Boolean);
        if (optionalFilesDown.length > 0) {
          console.error(`Failed to load optional translations for ${lang}:`, optionalFilesDown.join(', '));
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
        // No namespaces are used, and sentence keys such as "Free Plan:" contain colons.
        nsSeparator: false,
        
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

// Keep <html lang> in step with the language in use: screen readers pick the right voice
// and browsers stop offering to translate a page that is already in the visitor's language.
function syncDocumentLanguage(language: string | undefined) {
  if (typeof document === 'undefined' || !language) return;
  const code = language.slice(0, 2).toLowerCase();
  document.documentElement.lang = code === 'es' ? 'es-PE' : code === 'sk' ? 'sk' : 'en';
}
i18n.on('languageChanged', syncDocumentLanguage);
i18n.on('initialized', () => syncDocumentLanguage(i18n.language));

// Initialize on module load
initializeI18n();

export default i18n;