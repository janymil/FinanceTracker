import React, { useState, useRef, useEffect } from 'react';
import { X, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface WorkingVoiceInputProps {
  onClose: () => void;
  onComplete?: (transaction: any) => void;
}

export function WorkingVoiceInput({ onClose, onComplete }: WorkingVoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('Click "Start" and say something like "25 dollars for coffee"');
  const [transactionData, setTransactionData] = useState<any>({});
  
  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        console.log('Heard:', transcript);
        processTranscript(transcript);
      };

      recognition.onend = () => {
        setIsListening(false);
        // Auto-restart after 2 seconds if no complete transaction
        if (!isTransactionComplete()) {
          timeoutRef.current = setTimeout(() => {
            askFollowUp();
          }, 2000);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech error:', event.error);
        setIsListening(false);
        if (event.error === 'no-speech') {
          askFollowUp();
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Process transcript using existing backend
  const processTranscript = async (transcript: string) => {
    try {
      setCurrentMessage('Processing...');
      
      // Use existing voice processing API
      const response = await apiRequest('POST', '/api/voice/process', {
        transcript,
        sessionId: Date.now().toString()
      });

      const result = await response.json();
      console.log('API result:', result);
      
      if (result.success && result.data) {
        const data = result.data;
        
        // Update transaction data
        const updated = {
          amount: data.amount || transactionData.amount,
          description: data.description || transactionData.description,
          type: data.type || transactionData.type,
          vendor: data.vendor || transactionData.vendor,
          categoryId: data.categoryId || transactionData.categoryId
        };
        
        setTransactionData(updated);
        
        // Check if complete
        if (updated.amount && updated.description && updated.type) {
          // Save transaction
          await saveTransaction(updated);
        } else {
          // Ask for missing info
          askFollowUp(updated);
        }
      }
    } catch (error) {
      console.error('Process error:', error);
      setCurrentMessage('Error processing. Try again.');
      setTimeout(() => startListening(), 2000);
    }
  };

  // Check if transaction is complete
  const isTransactionComplete = () => {
    return transactionData.amount && 
           transactionData.description && 
           transactionData.type;
  };

  // Ask follow-up question
  const askFollowUp = (data = transactionData) => {
    let message = '';
    
    if (!data.amount) {
      message = 'How much was the transaction?';
    } else if (!data.description) {
      message = `What was this $${data.amount} for?`;
    } else if (!data.type) {
      message = 'Was this an expense or income?';
    } else {
      return; // Complete
    }
    
    setCurrentMessage(message);
    speak(message);
    setTimeout(() => startListening(), 1500);
  };

  // Start listening
  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      recognitionRef.current.start();
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  };

  // Text to speech
  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  };

  // Save transaction
  const saveTransaction = async (data: any) => {
    try {
      setCurrentMessage('Saving transaction...');
      
      const response = await apiRequest('POST', '/api/transactions', {
        amount: parseFloat(data.amount),
        description: data.description,
        type: data.type,
        date: new Date().toISOString().split('T')[0],
        categoryId: data.categoryId || null,
        vendor: data.vendor || null,
        isRecurring: false
      });

      if (response.ok) {
        const saved = await response.json();
        setCurrentMessage(`Saved $${data.amount} transaction!`);
        speak(`Saved your ${data.amount} dollar transaction`);
        
        toast({
          title: 'Transaction saved',
          description: `$${data.amount} ${data.type}`,
        });
        
        onComplete?.(saved);
        setTimeout(onClose, 3000);
      }
    } catch (error) {
      console.error('Save error:', error);
      setCurrentMessage('Failed to save. Try again.');
    }
  };

  // Start conversation
  useEffect(() => {
    setTimeout(() => {
      speak('Tell me about a transaction');
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
          {/* Microphone */}
          <div className="flex justify-center">
            {isListening ? (
              <Mic className="h-12 w-12 text-red-500 animate-pulse" />
            ) : (
              <MicOff className="h-12 w-12 text-gray-400" />
            )}
          </div>
          
          {/* Message */}
          <p className="text-sm text-gray-600 dark:text-gray-300 min-h-[40px]">
            {currentMessage}
          </p>
          
          {/* Progress */}
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
          
          {/* Manual control */}
          <Button 
            size="sm" 
            onClick={startListening}
            disabled={isListening}
          >
            {isListening ? 'Listening...' : 'Start Talking'}
          </Button>
        </div>
      </div>
    </div>
  );
}