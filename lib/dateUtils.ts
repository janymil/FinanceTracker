import { getCurrentLanguageForAPI } from './languageUtils';

/**
 * Get the correct locale for date formatting based on current language
 * Returns locale codes compatible with toLocaleDateString()
 */
export function getDateLocale(): string {
  const currentLang = getCurrentLanguageForAPI();
  
  if (currentLang.startsWith('es')) {
    return 'es-ES'; // Spanish format: DD/MM/YYYY
  } else if (currentLang.startsWith('sk')) {
    return 'sk-SK'; // Slovak format
  } else {
    return 'en-US'; // English format: MM/DD/YYYY
  }
}

/**
 * Format a date string or Date object with proper localization
 * @param date - Date string or Date object
 * @param options - Intl.DateTimeFormatOptions
 */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const locale = getDateLocale();
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  };
  
  return dateObj.toLocaleDateString(locale, options || defaultOptions);
}

/**
 * Format a date for transaction display (short format)
 * Uses DD/MM/YYYY for Spanish, MM/DD/YYYY for English, DD.MM.YYYY for Slovak
 * This version works in both server and client environments
 */
export function formatTransactionDate(date: string | Date, language?: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Use provided language or try to detect from client-side context
  let currentLang: string = language || 'en-us';
  if (!language && typeof window !== 'undefined') {
    // Client-side: try to get from window.i18next or localStorage
    currentLang = (window as any).i18next?.language || localStorage.getItem('i18nextLng') || 'en-us';
  } else if (!language) {
    // Server-side fallback
    currentLang = getCurrentLanguageForAPI() || 'en-us';
  }
  
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  
  if (currentLang.startsWith('es')) {
    // Spanish: DD/MM/YYYY
    return `${day}/${month}/${year}`;
  } else if (currentLang.startsWith('sk')) {
    // Slovak: DD.MM.YYYY
    return `${day}.${month}.${year}`;
  } else {
    // English: MM/DD/YYYY
    return `${month}/${day}/${year}`;
  }
}

/**
 * Format a date for detailed display (long format)
 */
export function formatDetailedDate(date: string | Date): string {
  return formatDate(date, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Format month names for charts with proper localization
 */
export function formatChartMonth(dateString: string): string {
  const date = new Date(dateString + '-01');
  const currentLang = getCurrentLanguageForAPI();
  
  if (currentLang.startsWith('es')) {
    const spanishMonths = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${spanishMonths[date.getMonth()]} ${date.getFullYear()}`;
  } else if (currentLang.startsWith('sk')) {
    const slovakMonths = ['jan', 'feb', 'mar', 'apr', 'máj', 'jún', 'júl', 'aug', 'sep', 'okt', 'nov', 'dec'];
    return `${slovakMonths[date.getMonth()]} ${date.getFullYear()}`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
}