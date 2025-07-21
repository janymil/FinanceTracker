import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Mic, MicOff, X, Save, Play, Stop } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/lib/queryClient';

interface GroqVoiceInputProps {
  onClose: () => void;
  onComplete: (transaction: any) => void;
  userCurrency: string;
}

export function GroqVoiceInput({ onClose, onComplete, userCurrency }: GroqVoiceInputProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  
  // Parsed transaction data
  const [transactionData, setTransactionData] = useState({
    amount: '',
    description: '',
    type: 'expense' as 'income' | 'expense',
    date: new Date().toISOString().split('T')[0],
    category: '',
    transcript: ''
  });
  
  const [isSaving, setIsSaving] = useState(false);
  
  // Media recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Start recording
  const startRecording = async () => {
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
        setAudioBlob(audioBlob);
        setAudioUrl(URL.createObjectURL(audioBlob));
        
        // Stop all tracks to free up microphone
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      
      toast({
        title: t('voice.recording_started'),
        description: t('voice.speak_naturally'),
      });
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast({
        title: t('voice.error'),
        description: t('voice.microphone_error'),
        variant: 'destructive'
      });
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      toast({
        title: t('voice.recording_stopped'),
        description: t('voice.processing_audio'),
      });
    }
  };

  // Process audio with Groq
  const processAudio = async () => {
    if (!audioBlob) return;
    
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      console.log('🎤 Sending audio to Groq for processing...');
      
      const response = await fetch('/api/voice-groq/transcribe-and-parse', {
        method: 'POST',
        body: formData,
        headers: {
          'x-user-language': i18n.language || 'en-us'
        }
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Processing failed');
      }
      
      console.log('✅ Groq processing result:', result.data);
      
      // Update transaction data with Groq results
      setTransactionData({
        amount: result.data.amount || '',
        description: result.data.description || '',
        type: result.data.type || 'expense',
        date: result.data.date || new Date().toISOString().split('T')[0],
        category: result.data.category || '',
        transcript: result.data.transcript || ''
      });
      
      toast({
        title: t('voice.processing_complete'),
        description: t('voice.review_and_save'),
      });
      
    } catch (error) {
      console.error('Groq processing failed:', error);
      toast({
        title: t('voice.processing_failed'),
        description: error instanceof Error ? error.message : t('voice.unknown_error'),
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Play recorded audio
  const playAudio = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };

  // Save transaction
  const saveTransaction = async () => {
    // Validation
    const missingFields = [];
    if (!transactionData.amount) missingFields.push(t('transaction.amount'));
    if (!transactionData.description) missingFields.push(t('transaction.description'));
    
    if (missingFields.length > 0) {
      toast({
        title: t('voice.missing_information'),
        description: `${t('voice.please_provide')}: ${missingFields.join(', ')}`,
        variant: 'destructive'
      });
      return;
    }
    
    const numericAmount = parseFloat(transactionData.amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({
        title: t('voice.invalid_amount'),
        description: t('voice.amount_greater_than_zero'),
        variant: 'destructive'
      });
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await apiRequest('POST', '/api/transactions', {
        amount: numericAmount,
        description: transactionData.description,
        type: transactionData.type,
        date: transactionData.date,
        categoryId: null, // Let the system assign category based on description
        referenceNote: transactionData.transcript
      });
      
      const result = await response.json();
      
      toast({
        title: t('voice.transaction_saved'),
        description: `${transactionData.description} - ${userCurrency}${transactionData.amount}`,
      });
      
      onComplete(result);
      onClose();
      
    } catch (error) {
      console.error('Failed to save transaction:', error);
      toast({
        title: t('voice.save_failed'),
        description: t('voice.save_error'),
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{t('voice.groq_title')}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {t('voice.groq_instructions')}
            </p>
          </div>

          {/* Recording Controls */}
          <div className="space-y-3">
            <div className="flex gap-2">
              {!audioBlob ? (
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  variant={isRecording ? "destructive" : "default"}
                  className="flex-1"
                  disabled={isProcessing}
                >
                  {isRecording ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
                  {isRecording ? t('voice.stop_recording') : t('voice.start_recording')}
                </Button>
              ) : (
                <>
                  <Button onClick={playAudio} variant="outline" size="sm">
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={processAudio}
                    disabled={isProcessing}
                    className="flex-1"
                  >
                    {isProcessing ? t('voice.processing') : t('voice.process_with_groq')}
                  </Button>
                </>
              )}
            </div>
            
            {isRecording && (
              <div className="text-center">
                <div className="inline-flex items-center gap-2 text-red-500">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  {t('voice.recording')}
                </div>
              </div>
            )}
          </div>

          {/* Transcript Display */}
          {transactionData.transcript && (
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-sm">
              <strong>{t('voice.transcript')}:</strong> {transactionData.transcript}
            </div>
          )}

          {/* Form Fields */}
          {(transactionData.amount || transactionData.description) && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium">{t('voice.review_transaction')}</h3>
              
              <div>
                <Label htmlFor="amount">{t('transaction.amount')} ({userCurrency})</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={transactionData.amount}
                  onChange={(e) => setTransactionData(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  className={transactionData.amount ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}
                />
              </div>

              <div>
                <Label htmlFor="description">{t('transaction.description')}</Label>
                <Input
                  id="description"
                  value={transactionData.description}
                  onChange={(e) => setTransactionData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t('transaction.description_placeholder')}
                  className={transactionData.description ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}
                />
              </div>

              <div>
                <Label htmlFor="category">{t('transaction.category')}</Label>
                <Input
                  id="category"
                  value={transactionData.category}
                  readOnly
                  className="bg-muted/50"
                  placeholder={t('voice.auto_detected')}
                />
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
                  className={transactionData.date !== new Date().toISOString().split('T')[0] ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {(transactionData.amount || transactionData.description) && (
          <div className="p-4 border-t">
            <Button
              onClick={saveTransaction}
              disabled={isSaving || !transactionData.amount || !transactionData.description}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? t('voice.saving') : t('voice.save_transaction')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}