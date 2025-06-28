import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, TrendingUp, Repeat } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Crown, Edit, Trash2, MoreHorizontal, Receipt } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import ReceiptModal from "@/components/receipt-modal";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";


interface Transaction {
  id: number;
  amount: string;
  description: string;
  date: string;
  type: 'income' | 'expense';
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  imageUrl?: string;
  ocrText?: string;
  ocrVendor?: string;
  ocrDetectedAmount?: string;
  ocrDetectedDate?: string;
  isRecurring?: boolean;
  recurringFrequency?: string;
}

interface SimpleTransactionListProps {
  transactions?: Transaction[];
  isLoading: boolean;
}

export default function SimpleTransactionList({ transactions, isLoading }: SimpleTransactionListProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const { user } = useUser();
  const { toast } = useToast();
  const { t } = useTranslation();

  // Fetch categories for edit form
  useEffect(() => {
    const fetchCategories = async () => {
      if (!user?.id) return;
      try {
        const response = await apiRequest("GET", "/api/categories");
        const data = await response.json();
        setCategories(data);
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      }
    };
    fetchCategories();
  }, [user?.id]);

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(parseFloat(amount)));
  };

  const { i18n } = useTranslation();
  const currentLang = i18n.language || 'en-us';
  let locale = 'en-us';
  
  if (currentLang.startsWith('es')) {
    locale = 'es-pe';
  } else if (currentLang.startsWith('sk')) {
    locale = 'sk-sk';
  }
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDelete = async (transactionId: number) => {
    setIsDeleting(transactionId);
    try {
      await apiRequest("DELETE", `/api/transactions/${transactionId}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/transactions", user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["/api/financial-summary", user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["/api/budgets", user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["/api/financial-health", user?.id] });
      toast({
        title: "Transaction Deleted",
        description: "Transaction has been successfully deleted",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete transaction",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleEdit = async (transaction: Transaction) => {
    if (!editingTransaction) return;

    try {
      const updateData = {
        amount: parseFloat(editingTransaction.amount),
        description: editingTransaction.description,
        date: editingTransaction.date,
        type: editingTransaction.type,
        categoryId: editingTransaction.categoryName ? 
          categories.find(c => c.name === editingTransaction.categoryName)?.id : null
      };

      await apiRequest("PUT", `/api/transactions/${editingTransaction.id}`, updateData);
      await queryClient.invalidateQueries({ queryKey: ["/api/transactions", user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["/api/financial-summary", user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["/api/budgets", user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["/api/financial-health", user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["/api/transaction-reminders"] });

      setEditingTransaction(null);
      toast({
        title: "Transaction Updated",
        description: "Transaction has been successfully updated",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update transaction",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-white dark:bg-gray-800">
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
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

  const displayTransactions = (transactions || []).slice(0, 5);



  return (
    <Card className="bg-white dark:bg-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{t('Recent Transactions')}</CardTitle>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {t('Last 5 transactions')}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>{t('No transactions found')}</p>
              <p className="text-sm">{t('Start by adding your first transaction')}</p>
            </div>
          ) : (
            displayTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
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

                  {/* Receipt thumbnail */}
                  {transaction.imageUrl && (
                    <div className="hidden sm:block">
                      <div 
                        className="relative cursor-pointer group"
                        onClick={() => setSelectedTransaction(transaction)}
                      >
                        <img
                          src={transaction.imageUrl}
                          alt="Receipt thumbnail"
                          className="w-10 h-10 object-cover rounded border group-hover:opacity-80 transition-opacity"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded">
                          <Receipt className="h-3 w-3 text-white opacity-0 group-hover:opacity-100" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 overflow-visible">
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {transaction.description}
                        </p>
                        {transaction.isRecurring && (
                          <Badge variant="outline" className="text-xs border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-300">
                            <Repeat className="h-3 w-3 mr-1" />
                            {t('Recurring')}
                          </Badge>
                        )}
                      </div>
                      {transaction.isRecurring && (
                        <Badge variant="outline" className="text-xs shrink-0 border-blue-200 text-blue-700 dark:border-blue-700 dark:text-blue-300 flex items-center ml-2">
                          <Repeat className="h-3 w-3 mr-1" />
                          {transaction.recurringFrequency ? t(transaction.recurringFrequency === 'weekly' ? 'Weekly' : transaction.recurringFrequency === 'monthly' ? 'Monthly' : transaction.recurringFrequency === 'yearly' ? 'Yearly' : 'Daily') : t('recurring.title', 'Recurring')}
                        </Badge>
                      )}
                      {transaction.imageUrl && (
                        <Badge variant="secondary" className="text-xs sm:hidden shrink-0">
                          <Receipt className="h-3 w-3" />
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
                      <span className="truncate">{transaction.categoryName || 'Uncategorized'}</span>
                      <span className="shrink-0">•</span>
                      <span className="shrink-0">{formatDate(transaction.date)}</span>
                      {transaction.ocrVendor && transaction.ocrVendor !== transaction.description && (
                        <>
                          <span className="hidden md:inline shrink-0">•</span>
                          <span className="hidden md:inline text-blue-600 dark:text-blue-400 text-xs truncate">
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
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <span className={`font-semibold text-sm ${
                      transaction.type === 'expense' ? 'text-destructive' : 'text-success'
                    }`}>
                      {transaction.type === 'expense' ? '-' : '+'}{formatCurrency(transaction.amount)}
                    </span>
                    {transaction.ocrDetectedAmount && 
                     transaction.ocrDetectedAmount !== transaction.amount && (
                      <div className="text-xs text-gray-500 hidden sm:block">
                        OCR: ${transaction.ocrDetectedAmount}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => setEditingTransaction(transaction)}
                        className="cursor-pointer"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(transaction.id)}
                        disabled={isDeleting === transaction.id}
                        className="cursor-pointer text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {isDeleting === transaction.id ? "Deleting..." : "Delete"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 mb-2">
            Free plan: {transactions?.length || 0}/100 transaction entries used
          </div>
          <Link href="/subscribe">
            <Button variant="ghost" className="w-full text-premium hover:text-premium/80">
              <Crown className="h-4 w-4 mr-2" />
              Upgrade for unlimited transaction storage
            </Button>
          </Link>
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

        {/* Edit Transaction Modal */}
        {editingTransaction && (
          <Dialog open={!!editingTransaction} onOpenChange={(open) => !open && setEditingTransaction(null)}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Edit Transaction</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={editingTransaction.amount}
                    onChange={(e) => setEditingTransaction({
                      ...editingTransaction,
                      amount: e.target.value
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={editingTransaction.description}
                    onChange={(e) => setEditingTransaction({
                      ...editingTransaction,
                      description: e.target.value
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={editingTransaction.date.split('T')[0]}
                    onChange={(e) => setEditingTransaction({
                      ...editingTransaction,
                      date: e.target.value
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select 
                    value={editingTransaction.type} 
                    onValueChange={(value: 'income' | 'expense') => setEditingTransaction({
                      ...editingTransaction,
                      type: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select 
                    value={editingTransaction.categoryName || ''} 
                    onValueChange={(value) => setEditingTransaction({
                      ...editingTransaction,
                      categoryName: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setEditingTransaction(null)}
                >
                  Cancel
                </Button>
                <Button onClick={() => handleEdit(editingTransaction)}>
                  Save Changes
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 mb-2">
          Free plan: {transactions?.length || 0}/100 transaction entries used
        </div>
        <Link href="/transactions" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium">
          {t("View All Transactions")}
        </Link>
      </div>
    </Card>
  );
}