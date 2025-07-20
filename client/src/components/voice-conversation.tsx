import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

interface VoiceConversationProps {
  onClose: () => void;
  onComplete?: () => void;
}

interface TransactionData {
  amount: number | null;
  description: string | null;
  type: 'income' | 'expense' | null;
  categoryId: number | null;
  categoryName: string | null;
  date?: string;
  note?: string;
}

type ConversationState = 'starting' | 'listening' | 'processing' | 'speaking' | 'complete' | 'error';

export function VoiceConversation({ onClose, onComplete }: VoiceConversationProps) {
  const [state, setState] = useState<ConversationState>('starting');
  const [currentMessage, setCurrentMessage] = useState('');
  const [sessionId] = useState(`session_${Date.now()}`);
  
  const [transactionData, setTransactionData] = useState<TransactionData>({
    amount: null,
    description: null,
    type: null,
    categoryId: null,
    categoryName: null,
    date: undefined,
    note: undefined
  });

  const recognitionRef = useRef<any>(null);
  const conversationLockRef = useRef<boolean>(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();

  // Get user data for language and currency
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    staleTime: 5 * 60 * 1000
  });

  // Get user's ACTUAL language and currency from database/settings
  const userLanguage = (user as any)?.language || i18n.language || 'en-us'; // User's database language preference  
  const userCurrency = (user as any)?.currency || '$'; // User's database currency preference
  
  console.log('🌍 Voice conversation using:', { 
    userLanguage, 
    userCurrency, 
    i18nLang: i18n.language,
    userData: user 
  });
  
  // Language mapping for speech recognition
  const getRecognitionLanguage = (lang: string) => {
    if (lang.startsWith('es')) return 'es-ES';
    if (lang.startsWith('sk')) return 'sk-SK';
    return 'en-US';
  };

  // Initialize and start conversation when user data is available
  useEffect(() => {
    if (user !== undefined && userLanguage && userCurrency) { // Wait for all data to load
      console.log('🚀 Initializing conversation with user data:', { userLanguage, userCurrency });
      initializeConversation();
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [user, userLanguage, userCurrency]);

  // Initialize speech recognition and start conversation
  const initializeConversation = useCallback(() => {
    if (!('webkitSpeechRecognition' in window)) {
      toast({
        title: 'Not supported',
        description: 'Speech recognition not supported in this browser',
        variant: 'destructive'
      });
      return;
    }

    console.log('🎤 Initializing speech recognition with language:', userLanguage);
    
    // Setup speech recognition with user's language
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = getRecognitionLanguage(userLanguage);
    
    console.log('🎤 STT Language set to:', recognition.lang);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.trim();
      console.log('🎤 Voice heard:', transcript);
      if (transcript && !conversationLockRef.current) {
        setState('processing');
        processVoiceInput(transcript);
      }
    };

    recognition.onstart = () => {
      console.log('🎤 Recognition started');
      setState('listening');
    };

    recognition.onend = () => {
      console.log('🎤 Recognition ended');
    };

    recognition.onerror = (event: any) => {
      console.error('🎤 Speech error:', event.error);
      setState('error');
    };

    recognitionRef.current = recognition;

    // Start conversation
    startConversation();
  }, [userLanguage, userCurrency]);

  // Text-to-speech with user's language
  const speak = useCallback(async (text: string, onComplete?: () => void) => {
    setState('speaking');
    
    try {
      console.log('🔊 Speaking:', text);
      
      const response = await apiRequest('POST', '/api/tts/speak', {
        text,
        voice: 'alloy',
        speed: 1.0,
        language: userLanguage // Pass user's language to TTS service
      });

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBufferDecoded = await audioContext.decodeAudioData(audioBuffer);
        
        const source = audioContext.createBufferSource();
        source.buffer = audioBufferDecoded;
        source.connect(audioContext.destination);
        
        source.onended = () => {
          console.log('✅ Speech finished');
          if (onComplete) onComplete();
        };
        
        source.start(0);
      } else {
        // Fallback to browser TTS with user's language
        console.log('⚠️ Using browser TTS fallback');
        if ('speechSynthesis' in window) {
          speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          
          // Set language for browser TTS
          if (userLanguage.startsWith('es')) {
            utterance.lang = 'es-ES';
          } else if (userLanguage.startsWith('sk')) {
            utterance.lang = 'sk-SK';
          } else {
            utterance.lang = 'en-US';
          }
          
          utterance.onend = () => {
            if (onComplete) onComplete();
          };
          speechSynthesis.speak(utterance);
        } else if (onComplete) {
          onComplete();
        }
      }
    } catch (error) {
      console.error('❌ TTS error:', error);
      if (onComplete) onComplete();
    }
  }, [userLanguage]);

  // Start listening with microphone permission
  const startListening = useCallback(async () => {
    if (recognitionRef.current && !conversationLockRef.current) {
      try {
        // Request microphone permission first
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('🎤 Microphone permission granted');
        
        console.log('🎤 Starting to listen...');
        setState('listening');
        recognitionRef.current.start();
      } catch (error) {
        console.error('🎤 Microphone permission denied or error:', error);
        toast({
          title: 'Microphone Access Required',
          description: 'Please allow microphone access to use voice input',
          variant: 'destructive'
        });
        setState('error');
      }
    } else {
      console.log('🎤 Cannot start listening - conversation locked or no recognition available');
    }
  }, []);

  // Start the initial conversation
  const startConversation = useCallback(() => {
    const message = 'Tell me about your transaction';
    console.log('🗣️ Starting conversation:', message);
    setCurrentMessage(message);
    speak(message, () => {
      // After speaking, start listening
      startListening();
    });
  }, [userLanguage]); // Only include userLanguage dependency to avoid circular reference

  // Process voice input with AI
  const processVoiceInput = useCallback(async (transcript: string) => {
    if (conversationLockRef.current) return;
    
    conversationLockRef.current = true;
    setState('processing');
    setCurrentMessage('Processing...');

    try {
      console.log('📡 Processing voice input:', transcript);
      console.log('📤 Sending to backend:', { transcript, sessionId, currentData: transactionData });
      
      const response = await apiRequest('POST', '/api/voice/conversation', {
        transcript,
        sessionId,
        currentData: transactionData,
        userLanguage: userLanguage,
        userCurrency: userCurrency
      });

      const result = await response.json();
      console.log('✅ Voice result:', result);

      if (result.success) {
        const updatedData = result.data;
        console.log('📥 Updating frontend state with:', updatedData);
        setTransactionData(updatedData);

        if (result.isComplete) {
          // Transaction complete - save it
          console.log('🎯 Transaction complete - saving...');
          setState('complete');
          conversationLockRef.current = true; // Lock conversation before saving
          await saveTransaction(updatedData);
        } else if (result.nextQuestion) {
          // Ask next question
          console.log('❓ Asking next question:', result.nextQuestion);
          setCurrentMessage(result.nextQuestion);
          conversationLockRef.current = false;
          setState('speaking');
          speak(result.nextQuestion, () => {
            // Only start listening if conversation is not locked
            if (!conversationLockRef.current) {
              startListening();
            }
          });
        } else {
          // Fallback - determine next question
          conversationLockRef.current = false;
          askNextQuestion(updatedData);
        }
      } else {
        throw new Error('Failed to process voice input');
      }
    } catch (error) {
      console.error('💥 Voice processing error:', error);
      setState('error');
      setCurrentMessage('Sorry, something went wrong. Let\'s try again.');
      
      setTimeout(() => {
        startConversation();
      }, 2000);
    } finally {
      conversationLockRef.current = false;
    }
  }, [transactionData, sessionId, userLanguage, userCurrency]);

  // Determine and ask next question with user's currency
  const askNextQuestion = useCallback((data: TransactionData) => {
    let question = '';

    if (!data.amount) {
      question = 'How much was it?';
    } else if (!data.description) {
      question = `What was this ${userCurrency}${data.amount} for?`;
    } else if (!data.date) {
      question = 'When did this happen? Today or another day?';
    } else if (data.note === undefined) {
      // Ask for note - user can say "no note" or "none" to skip
      question = 'Any notes to add to this transaction?';
    } else {
      // All required data collected - save transaction
      saveTransaction(data);
      return;
    }

    console.log('🗣️ Asking question:', question);
    setCurrentMessage(question);
    setState('speaking');
    speak(question, () => {
      // Only start listening if conversation is not locked
      if (!conversationLockRef.current) {
        startListening();
      }
    });
  }, [userCurrency, state]);



  // Save transaction
  const saveTransaction = useCallback(async (data: TransactionData) => {
    if (!data.amount || !data.description) {
      console.error('❌ Missing required data:', data);
      return;
    }

    setState('processing');
    setCurrentMessage('Saving transaction...');

    try {
      console.log('💾 Saving transaction:', data);

      // Use voice conversation complete endpoint
      const response = await apiRequest('POST', '/api/voice/complete', {
        transactionData: data,
        sessionId: sessionId,
        userLanguage: userLanguage // Pass user language for Mistral categorization
      });

      const result = await response.json();

      if (result.success) {
        const successMessage = `Saved ${userCurrency}${data.amount} ${data.type || 'transaction'}!`;
        
        setState('complete');
        setCurrentMessage(successMessage);
        
        // STOP ALL LISTENING permanently
        if (recognitionRef.current) {
          recognitionRef.current.stop();
          recognitionRef.current = null; // Completely disable recognition
        }
        conversationLockRef.current = true; // Lock conversation permanently
        
        speak(successMessage, () => {
          // After success message, close modal
          setTimeout(() => {
            onClose();
          }, 1500);
        });

        toast({
          title: 'Transaction saved',
          description: `${userCurrency}${data.amount} - ${data.description}`,
        });

        // Refresh data
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
        
        onComplete?.();
      } else {
        throw new Error(result.error || 'Failed to save transaction');
      }
    } catch (error) {
      console.error('💥 Save error:', error);
      setState('error');
      setCurrentMessage('Failed to save. Try again.');
      
      toast({
        title: 'Error',
        description: 'Failed to save transaction',
        variant: 'destructive'
      });
    }
  }, [queryClient, onComplete, onClose, userCurrency, userLanguage]);

  // UI helpers
  const getStatusIcon = () => {
    switch (state) {
      case 'listening':
        return <Mic className="h-12 w-12 text-red-500 animate-pulse" />;
      case 'processing':
      case 'speaking':
        return <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />;
      case 'complete':
        return <div className="h-12 w-12 text-green-500 flex items-center justify-center text-2xl">✓</div>;
      case 'error':
        return <div className="h-12 w-12 text-red-500 flex items-center justify-center text-2xl">⚠</div>;
      default:
        return <MicOff className="h-12 w-12 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (state) {
      case 'starting':
        return 'Initializing...';
      case 'listening':
        return 'Listening...';
      case 'processing':
        return 'Processing...';
      case 'speaking':
        return 'Speaking...';
      case 'complete':
        return 'Complete!';
      case 'error':
        return 'Error occurred';
      default:
        return currentMessage;
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
          {/* Status indicator */}
          <div className="flex justify-center">
            {getStatusIcon()}
          </div>
          
          {/* Current message */}
          <p className="text-sm text-gray-600 dark:text-gray-300 min-h-[40px] flex items-center justify-center px-2">
            {currentMessage || getStatusText()}
          </p>
          
          {/* Progress display */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">Amount:</span>
              <span className={transactionData.amount ? 'text-green-600 font-medium' : 'text-gray-400'}>
                {transactionData.amount ? `${userCurrency}${transactionData.amount}` : 'Waiting...'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Description:</span>
              <span className={transactionData.description ? 'text-green-600 font-medium' : 'text-gray-400'}>
                {transactionData.description ? 
                  (transactionData.description.length > 15 ? 
                    transactionData.description.substring(0, 15) + '...' : 
                    transactionData.description
                  ) : 'Waiting...'
                }
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Type:</span>
              <span className={transactionData.type ? 'text-green-600 font-medium' : 'text-gray-400'}>
                {transactionData.type ? 
                  transactionData.type.charAt(0).toUpperCase() + transactionData.type.slice(1) : 
                  'AI detecting...'
                }
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Date:</span>
              <span className={transactionData.date ? 'text-green-600 font-medium' : 'text-gray-400'}>
                {transactionData.date ? 
                  new Date(transactionData.date).toLocaleDateString() : 
                  'Waiting...'
                }
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Note:</span>
              <span className={transactionData.note ? 'text-green-600 font-medium' : 'text-gray-400'}>
                {transactionData.note ? 
                  (transactionData.note.length > 12 ? 
                    transactionData.note.substring(0, 12) + '...' : 
                    transactionData.note
                  ) : 'Asking...'
                }
              </span>
            </div>
          </div>
          
          {state === 'error' && (
            <Button 
              onClick={() => {
                setState('starting');
                startConversation();
              }}
              className="mt-4"
            >
              Try Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}