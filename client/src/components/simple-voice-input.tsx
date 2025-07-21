import React, { useState, useRef, useEffect } from 'react';
import { X, Mic, MicOff, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

interface SimpleVoiceInputProps {
  onClose: () => void;
  onComplete?: () => void;
}

interface TransactionData {
  amount: string;
  description: string;
  type: 'income' | 'expense';
  date: string;
  note: string;
}

export function SimpleVoiceInput({ onClose, onComplete }: SimpleVoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [transactionData, setTransactionData] = useState<TransactionData>({
    amount: '',
    description: '',
    type: 'expense' as 'income' | 'expense',
    date: '',
    note: ''
  });
  const [extractedCategory, setExtractedCategory] = useState<string>('');

  // Get categories for display
  const { data: categories } = useQuery({
    queryKey: ['/api/categories'],
    staleTime: 5 * 60 * 1000
  });
  const [isSaving, setIsSaving] = useState(false);

  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();

  // Get user data for language and currency
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    staleTime: 5 * 60 * 1000
  });

  // Remove categories query - will use AI categorization

  const userLanguage = (user as any)?.language || i18n.language || 'en-us';
  const userCurrency = (user as any)?.currency || '$';

  // Language mapping for speech recognition
  const getRecognitionLanguage = (lang: string) => {
    if (lang.startsWith('es')) return 'es-ES';
    if (lang.startsWith('sk')) return 'sk-SK';
    return 'en-US';
  };

  // Play greeting based on user language
  const playGreeting = () => {
    const audioFile = userLanguage.startsWith('sk') ? '/audio/voice-greeting-sk.mp3' :
                     userLanguage.startsWith('es') ? '/audio/voice-greeting-es.mp3' :
                     '/audio/voice-greeting-en.mp3';
    
    const audio = new Audio(audioFile);
    audio.play().catch(console.error);
  };

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = getRecognitionLanguage(userLanguage);

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }
        if (finalTranscript) {
          setTranscript(prev => prev + finalTranscript);
          extractDataFromTranscript(finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    // Play greeting when component mounts
    playGreeting();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [userLanguage]);

  // Dynamic voice parsing - send raw transcript to server for intelligent processing
  const extractDataFromTranscript = async (text: string) => {
    console.log('🎤 Processing transcript:', text);
    
    try {
      // Send raw transcript to server for dynamic parsing
      const response = await apiRequest('POST', '/api/voice/parse', {
        transcript: text,
        userLanguage: userLanguage
      });

      if (response?.data) {
        console.log('📋 Parsed transaction data:', response.data);
        
        // Update transaction data with parsed values
        setTransactionData(prev => ({
          ...prev,
          amount: response.data.amount || prev.amount,
          description: response.data.description || prev.description,
          type: (response.data.type as 'income' | 'expense') || prev.type,
          date: response.data.date || prev.date,
          note: response.data.note || prev.note
        }));

        // Set category if found
        if (response.data.category) {
          setExtractedCategory(response.data.category);
        }
      }
    } catch (error) {
      console.error('❌ Failed to parse transcript:', error);
      // Fallback: extract basic information without hardcoded patterns
      const words = text.split(' ');
      let description = words.filter(word => word.length > 2).slice(0, 3).join(' ');
      
      if (description) {
        setTransactionData(prev => ({
          ...prev,
          description: description
        }));
      }
    }
  };

  const startListening = () => {
    if (recognitionRef.current) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const handleSave = async () => {
    if (!transactionData.amount || !transactionData.description) {
      toast({
        title: t('voice.incomplete_data'),
        description: t('voice.fill_required_fields'),
        variant: 'destructive'
      });
      return;
    }

    setIsSaving(true);
    try {
      await apiRequest('POST', '/api/voice/complete', {
        transactionData: {
          amount: parseFloat(transactionData.amount),
          description: transactionData.description,
          type: transactionData.type,
          date: transactionData.date,
          note: transactionData.note || transcript
        },
        userLanguage
      });

      toast({
        title: t('voice.transaction_saved'),
        description: t('voice.transaction_success')
      });

      // Refresh transactions list
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      
      onComplete?.();
      onClose();
    } catch (error) {
      console.error('Failed to save transaction:', error);
      toast({
        title: t('voice.save_failed'),
        description: t('voice.try_again'),
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header - Fixed */}
        <div className="flex justify-between items-center p-6 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold">{t('voice.title')}</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            {t('voice.instructions')}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={playGreeting}
          >
            <Play className="h-4 w-4 mr-2" />
            {t('voice.play_example')}
          </Button>
          </div>

          {/* Voice Input */}
          <div>
          <div className="flex items-center gap-2 mb-2">
            <Button
              onClick={isListening ? stopListening : startListening}
              variant={isListening ? "destructive" : "default"}
              size="sm"
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {isListening ? t('voice.stop_listening') : t('voice.start_listening')}
            </Button>
          </div>
          
          {transcript && (
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-sm">
              <strong>{t('voice.transcript')}:</strong> {transcript}
            </div>
          )}
        </div>

        {/* Transaction Form */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="amount">{t('transaction.amount')} ({userCurrency})</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={transactionData.amount}
              onChange={(e) => setTransactionData(prev => ({ ...prev, amount: e.target.value }))}
              placeholder="0.00"
            />
          </div>

          <div>
            <Label htmlFor="description">{t('transaction.description')}</Label>
            <Input
              id="description"
              value={transactionData.description}
              onChange={(e) => setTransactionData(prev => ({ ...prev, description: e.target.value }))}
              placeholder={t('transaction.description_placeholder')}
            />
          </div>

          {/* Category Field */}
          {extractedCategory && (
            <div>
              <Label htmlFor="category">{t('transaction.category')}</Label>
              <Input
                id="category"
                value={extractedCategory}
                readOnly
                className="bg-muted/50"
                placeholder={t('transaction.category_detected')}
              />
            </div>
          )}

          <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">
            <p>{t('voice.ai_categorization_note')}</p>
          </div>

          <div>
            <Label htmlFor="type">{t('transaction.type')}</Label>
            <Select 
              value={transactionData.type} 
              onValueChange={(value: 'income' | 'expense') => 
                setTransactionData(prev => ({ ...prev, type: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">{t('types.expense')}</SelectItem>
                <SelectItem value="income">{t('types.income')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="date">{t('transaction.date')}</Label>
            <Input
              id="date"
              type="date"
              value={transactionData.date}
              onChange={(e) => setTransactionData(prev => ({ ...prev, date: e.target.value }))}
            />
          </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-6">
            <Button
              onClick={handleSave}
              disabled={isSaving || !transactionData.amount || !transactionData.description}
              className="flex-1"
            >
              {isSaving ? t('voice.saving') : t('voice.save_transaction')}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              {t('common.cancel')}
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}