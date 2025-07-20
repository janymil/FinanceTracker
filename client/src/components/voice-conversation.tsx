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
  const [currentMessage, setCurrentMessage] = useState('Tell me about a transaction...');
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
        console.log('Voice heard:', transcript);
        if (transcript) {
          processVoiceInput(transcript);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        // Auto restart after timeout if not complete
        if (!conversation.isComplete && !isProcessing) {
          timeoutRef.current = setTimeout(() => {
            askNextQuestion();
          }, 1800); // 1.8 second timeout as requested
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'no-speech') {
          // No speech detected - ask follow up after timeout
          timeoutRef.current = setTimeout(() => {
            askNextQuestion();
          }, 1800);
        }
      };

      recognitionRef.current = recognition;
    }

    // Start first question
    setTimeout(() => {
      speak('Tell me about a transaction');
      setTimeout(() => startListening(), 1000);
    }, 500);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  // Process voice input through new conversation endpoint
  const processVoiceInput = useCallback(async (transcript: string) => {
    if (isProcessing) return;

    setIsProcessing(true);
    setCurrentMessage('Processing...');
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    try {
      // Call new conversation API endpoint
      const response = await apiRequest('POST', '/api/voice/conversation', {
        transcript,
        sessionId: conversation.sessionId,
        transactionData: conversation.transactionData
      });

      const result = await response.json();
      console.log('Conversation result:', result);

      if (result.success) {
        // Update conversation state
        const updatedConversation = {
          ...conversation,
          transactionData: {
            amount: result.amount || conversation.transactionData.amount,
            description: result.description || conversation.transactionData.description,
            type: result.type || conversation.transactionData.type,
            date: result.date || new Date().toISOString().split('T')[0]
          },
          currentField: result.nextField || null,
          isComplete: result.isComplete || false
        };

        setConversation(updatedConversation);

        // Check if transaction is complete
        if (updatedConversation.isComplete) {
          // Save the transaction
          await saveTransaction(updatedConversation.transactionData);
        } else {
          // Ask for next missing field
          setTimeout(() => {
            askForField(result.nextField, updatedConversation.transactionData);
          }, 500);
        }
      } else {
        throw new Error(result.error || 'Failed to process voice input');
      }

    } catch (error) {
      console.error('Voice processing error:', error);
      setCurrentMessage('Error processing. Try again.');
      setTimeout(() => askNextQuestion(), 2000);
    } finally {
      setIsProcessing(false);
    }
  }, [conversation, isProcessing]);

  // Ask for specific field
  const askForField = async (field: string, data: TransactionData) => {
    let question = '';
    
    switch (field) {
      case 'amount':
        question = 'How much was it?';
        break;
      case 'description':
        question = data.amount ? `What was this $${data.amount} for?` : 'What was this transaction for?';
        break;
      case 'type':
        question = data.description ? `Was "${data.description}" an expense or income?` : 'Was this an expense or income?';
        break;
      default:
        question = 'Please provide more details.';
    }

    setCurrentMessage(question);
    speak(question);
    
    setTimeout(() => startListening(), 1500);
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

  // Text to speech
  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      speechSynthesis.speak(utterance);
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
        const successMessage = `Saved $${data.amount} ${data.type}!`;
        setCurrentMessage(successMessage);
        speak(successMessage);
        
        toast({
          title: 'Transaction saved',
          description: `$${data.amount} ${data.type} - ${data.description}`,
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
          <p className="text-sm text-gray-600 dark:text-gray-300 min-h-[40px] flex items-center justify-center">
            {currentMessage}
          </p>
          
          {/* Progress display */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">Amount:</span>
              <span className={conversation.transactionData.amount ? 'text-green-600 font-medium' : 'text-gray-400'}>
                {conversation.transactionData.amount ? `$${conversation.transactionData.amount}` : 'Waiting...'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Description:</span>
              <span className={conversation.transactionData.description ? 'text-green-600 font-medium' : 'text-gray-400'}>
                {conversation.transactionData.description ? 
                  (conversation.transactionData.description.length > 20 ? 
                    conversation.transactionData.description.substring(0, 20) + '...' : 
                    conversation.transactionData.description
                  ) : 'Waiting...'
                }
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Type:</span>
              <span className={conversation.transactionData.type ? 'text-green-600 font-medium' : 'text-gray-400'}>
                {conversation.transactionData.type ? 
                  conversation.transactionData.type.charAt(0).toUpperCase() + conversation.transactionData.type.slice(1) : 
                  'Waiting...'
                }
              </span>
            </div>
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
            
            {!conversation.isComplete && (
              <Button 
                size="sm" 
                onClick={askNextQuestion}
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