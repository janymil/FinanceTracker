import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Mic, MicOff, Loader2, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useUser } from '@clerk/clerk-react';

interface VoiceConversationProps {
  onClose: () => void;
  onComplete?: () => void;
}

interface TransactionData {
  amount: number | null;
  description: string | null;
  type: 'income' | 'expense' | null;
  date?: string;
}

interface ConversationState {
  sessionId: string;
  transactionData: TransactionData;
  currentField: string | null;
  isComplete: boolean;
}

export function VoiceConversation({ onClose, onComplete }: VoiceConversationProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [conversation, setConversation] = useState<ConversationState>({
    sessionId: `session_${Date.now()}`,
    transactionData: {
      amount: null,
      description: null,
      type: null
    },
    currentField: null,
    isComplete: false
  });

  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptRef = useRef<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const { user } = useUser();

  // Helper functions
  const getVoiceLanguage = (lang: string): string => {
    const langMap: Record<string, string> = {
      'en-us': 'en-US',
      'es-pe': 'es-PE', 
      'sk-sk': 'sk-SK'
    };
    return langMap[lang] || 'en-US';
  };

  const getUserCurrency = (): string => {
    return (user?.publicMetadata?.currency as string) || '$';
  };

  // Play TTS audio
  const playTTSAudio = useCallback(async (base64Data: string) => {
    try {
      setIsSpeaking(true);
      const audioBlob = new Blob([
        Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
      ], { type: 'audio/mpeg' });
      
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      await new Promise<void>((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setIsSpeaking(false);
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          setIsSpeaking(false);
          resolve();
        };
        audio.play().catch(() => {
          setIsSpeaking(false);
          resolve();
        });
      });
    } catch (error) {
      console.error('TTS playback failed:', error);
      setIsSpeaking(false);
    }
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = getVoiceLanguage(i18n.language);

      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        let bestTranscript = event.results[current][0].transcript;
        let bestConfidence = event.results[current][0].confidence;
        
        // Get best alternative
        for (let i = 1; i < event.results[current].length; i++) {
          const alternative = event.results[current][i];
          if (alternative.confidence > bestConfidence) {
            bestTranscript = alternative.transcript;
            bestConfidence = alternative.confidence;
          }
        }
        
        console.log('🗣️ [VoiceConversation] Speech detected:', bestTranscript);
        
        if (!event.results[current].isFinal) {
          setCurrentMessage(`${t('voiceConversation.listening')}: "${bestTranscript}"...`);
        } else {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          
          const cleanedText = bestTranscript.trim();
          transcriptRef.current = cleanedText;
          console.log('✅ [VoiceConversation] Final transcript:', cleanedText);
          setCurrentMessage(`${t('voiceConversation.processing')}: "${cleanedText}"`);
        }
      };

      recognition.onstart = () => {
        console.log('🎤 [VoiceConversation] Recording started');
        setIsListening(true);
        transcriptRef.current = '';
        setCurrentMessage(t('voiceConversation.listening'));
        
        // FAST conversation timeout - 2 seconds
        timeoutRef.current = setTimeout(() => {
          console.log('⏰ [VoiceConversation] 2-second timeout reached');
          if (recognitionRef.current) {
            try {
              recognitionRef.current.stop();
            } catch (e) {
              console.log('Timeout stop failed:', e);
            }
          }
        }, 2000);
      };

      recognition.onend = () => {
        console.log('🔍 [VoiceConversation] Recognition ended');
        setIsListening(false);
        
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        
        const finalTranscript = transcriptRef.current.trim();
        
        if (finalTranscript) {
          console.log('📤 [VoiceConversation] Processing transcript:', finalTranscript);
          processVoiceInput(finalTranscript);
        } else {
          console.log('❓ [VoiceConversation] No speech - asking next question');
          askNextQuestion();
        }
      };

      recognition.onerror = (event: any) => {
        console.error('❌ [VoiceConversation] Speech recognition error:', event.error);
        setIsListening(false);
        
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        
        switch (event.error) {
          case 'not-allowed':
            setCurrentMessage(t('voiceConversation.mic_permission_denied'));
            break;
          case 'no-speech':
            console.log('⚠️ [VoiceConversation] No speech - asking next question');
            askNextQuestion();
            break;
          case 'audio-capture':
            setCurrentMessage(t('voiceConversation.audio_capture_failed'));
            break;
          case 'network':
            setCurrentMessage(t('voiceConversation.network_error'));
            break;
          default:
            setCurrentMessage(t('voiceConversation.voice_recognition_error'));
        }
      };

      recognitionRef.current = recognition;
      
      // Start conversation immediately
      setTimeout(() => {
        startConversation();
      }, 300);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.log('Cleanup: Recognition already stopped');
        }
      }
    };
  }, [i18n.language]);

  // Process voice input using the FAST voice processing endpoint
  const processVoiceInput = useCallback(async (transcript: string) => {
    if (isProcessing) return;

    setIsProcessing(true);
    setCurrentMessage(t('voiceConversation.processing'));
    
    try {
      // Use the optimized voice processing endpoint
      const response = await apiRequest('POST', '/api/voice/process', {
        transcript,
        language: i18n.language,
        sessionId: conversation.sessionId
      });

      const result = await response.json();
      console.log('🚀 [VoiceConversation] API result:', result);

      if (result.success && result.data) {
        const voiceData = result.data;
        
        // Update conversation state with new data
        const updatedConversation = {
          ...conversation,
          transactionData: {
            amount: voiceData.amount || conversation.transactionData.amount,
            description: voiceData.description || conversation.transactionData.description,
            type: voiceData.type || conversation.transactionData.type,
            date: voiceData.parsedDate || voiceData.date || new Date().toISOString().split('T')[0]
          },
          isComplete: false
        };

        setConversation(updatedConversation);

        // Check if transaction is complete (all required fields)
        const { amount, description, type } = updatedConversation.transactionData;
        const isComplete = amount && description && type;
        
        if (isComplete) {
          // Save the transaction
          await saveTransaction(updatedConversation.transactionData);
        } else {
          // Ask for next missing field
          setTimeout(() => {
            askNextQuestion();
          }, 500);
        }
      } else {
        throw new Error(result.error || 'Failed to process voice input');
      }

    } catch (error) {
      console.error('❌ [VoiceConversation] Processing error:', error);
      setCurrentMessage(t('voiceConversation.processing_error'));
      setTimeout(() => askNextQuestion(), 2000);
    } finally {
      setIsProcessing(false);
    }
  }, [conversation, isProcessing, i18n.language, t]);

  // Ask for specific field using TTS service
  const askForField = async (field: string, data: TransactionData) => {
    try {
      console.log('❓ [VoiceConversation] Asking for field:', field);
      
      const ttsResponse = await apiRequest('POST', '/api/tts/question', {
        field,
        extractedData: data,
        generateAudio: true
      });
      
      const ttsResult = await ttsResponse.json();
      console.log('🔊 [VoiceConversation] TTS question:', ttsResult.question);
      
      setCurrentMessage(ttsResult.question || `${t('voiceConversation.please_provide')} ${field}`);
      
      // Play TTS audio and start listening
      if (ttsResult.audioData) {
        await playTTSAudio(ttsResult.audioData);
      }
      
      // Start listening immediately after TTS
      setTimeout(() => startListening(), 300);
      
    } catch (error) {
      console.error('❌ [VoiceConversation] Failed to ask question:', error);
      // Fallback to text-only
      setCurrentMessage(`${t('voiceConversation.please_provide')} ${field}`);
      setTimeout(() => startListening(), 1000);
    }
  };

  // Ask next question based on missing data
  const askNextQuestion = () => {
    const { amount, description, type } = conversation.transactionData;
    
    if (!amount) {
      askForField('amount', conversation.transactionData);
    } else if (!description) {
      askForField('description', conversation.transactionData);
    } else if (!type) {
      askForField('type', conversation.transactionData);
    } else {
      // All data collected, save transaction
      saveTransaction(conversation.transactionData);
    }
  };

  // Start listening
  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening && !isProcessing) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  }, [isListening, isProcessing]);

  // Start conversation with initial question
  const startConversation = async () => {
    console.log('🎬 [VoiceConversation] Starting conversation');
    setCurrentMessage(t('voiceConversation.starting_conversation'));
    
    try {
      const ttsResponse = await apiRequest('POST', '/api/tts/question', {
        field: 'amount',
        extractedData: {},
        generateAudio: true
      });
      
      const ttsResult = await ttsResponse.json();
      const question = ttsResult.question || t('voiceConversation.tell_me_about_transaction');
      
      setCurrentMessage(question);
      
      if (ttsResult.audioData) {
        await playTTSAudio(ttsResult.audioData);
      }
      
      // Start listening immediately after intro
      setTimeout(() => startListening(), 300);
      
    } catch (error) {
      console.error('❌ [VoiceConversation] Failed to start:', error);
      setCurrentMessage(t('voiceConversation.tell_me_about_transaction'));
      setTimeout(() => startListening(), 1000);
    }
  };

  // Save complete transaction
  const saveTransaction = async (data: TransactionData) => {
    if (!data.amount || !data.description || !data.type) {
      console.error('Missing required transaction data');
      return;
    }

    try {
      setCurrentMessage('Saving transaction...');
      
      const response = await apiRequest('POST', '/api/transactions', {
        amount: data.amount,
        description: data.description,
        type: data.type,
        date: data.date || new Date().toISOString().split('T')[0],
        categoryId: null,
        isRecurring: false
      });

      if (response.ok) {
        const saved = await response.json();
        const successMessage = `${t('voiceConversation.saved')} ${getUserCurrency()}${data.amount} ${t(`voiceConversation.${data.type}`)}!`;
        setCurrentMessage(successMessage);
        // Generate success TTS
        try {
          const successTTS = await apiRequest('POST', '/api/tts/speak', {
            text: successMessage,
            generateAudio: true
          });
          
          if (successTTS.ok) {
            const audioBlob = await successTTS.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.play().catch(console.error);
          }
        } catch (ttsError) {
          console.log('Success TTS failed:', ttsError);
        }
        
        toast({
          title: t('voiceConversation.transaction_saved'),
          description: `${getUserCurrency()}${data.amount} ${t(`voiceConversation.${data.type}`)} - ${data.description}`,
        });

        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
        
        // Mark as complete
        setConversation(prev => ({ ...prev, isComplete: true }));
        
        onComplete?.();
        setTimeout(onClose, 3000);
      } else {
        throw new Error('Failed to save transaction');
      }
    } catch (error) {
      console.error('Save transaction error:', error);
      setCurrentMessage('Failed to save. Try again.');
      toast({
        title: t('voiceConversation.error'),
        description: t('voiceConversation.failed_to_save'),
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Voice Transaction</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-center space-y-4">
          {/* Microphone indicator */}
          <div className="flex justify-center relative">
            {isProcessing ? (
              <Loader2 className="h-12 w-12 text-yellow-500 animate-spin" />
            ) : isSpeaking ? (
              <Volume2 className="h-12 w-12 text-blue-500 animate-pulse" />
            ) : isListening ? (
              <Mic className="h-12 w-12 text-red-500 animate-pulse" />
            ) : (
              <MicOff className="h-12 w-12 text-gray-400" />
            )}
            
            {/* Animated rings for listening */}
            {isListening && (
              <>
                <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-red-300 animate-ping" />
                <div className="absolute inset-0 w-12 h-12 rounded-full border border-red-400 animate-pulse" />
              </>
            )}
          </div>
          
          {/* Current message */}
          <p className="text-sm text-gray-600 dark:text-gray-300 min-h-[40px] flex items-center justify-center">
            {currentMessage}
          </p>
          
          {/* Progress display */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">{t('voiceConversation.amount')}:</span>
              <span className={conversation.transactionData.amount ? 'text-green-600 font-medium' : 'text-gray-400'}>
                {conversation.transactionData.amount ? `${getUserCurrency()}${conversation.transactionData.amount}` : t('voiceConversation.waiting')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">{t('voiceConversation.description')}:</span>
              <span className={conversation.transactionData.description ? 'text-green-600 font-medium' : 'text-gray-400'}>
                {conversation.transactionData.description ? 
                  (conversation.transactionData.description.length > 20 ? 
                    conversation.transactionData.description.substring(0, 20) + '...' : 
                    conversation.transactionData.description
                  ) : t('voiceConversation.waiting')
                }
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">{t('voiceConversation.type')}:</span>
              <span className={conversation.transactionData.type ? 'text-green-600 font-medium' : 'text-gray-400'}>
                {conversation.transactionData.type ? 
                  t(`voiceConversation.${conversation.transactionData.type}`) : 
                  t('voiceConversation.waiting')
                }
              </span>
            </div>
          </div>
          
          {/* Manual controls */}
          <div className="flex gap-2 justify-center">
            <Button 
              size="sm" 
              onClick={startListening}
              disabled={isListening || isProcessing || isSpeaking}
              variant="outline"
            >
              {isListening ? t('voiceConversation.listening') : isSpeaking ? t('voiceConversation.speaking') : t('voiceConversation.speak')}
            </Button>
            
            {!conversation.isComplete && (
              <Button 
                size="sm" 
                onClick={askNextQuestion}
                disabled={isProcessing || isSpeaking}
                variant="outline"
              >
                {t('voiceConversation.ask_question')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}