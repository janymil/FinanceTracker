import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { VoiceInput } from './voice-input';

interface ConversationState {
  sessionId: string;
  extractedData: Partial<Transaction>;
  missingFields: string[];
  questionHistory: string[];
  currentQuestion?: string;
  isComplete: boolean;
}

interface Transaction {
  amount: number;
  vendor: string;
  description: string;
  category: string;
  date: string;
  type: 'income' | 'expense';
}

interface ConversationalVoiceInputProps {
  onTransactionComplete: (transaction: Partial<Transaction>) => void;
  onError?: (error: string) => void;
  className?: string;
  language?: string;
  autoStart?: boolean;
}

type ConversationStatus = 
  | 'idle' 
  | 'listening' 
  | 'processing' 
  | 'asking' 
  | 'speaking' 
  | 'complete' 
  | 'error';

export function ConversationalVoiceInput({
  onTransactionComplete,
  onError,
  className,
  language,
  autoStart = false
}: ConversationalVoiceInputProps) {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState<ConversationStatus>('idle');
  const [conversation, setConversation] = useState<ConversationState>({
    sessionId: '',
    extractedData: {},
    missingFields: [],
    questionHistory: [],
    isComplete: false
  });
  const [transcript, setTranscript] = useState('');
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const conversationRef = useRef<ConversationState>(conversation);

  // Update ref when conversation changes
  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  // TTS Service
  const playAudioFromBase64 = useCallback(async (base64Data: string) => {
    try {
      // Stop any current audio
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      const audioBlob = new Blob([
        Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
      ], { type: 'audio/mpeg' });
      
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      setCurrentAudio(audio);
      setStatus('speaking');
      
      return new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setCurrentAudio(null);
          setStatus('listening');
          resolve();
        };
        
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          setCurrentAudio(null);
          reject(new Error('Audio playback failed'));
        };
        
        audio.play().catch(reject);
      });
    } catch (error) {
      console.error('Failed to play TTS audio:', error);
      setStatus('listening');
      throw error;
    }
  }, [currentAudio]);

  // Ask question with TTS
  const askQuestion = useCallback(async (field: string, extractedData: any) => {
    try {
      setStatus('processing');
      
      const response = await fetch('/api/tts/question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-language': language || i18n.language
        },
        body: JSON.stringify({
          field,
          extractedData,
          generateAudio: isTTSEnabled
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate question');
      }

      const data = await response.json();
      
      setConversation(prev => ({
        ...prev,
        currentQuestion: data.question,
        questionHistory: [...prev.questionHistory, data.question]
      }));

      // Play TTS audio if available
      if (isTTSEnabled && data.audioData) {
        await playAudioFromBase64(data.audioData);
      } else {
        setStatus('listening');
      }

      return data.question;
    } catch (error) {
      console.error('Failed to ask question:', error);
      setStatus('error');
      onError?.('Failed to generate question');
    }
  }, [isTTSEnabled, language, i18n.language, playAudioFromBase64, onError]);

  // Confirm transaction completion
  const confirmTransaction = useCallback(async (transactionData: any) => {
    try {
      setStatus('processing');

      const response = await fetch('/api/tts/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-language': language || i18n.language
        },
        body: JSON.stringify({
          transactionData,
          generateAudio: isTTSEnabled
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate confirmation');
      }

      const data = await response.json();

      // Play confirmation audio
      if (isTTSEnabled && data.audioData) {
        await playAudioFromBase64(data.audioData);
      }

      setStatus('complete');
      setTimeout(() => {
        onTransactionComplete(transactionData);
      }, 1000);

    } catch (error) {
      console.error('Failed to confirm transaction:', error);
      setStatus('error');
      onError?.('Failed to confirm transaction');
    }
  }, [isTTSEnabled, language, i18n.language, playAudioFromBase64, onTransactionComplete, onError]);

  // Process voice transcript
  const processVoiceInput = useCallback(async (inputTranscript: string) => {
    try {
      setStatus('processing');
      setTranscript(inputTranscript);

      // Choose API endpoint based on conversation state
      const isFirstInput = Object.keys(conversation.extractedData).length === 0;
      const apiEndpoint = isFirstInput ? '/api/voice/process' : '/api/voice/conversation';

      // Call appropriate voice processing API
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-language': language || i18n.language
        },
        body: JSON.stringify(isFirstInput ? {
          transcript: inputTranscript,
          sessionId: conversation.sessionId || undefined,
          context: conversation.extractedData
        } : {
          transcript: inputTranscript,
          sessionId: conversation.sessionId,
          context: {
            extractedData: conversation.extractedData,
            missingFields: conversation.missingFields
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle specific restriction errors
        if (response.status === 400 && errorData.error?.includes('restricted to transaction-related')) {
          setStatus('error');
          onError?.('Please only provide transaction information like amounts, vendors, or categories.');
          return;
        }
        
        throw new Error(errorData.message || 'Failed to process voice input');
      }

      const result = await response.json();
      
      // Update conversation state
      const newExtractedData = { ...conversation.extractedData, ...result };
      const missingFields = Object.keys({
        amount: null,
        vendor: null,
        category: null
      }).filter(field => !newExtractedData[field]);

      setConversation(prev => ({
        ...prev,
        sessionId: result.sessionId || prev.sessionId || `session_${Date.now()}`,
        extractedData: newExtractedData,
        missingFields,
        isComplete: missingFields.length === 0
      }));

      // Check if transaction is complete
      if (missingFields.length === 0) {
        await confirmTransaction(newExtractedData);
      } else {
        // Ask for the next missing field
        await askQuestion(missingFields[0], newExtractedData);
      }

    } catch (error) {
      console.error('Failed to process voice input:', error);
      setStatus('error');
      onError?.('Failed to process voice input');
    }
  }, [conversation, language, i18n.language, askQuestion, confirmTransaction, onError]);

  // Start conversation
  const startConversation = useCallback(() => {
    setStatus('listening');
    setConversation({
      sessionId: `session_${Date.now()}`,
      extractedData: {},
      missingFields: [],
      questionHistory: [],
      isComplete: false
    });
    setTranscript('');
  }, []);

  // Stop conversation
  const stopConversation = useCallback(() => {
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }
    setStatus('idle');
    setConversation({
      sessionId: '',
      extractedData: {},
      missingFields: [],
      questionHistory: [],
      isComplete: false
    });
    setTranscript('');
  }, [currentAudio]);

  // Toggle TTS
  const toggleTTS = useCallback(() => {
    setIsTTSEnabled(prev => !prev);
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
      setStatus('listening');
    }
  }, [currentAudio]);

  // Auto-start if requested
  useEffect(() => {
    if (autoStart && status === 'idle') {
      startConversation();
    }
  }, [autoStart, status, startConversation]);

  const getStatusMessage = () => {
    switch (status) {
      case 'idle':
        return t('voiceInput.conversation.idle');
      case 'listening':
        return conversation.currentQuestion || t('voiceInput.conversation.listening');
      case 'processing':
        return t('voiceInput.conversation.processing');
      case 'asking':
        return t('voiceInput.conversation.asking');
      case 'speaking':
        return t('voiceInput.conversation.speaking');
      case 'complete':
        return t('voiceInput.conversation.complete');
      case 'error':
        return t('voiceInput.conversation.error');
      default:
        return '';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'listening':
        return 'bg-green-500';
      case 'processing':
      case 'asking':
        return 'bg-yellow-500';
      case 'speaking':
        return 'bg-blue-500';
      case 'complete':
        return 'bg-green-600';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Control Buttons */}
      <div className="flex items-center gap-2">
        {status === 'idle' ? (
          <Button 
            onClick={startConversation}
            size="lg"
            className="bg-green-600 hover:bg-green-700"
          >
            <Mic className="h-5 w-5 mr-2" />
            {t('voiceInput.conversation.start')}
          </Button>
        ) : (
          <Button 
            onClick={stopConversation}
            size="lg"
            variant="destructive"
          >
            <MicOff className="h-5 w-5 mr-2" />
            {t('voiceInput.conversation.stop')}
          </Button>
        )}

        <Button
          onClick={toggleTTS}
          variant="outline"
          size="lg"
        >
          {isTTSEnabled ? (
            <Volume2 className="h-5 w-5" />
          ) : (
            <VolumeX className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Status Display */}
      {status !== 'idle' && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className={cn('w-3 h-3 rounded-full', getStatusColor())} />
              <Badge variant="outline" className="text-sm">
                {getStatusMessage()}
              </Badge>
              {(status === 'processing' || status === 'asking') && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {status === 'complete' && (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
            </div>

            {/* Current Transcript */}
            {transcript && (
              <div className="mb-3">
                <p className="text-sm text-muted-foreground">
                  {t('voiceInput.conversation.transcript')}:
                </p>
                <p className="text-sm bg-muted p-2 rounded">{transcript}</p>
              </div>
            )}

            {/* Extracted Data Preview */}
            {Object.keys(conversation.extractedData).length > 0 && (
              <div className="mb-3">
                <p className="text-sm text-muted-foreground mb-2">
                  {t('voiceInput.conversation.extracted')}:
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {conversation.extractedData.amount && (
                    <div>
                      <span className="font-medium">Amount:</span> ${conversation.extractedData.amount}
                    </div>
                  )}
                  {conversation.extractedData.vendor && (
                    <div>
                      <span className="font-medium">Vendor:</span> {conversation.extractedData.vendor}
                    </div>
                  )}
                  {conversation.extractedData.category && (
                    <div>
                      <span className="font-medium">Category:</span> {conversation.extractedData.category}
                    </div>
                  )}
                  {conversation.extractedData.date && (
                    <div>
                      <span className="font-medium">Date:</span> {conversation.extractedData.date}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Missing Fields */}
            {conversation.missingFields.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  {t('voiceInput.conversation.missing')}:
                </p>
                <div className="flex gap-1 flex-wrap">
                  {conversation.missingFields.map(field => (
                    <Badge key={field} variant="secondary" className="text-xs">
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Voice Input Component */}
      {(status === 'listening' || status === 'speaking') && (
        <VoiceInput
          onTranscript={processVoiceInput}
          onError={onError}
          language={language}
          className="hidden" // Hide the basic voice input UI since we have our own
        />
      )}
    </div>
  );
}