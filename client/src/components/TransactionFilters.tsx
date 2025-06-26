import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Filter } from "lucide-react";

interface TransactionFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterType?: string;
  onTypeChange?: (value: string) => void;
  filterCategory: string;
  onCategoryChange: (value: string) => void;
  filterRecurring: string;
  onRecurringChange: (value: string) => void;
  dateRange: string;
  onDateRangeChange: (value: string) => void;
  availableCategories: string[];
  showTypeFilter?: boolean;
  searchPlaceholder?: string;
}

export default function TransactionFilters({
  searchTerm,
  onSearchChange,
  filterType = "all",
  onTypeChange,
  filterCategory,
  onCategoryChange,
  filterRecurring,
  onRecurringChange,
  dateRange,
  onDateRangeChange,
  availableCategories,
  showTypeFilter = true,
  searchPlaceholder = "Search transactions..."
}: TransactionFiltersProps) {
  const { t } = useTranslation();
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = (showTypeFilter && filterType !== "all") || 
                          filterCategory !== "all" || 
                          filterRecurring !== "all" || 
                          dateRange !== "all";

  const clearAllFilters = () => {
    if (showTypeFilter && onTypeChange) {
      onTypeChange("all");
    }
    onCategoryChange("all");
    onRecurringChange("all");
    onDateRangeChange("all");
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        {/* Search and Filter Toggle */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-1 min-w-0">
            <Label htmlFor="search" className="text-sm font-medium">{t("Search")}</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                className="pl-10"
                placeholder={t(searchPlaceholder)}
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="shrink-0"
          >
            <Filter className="h-4 w-4 mr-2" />
            {t("Filters")}
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2 px-1 py-0 text-xs">
                {t("Active")}
              </Badge>
            )}
          </Button>
        </div>

        {/* Collapsible filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {showTypeFilter && onTypeChange && (
                <div>
                  <Label className="text-sm font-medium">{t("Type")}</Label>
                  <Select value={filterType} onValueChange={onTypeChange}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("All Types")}</SelectItem>
                      <SelectItem value="income">{t("Income")}</SelectItem>
                      <SelectItem value="expense">{t("Expense")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium">{t("Category")}</Label>
                <Select value={filterCategory} onValueChange={onCategoryChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("All Categories")}</SelectItem>
                    {availableCategories.filter(Boolean).map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">{t("Recurring")}</Label>
                <Select value={filterRecurring} onValueChange={onRecurringChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("All Transactions")}</SelectItem>
                    <SelectItem value="recurring">{t("Recurring Only")}</SelectItem>
                    <SelectItem value="one-time">{t("One-time Only")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">{t("Date Range")}</Label>
                <Select value={dateRange} onValueChange={onDateRangeChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("All Time")}</SelectItem>
                    <SelectItem value="today">{t("Today")}</SelectItem>
                    <SelectItem value="week">{t("Last Week")}</SelectItem>
                    <SelectItem value="month">{t("Last Month")}</SelectItem>
                    <SelectItem value="current-month">{t("This Month")}</SelectItem>
                    <SelectItem value="jan">{t("January")}</SelectItem>
                    <SelectItem value="feb">{t("February")}</SelectItem>
                    <SelectItem value="mar">{t("March")}</SelectItem>
                    <SelectItem value="apr">{t("April")}</SelectItem>
                    <SelectItem value="may">{t("May")}</SelectItem>
                    <SelectItem value="jun">{t("June")}</SelectItem>
                    <SelectItem value="jul">{t("July")}</SelectItem>
                    <SelectItem value="aug">{t("August")}</SelectItem>
                    <SelectItem value="sep">{t("September")}</SelectItem>
                    <SelectItem value="oct">{t("October")}</SelectItem>
                    <SelectItem value="nov">{t("November")}</SelectItem>
                    <SelectItem value="dec">{t("December")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Clear filters button */}
            {hasActiveFilters && (
              <div className="mt-4 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                >
                  {t("Clear all filters")}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}