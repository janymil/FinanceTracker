import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface SimpleVoiceInputProps {
  onClose: () => void;
  onComplete?: (transaction: any) => void;
}

interface TransactionData {
  amount: number | null;
  description: string | null;
  type: 'income' | 'expense' | null;
}

export function SimpleVoiceInput({ onClose, onComplete }: SimpleVoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('🎤 Say an amount like "25 dollars"');
  const [transactionData, setTransactionData] = useState<TransactionData>({
    amount: null,
    description: null,
    type: null
  });
  const [conversationStep, setConversationStep] = useState(0); // 0=amount, 1=description, 2=type, 3=complete
  
  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript.trim();
        console.log('🎤 Heard:', transcript);
        handleVoiceInput(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error !== 'no-speech') {
          setCurrentMessage('❌ Speech recognition error');
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  // Start listening with timeout
  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    
    setIsListening(true);
    recognitionRef.current.start();
    
    // Set timeout for no speech
    timeoutRef.current = setTimeout(() => {
      if (isListening) {
        askNextQuestion();
      }
    }, 2000); // 2 second timeout
  }, [isListening]);

  // Handle voice input based on conversation step
  const handleVoiceInput = useCallback(async (transcript: string) => {
    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    console.log(`📝 Step ${conversationStep}: Processing "${transcript}"`);

    if (conversationStep === 0) {
      // Step 1: Extract amount
      const amount = extractAmount(transcript);
      if (amount && amount > 0) {
        setTransactionData(prev => ({ ...prev, amount }));
        setConversationStep(1);
        setCurrentMessage(`💰 Got $${amount}. What was this for?`);
        speak(`Got ${amount} dollars. What was this for?`);
        setTimeout(startListening, 1500);
      } else {
        setCurrentMessage('🎤 Please say an amount like "25 dollars"');
        speak('Please say an amount like twenty five dollars');
        setTimeout(startListening, 1500);
      }
    } else if (conversationStep === 1) {
      // Step 2: Get description
      const description = transcript.trim();
      if (description.length > 2) {
        setTransactionData(prev => ({ ...prev, description }));
        setConversationStep(2);
        setCurrentMessage(`📝 "${description}" - Was this an expense or income?`);
        speak(`${description}. Was this an expense or income?`);
        setTimeout(startListening, 1500);
      } else {
        setCurrentMessage('🎤 What was this transaction for?');
        speak('What was this transaction for?');
        setTimeout(startListening, 1500);
      }
    } else if (conversationStep === 2) {
      // Step 3: Get type
      const type = extractType(transcript);
      if (type) {
        setTransactionData(prev => ({ ...prev, type }));
        setConversationStep(3);
        saveTransaction({ ...transactionData, type });
      } else {
        setCurrentMessage('🎤 Please say "expense" or "income"');
        speak('Please say expense or income');
        setTimeout(startListening, 1500);
      }
    }
  }, [conversationStep, transactionData]);

  // Ask next question when no speech detected
  const askNextQuestion = useCallback(() => {
    if (conversationStep === 0) {
      setCurrentMessage('🎤 How much was it?');
      speak('How much was it?');
    } else if (conversationStep === 1) {
      setCurrentMessage('🎤 What was this for?');
      speak('What was this for?');
    } else if (conversationStep === 2) {
      setCurrentMessage('🎤 Expense or income?');
      speak('Expense or income?');
    }
    setTimeout(startListening, 1500);
  }, [conversationStep]);

  // Extract amount from text
  const extractAmount = (text: string): number | null => {
    const patterns = [
      /(\d+\.?\d*)\s*dollars?/gi,
      /\$(\d+\.?\d*)/gi,
      /(\d+\.?\d*)/gi
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const amount = parseFloat(match[0].replace(/[^\d.]/g, ''));
        if (!isNaN(amount) && amount > 0) {
          return amount;
        }
      }
    }
    return null;
  };

  // Extract type from text
  const extractType = (text: string): 'income' | 'expense' | null => {
    const lower = text.toLowerCase();
    if (lower.includes('income') || lower.includes('earned') || lower.includes('salary')) {
      return 'income';
    }
    if (lower.includes('expense') || lower.includes('spent') || lower.includes('bought')) {
      return 'expense';
    }
    return null;
  };

  // Text to speech
  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  };

  // Save complete transaction
  const saveTransaction = async (data: TransactionData & { type: 'income' | 'expense' }) => {
    try {
      setCurrentMessage('💾 Saving transaction...');
      
      const response = await apiRequest('POST', '/api/transactions', {
        amount: data.amount,
        description: data.description,
        type: data.type,
        date: new Date().toISOString().split('T')[0],
        categoryId: null,
        vendor: null,
        isRecurring: false
      });

      if (response.ok) {
        const savedTransaction = await response.json();
        setCurrentMessage(`✅ Saved $${data.amount} transaction!`);
        speak(`Perfect! Saved your ${data.amount} dollar transaction.`);
        
        onComplete?.(savedTransaction);
        setTimeout(onClose, 2000);
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Save error:', error);
      setCurrentMessage('❌ Failed to save transaction');
      toast({
        title: 'Save failed',
        description: 'Could not save the transaction',
        variant: 'destructive',
      });
    }
  };

  // Start first question
  useEffect(() => {
    setTimeout(() => {
      speak('How much was the transaction?');
      setTimeout(startListening, 1000);
    }, 500);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Voice Input</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-center space-y-4">
          <div className="flex justify-center">
            {isListening ? (
              <Mic className="h-12 w-12 text-red-500 animate-pulse" />
            ) : (
              <MicOff className="h-12 w-12 text-gray-400" />
            )}
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {currentMessage}
          </p>
          
          <div className="text-xs text-gray-500 space-y-1">
            <p>Amount: {transactionData.amount ? `$${transactionData.amount}` : 'Waiting...'}</p>
            <p>Description: {transactionData.description || 'Waiting...'}</p>
            <p>Type: {transactionData.type || 'Waiting...'}</p>
          </div>
          
          <div className="flex justify-center space-x-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={startListening}
              disabled={isListening}
            >
              {isListening ? 'Listening...' : 'Start Talking'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}