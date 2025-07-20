import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mic, MicOff, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface SeamlessVoiceTransactionProps {
  onClose: () => void;
  onComplete?: (transaction: any) => void;
}

interface TransactionData {
  amount: number | null;
  description: string | null;
  type: 'income' | 'expense' | null;
}

export function SeamlessVoiceTransaction({ onClose, onComplete }: SeamlessVoiceTransactionProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('🎤 Tell me about a transaction...');
  const [transactionData, setTransactionData] = useState<TransactionData>({
    amount: null,
    description: null,
    type: null
  });
  
  const recognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        // Get the latest final result
        for (let i = event.results.length - 1; i >= 0; i--) {
          if (event.results[i].isFinal) {
            const transcript = event.results[i][0].transcript.trim();
            if (transcript) {
              console.log('🎤 Final transcript:', transcript);
              handleVoiceInput(transcript);
            }
            break;
          }
        }
      };

      recognitionRef.current.onend = () => {
        console.log('🎤 Recognition ended');
        setIsListening(false);
        
        // Restart listening after processing if not complete
        if (!isProcessing && !isTransactionComplete()) {
          setTimeout(() => {
            startListening();
          }, 500);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('🎤 Recognition error:', event.error);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setCurrentMessage('❌ Speech recognition error. Try again.');
          setTimeout(() => {
            if (!isTransactionComplete()) {
              askForMissingField();
            }
          }, 2000);
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, []);

  // Start listening
  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening || isProcessing) return;
    
    try {
      console.log('🎤 Starting recognition...');
      setIsListening(true);
      recognitionRef.current.start();
      
      // Set silence timeout (1.5-2 seconds as requested)
      silenceTimeoutRef.current = setTimeout(() => {
        console.log('🔇 Silence timeout - asking follow-up');
        if (isListening && !isProcessing) {
          recognitionRef.current.stop();
          askForMissingField();
        }
      }, 1800); // 1.8 second timeout
      
    } catch (error) {
      console.error('🎤 Start error:', error);
      setIsListening(false);
    }
  }, [isListening, isProcessing]);

  // Handle voice input
  const handleVoiceInput = useCallback(async (transcript: string) => {
    if (isProcessing) return;
    
    // Clear silence timeout
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    
    setIsProcessing(true);
    setCurrentMessage('🤖 Processing...');
    
    try {
      // Extract transaction data from transcript
      const extractedAmount = extractAmount(transcript);
      const extractedDescription = extractDescription(transcript);
      const extractedType = extractType(transcript);
      
      // Update transaction data with new information
      const updatedData = {
        amount: extractedAmount || transactionData.amount,
        description: extractedDescription || transactionData.description,
        type: extractedType || transactionData.type
      };
      
      console.log('📝 Updated data:', updatedData);
      setTransactionData(updatedData);
      
      // Check if transaction is complete
      const missingFields = getMissingFields(updatedData);
      
      if (missingFields.length === 0) {
        // Transaction complete - save it
        console.log('✅ Transaction complete - saving');
        await saveTransaction(updatedData as Required<TransactionData>);
      } else {
        // Ask for missing information
        console.log('❓ Missing fields:', missingFields);
        askForMissingField(missingFields[0], updatedData);
      }
      
    } catch (error) {
      console.error('❌ Processing error:', error);
      setCurrentMessage('❌ Processing failed. Please try again.');
      setTimeout(() => {
        askForMissingField();
      }, 2000);
    } finally {
      setIsProcessing(false);
    }
  }, [transactionData, isProcessing]);

  // Check if transaction is complete
  const isTransactionComplete = () => {
    return transactionData.amount && 
           transactionData.amount > 0 && 
           transactionData.description && 
           transactionData.description.trim() && 
           transactionData.type;
  };

  // Get missing fields
  const getMissingFields = (data: TransactionData): string[] => {
    const missing = [];
    if (!data.amount || data.amount <= 0) missing.push('amount');
    if (!data.description || !data.description.trim()) missing.push('description');
    if (!data.type) missing.push('type');
    return missing;
  };

  // Ask for missing field
  const askForMissingField = (field?: string, data?: TransactionData) => {
    const currentData = data || transactionData;
    const missingFields = getMissingFields(currentData);
    const nextField = field || missingFields[0];
    
    let message = '';
    let speech = '';
    
    if (!nextField) {
      // No missing fields - should not happen
      return;
    }
    
    if (nextField === 'amount') {
      message = '💰 How much was the transaction?';
      speech = 'How much was the transaction?';
    } else if (nextField === 'description') {
      const amountText = currentData.amount ? `this $${currentData.amount}` : 'this';
      message = `📝 What was ${amountText} for?`;
      speech = `What was ${amountText} for?`;
    } else if (nextField === 'type') {
      message = '📊 Was this an expense or income?';
      speech = 'Was this an expense or income?';
    }
    
    setCurrentMessage(message);
    speak(speech);
    
    // Resume listening after TTS
    setTimeout(() => {
      startListening();
    }, 1500);
  };

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
        const numStr = match[0].replace(/[^\d.]/g, '');
        const amount = parseFloat(numStr);
        if (!isNaN(amount) && amount > 0) {
          console.log('💰 Extracted amount:', amount);
          return amount;
        }
      }
    }
    return null;
  };

  // Extract description from text
  const extractDescription = (text: string): string | null => {
    // Remove amount from text to get description
    let description = text.replace(/\$?\d+\.?\d*\s*dollars?/gi, '').trim();
    description = description.replace(/^(for|at|from|to|in)\s+/gi, '').trim();
    
    // If it's just a number, return null
    if (/^\d+\.?\d*$/.test(description)) {
      return null;
    }
    
    if (description.length > 2) {
      console.log('📝 Extracted description:', description);
      return description;
    }
    
    return null;
  };

  // Extract type from text
  const extractType = (text: string): 'income' | 'expense' | null => {
    const lower = text.toLowerCase();
    
    // Income keywords
    if (lower.includes('income') || lower.includes('earned') || 
        lower.includes('salary') || lower.includes('paid me') ||
        lower.includes('received')) {
      console.log('📊 Extracted type: income');
      return 'income';
    }
    
    // Expense keywords
    if (lower.includes('expense') || lower.includes('spent') || 
        lower.includes('bought') || lower.includes('paid for') ||
        lower.includes('cost')) {
      console.log('📊 Extracted type: expense');
      return 'expense';
    }
    
    return null;
  };

  // Text to speech
  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.volume = 0.8;
      speechSynthesis.speak(utterance);
    }
  };

  // Save transaction
  const saveTransaction = async (data: Required<TransactionData>) => {
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
        console.log('✅ Transaction saved:', savedTransaction);
        
        setCurrentMessage(`✅ Saved $${data.amount} ${data.type}!`);
        speak(`Perfect! I saved your ${data.amount} dollar ${data.type} for ${data.description}.`);
        
        toast({
          title: 'Transaction saved',
          description: `$${data.amount} ${data.type} saved successfully`,
        });
        
        onComplete?.(savedTransaction);
        
        // Auto-close after success
        setTimeout(() => {
          onClose();
        }, 3000);
        
      } else {
        throw new Error('Save request failed');
      }
    } catch (error) {
      console.error('❌ Save error:', error);
      setCurrentMessage('❌ Failed to save transaction');
      toast({
        title: 'Save failed',
        description: 'Could not save the transaction',
        variant: 'destructive',
      });
    }
  };

  // Start the conversation
  useEffect(() => {
    setTimeout(() => {
      speak('Tell me about a transaction');
      setTimeout(startListening, 1000);
    }, 500);
  }, [startListening]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Voice Transaction</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-center space-y-4">
          {/* Microphone Status */}
          <div className="flex justify-center">
            {isProcessing ? (
              <Loader className="h-12 w-12 text-blue-500 animate-spin" />
            ) : isListening ? (
              <Mic className="h-12 w-12 text-red-500 animate-pulse" />
            ) : (
              <MicOff className="h-12 w-12 text-gray-400" />
            )}
          </div>
          
          {/* Current Message */}
          <p className="text-sm text-gray-600 dark:text-gray-300 min-h-[40px]">
            {currentMessage}
          </p>
          
          {/* Transaction Progress */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span>Amount:</span>
              <span className={transactionData.amount ? 'text-green-600' : 'text-gray-400'}>
                {transactionData.amount ? `$${transactionData.amount}` : 'Waiting...'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Description:</span>
              <span className={transactionData.description ? 'text-green-600' : 'text-gray-400'}>
                {transactionData.description || 'Waiting...'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Type:</span>
              <span className={transactionData.type ? 'text-green-600' : 'text-gray-400'}>
                {transactionData.type || 'Waiting...'}
              </span>
            </div>
          </div>
          
          {/* Manual Controls */}
          <div className="flex justify-center space-x-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={startListening}
              disabled={isListening || isProcessing}
            >
              {isListening ? 'Listening...' : 'Talk'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}