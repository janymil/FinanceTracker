import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface SimpleVoiceInputProps {
  onClose: () => void;
  onComplete: (data: any) => void;
}

export function SimpleVoiceInput({ onClose, onComplete }: SimpleVoiceInputProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsedResult, setParsedResult] = useState<any>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Get user data and categories
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    staleTime: 5 * 60 * 1000
  });

  const { data: categories } = useQuery({
    queryKey: ['/api/categories'],
    staleTime: 5 * 60 * 1000
  });

  const userLanguage = (user as any)?.language || i18n.language || 'en-us';
  const userCurrency = (user as any)?.currency || '$';

  // Process audio with Mistral STT + parsing
  const processAudioWithMistral = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      console.log('🎤 Sending audio to Mistral for processing...');
      
      const response = await fetch('/api/voice-mistral/transcribe-and-parse', {
        method: 'POST',
        body: formData,
        headers: {
          'x-user-language': userLanguage,
          'x-user-currency': userCurrency
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ Mistral processing result:', result.data);
      
      if (result.success && result.data) {
        // Set transcript
        setTranscript(result.data.transcript || result.data.note || '');
        
        // Intelligently match category with existing ones
        let matchedCategoryId: number | null = null;
        
        if (categories && Array.isArray(categories) && categories.length > 0) {
          console.log('🏷️ Starting intelligent category matching...');
          console.log('🏷️ Parsed category from Mistral:', result.data.category);
          
          // Try exact match first
          const exactMatch = (categories as any[]).find(cat => 
            cat.name.toLowerCase() === result.data.category.toLowerCase()
          );
          
          if (exactMatch) {
            matchedCategoryId = exactMatch.id;
            console.log('✅ Found exact match:', exactMatch.name);
          } else {
            // Use intelligent matching API
            const matchResponse = await fetch('/api/voice-mistral/match-category', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-user-language': userLanguage,
              },
              body: JSON.stringify({
                suggestedCategory: result.data.category,
                existingCategories: (categories as any[]).map(c => ({ id: c.id, name: c.name, type: c.type }))
              })
            });

            const matchResult = await matchResponse.json();
            
            if (matchResult.matchedCategory) {
              matchedCategoryId = matchResult.matchedCategory.id;
              console.log('✅ Backend found intelligent match:', matchResult.matchedCategory.name);
            }
          }
        }
        
        // Update form data
        setTransactionData({
          amount: result.data.amount || '',
          description: result.data.description || '',
          type: result.data.type || 'expense',
          date: result.data.date || new Date().toISOString().split('T')[0],
          categoryId: matchedCategoryId,
          note: result.data.transcript || result.data.note || ''
        });
        
        toast({
          title: t('voice.processing_complete'),
          description: t('voice.review_and_save'),
        });
        
      } else {
        throw new Error('No data returned from Mistral processing');
      }
      
    } catch (error) {
      console.error('❌ Mistral processing failed:', error);
      toast({
        title: t('voice.processing_failed'),
        description: error instanceof Error ? error.message : t('voice.unknown_error'),
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Start recording
  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        processAudioWithMistral(audioBlob);
      };
      
      mediaRecorder.start();
      setIsListening(true);
      
      toast({
        title: t('voice.listening'),
        description: t('voice.speak_now'),
      });
      
    } catch (error) {
      console.error('❌ Recording failed:', error);
      toast({
        title: t('voice.recording_failed'),
        description: t('voice.microphone_access'),
        variant: 'destructive'
      });
    }
  };

  // Stop recording
  const stopListening = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  };

  // Save transaction
  const handleSave = async () => {
    if (!transactionData.amount || !transactionData.description) {
      toast({
        title: t('voice.validation_error'),
        description: t('voice.required_fields'),
        variant: 'destructive'
      });
      return;
    }

    setIsSaving(true);
    
    try {
      const response = await apiRequest('/api/transactions', 'POST', {
        amount: parseFloat(transactionData.amount),
        description: transactionData.description,
        type: transactionData.type,
        date: transactionData.date,
        categoryId: transactionData.categoryId,
        note: transactionData.note
      });

      toast({
        title: t('voice.transaction_saved'),
        description: t('voice.success_message'),
      });
      
      onComplete(response);
      onClose();
      
    } catch (error) {
      console.error('❌ Save failed:', error);
      toast({
        title: t('voice.save_failed'),
        description: error instanceof Error ? error.message : t('voice.unknown_error'),
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{t('voice.title')}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* Voice Input */}
          <div className="text-center">
            <Button
              onClick={isListening ? stopListening : startListening}
              disabled={isProcessing}
              size="lg"
              className={`w-20 h-20 rounded-full ${
                isListening ? 'bg-red-500 hover:bg-red-600' : ''
              }`}
            >
              {isProcessing ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
              ) : isListening ? (
                <MicOff className="h-8 w-8" />
              ) : (
                <Mic className="h-8 w-8" />
              )}
            </Button>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {isProcessing ? t('voice.processing') : 
               isListening ? t('voice.listening') : t('voice.click_to_record')}
            </p>
          </div>

          {/* Transcript */}
          {transcript && (
            <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded">
              <Label className="text-sm font-medium">{t('voice.transcript')}</Label>
              <p className="text-sm mt-1">{transcript}</p>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="amount">{t('voice.amount')}</Label>
              <Input
                id="amount"
                value={transactionData.amount}
                onChange={(e) => setTransactionData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="description">{t('voice.description')}</Label>
              <Input
                id="description"
                value={transactionData.description}
                onChange={(e) => setTransactionData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t('voice.description_placeholder')}
              />
            </div>

            <div>
              <Label htmlFor="type">{t('voice.type')}</Label>
              <Select
                value={transactionData.type}
                onValueChange={(value: 'expense' | 'income') => 
                  setTransactionData(prev => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">{t('voice.expense')}</SelectItem>
                  <SelectItem value="income">{t('voice.income')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="category">{t('voice.category')}</Label>
              <Select
                value={transactionData.categoryId?.toString() || ''}
                onValueChange={(value) => 
                  setTransactionData(prev => ({ ...prev, categoryId: value ? parseInt(value) : null }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('voice.select_category')} />
                </SelectTrigger>
                <SelectContent>
                  {(categories as any[])?.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="date">{t('voice.date')}</Label>
              <Input
                id="date"
                type="date"
                value={transactionData.date}
                onChange={(e) => setTransactionData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              {t('voice.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="flex-1">
              {isSaving ? t('voice.saving') : t('voice.save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}