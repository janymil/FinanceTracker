import { normalizeLanguageCode } from '../lib/languageUtils';

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
  },
  
  // Goal categories
  'Emergency Fund': {
    'en-us': 'Emergency Fund',
    'es-pe': 'Fondo de emergencia',
    'sk-sk': 'Núdzový fond'
  },
  'Vacation': {
    'en-us': 'Vacation',
    'es-pe': 'Vacaciones',
    'sk-sk': 'Dovolenka'
  },
  'House Down Payment': {
    'en-us': 'House Down Payment',
    'es-pe': 'Pago inicial de casa',
    'sk-sk': 'Záloha na dom'
  },
  'Car Purchase': {
    'en-us': 'Car Purchase',
    'es-pe': 'Compra de auto',
    'sk-sk': 'Kúpa auta'
  },
  'Debt Payoff': {
    'en-us': 'Debt Payoff',
    'es-pe': 'Pago de deudas',
    'sk-sk': 'Splácanie dlhov'
  },
  'Retirement': {
    'en-us': 'Retirement',
    'es-pe': 'Jubilación',
    'sk-sk': 'Dôchodok'
  },
  'Other': {
    'en-us': 'Other',
    'es-pe': 'Otro',
    'sk-sk': 'Iné'
  },
  // Handle database values (processed category names from dropdown)
  'fondo_de_emergencia': {
    'en-us': 'Emergency Fund',
    'es-pe': 'Fondo de emergencia',
    'sk-sk': 'Núdzový fond'
  },
  'emergency_fund': {
    'en-us': 'Emergency Fund',
    'es-pe': 'Fondo de emergencia',
    'sk-sk': 'Núdzový fond'
  },
  'núdzový_fond': {
    'en-us': 'Emergency Fund',
    'es-pe': 'Fondo de emergencia',
    'sk-sk': 'Núdzový fond'
  },
  'vacation': {
    'en-us': 'Vacation',
    'es-pe': 'Vacaciones',
    'sk-sk': 'Dovolenka'
  },
  'vacaciones': {
    'en-us': 'Vacation',
    'es-pe': 'Vacaciones',
    'sk-sk': 'Dovolenka'
  },
  'dovolenka': {
    'en-us': 'Vacation',
    'es-pe': 'Vacaciones',
    'sk-sk': 'Dovolenka'
  },
  'house_down_payment': {
    'en-us': 'House Down Payment',
    'es-pe': 'Pago inicial de casa',
    'sk-sk': 'Záloha na dom'
  },
  'pago_inicial_de_casa': {
    'en-us': 'House Down Payment',
    'es-pe': 'Pago inicial de casa',
    'sk-sk': 'Záloha na dom'
  },
  'záloha_na_dom': {
    'en-us': 'House Down Payment',
    'es-pe': 'Pago inicial de casa',
    'sk-sk': 'Záloha na dom'
  },
  'car_purchase': {
    'en-us': 'Car Purchase',
    'es-pe': 'Compra de auto',
    'sk-sk': 'Kúpa auta'
  },
  'compra_de_auto': {
    'en-us': 'Car Purchase',
    'es-pe': 'Compra de auto',
    'sk-sk': 'Kúpa auta'
  },
  'kúpa_auta': {
    'en-us': 'Car Purchase',
    'es-pe': 'Compra de auto',
    'sk-sk': 'Kúpa auta'
  },
  'debt_payoff': {
    'en-us': 'Debt Payoff',
    'es-pe': 'Pago de deudas',
    'sk-sk': 'Splácanie dlhov'
  },
  'pago_de_deudas': {
    'en-us': 'Debt Payoff',
    'es-pe': 'Pago de deudas',
    'sk-sk': 'Splácanie dlhov'
  },
  'splácanie_dlhov': {
    'en-us': 'Debt Payoff',
    'es-pe': 'Pago de deudas',
    'sk-sk': 'Splácanie dlhov'
  },
  'retirement': {
    'en-us': 'Retirement',
    'es-pe': 'Jubilación',
    'sk-sk': 'Dôchodok'
  },
  'jubilación': {
    'en-us': 'Retirement',
    'es-pe': 'Jubilación',
    'sk-sk': 'Dôchodok'
  },
  'dôchodok': {
    'en-us': 'Retirement',
    'es-pe': 'Jubilación',
    'sk-sk': 'Dôchodok'
  },
  'other': {
    'en-us': 'Other',
    'es-pe': 'Otro',
    'sk-sk': 'Iné'
  },
  'otro': {
    'en-us': 'Other',
    'es-pe': 'Otro',
    'sk-sk': 'Iné'
  },
  'iné': {
    'en-us': 'Other',
    'es-pe': 'Otro',
    'sk-sk': 'Iné'
  },
  // Additional collaborative goal categories
  'Wedding': {
    'en-us': 'Wedding',
    'es-pe': 'Boda',
    'sk-sk': 'Svadba'
  },
  'wedding': {
    'en-us': 'Wedding',
    'es-pe': 'Boda',
    'sk-sk': 'Svadba'
  },
  'boda': {
    'en-us': 'Wedding',
    'es-pe': 'Boda',
    'sk-sk': 'Svadba'
  },
  'svadba': {
    'en-us': 'Wedding',
    'es-pe': 'Boda',
    'sk-sk': 'Svadba'
  },
  'Home': {
    'en-us': 'Home',
    'es-pe': 'Casa',
    'sk-sk': 'Dom'
  },
  'home': {
    'en-us': 'Home',
    'es-pe': 'Casa',
    'sk-sk': 'Dom'
  },
  'casa': {
    'en-us': 'Home',
    'es-pe': 'Casa',
    'sk-sk': 'Dom'
  },
  'dom': {
    'en-us': 'Home',
    'es-pe': 'Casa',
    'sk-sk': 'Dom'
  },
  'education': {
    'en-us': 'Education',
    'es-pe': 'Educación',
    'sk-sk': 'Vzdelanie'
  },
  'educación': {
    'en-us': 'Education',
    'es-pe': 'Educación',
    'sk-sk': 'Vzdelanie'
  },
  'vzdelanie': {
    'en-us': 'Education',
    'es-pe': 'Educación',
    'sk-sk': 'Vzdelanie'
  },
  'Emergency': {
    'en-us': 'Emergency',
    'es-pe': 'Emergencia',
    'sk-sk': 'Núdzové'
  },
  'emergency': {
    'en-us': 'Emergency',
    'es-pe': 'Emergencia',
    'sk-sk': 'Núdzové'
  },
  'emergencia': {
    'en-us': 'Emergency',
    'es-pe': 'Emergencia',
    'sk-sk': 'Núdzové'
  },
  'núdzové': {
    'en-us': 'Emergency',
    'es-pe': 'Emergencia',
    'sk-sk': 'Núdzové'
  },
  'Investment': {
    'en-us': 'Investment',
    'es-pe': 'Inversión',
    'sk-sk': 'Investícia'
  },
  'investment': {
    'en-us': 'Investment',
    'es-pe': 'Inversión',
    'sk-sk': 'Investícia'
  },
  'inversión': {
    'en-us': 'Investment',
    'es-pe': 'Inversión',
    'sk-sk': 'Investícia'
  },
  'investícia': {
    'en-us': 'Investment',
    'es-pe': 'Inversión',
    'sk-sk': 'Investícia'
  }
};

