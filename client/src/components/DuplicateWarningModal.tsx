import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Calendar, DollarSign, FileText, TrendingDown, TrendingUp } from "lucide-react";

interface DuplicateDetection {
  extractedTransaction: {
    date: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    confidence: number;
  };
  existingTransactions: {
    id: number;
    date: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
  }[];
  similarityScore: number;
  matchReasons: string[];
}

interface DuplicateWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: (selectedTransactions: any[]) => void;
  duplicates: DuplicateDetection[];
  allTransactions: any[];
}

export function DuplicateWarningModal({
  isOpen,
  onClose,
  onProceed,
  duplicates,
  allTransactions
}: DuplicateWarningModalProps) {
  const { t } = useTranslation();
  const [excludedIndices, setExcludedIndices] = useState<Set<number>>(new Set());

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(Math.abs(amount));
  };

  // Handle checkbox toggle
  const toggleExclude = (transactionIndex: number) => {
    const newExcluded = new Set(excludedIndices);
    if (newExcluded.has(transactionIndex)) {
      newExcluded.delete(transactionIndex);
    } else {
      newExcluded.add(transactionIndex);
    }
    setExcludedIndices(newExcluded);
  };

  // Handle proceed with selected transactions
  const handleProceed = () => {
    const selectedTransactions = allTransactions.filter((_, index) => !excludedIndices.has(index));
    onProceed(selectedTransactions);
  };

  // Get transaction index from duplicate data
  const getTransactionIndex = (duplicate: DuplicateDetection) => {
    return allTransactions.findIndex(tx => 
      tx.date === duplicate.extractedTransaction.date &&
      tx.description === duplicate.extractedTransaction.description &&
      Math.abs(tx.amount - duplicate.extractedTransaction.amount) < 0.01
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            {t('export.duplicate_warning.title', 'Potential Duplicate Transactions Detected')}
          </DialogTitle>
          <DialogDescription>
            {t('export.duplicate_warning.description', 'We found transactions that may already exist in your account. Review the matches below and choose which transactions to import.')}
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            {t('export.duplicate_warning.found_count', 'Found {{count}} potential duplicate(s) out of {{total}} extracted transactions.', {
              count: duplicates.length,
              total: allTransactions.length
            })}
          </AlertDescription>
        </Alert>

        <div className="space-y-6">
          {duplicates.map((duplicate, index) => {
            const transactionIndex = getTransactionIndex(duplicate);
            const isExcluded = excludedIndices.has(transactionIndex);

            return (
              <div key={index} className="border rounded-lg p-4 space-y-4">
                {/* Header with checkbox */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isExcluded}
                      onCheckedChange={() => toggleExclude(transactionIndex)}
                      className="mt-1"
                    />
                    <div>
                      <label className="text-sm font-medium cursor-pointer">
                        {isExcluded ? 
                          t('export.duplicate_warning.exclude_transaction', 'Exclude this transaction') :
                          t('export.duplicate_warning.include_transaction', 'Include this transaction')
                        }
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {t('export.duplicate_warning.similarity_score', 'Similarity: {{score}}%', {
                          score: Math.round(duplicate.similarityScore * 100)
                        })}
                      </p>
                    </div>
                  </div>
                  <Badge variant={duplicate.similarityScore > 0.9 ? "destructive" : "secondary"}>
                    {duplicate.similarityScore > 0.9 ? 
                      t('export.duplicate_warning.high_match', 'High Match') :
                      t('export.duplicate_warning.possible_match', 'Possible Match')
                    }
                  </Badge>
                </div>

                {/* New Transaction (from PDF) */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-800">
                  <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {t('export.duplicate_warning.new_transaction', 'New Transaction (from PDF)')}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{duplicate.extractedTransaction.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className={duplicate.extractedTransaction.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                        {duplicate.extractedTransaction.type === 'income' ? '+' : '-'}{formatCurrency(duplicate.extractedTransaction.amount)}
                      </span>
                      {duplicate.extractedTransaction.type === 'income' ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div className="md:col-span-1">
                      <p className="truncate" title={duplicate.extractedTransaction.description}>
                        {duplicate.extractedTransaction.description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Existing Transactions */}
                <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded border border-orange-200 dark:border-orange-800">
                  <h4 className="font-medium text-orange-800 dark:text-orange-200 mb-2">
                    {t('export.duplicate_warning.existing_matches', 'Existing Similar Transaction(s)')}
                  </h4>
                  <div className="space-y-2">
                    {duplicate.existingTransactions.map((existing, existingIndex) => (
                      <div key={existingIndex} className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm bg-white dark:bg-gray-800 p-2 rounded">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{existing.date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className={existing.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                            {existing.type === 'income' ? '+' : '-'}{formatCurrency(existing.amount)}
                          </span>
                        </div>
                        <div className="md:col-span-1">
                          <p className="truncate" title={existing.description}>
                            {existing.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Match Reasons */}
                {duplicate.matchReasons.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm font-medium">{t('export.duplicate_warning.match_reasons', 'Why this might be a duplicate:')} </span>
                    {duplicate.matchReasons.map((reason, reasonIndex) => (
                      <Badge key={reasonIndex} variant="outline" className="text-xs">
                        {reason}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {t('export.duplicate_warning.will_import', 'Will import {{count}} of {{total}} transactions', {
              count: allTransactions.length - excludedIndices.size,
              total: allTransactions.length
            })}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              {t('export.duplicate_warning.cancel', 'Cancel Import')}
            </Button>
            <Button 
              onClick={handleProceed}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {t('export.duplicate_warning.proceed', 'Proceed with Import')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}