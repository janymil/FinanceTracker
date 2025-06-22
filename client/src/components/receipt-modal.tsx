import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Receipt, ChevronDown, ChevronUp, Calendar, DollarSign, Store } from "lucide-react";
import { useState } from "react";

interface ReceiptModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: {
    id: number;
    description: string;
    amount: string;
    date: string;
    imageUrl?: string;
    ocrText?: string;
    ocrVendor?: string;
    ocrDetectedAmount?: string;
    ocrDetectedDate?: string;
  };
}

export default function ReceiptModal({ isOpen, onOpenChange, transaction }: ReceiptModalProps) {
  const [showFullOcr, setShowFullOcr] = useState(false);

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const hasOcrData = transaction.ocrVendor || transaction.ocrDetectedAmount || transaction.ocrDetectedDate;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Receipt Details
          </DialogTitle>
          <DialogDescription>
            Transaction: {transaction.description}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Receipt Image */}
          {transaction.imageUrl && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Receipt Image</h3>
              <div className="border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
                <img
                  src={transaction.imageUrl}
                  alt="Receipt"
                  className="w-full h-auto max-h-[500px] object-contain"
                />
              </div>
            </div>
          )}

          {/* Transaction & OCR Data */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Transaction Information</h3>
            
            {/* Basic Transaction Data */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Transaction Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">Description:</span>
                  <span>{transaction.description}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">Final Amount:</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(transaction.amount)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">Date:</span>
                  <span>{formatDate(transaction.date)}</span>
                </div>
              </CardContent>
            </Card>

            {/* OCR Data */}
            {hasOcrData && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    OCR Extracted Data
                    <Badge variant="secondary" className="text-xs">Auto-detected</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {transaction.ocrVendor && (
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Detected Vendor:</span>
                      <span className="text-blue-600 dark:text-blue-400">
                        {transaction.ocrVendor}
                      </span>
                    </div>
                  )}
                  
                  {transaction.ocrDetectedAmount && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Detected Amount:</span>
                      <span className={`font-semibold ${
                        transaction.ocrDetectedAmount !== transaction.amount 
                          ? 'text-orange-600 dark:text-orange-400' 
                          : 'text-green-600 dark:text-green-400'
                      }`}>
                        {formatCurrency(transaction.ocrDetectedAmount)}
                      </span>
                      {transaction.ocrDetectedAmount !== transaction.amount && (
                        <Badge variant="outline" className="text-xs">
                          Manually adjusted
                        </Badge>
                      )}
                    </div>
                  )}

                  {transaction.ocrDetectedDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Detected Date:</span>
                      <span>{formatDate(transaction.ocrDetectedDate)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Full OCR Text */}
            {transaction.ocrText && (
              <Card>
                <CardHeader className="pb-3">
                  <Collapsible open={showFullOcr} onOpenChange={setShowFullOcr}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                        <CardTitle className="text-base">Full Receipt Text</CardTitle>
                        {showFullOcr ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-3">
                        <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded border text-sm font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {transaction.ocrText}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Raw text extracted from receipt image using OCR technology
                        </p>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </CardHeader>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}