// Helper function to get user language from request with improved detection
export function getUserLanguage(req: any): string {
  // Priority 1: Check for custom language header from frontend (most reliable)
  const userLanguage = req.headers['x-user-language'];
  if (userLanguage && typeof userLanguage === 'string') {
    const normalized = normalizeLanguageCode(userLanguage);
    console.log(`[Lang Detection] Using x-user-language header: ${userLanguage} -> ${normalized}`);
    return normalized;
  }
  
  // Priority 2: Extract language from URL path (more reliable than referer)
  const urlPath = req.url || req.originalUrl || '';
  const urlMatch = urlPath.match(/^\/(en|es|sk)\b/);
  if (urlMatch) {
    const langFromUrl = normalizeLanguageCode(urlMatch[1]);
    console.log(`[Lang Detection] Using URL path: ${urlMatch[1]} -> ${langFromUrl}`);
    return langFromUrl;
  }
  
  // Priority 3: Check referer header for language preference
  const referer = req.headers.referer || req.headers.origin || '';
  if (referer && typeof referer === 'string') {
    const refererMatch = referer.match(/\/(en|es|sk)(?:\/|$)/);
    if (refererMatch) {
      const langFromReferer = normalizeLanguageCode(refererMatch[1]);
      console.log(`[Lang Detection] Using referer: ${refererMatch[1]} -> ${langFromReferer}`);
      return langFromReferer;
    }
  }
  
  // Priority 4: Parse Accept-Language header (browser preference)
  const acceptLanguage = req.headers['accept-language'];
  if (acceptLanguage && typeof acceptLanguage === 'string') {
    try {
      const languages = acceptLanguage.split(',').map((lang: string) => {
        const [code, quality] = lang.trim().split(';q=');
        return { 
          code: code.trim(), 
          quality: quality ? parseFloat(quality) || 1 : 1 
        };
      }).sort((a: any, b: any) => b.quality - a.quality);
      
      const primaryLang = languages[0]?.code;
      if (primaryLang) {
        const langFromAccept = normalizeLanguageCode(primaryLang);
        console.log(`[Lang Detection] Using Accept-Language: ${primaryLang} -> ${langFromAccept}`);
        return langFromAccept;
      }
    } catch (error) {
      console.warn('[Lang Detection] Failed to parse Accept-Language header:', error);
    }
  }
  
  console.log('[Lang Detection] Using default fallback: en-us');
  return 'en-us'; // Default fallback
}

