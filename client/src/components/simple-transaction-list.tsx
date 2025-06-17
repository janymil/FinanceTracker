import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Crown, TrendingDown, TrendingUp, Receipt } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import ReceiptModal from "@/components/receipt-modal";

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
}

interface SimpleTransactionListProps {
  transactions?: Transaction[];
  isLoading: boolean;
}

export default function SimpleTransactionList({ transactions, isLoading }: SimpleTransactionListProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(parseFloat(amount)));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
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
          <CardTitle className="text-lg font-semibold">Recent Transactions</CardTitle>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Last 5 transactions
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>No transactions found</p>
              <p className="text-sm">Start by adding your first transaction</p>
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
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {transaction.description}
                      </p>
                      {transaction.imageUrl && (
                        <Badge variant="secondary" className="text-xs sm:hidden">
                          <Receipt className="h-3 w-3" />
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>{transaction.categoryName || 'Uncategorized'}</span>
                      <span>•</span>
                      <span>{formatDate(transaction.date)}</span>
                      {transaction.ocrVendor && transaction.ocrVendor !== transaction.description && (
                        <>
                          <span className="hidden md:inline">•</span>
                          <span className="hidden md:inline text-blue-600 dark:text-blue-400 text-xs">
                            OCR: {transaction.ocrVendor}
                          </span>
                        </>
                      )}
                    </div>
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
                      <div className="text-xs text-gray-500 hidden sm:block">
                        OCR: ${transaction.ocrDetectedAmount}
                      </div>
                    )}
                  </div>
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
      </CardContent>
    </Card>
  );
}