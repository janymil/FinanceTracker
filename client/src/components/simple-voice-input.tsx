import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, MicOff, X, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

interface SimpleVoiceInputProps {
  onClose: () => void;
  onComplete: (data: any) => void;
}

interface TransactionData {
  amount: string;
  description: string;
  type: 'income' | 'expense';
  date: string;
  note: string;
}

export function SimpleVoiceInput({ onClose, onComplete }: SimpleVoiceInputProps) {
  const { t, i18n } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [extractedCategory, setExtractedCategory] = useState<string>('');
  
  // Start with completely empty form
  const [transactionData, setTransactionData] = useState<TransactionData>({
    amount: '',
    description: '',
    type: 'expense',
    date: '',
    note: ''
  });

  const recognitionRef = useRef<any>(null);

  // Get user data
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    staleTime: 5 * 60 * 1000
  });

  const userLanguage = (user as any)?.language || i18n.language || 'en-us';
  const userCurrency = (user as any)?.currency || '$';

  // Get API language
  const getCurrentLanguageForAPI = () => {
    const currentLang = i18n.language || 'en';
    if (currentLang.startsWith('es')) return 'es-pe';
    if (currentLang.startsWith('sk')) return 'sk-sk'; 
    return 'en-us';
  };

  // Speech recognition language
  const getRecognitionLanguage = (lang: string) => {
    if (lang.startsWith('es')) return 'es-ES';
    if (lang.startsWith('sk')) return 'sk-SK';
    return 'en-US';
  };

  // Play greeting
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
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = getRecognitionLanguage(userLanguage);

      recognitionRef.current.onresult = (event: any) => {
        const finalTranscript = event.results[0][0].transcript;
        console.log('🎤 Voice captured:', finalTranscript);
        setTranscript(finalTranscript);
        processVoiceInput(finalTranscript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    playGreeting();
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [userLanguage]);

  // Process voice input - completely rewritten
  const processVoiceInput = async (text: string) => {
    if (!text.trim() || text.length < 5) return;
    
    console.log('🔍 Processing voice input:', text);
    
    try {
      const response = await fetch('/api/voice/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          userLanguage: getCurrentLanguageForAPI()
        })
      });

      const data = await response.json();
      console.log('📋 Parsed response:', data);

      if (data.success && data.data) {
        const parsed = data.data;
        
        // Update form with extracted data
        setTransactionData({
          amount: parsed.amount || '',
          description: parsed.description || '',
          type: parsed.type || 'expense',
          date: parsed.date || '',
          note: parsed.note || text
        });

        // Set category
        if (parsed.category) {
          setExtractedCategory(parsed.category);
        }
      }
    } catch (error) {
      console.error('❌ Voice processing failed:', error);
    }
  };

  // Start/stop listening
  const startListening = () => {
    if (recognitionRef.current) {
      setIsListening(true);
      setTranscript('');
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  // Save transaction
  const handleSave = async () => {
    if (!transactionData.amount || !transactionData.description) return;

    setIsSaving(true);
    try {
      await onComplete({
        ...transactionData,
        category: extractedCategory
      });
      onClose();
    } catch (error) {
      console.error('Failed to save transaction:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{t('voice.title')}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {t('voice.instructions')}
            </p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={playGreeting}>
              <Play className="h-4 w-4 mr-2" />
              {t('voice.play_example')}
            </Button>
          </div>

          {/* Voice Controls */}
          <div>
            <Button
              onClick={isListening ? stopListening : startListening}
              variant={isListening ? "destructive" : "default"}
              className="w-full"
            >
              {isListening ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
              {isListening ? t('voice.stop_listening') : t('voice.start_listening')}
            </Button>
            
            {transcript && (
              <div className="mt-2 bg-gray-50 dark:bg-gray-700 p-3 rounded text-sm">
                <strong>{t('voice.transcript')}:</strong> {transcript}
              </div>
            )}
          </div>

          {/* Form Fields */}
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

            {extractedCategory && (
              <div>
                <Label htmlFor="category">{t('transaction.category')}</Label>
                <Input
                  id="category"
                  value={extractedCategory}
                  readOnly
                  className="bg-muted/50"
                />
              </div>
            )}

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
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaving || !transactionData.amount || !transactionData.description}
              className="flex-1"
            >
              {isSaving ? t('voice.saving') : t('voice.save_transaction')}
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1">
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}