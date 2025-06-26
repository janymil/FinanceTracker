// Custom language detector for path-based language detection
const languageDetector = {
  type: 'languageDetector',
  
  init: function() {
    // No initialization needed
  },
  
  detect: function() {
    // 1. First try to detect from URL path
    const pathname = window.location.pathname;
    const pathLangMatch = pathname.match(/^\/([a-z]{2}-[a-z]{2})\//);
    
    if (pathLangMatch) {
      const lang = pathLangMatch[1];
      // Validate it's one of our supported languages
      if (['en-us', 'es-pe', 'sk-sk'].includes(lang)) {
        return lang;
      }
    }
    
    // 2. Try to get from cookie
    const cookieLang = this.getCookie('i18next');
    if (cookieLang && ['en-us', 'es-pe', 'sk-sk'].includes(cookieLang)) {
      return cookieLang;
    }
    
    // 3. Try browser language with mapping
    const browserLang = navigator.language || navigator.userLanguage;
    const langMap = {
      'en': 'en-us',
      'en-US': 'en-us',
      'es': 'es-pe',
      'es-PE': 'es-pe',
      'es-ES': 'es-pe',
      'sk': 'sk-sk',
      'sk-SK': 'sk-sk'
    };
    
    if (langMap[browserLang]) {
      return langMap[browserLang];
    }
    
    // 4. Fallback to default
    return 'en-us';
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