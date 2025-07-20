import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ExtractedTransaction {
  amount: number;
  vendor: string;
  description: string;
  category: string;
  categoryId?: string;
  date: string;
  type: 'income' | 'expense';
  confidence: number;
}

interface SeamlessVoiceInputProps {
  onComplete?: (transaction: ExtractedTransaction) => void;
  className?: string;
  language?: string;
}

export function SeamlessVoiceInput({
  onComplete,
  className,
  language
}: SeamlessVoiceInputProps) {
  const { t, i18n } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [extractedData, setExtractedData] = useState<Partial<ExtractedTransaction>>({});
  const [sessionId, setSessionId] = useState<string>('');
  
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');
  const isCleaningUpRef = useRef(false);
  const queryClient = useQueryClient();

  const createTransactionMutation = useMutation({
    mutationFn: async (transaction: any) => {
      return apiRequest('POST', '/api/transactions', transaction);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
    },
  });

  // Helper function for voice language mapping - EXACT COPY
  const getVoiceLanguage = (lang: string): string => {
    const langMap: Record<string, string> = {
      'en-us': 'en-US',
      'es-pe': 'es-PE',
      'sk-sk': 'sk-SK'
    };
    return langMap[lang] || 'en-US';
  };

  // Initialize speech recognition - EXACT COPY from working voice-input
  useEffect(() => {
    console.log('🔧 [SeamlessVoice] Initializing speech recognition...', {
      hasWebkitSpeechRecognition: 'webkitSpeechRecognition' in window,
      hasSpeechRecognition: 'SpeechRecognition' in window,
      userAgent: navigator.userAgent,
      language: language || getVoiceLanguage(i18n.language)
    });

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('❌ [SeamlessVoice] Speech Recognition not supported');
      toast({
        title: t('voiceInput.notSupported'),
        variant: 'destructive',
      });
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    
    console.log('✅ [SeamlessVoice] Speech recognition initialized successfully');

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language || getVoiceLanguage(i18n.language);
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      console.log('🎤 [SeamlessVoice] Recording started');
      setIsListening(true);
      setTranscript('');
      transcriptRef.current = '';
    };

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      
      // Get the best alternative if multiple are available - EXACT COPY
      let bestTranscript = event.results[current][0].transcript;
      let bestConfidence = event.results[current][0].confidence;
      
      for (let i = 1; i < event.results[current].length; i++) {
        const alternative = event.results[current][i];
        if (alternative.confidence > bestConfidence) {
          bestTranscript = alternative.transcript;
          bestConfidence = alternative.confidence;
        }
      }
      
      console.log('🗣️ [SeamlessVoice] Speech result:', {
        text: bestTranscript,
        confidence: bestConfidence,
        isFinal: event.results[current].isFinal,
        alternatives: event.results[current].length
      });
      
      if (event.results[current].isFinal) {
        // Clean up transcript - EXACT COPY
        const cleanedText = bestTranscript
          .replace(/\s+/g, ' ')
          .replace(/\bdollar\b/gi, 'dollars')
          .replace(/\bcent\b/gi, 'cents')
          .trim();
          
        transcriptRef.current = transcriptRef.current + ' ' + cleanedText;
        setTranscript(transcriptRef.current);
        console.log('✅ [SeamlessVoice] Final transcript captured:', cleanedText);
        console.log('📝 [SeamlessVoice] Full transcript so far:', transcriptRef.current);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('❌ [SeamlessVoice] Speech recognition error:', event.error);
      
      if (isCleaningUpRef.current && event.error === 'aborted') {
        console.log('✅ [SeamlessVoice] Ignoring aborted error during cleanup');
        return;
      }
      
      setIsListening(false);
      toast({
        title: t('voiceInput.errors.generic'),
        variant: 'destructive',
      });
    };

    recognition.onend = () => {
      console.log('🔍 [SeamlessVoice] Recognition ended');
      setIsListening(false);
      const finalTranscript = transcriptRef.current.trim();
      
      if (finalTranscript) {
        console.log('📤 [SeamlessVoice] Processing transcript:', finalTranscript);
        setIsProcessing(true);
        processVoiceInput(finalTranscript);
      } else {
        console.warn('⚠️ [SeamlessVoice] No transcript captured');
      }
    };

    recognitionRef.current = recognition;

    return () => {
      isCleaningUpRef.current = true;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.log('🧹 [SeamlessVoice] Cleanup: Recognition already stopped');
        }
      }
    };
  }, [language, i18n.language, t]);

  // Process voice input - use existing API and TTS system
  const processVoiceInput = useCallback(async (inputTranscript: string) => {
    try {
      console.log('🔄 [SeamlessVoice] Processing input:', inputTranscript);
      
      // Step 1: Process transcript using existing voice API
      const response = await apiRequest('POST', '/api/voice/process', {
        transcript: inputTranscript,
        sessionId: sessionId || `session_${Date.now()}`,
        context: extractedData
      });

      const result = await response.json();
      console.log('📦 [SeamlessVoice] API result:', result);
      
      // Update extracted data
      const newExtractedData = { ...extractedData, ...result };
      setExtractedData(newExtractedData);
      
      if (result.sessionId) setSessionId(result.sessionId);

      // Step 2: Check what fields are still missing
      const requiredFields = ['amount', 'vendor', 'category'];
      const missingFields = requiredFields.filter(field => !newExtractedData[field]);
      
      console.log('🔍 [SeamlessVoice] Missing fields:', missingFields);
      console.log('📝 [SeamlessVoice] Current data:', newExtractedData);

      if (missingFields.length === 0) {
        // Transaction complete - save it
        console.log('✅ [SeamlessVoice] Transaction complete, saving...');
        await saveTransaction({
          amount: newExtractedData.amount,
          vendor: newExtractedData.vendor,
          description: newExtractedData.description || newExtractedData.vendor,
          category: newExtractedData.category,
          categoryId: newExtractedData.categoryId,
          date: newExtractedData.date || new Date().toISOString().split('T')[0],
          type: newExtractedData.type || 'expense',
          confidence: newExtractedData.confidence || 0.8
        });
      } else {
        // Step 3: Ask for missing field using TTS service
        const nextField = missingFields[0];
        console.log('❓ [SeamlessVoice] Asking for field:', nextField);
        
        const ttsResponse = await apiRequest('POST', '/api/tts/question', {
          field: nextField,
          extractedData: newExtractedData,
          generateAudio: true
        });
        
        const ttsResult = await ttsResponse.json();
        console.log('🔊 [SeamlessVoice] TTS result:', { hasAudio: !!ttsResult.audioData, question: ttsResult.question });
        
        // Play TTS audio and restart listening
        if (ttsResult.audioData) {
          await playTTSAudio(ttsResult.audioData);
          // Automatically restart listening after TTS finishes
          setTimeout(() => {
            console.log('🔄 [SeamlessVoice] Auto-restarting listening...');
            startListening();
          }, 500);
        } else {
          // Fallback: restart listening immediately if no audio
          setTimeout(() => startListening(), 1000);
        }
      }

      setIsProcessing(false);
    } catch (error) {
      console.error('❌ [SeamlessVoice] Processing error:', error);
      setIsProcessing(false);
      toast({
        title: 'Processing failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [sessionId, extractedData]);

  // Play TTS audio
  const playTTSAudio = useCallback(async (base64Data: string) => {
    try {
      const audioBlob = new Blob([
        Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
      ], { type: 'audio/mpeg' });
      
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      await new Promise<void>((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        audio.play();
      });
    } catch (error) {
      console.error('TTS playback failed:', error);
    }
  }, []);

  // Save transaction
  const saveTransaction = useCallback(async (transaction: ExtractedTransaction) => {
    try {
      await createTransactionMutation.mutateAsync({
        amount: transaction.amount,
        type: transaction.type,
        description: transaction.description,
        vendor: transaction.vendor,
        category: transaction.category,
        categoryId: transaction.categoryId,
        date: transaction.date,
        isRecurring: false
      });

      toast({
        title: 'Transaction saved!',
        description: `${transaction.vendor} - $${transaction.amount}`,
      });

      onComplete?.(transaction);
      
      // Reset
      setTimeout(() => {
        setMessages([]);
        setExtractedData({});
        setSessionId('');
        setTranscript('');
      }, 2000);

    } catch (error) {
      console.error('Failed to save transaction:', error);
      toast({
        title: 'Save failed',
        variant: 'destructive',
      });
    }
  }, [createTransactionMutation, onComplete]);

  // Start listening - EXACT COPY from working voice-input
  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      console.error('❌ [SeamlessVoice] Recognition not initialized');
      return;
    }

    console.log('▶️ [SeamlessVoice] Starting recognition...');
    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('❌ [SeamlessVoice] Failed to start:', error);
    }
  }, []);

  // Stop listening
  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    
    console.log('🛑 [SeamlessVoice] Stopping recognition...');
    recognitionRef.current.stop();
  }, []);

  // Toggle listening - EXACT COPY
  const toggleListening = () => {
    if (!recognitionRef.current) {
      console.error('❌ [SeamlessVoice] Recognition not initialized');
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      // Start new session
      setSessionId(`session_${Date.now()}`);
      setMessages([]);
      setExtractedData({});
      setTranscript('');
      startListening();
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Simple button like working voice-input */}
      <Button
        onClick={toggleListening}
        disabled={isProcessing}
        size="lg"
        className={cn(
          'transition-colors',
          isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
        )}
      >
        {isListening ? (
          <>
            <MicOff className="h-5 w-5 mr-2" />
            Stop Listening
          </>
        ) : (
          <>
            <Mic className="h-5 w-5 mr-2" />
            Start Voice Input
          </>
        )}
      </Button>

      {/* Status */}
      {isListening && (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm">Listening...</span>
        </div>
      )}

      {/* No visible transcripts or messages - pure ChatGPT voice mode */}

      {/* Processing indicator */}
      {isProcessing && (
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Processing...</span>
        </div>
      )}
    </div>
  );
}