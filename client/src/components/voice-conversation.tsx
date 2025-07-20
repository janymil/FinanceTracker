import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

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

  // Use useRef to store the current transaction data to avoid stale closures
  const transactionDataRef = useRef<TransactionData>(transactionData);
  
  // Keep ref in sync with state
  useEffect(() => {
    transactionDataRef.current = transactionData;
  }, [transactionData]);

  const recognitionRef = useRef<any>(null);
  const conversationLockRef = useRef<boolean>(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize and start conversation
  useEffect(() => {
    initializeConversation();
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

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

    // Setup speech recognition
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.trim();
      console.log('🎤 Voice heard:', transcript);
      if (transcript && !conversationLockRef.current) {
        processVoiceInput(transcript);
      }
    };

    recognition.onstart = () => {
      console.log('🎤 Recognition started');
      setState('listening');
    };

    recognition.onend = () => {
      console.log('🎤 Recognition ended');
      if (state === 'listening') {
        setState('processing');
      }
    };

    recognition.onerror = (event: any) => {
      console.error('🎤 Speech error:', event.error);
      setState('error');
    };

    recognitionRef.current = recognition;

    // Start conversation
    startConversation();
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
  }, []);

  // Process voice input with AI
  const processVoiceInput = useCallback(async (transcript: string) => {
    if (conversationLockRef.current) return;
    
    conversationLockRef.current = true;
    setState('processing');
    setCurrentMessage('Processing...');

    try {
      console.log('📡 Processing voice input:', transcript);
      
      // Get current data from ref to avoid stale closure
      const currentData = transactionDataRef.current;
      console.log('📤 Sending to backend:', { transcript, sessionId, currentData });
      
      const response = await apiRequest('POST', '/api/voice/conversation', {
        transcript,
        sessionId,
        currentData
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
          await saveTransaction(updatedData);
        } else if (result.nextQuestion) {
          // Ask next question
          console.log('❓ Asking next question:', result.nextQuestion);
          setCurrentMessage(result.nextQuestion);
          speak(result.nextQuestion, () => {
            startListening();
          });
        } else {
          // Fallback - determine next question
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
  }, [sessionId]);

  // Determine and ask next question
  const askNextQuestion = useCallback((data: TransactionData) => {
    let question = '';

    if (!data.amount) {
      question = 'How much was it?';
    } else if (!data.description) {
      question = `What was this $${data.amount} for?`;
    } else if (!data.date) {
      question = 'When did this happen? Today or another day?';
    } else if (data.note === undefined) {
      // Ask for note - user can say "no note" or "none" to skip
      question = 'Any notes to add to this transaction?';
    } else {
      // All required data collected - save transaction
      // Note: type (expense/income) should be determined automatically by AI
      saveTransaction(data);
      return;
    }

    console.log('🗣️ Asking question:', question);
    setCurrentMessage(question);
    speak(question, () => {
      startListening();
    });
  }, []);

  // Text-to-speech with callback
  const speak = useCallback(async (text: string, onComplete?: () => void) => {
    setState('speaking');
    
    try {
      console.log('🔊 Speaking:', text);
      
      const response = await apiRequest('POST', '/api/tts/speak', {
        text,
        voice: 'alloy',
        speed: 1.0
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
        // Fallback to browser TTS
        console.log('⚠️ Using browser TTS fallback');
        if ('speechSynthesis' in window) {
          speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
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
  }, []);

  // Start listening
  const startListening = useCallback(() => {
    if (recognitionRef.current && state !== 'listening') {
      try {
        console.log('🎤 Starting to listen...');
        recognitionRef.current.start();
      } catch (error) {
        console.log('🎤 Recognition already running');
      }
    }
  }, [state]);

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
        sessionId: sessionId
      });

      const result = await response.json();

      if (result.success) {
        const successMessage = `Saved $${data.amount} ${data.type || 'transaction'}!`;
        
        setState('complete');
        setCurrentMessage(successMessage);
        speak(successMessage);

        toast({
          title: 'Transaction saved',
          description: `$${data.amount} - ${data.description}`,
        });

        // Refresh data
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
        
        onComplete?.();
        
        // Close after success message
        setTimeout(onClose, 3000);
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
  }, [queryClient, onComplete, onClose]);

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
                {transactionData.amount ? `$${transactionData.amount}` : 'Waiting...'}
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