// Helper function to translate category name if it's predefined
export function translateCategoryName(categoryName: string, language: string): string {
  // Handle translation keys like "categories.transportation"
  if (categoryName.startsWith('categories.')) {
    const keyName = categoryName.replace('categories.', '');
    
    // Map common translation keys to category names
    const keyMappings: Record<string, string> = {
      'transportation': 'Transportation',
      'healthcare': 'Healthcare', 
      'shopping': 'Shopping',
      'housing': 'Housing',
      'entertainment': 'Entertainment',
      'food': 'Food',
      'utilities': 'Utilities',
      'education': 'Education',
      'travel': 'Travel',
      'business': 'Business',
      'other': 'Other',
      'salary': 'Salary',
      'freelance': 'Freelance',
      'investments': 'Investments'
    };
    
    const mappedName = keyMappings[keyName] || keyName;
    const translation = categoryTranslations[mappedName as keyof typeof categoryTranslations];
    
    if (translation && translation[language as keyof typeof translation]) {
      return translation[language as keyof typeof translation];
    }
    
    // Return mapped name if no translation found
    return mappedName;
  }
  
  // Check if this is a predefined category
  const translation = categoryTranslations[categoryName as keyof typeof categoryTranslations];
  
  if (translation && translation[language as keyof typeof translation]) {
    return translation[language as keyof typeof translation];
  }
  
  // Return original name for custom categories or if no translation found
  return categoryName;
}

// Helper function to translate an array of categories
export function translateCategories(categories: any[], language: string): any[] {
  return categories.map(category => {
    // Translate predefined categories (those with userId: null)
    if (category.userId === null) {
      return {
        ...category,
        name: translateCategoryName(category.name, language)
      };
    }
    
    // Also translate user categories that contain translation keys (like "categories.jedlo")
    if (category.name && category.name.startsWith('categories.')) {
      return {
        ...category,
        name: translateCategoryName(category.name, language)
      };
    }
    
    // Keep other custom categories unchanged
    return category;
  });
}