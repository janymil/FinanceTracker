/**
 * Centralized Date Range Utilities
 * Handles timezone-aware date calculations for consistent financial data
 */

export interface DateRange {
  startDate: Date;
  endDate: Date;
  startISO: string;
  endISO: string;
}

/**
 * Get user's timezone offset in minutes
 */
export function getUserTimezoneOffset(): number {
  return new Date().getTimezoneOffset();
}

/**
 * Create a date range for a specific month that works across all timezones
 * @param yearMonth - Format: "2025-06"
 * @returns DateRange object with proper start/end dates
 */
export function getMonthDateRange(yearMonth: string): DateRange {
  const [year, month] = yearMonth.split('-').map(Number);
  
  // Create dates in local timezone
  const startDate = new Date(year, month - 1, 1); // First day of month
  startDate.setHours(0, 0, 0, 0); // Start of day
  
  const endDate = new Date(year, month, 0); // Last day of month
  endDate.setHours(23, 59, 59, 999); // End of day
  
  return {
    startDate,
    endDate,
    startISO: startDate.toISOString(),
    endISO: endDate.toISOString()
  };
}

/**
 * Get date range for current month
 */
export function getCurrentMonthDateRange(): DateRange {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return getMonthDateRange(yearMonth);
}

/**
 * Get date range for last N months (for trends)
 * @param monthsBack - Number of months to go back
 */
export function getLastMonthsDateRange(monthsBack: number = 6): DateRange {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  endDate.setHours(23, 59, 59, 999);
  
  return {
    startDate,
    endDate,
    startISO: startDate.toISOString(),
    endISO: endDate.toISOString()
  };
}

/**
 * Get date range for a custom period
 * @param startDate - Start date
 * @param endDate - End date
 */
export function getCustomDateRange(startDate: Date, endDate: Date): DateRange {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  return {
    startDate: start,
    endDate: end,
    startISO: start.toISOString(),
    endISO: end.toISOString()
  };
}

/**
 * Debug function to log date range information
 */
export function debugDateRange(range: DateRange, label: string): void {
  console.log(`🗓️ ${label}:`, {
    startLocal: range.startDate.toLocaleString(),
    endLocal: range.endDate.toLocaleString(),
    startISO: range.startISO,
    endISO: range.endISO,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: getUserTimezoneOffset()
  });
}

/**
 * Get date range for specific month in current year
 * @param monthAbbr - Month abbreviation (jan, feb, mar, etc.)
 * @returns DateRange object for the specified month
 */
export function getSpecificMonthDateRange(monthAbbr: string): DateRange {
  const monthMap: { [key: string]: number } = {
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
  };
  
  const currentYear = new Date().getFullYear();
  const monthIndex = monthMap[monthAbbr.toLowerCase()];
  
  if (monthIndex === undefined) {
    throw new Error(`Invalid month abbreviation: ${monthAbbr}`);
  }
  
  const startDate = new Date(currentYear, monthIndex, 1);
  const endDate = new Date(currentYear, monthIndex + 1, 0, 23, 59, 59, 999);
  
  return {
    startDate,
    endDate,
    startISO: startDate.toISOString(),
    endISO: endDate.toISOString()
  };
}

/**
 * Get date range for current month
 */
export function getCurrentMonthOnlyDateRange(): DateRange {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  
  const startDate = new Date(currentYear, currentMonth, 1);
  const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
  
  return {
    startDate,
    endDate,
    startISO: startDate.toISOString(),
    endISO: endDate.toISOString()
  };
}

/**
 * Check if a date falls within a date range
 * @param date - Date to check
 * @param dateRange - Date range to check against
 */
export function isDateInRange(date: Date, dateRange: DateRange): boolean {
  return date >= dateRange.startDate && date <= dateRange.endDate;
}

/**
 * Get date range based on filter type
 * @param filterType - Date filter type
 */
export function getDateRangeForFilter(filterType: string): DateRange | null {
  const today = new Date();
  
  switch (filterType) {
    case "today":
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
      return {
        startDate: startOfDay,
        endDate: endOfDay,
        startISO: startOfDay.toISOString(),
        endISO: endOfDay.toISOString()
      };
      
    case "week":
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      return {
        startDate: weekAgo,
        endDate: today,
        startISO: weekAgo.toISOString(),
        endISO: today.toISOString()
      };
      
    case "month":
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      return {
        startDate: monthAgo,
        endDate: today,
        startISO: monthAgo.toISOString(),
        endISO: today.toISOString()
      };
      
    case "current-month":
      return getCurrentMonthOnlyDateRange();
      
    case "this-month":
      return getCurrentMonthOnlyDateRange();
      
    case "last-month":
      const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
      return {
        startDate: lastMonthDate,
        endDate: lastMonthEnd,
        startISO: lastMonthDate.toISOString(),
        endISO: lastMonthEnd.toISOString()
      };
      
    case "this-year":
      const yearStart = new Date(today.getFullYear(), 0, 1);
      const yearEnd = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
      return {
        startDate: yearStart,
        endDate: yearEnd,
        startISO: yearStart.toISOString(),
        endISO: yearEnd.toISOString()
      };
      
    case "last-30-days":
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      return {
        startDate: thirtyDaysAgo,
        endDate: today,
        startISO: thirtyDaysAgo.toISOString(),
        endISO: today.toISOString()
      };
      
    case "jan":
    case "feb":
    case "mar":
    case "apr":
    case "may":
    case "jun":
    case "jul":
    case "aug":
    case "sep":
    case "oct":
    case "nov":
    case "dec":
      return getSpecificMonthDateRange(filterType);
      
    default:
      return null;
  }
}