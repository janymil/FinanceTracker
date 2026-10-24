import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Currency names in the page language ("Sol peruano", "Mexican Peso", "Peruánsky sol"),
 * from the browser's own data, so no list of translated names has to be maintained.
 */
export function useCurrencyNames(): (code: string) => string {
  const { i18n } = useTranslation();
  const language = (i18n.language || 'en').slice(0, 2);

  return useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([language], { type: 'currency' });
    } catch {
      names = null;
    }
    return (code: string) => {
      try {
        return names?.of(code) ?? code;
      } catch {
        return code;
      }
    };
  }, [language]);
}
