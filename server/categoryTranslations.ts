// Category translation mappings for predefined categories
export const categoryTranslations = {
  // Expense categories
  'Food': {
    'en-us': 'Food',
    'es-pe': 'Comida',
    'sk-sk': 'Jedlo'
  },
  'Transportation': {
    'en-us': 'Transportation',
    'es-pe': 'Transporte',
    'sk-sk': 'Doprava'
  },
  'Housing': {
    'en-us': 'Housing',
    'es-pe': 'Vivienda',
    'sk-sk': 'Bývanie'
  },
  'Entertainment': {
    'en-us': 'Entertainment',
    'es-pe': 'Entretenimiento',
    'sk-sk': 'Zábava'
  },
  'Healthcare': {
    'en-us': 'Healthcare',
    'es-pe': 'Salud',
    'sk-sk': 'Zdravotníctvo'
  },
  'Shopping': {
    'en-us': 'Shopping',
    'es-pe': 'Compras',
    'sk-sk': 'Nákupy'
  },
  'Utilities': {
    'en-us': 'Utilities',
    'es-pe': 'Servicios públicos',
    'sk-sk': 'Služby'
  },
  'Education': {
    'en-us': 'Education',
    'es-pe': 'Educación',
    'sk-sk': 'Vzdelávanie'
  },
  'Travel': {
    'en-us': 'Travel',
    'es-pe': 'Viajes',
    'sk-sk': 'Cestovanie'
  },
  'Personal Care': {
    'en-us': 'Personal Care',
    'es-pe': 'Cuidado personal',
    'sk-sk': 'Osobná starostlivosť'
  },
  
  // Income categories
  'Salary': {
    'en-us': 'Salary',
    'es-pe': 'Salario',
    'sk-sk': 'Plat'
  },
  'Freelance': {
    'en-us': 'Freelance',
    'es-pe': 'Trabajo independiente',
    'sk-sk': 'Voľná práca'
  },
  'Investments': {
    'en-us': 'Investments',
    'es-pe': 'Inversiones',
    'sk-sk': 'Investície'
  },
  'Business': {
    'en-us': 'Business',
    'es-pe': 'Negocio',
    'sk-sk': 'Podnikanie'
  },
  'Other Income': {
    'en-us': 'Other Income',
    'es-pe': 'Otros ingresos',
    'sk-sk': 'Iné príjmy'
  }
};

// Helper function to get user language from request
export function getUserLanguage(req: any): string {
  // First check the URL path for language preference
  const referer = req.headers.referer || req.headers.origin || req.url || '';
  
  console.log('Language detection - referer:', referer);
  console.log('Language detection - url:', req.url);
  
  // Check if URL contains language path
  if (referer.includes('/es/') || referer.includes('/es')) {
    console.log('Detected Spanish from URL');
    return 'es-pe'; // Spanish (Peru)
  }
  if (referer.includes('/sk/') || referer.includes('/sk')) {
    console.log('Detected Slovak from URL');
    return 'sk-sk'; // Slovak
  }
  if (referer.includes('/en/') || referer.includes('/en')) {
    console.log('Detected English from URL');
    return 'en-us'; // English
  }
  
  // Fallback to Accept-Language header
  const acceptLanguage = req.headers['accept-language'];
  console.log('Language detection - accept-language:', acceptLanguage);
  
  if (acceptLanguage) {
    // Parse the Accept-Language header to get the primary language
    const languages = acceptLanguage.split(',').map((lang: string) => {
      const [code, quality] = lang.trim().split(';q=');
      return { code: code.trim(), quality: quality ? parseFloat(quality) : 1 };
    }).sort((a: any, b: any) => b.quality - a.quality);
    
    const primaryLang = languages[0]?.code || 'en';
    console.log('Primary language from header:', primaryLang);
    
    // Map browser language codes to our supported locales
    if (primaryLang.startsWith('es')) {
      console.log('Detected Spanish from header');
      return 'es-pe'; // Spanish (Peru) for all Spanish variants
    } else if (primaryLang.startsWith('sk')) {
      console.log('Detected Slovak from header');
      return 'sk-sk'; // Slovak
    } else {
      console.log('Defaulting to English from header');
      return 'en-us'; // Default to English
    }
  }
  
  console.log('Using default fallback: en-us');
  return 'en-us'; // Default fallback
}

// Helper function to translate category name if it's predefined
export function translateCategoryName(categoryName: string, language: string): string {
  console.log(`Translating category: "${categoryName}" to language: "${language}"`);
  
  // Check if this is a predefined category
  const translation = categoryTranslations[categoryName as keyof typeof categoryTranslations];
  
  if (translation && translation[language as keyof typeof translation]) {
    const result = translation[language as keyof typeof translation];
    console.log(`Translation found: "${categoryName}" -> "${result}"`);
    return result;
  }
  
  console.log(`No translation found for "${categoryName}" in "${language}", keeping original`);
  // Return original name for custom categories or if no translation found
  return categoryName;
}

// Helper function to translate an array of categories
export function translateCategories(categories: any[], language: string): any[] {
  return categories.map(category => {
    // Only translate predefined categories (those with userId: null)
    if (category.userId === null) {
      return {
        ...category,
        name: translateCategoryName(category.name, language)
      };
    }
    
    // Keep custom categories unchanged
    return category;
  });
}