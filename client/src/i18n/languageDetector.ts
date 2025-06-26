// Custom language detector for path-based language detection
const languageDetector = {
  type: 'languageDetector',
  
  init: function() {
    // No initialization needed
  },
  
  detect: function() {
    // 1. First try to detect from URL path
    const pathname = window.location.pathname;
    const pathLangMatch = pathname.match(/^\/([a-z]{2})\//);
    
    if (pathLangMatch) {
      const lang = pathLangMatch[1];
      // Validate it's one of our supported languages
      if (['en', 'es', 'sk'].includes(lang)) {
        return lang;
      }
    }
    
    // 2. Try to get from cookie
    const cookieLang = this.getCookie('i18next');
    if (cookieLang && ['en', 'es', 'sk'].includes(cookieLang)) {
      return cookieLang;
    }
    
    // 3. Try browser language with dynamic mapping
    const browserLang = navigator.language || (navigator as any).userLanguage;
    
    // Extract the main language code (e.g., 'en' from 'en-GB', 'es' from 'es-MX')
    const mainLangCode = browserLang.split('-')[0].toLowerCase();
    
    // Map to our supported simplified codes
    if (mainLangCode === 'en') {
      return 'en';
    } else if (mainLangCode === 'es') {
      return 'es';
    } else if (mainLangCode === 'sk') {
      return 'sk';
    }
    
    // 4. Fallback to default
    return 'en';
  },
  
  cacheUserLanguage: function(lng) {
    // Save to cookie for persistence
    this.setCookie('i18next', lng, 365);
  },
  
  // Helper methods for cookie handling
  getCookie: function(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  },
  
  setCookie: function(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
  }
};

export default languageDetector;

// Standalone function for redirecting to correct language route
export function detectLanguageAndRedirect() {
  const currentPath = window.location.pathname;
  
  // Check if URL has old locale-specific format and convert to simplified
  const oldLangMatch = currentPath.match(/^\/([a-z]{2}-[a-z]{2})\//);
  if (oldLangMatch) {
    const oldLang = oldLangMatch[1];
    const langMap = {
      'en-us': 'en',
      'es-pe': 'es',
      'sk-sk': 'sk'
    };
    const newLang = langMap[oldLang];
    if (newLang) {
      const newPath = currentPath.replace(`/${oldLang}/`, `/${newLang}/`);
      window.location.replace(newPath);
      return;
    }
  }
  
  // Check if already has simplified language prefix
  const hasLangPrefix = /^\/([a-z]{2})\//.test(currentPath);
  if (hasLangPrefix) {
    return;
  }
  
  // Detect preferred language (use simplified codes)
  let preferredLang = localStorage.getItem('preferredLanguage');
  
  if (!preferredLang || !['en', 'es', 'sk'].includes(preferredLang)) {
    // Try browser language with dynamic mapping
    const browserLang = navigator.language || navigator.userLanguage || 'en-US';
    
    // Extract the main language code (e.g., 'en' from 'en-GB', 'es' from 'es-MX')
    const mainLangCode = browserLang.split('-')[0].toLowerCase();
    
    // Map to our supported simplified codes
    if (mainLangCode === 'en') {
      preferredLang = 'en';
    } else if (mainLangCode === 'es') {
      preferredLang = 'es';
    } else if (mainLangCode === 'sk') {
      preferredLang = 'sk';
    } else {
      preferredLang = 'en'; // Default fallback
    }
    
    localStorage.setItem('preferredLanguage', preferredLang);
  }
  
  // Redirect to language-prefixed URL
  const newPath = `/${preferredLang}${currentPath}`;
  window.location.replace(newPath);
}