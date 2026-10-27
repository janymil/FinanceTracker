import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Trash2, Filter, TrendingDown, TrendingUp, ChevronDown, ChevronUp, Receipt, Repeat } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ReceiptModal from "@/components/receipt-modal";
import { useTranslation } from "react-i18next";
import { useDateFormat } from "@/hooks/useDateFormat";


interface Transaction {
  id: number;
  amount: string;
  description: string;
  date: string;
  type: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  imageUrl?: string;
  ocrText?: string;
  ocrVendor?: string;
  ocrDetectedAmount?: string;
  ocrDetectedDate?: string;
  isRecurring?: boolean;
  referenceNote?: string;
}

interface TransactionListProps {
  transactions?: Transaction[];
  isLoading: boolean;
  isPremium: boolean;
}

export default function TransactionList({ transactions, isLoading, isPremium }: TransactionListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [, setLocation] = useLocation();
  const [expandedTransactions, setExpandedTransactions] = useState<Set<number>>(new Set());
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const { t } = useTranslation();
  const { formatDate } = useDateFormat();
  const { toast } = useToast();

  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      toast({
        title: t("common.success"),
        description: t("transactions.deleted_success"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter and search transactions
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];

    let filtered = transactions.filter(transaction => {
      // Search filter
      const matchesSearch = searchTerm === "" || 
        transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (transaction.categoryName && transaction.categoryName.toLowerCase().includes(searchTerm.toLowerCase()));

      // Type filter
      const matchesType = filterType === "all" || transaction.type === filterType;

      return matchesSearch && matchesType;
    });

    // Show only last 5 transactions
    return filtered.slice(0, 5);
  }, [transactions, searchTerm, filterType]);

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(parseFloat(amount)));
  };

  // Using centralized date formatting from lib/dateUtils

  const getCategoryIcon = (icon?: string) => {
    const iconMap: { [key: string]: string } = {
      'utensils': '🍽️',
      'film': '🎬',
      'home': '🏠',
      'car': '🚗',
      'heart': '❤️',
      'shopping-bag': '🛍️',
      'dollar-sign': '💰',
      'laptop': '💻',
      'trending-up': '📈',
    };
    return iconMap[icon || ''] || '💰';
  };

  const toggleTransactionExpansion = (transactionId: number) => {
    setExpandedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  };

  const hasOcrData = (transaction: Transaction) => {
    return transaction.ocrVendor || transaction.ocrDetectedAmount || transaction.ocrDetectedDate || transaction.ocrText;
  };

  if (isLoading) {
    return (
      <Card className="bg-white dark:bg-gray-800">
        <CardHeader>
          <CardTitle>{t('Recent Transactions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{t('Recent Transactions')}</CardTitle>
          <div className="flex items-center space-x-2">
            <Input 
              placeholder={t('Search transactions...')} 
              className="w-48 h-8 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button aria-label={t('a11y.filters')} size="sm" variant="outline">
                  <Filter className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48" align="end">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">{t('Filter by type')}</h4>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('All transactions')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('All transactions')}</SelectItem>
                      <SelectItem value="expense">{t('Expenses only')}</SelectItem>
                      <SelectItem value="income">{t('Income only')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>{t('No transactions found')}</p>
              <p className="text-sm">{t('Start by adding your first transaction')}</p>
            </div>
          ) : (
            filteredTransactions.map((transaction) => {
              const isExpanded = expandedTransactions.has(transaction.id);
              const showOcrData = hasOcrData(transaction);

              return (
                <div key={transaction.id} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className={`p-2 rounded-lg text-lg ${
                        transaction.type === 'income' 
                          ? 'bg-green-100 dark:bg-green-900' 
                          : 'bg-red-100 dark:bg-red-900'
                      }`}>
                        {transaction.type === 'income' ? (
                          <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                        )}
                      </div>

                      {/* Receipt thumbnail for desktop */}
                      {transaction.imageUrl && (
                        <div className="hidden md:block">
                          <div 
                            className="relative cursor-pointer group"
                            onClick={() => setSelectedTransaction(transaction)}
                          >
                            <img
                              src={transaction.imageUrl}
                              alt="Receipt thumbnail"
                              className="w-12 h-12 object-cover rounded border group-hover:opacity-80 transition-opacity"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded">
                              <Receipt className="h-4 w-4 text-white opacity-0 group-hover:opacity-100" />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {transaction.description}
                          </p>
                          {transaction.imageUrl && (
                            <Badge variant="secondary" className="text-xs">
                              <Receipt className="h-3 w-3 mr-1" />
                              Receipt
                            </Badge>
                          )}
                          {transaction.isRecurring && (
                            <Badge variant="outline" className="text-xs border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-300">
                              <Repeat className="h-3 w-3 mr-1" />
                              {t("Recurring")}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                          <span>{transaction.categoryName || 'Uncategorized'}</span>
                          <span>•</span>
                          <span>{formatDate(transaction.date)}</span>
                          {transaction.ocrVendor && transaction.ocrVendor !== transaction.description && (
                            <>
                              <span>•</span>
                              <span className="text-blue-600 dark:text-blue-400">
                                OCR: {transaction.ocrVendor}
                              </span>
                            </>
                          )}
                        </div>
                        {transaction.referenceNote && (
                          <div className="text-sm text-gray-600 dark:text-gray-300 mt-1 italic">
                            Note: {transaction.referenceNote}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <span className={`font-semibold ${
                          transaction.type === 'expense' ? 'text-destructive' : 'text-success'
                        }`}>
                          {transaction.type === 'expense' ? '-' : '+'}{formatCurrency(transaction.amount)}
                        </span>
                        {transaction.ocrDetectedAmount && 
                         transaction.ocrDetectedAmount !== transaction.amount && (
                          <div className="text-xs text-gray-500">
                            OCR: ${transaction.ocrDetectedAmount}
                          </div>
                        )}
                      </div>

                      {(showOcrData || transaction.imageUrl) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleTransactionExpansion(transaction.id)}
                          className="h-8 w-8 p-0"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      )}

                      {isPremium && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-gray-400 hover:text-destructive"
                          aria-label={t("transactions.deleteLabel")}
                          title={t("transactions.deleteLabel")}
                          onClick={() => {
                            // Deleting leaves no trace: ask first, and say so.
                            if (window.confirm(t("transactions.confirmDelete"))) {
                              deleteTransactionMutation.mutate(transaction.id);
                            }
                          }}
                          disabled={deleteTransactionMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expanded OCR details */}
                  {isExpanded && (showOcrData || transaction.imageUrl) && (
                    <div className="border-t bg-gray-50 dark:bg-gray-800 p-4 space-y-3">
                      {/* Mobile receipt image */}
                      {transaction.imageUrl && (
                        <div className="md:hidden">
                          <div 
                            className="relative cursor-pointer group"
                            onClick={() => setSelectedTransaction(transaction)}
                          >
                            <img
                              src={transaction.imageUrl}
                              alt="Receipt"
                              className="w-24 h-24 object-cover rounded border group-hover:opacity-80 transition-opacity"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded">
                              <Receipt className="h-5 w-5 text-white opacity-0 group-hover:opacity-100" />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* OCR Data */}
                      {showOcrData && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Receipt Information (OCR)
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                            {transaction.ocrVendor && (
                              <div>
                                <span className="font-medium">Vendor:</span>
                                <span className="ml-1 text-gray-600 dark:text-gray-400">
                                  {transaction.ocrVendor}
                                </span>
                              </div>
                            )}
                            {transaction.ocrDetectedAmount && (
                              <div>
                                <span className="font-medium">Original Amount:</span>
                                <span className="ml-1 text-gray-600 dark:text-gray-400">
                                  ${transaction.ocrDetectedAmount}
                                </span>
                              </div>
                            )}
                            {transaction.ocrDetectedDate && (
                              <div>
                                <span className="font-medium">Receipt Date:</span>
                                <span className="ml-1 text-gray-600 dark:text-gray-400">
                                  {formatDate(transaction.ocrDetectedDate)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Full OCR text - collapsed by default */}
                          {transaction.ocrText && (
                            <Collapsible>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 text-xs">
                                  <Receipt className="h-3 w-3 mr-1" />
                                  View Full Receipt Text
                                  <ChevronDown className="h-3 w-3 ml-1" />
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="mt-2">
                                <div className="bg-white dark:bg-gray-900 p-3 rounded border text-xs font-mono max-h-40 overflow-y-auto">
                                  {transaction.ocrText}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <Button 
            variant="ghost" 
            className="w-full text-primary hover:text-primary/80"
            onClick={() => setLocation('/transactions')}
          >
            {t("View All Transactions")}
          </Button>
        </div>

        {/* Receipt Modal */}
        {selectedTransaction && (
          <ReceiptModal
            isOpen={!!selectedTransaction}
            onOpenChange={(open) => !open && setSelectedTransaction(null)}
            transaction={{
              id: selectedTransaction.id,
              description: selectedTransaction.description,
              amount: selectedTransaction.amount,
              date: selectedTransaction.date,
              imageUrl: selectedTransaction.imageUrl,
              ocrText: selectedTransaction.ocrText,
              ocrVendor: selectedTransaction.ocrVendor,
              ocrDetectedAmount: selectedTransaction.ocrDetectedAmount,
              ocrDetectedDate: selectedTransaction.ocrDetectedDate,
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}