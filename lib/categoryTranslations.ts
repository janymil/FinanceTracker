import { normalizeLanguageCode } from './languageUtils';

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
  'Insurance': {
    'en-us': 'Insurance',
    'es-pe': 'Seguros',
    'sk-sk': 'Poistenie'
  },
  'Personal Care': {
    'en-us': 'Personal Care',
    'es-pe': 'Cuidado personal',
    'sk-sk': 'Osobná starostlivosť'
  },
  'Gifts': {
    'en-us': 'Gifts',
    'es-pe': 'Regalos',
    'sk-sk': 'Darčeky'
  },
  'Business': {
    'en-us': 'Business',
    'es-pe': 'Negocios',
    'sk-sk': 'Podnikanie'
  },
  'Other': {
    'en-us': 'Other',
    'es-pe': 'Otro',
    'sk-sk': 'Iné'
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
    'sk-sk': 'Freelance'
  },
  'Investment': {
    'en-us': 'Investment',
    'es-pe': 'Inversión',
    'sk-sk': 'Investícia'
  },
  'Bonus': {
    'en-us': 'Bonus',
    'es-pe': 'Bono',
    'sk-sk': 'Bonus'
  },
  'Gift': {
    'en-us': 'Gift',
    'es-pe': 'Regalo',
    'sk-sk': 'Darček'
  }
} as const;

/**
 * Get user language from request or fallback
 */
export function getUserLanguage(req?: any): string {
  if (typeof window !== 'undefined') {
    // Client-side: get from localStorage or browser
    const savedLang = localStorage.getItem('language');
    if (savedLang) return normalizeLanguageCode(savedLang);
    return normalizeLanguageCode(navigator.language);
  }
  
  // Server-side: get from request headers
  if (req?.headers?.['x-user-language']) {
    return normalizeLanguageCode(req.headers['x-user-language']);
  }
  
  // Fallback to English
  return 'en-us';
}

/**
 * Translate category name to user's language
 */
export function translateCategoryName(categoryName: string, language?: string): string {
  if (!language) {
    language = getUserLanguage();
  }
  
  const normalizedLang = normalizeLanguageCode(language);
  const translation = categoryTranslations[categoryName as keyof typeof categoryTranslations];
  
  if (translation && translation[normalizedLang as keyof typeof translation]) {
    return translation[normalizedLang as keyof typeof translation];
  }
  
  // Return original category name if no translation found
  return categoryName;
}

/**
 * Translate array of categories
 */
export function translateCategories(categories: any[], language?: string): any[] {
  return categories.map(category => ({
    ...category,
    name: translateCategoryName(category.name, language)
  }));
}