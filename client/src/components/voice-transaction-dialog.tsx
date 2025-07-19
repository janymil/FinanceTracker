import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/context/CurrencyContext';
import { getDynamicIcon } from '@/lib/iconUtils';

interface VoiceTransactionData {
  amount?: number | null;
  currency?: string | null;
  vendor?: string | null;
  description?: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
  dateReference?: string | null;
  parsedDate?: string | null;
  type?: 'income' | 'expense' | null;
  isRecurring?: boolean;
  recurringFrequency?: 'weekly' | 'monthly' | 'yearly' | null;
  confidence?: number;
  ambiguities?: string[];
  followUpQuestions?: string[];
}

interface VoiceTransactionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transcript: string;
  onSuccess?: () => void;
}

export function VoiceTransactionDialog({ 
  isOpen, 
  onClose, 
  transcript,
  onSuccess 
}: VoiceTransactionDialogProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { currency } = useCurrency();
  const queryClient = useQueryClient();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<VoiceTransactionData | null>(null);
  const [editedData, setEditedData] = useState<VoiceTransactionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiRequest('/api/categories'),
  });

  // Process voice transcript
  const processVoice = useMutation({
    mutationFn: async (transcript: string) => {
      const requestData = {
        transcript,
        language: i18n.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      
      console.log('🚀 [VoiceDialog] Starting voice processing:', {
        ...requestData,
        timestamp: new Date().toISOString()
      });
      
      const startTime = performance.now();
      
      try {
        const response = await apiRequest('POST', '/api/voice/process', requestData);
        const data = await response.json();
        
        const endTime = performance.now();
        console.log('⚡ [VoiceDialog] API response received:', {
          processingTime: `${(endTime - startTime).toFixed(2)}ms`,
          success: data.success,
          hasData: !!data.data,
          timestamp: new Date().toISOString()
        });
        
        return data;
      } catch (error) {
        const endTime = performance.now();
        console.error('💥 [VoiceDialog] API request failed:', {
          processingTime: `${(endTime - startTime).toFixed(2)}ms`,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('✅ [VoiceDialog] Processing successful:', {
        extractedData: data.data,
        confidence: data.data?.confidence,
        ambiguities: data.data?.ambiguities,
        timestamp: new Date().toISOString()
      });
      
      if (data.success && data.data) {
        setExtractedData(data.data);
        setEditedData({ ...data.data });
        setError(null);
        
        console.log('📊 [VoiceDialog] Data extraction results:', {
          amount: data.data.amount,
          type: data.data.type,
          vendor: data.data.vendor,
          categoryId: data.data.categoryId,
          confidence: data.data.confidence,
          hasAmbiguities: data.data.ambiguities?.length > 0
        });
      } else {
        console.error('❌ [VoiceDialog] Invalid response format:', data);
        setError(t('voiceTransaction.processingError'));
      }
      setIsProcessing(false);
    },
    onError: (error) => {
      console.error('💥 [VoiceDialog] Processing error:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      setError(t('voiceTransaction.processingError'));
      setIsProcessing(false);
    },
  });

  // Create transaction
  const createTransaction = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: t('voiceTransaction.success'),
        description: t('voiceTransaction.successDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast({
        title: t('Error'),
        description: t('voiceTransaction.createError'),
        variant: 'destructive',
      });
    },
  });

  // Process transcript when dialog opens
  useEffect(() => {
    if (isOpen && transcript && !extractedData && !isProcessing) {
      setIsProcessing(true);
      processVoice.mutate(transcript);
    }
  }, [isOpen, transcript]);

  const handleSave = () => {
    if (!editedData) return;

    const transactionData = {
      amount: editedData.amount?.toString() || '0',
      description: editedData.description || editedData.vendor || '',
      date: editedData.parsedDate || new Date().toISOString().split('T')[0],
      type: editedData.type || 'expense',
      categoryId: editedData.categoryId?.toString() || '',
      isRecurring: editedData.isRecurring || false,
      recurringFrequency: editedData.recurringFrequency || 'monthly',
    };

    createTransaction.mutate(transactionData);
  };

  const confidenceColor = (confidence?: number) => {
    if (!confidence) return 'text-gray-500';
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getLocalizedCategoryName = (category: any): string => {
    if (category.userId === null) {
      return t(category.name);
    }
    return category.name;
  };



  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('voiceTransaction.title')}</DialogTitle>
          <DialogDescription>
            {t('voiceTransaction.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transcript Display */}
          <div className="bg-muted p-3 rounded-md">
            <p className="text-sm font-medium mb-1">{t('voiceTransaction.transcript')}:</p>
            <p className="text-sm italic">"{transcript}"</p>
          </div>

          {/* Processing State */}
          {isProcessing && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span>{t('voiceTransaction.processing')}</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Extracted Data Form */}
          {editedData && !isProcessing && (
            <>
              {/* Confidence Score */}
              {extractedData?.confidence !== undefined && (
                <div className="flex items-center gap-2 text-sm">
                  <span>{t('voiceTransaction.confidence')}:</span>
                  <span className={`font-medium ${confidenceColor(extractedData.confidence)}`}>
                    {Math.round(extractedData.confidence * 100)}%
                  </span>
                </div>
              )}

              {/* Ambiguities Alert */}
              {extractedData?.ambiguities && extractedData.ambiguities.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {t('voiceTransaction.ambiguities')}: {extractedData.ambiguities.join(', ')}
                  </AlertDescription>
                </Alert>
              )}

              {/* Transaction Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('voiceTransaction.type')}</Label>
                  <Select
                    value={editedData.type || 'expense'}
                    onValueChange={(value) => setEditedData({ ...editedData, type: value as 'income' | 'expense' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">{t('Expense')}</SelectItem>
                      <SelectItem value="income">{t('Income')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount */}
                <div>
                  <Label>{t('Amount')}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editedData.amount || ''}
                    onChange={(e) => setEditedData({ ...editedData, amount: parseFloat(e.target.value) || null })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <Label>{t('Description')}</Label>
                <Input
                  value={editedData.description || editedData.vendor || ''}
                  onChange={(e) => setEditedData({ ...editedData, description: e.target.value })}
                  placeholder={t('voiceTransaction.descriptionPlaceholder')}
                />
              </div>

              {/* Category */}
              <div>
                <Label>{t('Category')}</Label>
                <Select
                  value={editedData.categoryId?.toString() || ''}
                  onValueChange={(value) => setEditedData({ ...editedData, categoryId: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('voiceTransaction.selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories
                      .filter((cat: any) => cat.type === editedData.type)
                      .map((category: any) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          <div className="flex items-center">
                            <span className="mr-2">
                              {getDynamicIcon(category.icon, "h-4 w-4")}
                            </span>
                            {getLocalizedCategoryName(category)}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date */}
              <div>
                <Label>{t('Date')}</Label>
                <Input
                  type="date"
                  value={editedData.parsedDate || new Date().toISOString().split('T')[0]}
                  onChange={(e) => setEditedData({ ...editedData, parsedDate: e.target.value })}
                />
              </div>

              {/* Follow-up Questions */}
              {extractedData?.followUpQuestions && extractedData.followUpQuestions.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-1">{t('voiceTransaction.followUp')}:</p>
                    <ul className="list-disc list-inside">
                      {extractedData.followUpQuestions.map((question, index) => (
                        <li key={index}>{question}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          {editedData && (
            <Button 
              onClick={handleSave} 
              disabled={createTransaction.isPending || !editedData.amount}
            >
              {createTransaction.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('Saving')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {t('Save')}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}