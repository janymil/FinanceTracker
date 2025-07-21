import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

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

  // Get user data
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    staleTime: 5 * 60 * 1000
  });

  const userLanguage = (user as any)?.language || i18n.language || 'en-us';
  const userCurrency = (user as any)?.currency || '$';

  // Process audio with Mistral
  const processAudioWithMistral = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
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
      
      if (result.success && result.data) {
        setTranscript(result.data.transcript || result.data.note || '');
        setParsedResult(result.data);
        
        toast({
          title: t('voice.processing_complete'),
          description: t('voice.review_and_save'),
        });
        
      } else {
        throw new Error('No data returned from processing');
      }
      
    } catch (error) {
      console.error('Processing failed:', error);
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
      console.error('Recording failed:', error);
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
    if (!parsedResult) {
      toast({
        title: t('voice.validation_error'),
        description: t('voice.no_data'),
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await apiRequest('/api/transactions', 'POST', {
        amount: parseFloat(parsedResult.amount),
        description: parsedResult.description,
        type: parsedResult.type,
        date: parsedResult.date,
        categoryName: parsedResult.category,
        note: parsedResult.note
      });

      toast({
        title: t('voice.transaction_saved'),
        description: t('voice.success_message'),
      });
      
      onComplete(response);
      onClose();
      
    } catch (error) {
      console.error('Save failed:', error);
      toast({
        title: t('voice.save_failed'),
        description: error instanceof Error ? error.message : t('voice.unknown_error'),
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-medium mb-2">{t('voice.title')}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {isProcessing ? t('voice.processing') : 
             isListening ? t('voice.listening') : t('voice.click_to_record')}
          </p>
        </div>

        {/* Voice Button */}
        <div className="text-center mb-6">
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
        </div>

        {/* Transcript */}
        {transcript && (
          <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded mb-4">
            <p className="text-sm">{transcript}</p>
          </div>
        )}

        {/* Parsed Result */}
        {parsedResult && (
          <div className="space-y-2 mb-6">
            <div className="flex justify-between">
              <span className="text-sm font-medium">{t('voice.amount')}:</span>
              <span className="text-sm">{userCurrency}{parsedResult.amount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">{t('voice.description')}:</span>
              <span className="text-sm">{parsedResult.description}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">{t('voice.type')}:</span>
              <span className="text-sm">{parsedResult.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">{t('voice.category')}:</span>
              <span className="text-sm">{parsedResult.category}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="flex-1"
          >
            {t('voice.cancel')}
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!parsedResult}
            className="flex-1"
          >
            {t('voice.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}