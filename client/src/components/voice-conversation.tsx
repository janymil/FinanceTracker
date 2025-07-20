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
}

export function VoiceConversation({ onClose, onComplete }: VoiceConversationProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('Tell me about a transaction...');
  const [sessionId] = useState(`session_${Date.now()}`);
  const [transactionData, setTransactionData] = useState<TransactionData>({
    amount: null,
    description: null,
    type: null,
    categoryId: null,
    categoryName: null
  });

  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript.trim();
        console.log('🎤 Voice heard:', transcript);
        if (transcript) {
          processVoiceInput(transcript);
        }
      };

      recognition.onend = () => {
        console.log('🎤 Recognition ended');
        setIsListening(false);
        
        // Auto restart with timeout if transaction not complete
        if (!isTransactionComplete() && !isProcessing) {
          timeoutRef.current = setTimeout(() => {
            console.log('⏰ 1.8s timeout - asking follow-up');
            askNextQuestion();
          }, 1800); // 1.8 second timeout as requested
        }
      };

      recognition.onerror = (event: any) => {
        console.error('🎤 Speech error:', event.error);
        setIsListening(false);
        
        if (event.error === 'no-speech') {
          // No speech detected - trigger follow-up after timeout
          timeoutRef.current = setTimeout(() => {
            askNextQuestion();
          }, 1800);
        }
      };

      recognitionRef.current = recognition;
    } else {
      toast({
        title: 'Not supported',
        description: 'Speech recognition not supported in this browser',
        variant: 'destructive'
      });
    }

    // Start conversation
    setTimeout(() => {
      speak('Tell me about a transaction');
      setTimeout(() => startListening(), 1000);
    }, 500);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  // Process voice input with AI categorization
  const processVoiceInput = useCallback(async (transcript: string) => {
    if (isProcessing) return;

    setIsProcessing(true);
    setCurrentMessage('Processing...');
    
    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    try {
      console.log('📡 Sending to voice conversation API:', {
        transcript,
        sessionId,
        currentData: transactionData
      });

      // Call voice conversation API with AI categorization
      const response = await apiRequest('POST', '/api/voice/conversation', {
        transcript,
        sessionId,
        currentData: transactionData
      });

      const result = await response.json();
      console.log('✅ Voice conversation result:', result);

      if (result.success) {
        // Update transaction data with AI categorization results
        const updatedData = result.data;
        setTransactionData(updatedData);

        console.log('📊 Updated transaction data:', updatedData);

        if (result.isComplete) {
          // All required fields collected - save transaction
          console.log('🎯 Transaction complete - saving...');
          await saveTransaction(updatedData);
        } else {
          // Ask next question after short delay
          console.log('❓ Missing fields:', result.missing);
          setTimeout(() => {
            if (result.nextQuestion) {
              setCurrentMessage(result.nextQuestion);
              speak(result.nextQuestion);
              setTimeout(() => startListening(), 1500);
            } else {
              askNextQuestion(result.nextField, updatedData);
            }
          }, 500);
        }
      } else {
        throw new Error(result.error || 'Failed to process voice input');
      }

    } catch (error) {
      console.error('💥 Voice processing error:', error);
      setCurrentMessage('Error processing. Try again.');
      setTimeout(() => askNextQuestion(), 2000);
    } finally {
      setIsProcessing(false);
    }
  }, [transactionData, sessionId, isProcessing]);

  // Check if transaction has all required fields
  const isTransactionComplete = useCallback(() => {
    return transactionData.amount && 
           transactionData.description && 
           transactionData.type;
  }, [transactionData]);

  // Ask next question based on missing fields
  const askNextQuestion = useCallback((field?: string, data = transactionData) => {
    let question = '';
    
    if (!data.amount || field === 'amount') {
      question = 'How much was it?';
    } else if (!data.description || field === 'description') {
      question = data.amount ? `What was this $${data.amount} for?` : 'What was this transaction for?';
    } else if (!data.type || field === 'type') {
      question = data.description ? `Was "${data.description}" an expense or income?` : 'Was this an expense or income?';
    } else {
      // Should not reach here if logic is correct
      return;
    }

    setCurrentMessage(question);
    speak(question);
    setTimeout(() => startListening(), 1500);
  }, [transactionData]);

  // Start listening
  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening && !isProcessing) {
      console.log('🎤 Starting to listen...');
      setIsListening(true);
      recognitionRef.current.start();
    }
  }, [isListening, isProcessing]);

  // Text-to-speech
  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      speechSynthesis.speak(utterance);
    }
  }, []);

  // Save complete transaction
  const saveTransaction = async (data: TransactionData) => {
    if (!data.amount || !data.description || !data.type) {
      console.error('❌ Missing required transaction data:', data);
      return;
    }

    try {
      setCurrentMessage('Saving transaction...');
      
      const transactionPayload = {
        amount: data.amount,
        description: data.description,
        type: data.type,
        date: data.date || new Date().toISOString().split('T')[0],
        categoryId: data.categoryId, // AI categorization result
        isRecurring: false
      };

      console.log('💾 Saving transaction:', transactionPayload);

      const response = await apiRequest('POST', '/api/transactions', transactionPayload);

      if (response.ok) {
        const saved = await response.json();
        const successMessage = `Saved $${data.amount} ${data.type}!`;
        
        // Show category if AI found one
        const categoryInfo = data.categoryName ? ` in ${data.categoryName}` : '';
        const fullMessage = successMessage + categoryInfo;
        
        setCurrentMessage(fullMessage);
        speak(successMessage);
        
        toast({
          title: 'Transaction saved',
          description: `$${data.amount} ${data.type} - ${data.description}${categoryInfo}`,
        });

        // Refresh data
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
        
        onComplete?.();
        setTimeout(onClose, 3000);
      } else {
        throw new Error('Failed to save transaction');
      }
    } catch (error) {
      console.error('💥 Save transaction error:', error);
      setCurrentMessage('Failed to save. Try again.');
      toast({
        title: 'Error',
        description: 'Failed to save transaction',
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
          <div className="flex justify-center">
            {isProcessing ? (
              <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
            ) : isListening ? (
              <Mic className="h-12 w-12 text-red-500 animate-pulse" />
            ) : (
              <MicOff className="h-12 w-12 text-gray-400" />
            )}
          </div>
          
          {/* Current message */}
          <p className="text-sm text-gray-600 dark:text-gray-300 min-h-[40px] flex items-center justify-center px-2">
            {currentMessage}
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
                  (transactionData.description.length > 20 ? 
                    transactionData.description.substring(0, 20) + '...' : 
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
                  'Waiting...'
                }
              </span>
            </div>
            {/* Show category if AI found one */}
            {transactionData.categoryName && (
              <div className="flex justify-between items-center">
                <span className="font-medium">Category:</span>
                <span className="text-blue-600 font-medium text-xs">
                  {transactionData.categoryName}
                </span>
              </div>
            )}
          </div>
          
          {/* Manual controls */}
          <div className="flex gap-2 justify-center">
            <Button 
              size="sm" 
              onClick={startListening}
              disabled={isListening || isProcessing}
              variant="outline"
            >
              {isListening ? 'Listening...' : 'Speak'}
            </Button>
            
            {!isTransactionComplete() && (
              <Button 
                size="sm" 
                onClick={() => askNextQuestion()}
                disabled={isProcessing}
                variant="outline"
              >
                Ask Question
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}