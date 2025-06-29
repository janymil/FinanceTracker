import { useTranslation } from "react-i18next";
import { formatTransactionDate } from "../../../lib/dateUtils";

/**
 * Hook that provides consistent date formatting across all components
 * Uses the current language from i18n context
 */
export function useDateFormat() {
  const { i18n } = useTranslation();
  
  const formatDate = (date: string | Date): string => {
    return formatTransactionDate(date, i18n.language);
  };
  
  return { formatDate };
}