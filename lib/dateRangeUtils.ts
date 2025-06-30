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