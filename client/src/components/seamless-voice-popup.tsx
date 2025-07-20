import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Loader2, X, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface SeamlessVoicePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

interface ExtractedTransaction {
  amount: number;
  vendor: string;
  description: string;
  category: string;
  categoryId?: string;
  date: string;
  type: 'income' | 'expense';
}

export function SeamlessVoicePopup({ isOpen, onClose, onComplete }: SeamlessVoicePopupProps) {
  const { t, i18n } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [extractedData, setExtractedData] = useState<Partial<ExtractedTransaction>>({});
  const [sessionId, setSessionId] = useState<string>('');
  const [listeningTimeout, setListeningTimeout] = useState<NodeJS.Timeout | null>(null);
  
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

  // Helper function for voice language mapping
  const getVoiceLanguage = (lang: string): string => {
    const langMap: Record<string, string> = {
      'en-us': 'en-US',
      'es-pe': 'es-PE', 
      'sk-sk': 'sk-SK'
    };
    return langMap[lang] || 'en-US';
  };

  // MOVED TO AFTER FUNCTION DEFINITIONS

  // Play TTS audio - NON-BLOCKING for seamless conversation
  const playTTSAudio = useCallback(async (base64Data: string) => {
    try {
      setIsSpeaking(true);
      const audioBlob = new Blob([
        Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
      ], { type: 'audio/mpeg' });
      
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      // NON-BLOCKING: Play and continue immediately
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setIsSpeaking(false);
      };
      
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        setIsSpeaking(false);
      };
      
      // Start playing and return immediately - don't wait
      audio.play().catch(err => {
        console.log('Audio play failed:', err);
        setIsSpeaking(false);
      });
      
      // Return immediately without waiting for audio to finish
      return Promise.resolve();
      
    } catch (error) {
      console.error('TTS playback failed:', error);
      setIsSpeaking(false);
      return Promise.resolve();
    }
  }, []);

  // Start listening - MOVED HERE SECOND  
  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      console.error('❌ [SeamlessPopup] Recognition not initialized');
      setCurrentMessage('Speech recognition not available');
      return;
    }

    console.log('▶️ [SeamlessPopup] Starting recognition...');
    try {
      // Reset transcript
      transcriptRef.current = '';
      
      // Request microphone permission explicitly
      navigator.mediaDevices?.getUserMedia({ audio: true })
        .then(() => {
          console.log('🎯 [SeamlessPopup] Microphone permission granted, starting...');
          recognitionRef.current.start();
        })
        .catch((permError) => {
          console.error('❌ [SeamlessPopup] Microphone permission denied:', permError);
          setCurrentMessage('Microphone permission required');
          // Try to start anyway
          recognitionRef.current.start();
        });
    } catch (error) {
      console.error('❌ [SeamlessPopup] Failed to start:', error);
      setCurrentMessage('Failed to start voice recognition');
    }
  }, []);

  // SINGLE validation function - ensures consistency everywhere
  const validateRequiredFields = (data: any): string[] => {
    const missing = [];
    
    if (!data.amount || data.amount <= 0) missing.push('amount');
    if (!data.description || !data.description.trim()) missing.push('description'); 
    if (!data.type || (data.type !== 'income' && data.type !== 'expense')) missing.push('type');
    
    return missing;
  };

  // Process voice input using existing APIs
  const processVoiceInput = useCallback(async (inputTranscript: string) => {
    try {
      // Step 1: Process transcript using existing voice API
      const response = await apiRequest('POST', '/api/voice/process', {
        transcript: inputTranscript,
        sessionId: sessionId || `session_${Date.now()}`,
        context: extractedData
      });

      const result = await response.json();
      console.log('📦 [SeamlessPopup] API result:', result);
      console.log('📦 [SeamlessPopup] Current extractedData:', extractedData);
      
      // Update extracted data - FIXED FOR VOICE API RESPONSE FORMAT
      console.log('🔧 [SeamlessPopup] Raw API result structure:', JSON.stringify(result, null, 2));
      
      // Voice API returns data in result.data structure
      const voiceData = result.data || result;
      
      const newExtractedData = { 
        ...extractedData, 
        // Extract from voice API response structure
        amount: voiceData.amount || extractedData.amount,
        vendor: voiceData.vendor || extractedData.vendor, 
        category: voiceData.categoryName || voiceData.category || extractedData.category,
        description: voiceData.description || extractedData.description,
        type: voiceData.type || extractedData.type || 'expense',
        date: voiceData.parsedDate || voiceData.date || extractedData.date,
        categoryId: voiceData.categoryId || extractedData.categoryId
      };
      
      console.log('📝 [SeamlessPopup] NEW extractedData:', newExtractedData);
      setExtractedData(newExtractedData);
      
      if (result.sessionId) setSessionId(result.sessionId);

      // Step 2: Check REQUIRED fields based on transaction schema
      // REQUIRED: amount, description, type, date (userId handled automatically)
      // OPTIONAL: categoryId, vendor, recurring fields
      
      const hasAmount = newExtractedData.amount && newExtractedData.amount > 0;
      const hasDescription = newExtractedData.description && newExtractedData.description.trim();
      const hasType = newExtractedData.type && (newExtractedData.type === 'income' || newExtractedData.type === 'expense');
      const hasDate = newExtractedData.date || newExtractedData.parsedDate || true; // Can default to today
      
      console.log('🔍 [SeamlessPopup] Required field validation:', {
        amount: newExtractedData.amount,
        hasAmount,
        description: newExtractedData.description,
        hasDescription,
        type: newExtractedData.type,
        hasType,
        date: newExtractedData.date || 'will default to today',
        hasDate,
        // Optional fields:
        vendor: newExtractedData.vendor,
        category: newExtractedData.category
      });
      
      // Use the single validation function
      const missingFields = validateRequiredFields(newExtractedData);
      
      console.log('🔍 [SeamlessPopup] Missing fields:', missingFields);
      console.log('🎯 [SeamlessPopup] Field values:', {
        amount: newExtractedData.amount,
        vendor: newExtractedData.vendor,
        category: newExtractedData.category
      });

      if (missingFields.length === 0) {
        // Transaction complete - save it
        console.log('✅ [SeamlessPopup] Transaction complete, saving...');
        // IMMEDIATE transaction saving
        setCurrentMessage('💾 Saving transaction...');
        try {
          // STRICT validation - NO FALLBACKS for required fields
          if (!newExtractedData.amount || newExtractedData.amount <= 0) {
            throw new Error('Amount is required and must be greater than 0');
          }
          if (!newExtractedData.description || !newExtractedData.description.trim()) {
            throw new Error('Description is required');
          }
          if (!newExtractedData.type || (newExtractedData.type !== 'income' && newExtractedData.type !== 'expense')) {
            throw new Error('Type must be either income or expense');
          }
          
          const transactionData = {
            amount: parseFloat(newExtractedData.amount),
            type: newExtractedData.type,
            description: newExtractedData.description.trim(),
            date: newExtractedData.date || new Date().toISOString().split('T')[0],
            // Optional fields:
            categoryId: newExtractedData.categoryId || null,
            vendor: newExtractedData.vendor || null,
            isRecurring: false
          };
          
          console.log('💾 [SeamlessPopup] Saving transaction:', transactionData);
          
          const saveResponse = await apiRequest('POST', '/api/transactions', transactionData);
          
          if (saveResponse.ok) {
            const savedTransaction = await saveResponse.json();
            console.log('✅ [SeamlessPopup] Transaction saved:', savedTransaction);
            
            setCurrentMessage(`✅ Saved $${transactionData.amount} transaction!`);
            
            // Generate success TTS
            const successTTS = await apiRequest('POST', '/api/tts/generate', {
              text: `Perfect! I saved your ${transactionData.amount} dollar transaction.`,
              generateAudio: true
            });
            
            if (successTTS.ok) {
              const successResult = await successTTS.json();
              if (successResult.audioData) {
                playTTSAudio(successResult.audioData).catch(console.error);
              }
            }
            
            onComplete?.();
            
            // Auto-close after success
            setTimeout(() => {
              handleClose();
            }, 2500);
          } else {
            throw new Error('Save request failed');
          }
        } catch (saveError) {
          console.error('❌ [SeamlessPopup] Save failed:', saveError);
          setCurrentMessage('❌ Failed to save transaction');
        }
      } else {
        // Step 3: Ask for missing field using TTS service
        const nextField = missingFields[0];
        console.log('❓ [SeamlessPopup] Asking for field:', nextField);
        
        const ttsResponse = await apiRequest('POST', '/api/tts/question', {
          field: nextField,
          extractedData: newExtractedData,
          generateAudio: true
        });
        
        const ttsResult = await ttsResponse.json();
        console.log('🔊 [SeamlessPopup] TTS result:', { hasAudio: !!ttsResult.audioData, question: ttsResult.question });
        
        setCurrentMessage(ttsResult.question || `Please provide ${nextField}`);
        
        // Play TTS audio and restart listening IMMEDIATELY - NO WAITING
        if (ttsResult.audioData) {
          console.log('🔊 [SeamlessPopup] Playing TTS question...');
          // Start listening WHILE TTS is playing for seamless conversation
          setTimeout(() => {
            console.log('🔄 [SeamlessPopup] Starting listening while TTS plays...');
            startListening();
          }, 100); // Start almost immediately - overlapping conversation
          
          // Play audio in background
          playTTSAudio(ttsResult.audioData).catch(err => console.log('TTS play failed:', err));
        } else {
          // No audio - start listening immediately
          console.log('🔄 [SeamlessPopup] No audio - starting listening immediately...');
          startListening();
        }
      }

      setIsProcessing(false);
    } catch (error) {
      console.error('❌ [SeamlessPopup] Processing error:', error);
      setIsProcessing(false);
      setCurrentMessage('Processing failed');
      toast({
        title: 'Processing failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [sessionId, extractedData, startListening, playTTSAudio]);

  // Ask for missing field when no speech detected  
  const askForMissingField = useCallback(async () => {
    try {
      console.log('❓ [SeamlessPopup] Asking for missing field...');
      setIsProcessing(true);
      setCurrentMessage('Let me ask you about your transaction...');
      
      // Use the same single validation function
      const missingFields = validateRequiredFields(extractedData);
      
      // Ask for first missing required field, or amount if all good
      const nextField = missingFields[0] || 'amount';
      
      const ttsResponse = await apiRequest('POST', '/api/tts/question', {
        field: nextField,
        extractedData: extractedData,
        generateAudio: true
      });
      
      const ttsResult = await ttsResponse.json();
      console.log('🔊 [SeamlessPopup] TTS question:', ttsResult.question);
      
      setCurrentMessage(ttsResult.question || `What is the ${nextField}?`);
      
      if (ttsResult.audioData) {
        console.log('🔊 [SeamlessPopup] Playing question TTS...');
        // Start listening WHILE TTS is playing - seamless conversation
        setTimeout(() => {
          console.log('🔄 [SeamlessPopup] Starting listening while question TTS plays...');
          startListening();
        }, 150); // Start quickly while audio plays
        
        // Play audio in background
        playTTSAudio(ttsResult.audioData).catch(err => console.log('Question TTS failed:', err));
      } else {
        // No audio - start listening immediately
        console.log('🔄 [SeamlessPopup] No question audio - starting listening immediately...');
        startListening();
      }
      
      setIsProcessing(false);
    } catch (error) {
      console.error('❌ [SeamlessPopup] Failed to ask question:', error);
      setIsProcessing(false);
      setCurrentMessage('Failed to ask question. Click microphone to continue.');
    }
  }, [extractedData, playTTSAudio, startListening]);

  // DUPLICATE REMOVED

  // Save transaction
  const saveTransaction = useCallback(async (transaction: ExtractedTransaction) => {
    try {
      setCurrentMessage('Saving transaction...');
      
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

      setCurrentMessage('Transaction saved successfully!');
      
      toast({
        title: 'Transaction saved!',
        description: `${transaction.vendor} - $${transaction.amount}`,
      });

      onComplete?.();
      
      // Auto-close after success
      setTimeout(() => {
        handleClose();
      }, 2000);

    } catch (error) {
      console.error('Failed to save transaction:', error);
      setCurrentMessage('Failed to save transaction');
      toast({
        title: 'Save failed',
        variant: 'destructive',
      });
    }
  }, [createTransactionMutation, onComplete]);

  // DUPLICATE START LISTENING REMOVED

  // Stop listening
  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    
    console.log('🛑 [SeamlessPopup] Stopping recognition...');
    
    // Clear timeout if exists
    if (listeningTimeout) {
      clearTimeout(listeningTimeout);
      setListeningTimeout(null);
    }
    
    try {
      recognitionRef.current.stop();
      // The onend handler will process any transcript
    } catch (error) {
      console.error('❌ [SeamlessPopup] Error stopping recognition:', error);
      setIsListening(false);
    }
  }, [listeningTimeout]);

  // Start conversation
  const startConversation = async () => {
    console.log('🎬 [SeamlessPopup] Starting conversation...');
    setSessionId(`session_${Date.now()}`);
    setExtractedData({});
    
    // IMMEDIATELY ask the first question with TTS
    try {
      setCurrentMessage('Let me ask you about your transaction...');
      setIsProcessing(true);
      
      const ttsResponse = await apiRequest('POST', '/api/tts/question', {
        field: 'amount',
        extractedData: {},
        generateAudio: true
      });
      
      const ttsResult = await ttsResponse.json();
      console.log('🔊 [SeamlessPopup] Initial TTS question:', ttsResult.question);
      
      setCurrentMessage(ttsResult.question || 'How much was this transaction?');
      
      if (ttsResult.audioData) {
        console.log('🔊 [SeamlessPopup] Playing initial TTS question...');
        // Start listening WHILE TTS is playing - seamless conversation  
        setTimeout(() => {
          console.log('🔄 [SeamlessPopup] Starting listening while initial TTS plays...');
          startListening();
        }, 200); // Start quickly while audio plays
        
        // Play audio in background
        playTTSAudio(ttsResult.audioData).catch(err => console.log('Initial TTS failed:', err));
      } else {
        // No audio - start listening immediately
        console.log('🔄 [SeamlessPopup] No initial audio - starting listening immediately...');
        startListening();
      }
      
      setIsProcessing(false);
      
    } catch (error) {
      console.error('❌ [SeamlessPopup] Failed to start with TTS:', error);
      setIsProcessing(false);
      setCurrentMessage('Tell me about your transaction...');
      startListening();
    }
  };

  // Handle close
  const handleClose = () => {
    stopListening();
    setIsListening(false);
    setIsProcessing(false);
    setIsSpeaking(false);
    setCurrentMessage('');
    setExtractedData({});
    setSessionId('');
    onClose();
  };

  // Initialize speech recognition - MOVED HERE AFTER ALL FUNCTIONS
  useEffect(() => {
    if (!isOpen) return;

    console.log('🔧 [SeamlessPopup] Initializing speech recognition...');

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('❌ [SeamlessPopup] Speech Recognition not supported');
      toast({
        title: 'Voice input not supported',
        description: 'Your browser does not support voice recognition',
        variant: 'destructive',
      });
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = getVoiceLanguage(i18n.language);
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      console.log('🎤 [SeamlessPopup] Recording started');
      setIsListening(true);
      transcriptRef.current = '';
      setCurrentMessage('Listening... speak now!');
      
      // Set timeout for CONVERSATIONAL FLOW - 1.5 seconds like human talk
      const timeout = setTimeout(async () => {
        console.log('⏰ [SeamlessPopup] 1.5-second timeout - triggering conversational flow...');
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
            
            // CRITICAL: If user said something (partial), process it
            // If user said nothing, ask for missing field
            const currentTranscript = transcriptRef.current.trim();
            if (currentTranscript) {
              console.log('🗣️ [SeamlessPopup] Processing partial input from timeout:', currentTranscript);
              processVoiceInput(currentTranscript);
            } else {
              console.log('❓ [SeamlessPopup] No input detected - asking for missing field...');
              askForMissingField();
            }
          } catch (e) {
            console.log('Timeout stop failed:', e);
          }
        }
      }, 1500); // 1.5 seconds for natural conversation flow
      setListeningTimeout(timeout);
    };

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      
      // Get the best alternative
      let bestTranscript = event.results[current][0].transcript;
      let bestConfidence = event.results[current][0].confidence;
      
      for (let i = 1; i < event.results[current].length; i++) {
        const alternative = event.results[current][i];
        if (alternative.confidence > bestConfidence) {
          bestTranscript = alternative.transcript;
          bestConfidence = alternative.confidence;
        }
      }
      
      console.log('🗣️ [SeamlessPopup] Speech detected:', bestTranscript);
      
      // Show interim results
      if (!event.results[current].isFinal) {
        setCurrentMessage(`Hearing: "${bestTranscript}"...`);
      } else {
        // Clear timeout when we get final speech
        if (listeningTimeout) {
          clearTimeout(listeningTimeout);
          setListeningTimeout(null);
        }
        
        const cleanedText = bestTranscript
          .replace(/\s+/g, ' ')
          .replace(/\bdollar\b/gi, 'dollars')
          .replace(/\bcent\b/gi, 'cents')
          .trim();
          
        transcriptRef.current = transcriptRef.current + ' ' + cleanedText;
        console.log('✅ [SeamlessPopup] Final transcript:', cleanedText);
        setCurrentMessage(`Got it: "${cleanedText}"`);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('❌ [SeamlessPopup] Speech recognition error:', event.error);
      
      // Clear timeout on error
      if (listeningTimeout) {
        clearTimeout(listeningTimeout);
        setListeningTimeout(null);
      }
      
      if (isCleaningUpRef.current && event.error === 'aborted') {
        return;
      }
      
      setIsListening(false);
      
      // Handle specific errors
      switch (event.error) {
        case 'not-allowed':
          setCurrentMessage('❌ Microphone access denied. Please allow microphone and try again.');
          break;
        case 'no-speech':
          setCurrentMessage('⚠️ No speech detected. Click microphone to try again.');
          break;
        case 'audio-capture':
          setCurrentMessage('❌ Audio capture failed. Check microphone.');
          break;
        case 'network':
          setCurrentMessage('❌ Network error. Check connection.');
          break;
        default:
          setCurrentMessage('❌ Voice recognition error. Click to retry.');
      }
    };

    recognition.onend = () => {
      console.log('🔍 [SeamlessPopup] Recognition ended');
      setIsListening(false);
      
      // Clear timeout since recognition ended
      if (listeningTimeout) {
        clearTimeout(listeningTimeout);
        setListeningTimeout(null);
      }
      
      const finalTranscript = transcriptRef.current.trim();
      
      if (finalTranscript) {
        console.log('📤 [SeamlessPopup] Processing final transcript:', finalTranscript);
        setIsProcessing(true);
        setCurrentMessage('Processing...');
        processVoiceInput(finalTranscript);
      } else {
        console.log('❓ [SeamlessPopup] No speech detected - asking for missing field...');
        // Ask for missing field when no input received
        askForMissingField();
      }
    };

    recognitionRef.current = recognition;

    return () => {
      isCleaningUpRef.current = true;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.log('🧹 [SeamlessPopup] Cleanup: Recognition already stopped');
        }
      }
    };
  }, [isOpen, i18n.language, processVoiceInput, askForMissingField]);

  // Auto-start conversation when opened
  useEffect(() => {
    if (isOpen && recognitionRef.current) {
      console.log('🚀 [SeamlessPopup] Auto-starting conversation...');
      // Start IMMEDIATELY - no delay
      startConversation();
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md mx-auto bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white">
        <div className="flex flex-col items-center space-y-6 p-6">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>

          {/* ChatGPT-style voice interface */}
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold">Voice Transaction</h2>
            
            {/* Large animated microphone button - clickable */}
            <div className="relative">
              <button
                onClick={() => {
                  console.log('🖱️ [SeamlessPopup] Mic button clicked, isListening:', isListening);
                  if (isListening) {
                    console.log('🛑 [SeamlessPopup] Stopping listening via button...');
                    stopListening();
                  } else if (isProcessing || isSpeaking) {
                    console.log('⏸️ [SeamlessPopup] System busy, ignoring click...');
                    return;
                  } else {
                    console.log('▶️ [SeamlessPopup] Starting conversation via button...');
                    startConversation();
                  }
                }}
                className={cn(
                  "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer hover:scale-105",
                  isListening ? "bg-red-500 animate-pulse shadow-lg shadow-red-500/50" :
                  isSpeaking ? "bg-blue-500 animate-pulse shadow-lg shadow-blue-500/50" :
                  isProcessing ? "bg-yellow-500 shadow-lg shadow-yellow-500/50" :
                  "bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/50"
                )}
              >
                {isProcessing ? (
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                ) : isSpeaking ? (
                  <Volume2 className="h-8 w-8 text-white" />
                ) : isListening ? (
                  <Mic className="h-8 w-8 text-white" />
                ) : (
                  <MicOff className="h-8 w-8 text-white" />
                )}
              </button>
              
              {/* Animated rings for listening state */}
              {isListening && (
                <>
                  <div className="absolute inset-0 w-24 h-24 rounded-full border-2 border-red-300 animate-ping" />
                  <div className="absolute inset-0 w-24 h-24 rounded-full border border-red-400 animate-pulse" />
                </>
              )}
            </div>

            {/* Status message with more detail */}
            <div className="h-20 flex items-center justify-center">
              <div className="text-center text-gray-300 max-w-xs space-y-1">
                <p className="text-sm font-medium">
                  {currentMessage || 'Click microphone to start'}
                </p>
                {isListening && (
                  <p className="text-xs text-green-400 animate-pulse">
                    🎤 Say something now...
                  </p>
                )}
                {isProcessing && (
                  <p className="text-xs text-yellow-400">
                    ⚡ Processing your speech...
                  </p>
                )}
                {isSpeaking && (
                  <p className="text-xs text-blue-400">
                    🔊 Listen to the question...
                  </p>
                )}
              </div>
            </div>

            {/* Status indicator */}
            <div className="flex items-center justify-center space-x-2">
              <div className={cn(
                "w-2 h-2 rounded-full transition-colors",
                isListening ? "bg-red-400" :
                isSpeaking ? "bg-blue-400" :
                isProcessing ? "bg-yellow-400" :
                "bg-gray-400"
              )} />
              <span className="text-xs text-gray-400">
                {isListening ? 'Listening' :
                 isSpeaking ? 'Speaking' :
                 isProcessing ? 'Processing' :
                 'Ready'}
              </span>
            </div>
          </div>

          {/* Debug info and extracted data */}
          <div className="text-xs space-y-2 max-w-xs">
            {/* Show extracted data */}
            {Object.keys(extractedData).length > 0 && (
              <div className="bg-slate-800 p-2 rounded text-center">
                {extractedData.amount && `$${extractedData.amount} `}
                {extractedData.vendor && `• ${extractedData.vendor} `}
                {extractedData.category && `• ${extractedData.category}`}
              </div>
            )}
            
            {/* Debug info */}
            <div className="text-gray-500 text-center space-y-1">
              <div>Session: {sessionId.slice(-8) || 'None'}</div>
              <div>Recognition: {recognitionRef.current ? '✅' : '❌'}</div>
              <div>Transcript: "{transcriptRef.current.slice(0, 30)}{transcriptRef.current.length > 30 ? '...' : ''}"</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}