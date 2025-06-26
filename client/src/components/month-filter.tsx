import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

interface MonthFilterProps {
  selectedMonth: string | null;
  onMonthSelect: (month: string | null) => void;
  onDateRangeReset?: () => void;
}

export default function MonthFilter({ selectedMonth, onMonthSelect, onDateRangeReset }: MonthFilterProps) {
  const [monthOffset, setMonthOffset] = useState(8); // Start showing the last 4 months
  const { t } = useTranslation();

  // Helper function to get translated month name
  const getTranslatedMonthName = (date: Date, short = false) => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const shortMonthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    
    const monthIndex = date.getMonth();
    const monthName = short ? shortMonthNames[monthIndex] : monthNames[monthIndex];
    return t(monthName);
  };

  // Generate month navigation data (last 12 months including current)
  const generateMonthData = () => {
    const months = [];
    const today = new Date();
    
    // Start from current month and go back 11 months (total 12 months)
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push({
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: `${getTranslatedMonthName(date, true)} ${date.getFullYear()}`,
        month: date.getMonth(),
        year: date.getFullYear(),
      });
    }
    return months.reverse(); // Reverse to show oldest to newest
  };

  const monthData = generateMonthData();
  const visibleMonths = monthData.slice(monthOffset, monthOffset + 4);

  const handleMonthSelect = (monthKey: string) => {
    const newMonth = monthKey === selectedMonth ? null : monthKey;
    onMonthSelect(newMonth);
    if (newMonth && onDateRangeReset) {
      onDateRangeReset(); // Reset date range when using month filter
    }
  };

  const handlePrevMonths = () => {
    if (monthOffset > 0) {
      setMonthOffset(monthOffset - 1);
    }
  };

  const handleNextMonths = () => {
    if (monthOffset < monthData.length - 4) {
      setMonthOffset(monthOffset + 1);
    }
  };

  return (
    <Card className="mb-4">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("Filter by Month")}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevMonths}
              disabled={monthOffset === 0}
              className="h-8 w-8 p-0 shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex gap-1 min-w-0">
              {visibleMonths.map((month) => (
                <Button
                  key={month.key}
                  variant={selectedMonth === month.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleMonthSelect(month.key)}
                  className="h-8 px-2 sm:px-3 text-xs whitespace-nowrap shrink-0"
                >
                  <span className="hidden sm:inline">{month.label}</span>
                  <span className="sm:hidden">{getTranslatedMonthName(new Date(month.year, month.month), true)}</span>
                </Button>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextMonths}
              disabled={monthOffset >= monthData.length - 4}
              className="h-8 w-8 p-0 shrink-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {selectedMonth && (
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {t("Filtering by")}: {visibleMonths.find(m => m.key === selectedMonth)?.label || selectedMonth}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMonthSelect(null)}
              className="h-6 px-2 text-xs"
            >
              {t("Clear")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}