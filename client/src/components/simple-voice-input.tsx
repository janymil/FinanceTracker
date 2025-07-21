import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, MicOff, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface SimpleVoiceInputProps {
  onClose: () => void;
  onComplete: (data: any) => void;
}

interface TransactionData {
  amount: string;
  description: string;
  type: 'income' | 'expense';
  date: string;
  note: string;
}

export function SimpleVoiceInput({ onClose, onComplete }: SimpleVoiceInputProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [accumulatedData, setAccumulatedData] = useState({
    amount: '',
    description: '',
    type: 'expense' as 'expense' | 'income',
    date: new Date().toISOString().split('T')[0], // Default to today
    category: '',
    categoryId: null as number | null,
    note: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [extractedCategory, setExtractedCategory] = useState<string>('');
  
  // Start with completely empty form
  const [transactionData, setTransactionData] = useState<TransactionData>({
    amount: '',
    description: '',
    type: 'expense',
    date: '',
    note: ''
  });
  
  // Draft key for localStorage
  const VOICE_DRAFT_KEY = 'voice_transaction_draft';

  const recognitionRef = useRef<any>(null);
  
  // Groq recording state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Recording timer state
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const MAX_RECORDING_SECONDS = 60;
  
  // New category creation state
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Get user data
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    staleTime: 5 * 60 * 1000
  });

  // Get categories for matching
  const { data: allCategories } = useQuery({
    queryKey: ['/api/categories'],
    staleTime: 5 * 60 * 1000
  });

  // Filter categories by transaction type
  const categories = allCategories?.filter(cat => cat.type === accumulatedData.type) || [];
  
  // Debug logging for category filtering
  console.log('🔍 [VOICE-INPUT] Category filtering debug:', {
    totalCategories: allCategories?.length || 0,
    transactionType: accumulatedData.type,
    filteredCategories: categories.length,
    allCategoryNames: allCategories?.map(c => `${c.name} (${c.type})`),
    filteredCategoryNames: categories.map(c => `${c.name} (${c.type})`)
  });

  const userLanguage = (user as any)?.language || i18n.language || 'en-us';
  const userCurrency = (user as any)?.currency || '$';

  // Intelligent category matching function
  const matchCategoryIntelligently = async (suggestedCategory: string, categories: any[]) => {
    if (!suggestedCategory || !categories) {
      return { name: '', id: null };
    }

    console.log('🎯 Starting intelligent category matching for:', suggestedCategory);
    console.log('🎯 Available categories:', categories.map(c => c.name));

    // Step 1: Exact match (case-insensitive)
    const exactMatch = categories.find(cat => 
      cat.name.toLowerCase() === suggestedCategory.toLowerCase()
    );
    
    if (exactMatch) {
      console.log('✅ Found exact match:', exactMatch.name);
      return { name: exactMatch.name, id: exactMatch.id };
    }

    // Step 2: Send to backend for intelligent matching
    try {
      const response = await fetch('/api/voice-mistral/match-category', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-language': getCurrentLanguageForAPI(),
        },
        body: JSON.stringify({
          suggestedCategory,
          existingCategories: categories.map(c => ({ id: c.id, name: c.name, type: c.type }))
        })
      });

      const result = await response.json();

      if (result.matchedCategory) {
        console.log('✅ Backend found intelligent match:', result.matchedCategory.name);
        return {
          name: result.matchedCategory.name,
          id: result.matchedCategory.id
        };
      }

      // Step 3: Create new category if no match found
      if (result.createNew) {
        console.log('🆕 Creating new category:', result.newCategoryName);
        const newCategoryResponse = await apiRequest('/api/categories', {
          method: 'POST',
          body: {
            name: result.newCategoryName,
            type: 'expense', // Default to expense
            color: '#6366f1' // Default color
          }
        });

        if (newCategoryResponse.id) {
          console.log('✅ New category created:', newCategoryResponse.name);
          return {
            name: newCategoryResponse.name,
            id: newCategoryResponse.id
          };
        }
      }

    } catch (error) {
      console.error('❌ Category matching failed:', error);
    }

    // Fallback: return suggested category without ID
    console.log('⚠️ Falling back to suggested category:', suggestedCategory);
    return { name: suggestedCategory, id: null };
  };

  // Get API language
  const getCurrentLanguageForAPI = () => {
    const currentLang = i18n.language || 'en';
    if (currentLang.startsWith('es')) return 'es-pe';
    if (currentLang.startsWith('sk')) return 'sk-sk'; 
    return 'en-us';
  };

  // Speech recognition language
  const getRecognitionLanguage = (lang: string) => {
    if (lang.startsWith('es')) return 'es-ES';
    if (lang.startsWith('sk')) return 'sk-SK';
    return 'en-US';
  };

  // Removed greeting audio - keeping only text info

  // Load draft on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(VOICE_DRAFT_KEY);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        // Check if draft is recent (within last 24 hours)
        if (draft.timestamp && Date.now() - draft.timestamp < 24 * 60 * 60 * 1000) {
          setAccumulatedData(draft.data);
          setExtractedCategory(draft.data.category || '');
          console.log('📝 Loaded voice transaction draft');
        } else {
          // Clear old draft
          localStorage.removeItem(VOICE_DRAFT_KEY);
        }
      } catch (error) {
        console.error('Failed to load draft:', error);
        localStorage.removeItem(VOICE_DRAFT_KEY);
      }
    }
  }, []);
  
  // Save draft whenever accumulated data changes
  useEffect(() => {
    if (accumulatedData.amount || accumulatedData.description) {
      const draft = {
        data: accumulatedData,
        timestamp: Date.now()
      };
      localStorage.setItem(VOICE_DRAFT_KEY, JSON.stringify(draft));
      console.log('💾 Saved voice transaction draft');
    }
  }, [accumulatedData]);

  // Initialize Groq audio recording (replaces browser STT)
  useEffect(() => {
    // No browser STT setup needed - using Groq instead
    return () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      // Clear timer on unmount
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  // Detect voice commands
  const detectVoiceCommand = (text: string): string | null => {
    const cleanText = text.toLowerCase().trim();
    
    // Cancel commands (multilingual)
    const cancelCommands = ['cancel', 'cancelar', 'zrušiť', 'stop', 'alto', 'parar'];
    if (cancelCommands.some(cmd => cleanText.includes(cmd))) {
      return 'cancel';
    }
    
    // Save commands
    const saveCommands = ['save', 'guardar', 'uložiť', 'ok', 'confirm', 'confirmar', 'potvrdiť'];
    if (saveCommands.some(cmd => cleanText.includes(cmd))) {
      return 'save';
    }
    
    // Repeat/retry commands
    const repeatCommands = ['repeat', 'repetir', 'opakovať', 'again', 'otra vez', 'znovu'];
    if (repeatCommands.some(cmd => cleanText.includes(cmd))) {
      return 'repeat';
    }
    
    return null;
  };

  // Process voice input - completely rewritten
  const processVoiceInput = async (text: string) => {
    if (!text.trim() || text.length < 5) return;
    
    console.log('🔍 Processing voice input:', text);
    
    // Check for voice commands first
    const command = detectVoiceCommand(text);
    if (command) {
      console.log('🎙️ Voice command detected:', command);
      
      switch (command) {
        case 'cancel':
          onClose();
          return;
        case 'save':
          if (accumulatedData.amount && accumulatedData.description) {
            handleSave();
          } else {
            toast({
              title: t('voice.incomplete_data'),
              description: t('voice.fill_required_fields'),
              variant: 'destructive'
            });
          }
          return;
        case 'repeat':
          // Clear current data and start fresh recording
          setAccumulatedData({
            amount: '',
            description: '',
            type: 'expense',
            date: new Date().toISOString().split('T')[0],
            category: '',
            categoryId: null,
            note: ''
          });
          setExtractedCategory('');
          setTranscript('');
          startListening();
          return;
      }
    }
    
    try {
      const response = await fetch('/api/voice/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          userLanguage: getCurrentLanguageForAPI()
        })
      });

      const data = await response.json();
      console.log('📋 Parsed response:', data);

      if (data.success && data.data) {
        const parsed = data.data;
        
        // Accumulate data instead of overwriting - merge with existing data
        setAccumulatedData(prev => {
          const updated = {
            amount: parsed.amount || prev.amount,
            description: parsed.description || prev.description,
            type: parsed.type || prev.type,
            date: parsed.date || prev.date, // Keep existing date if no new date parsed
            category: parsed.category || prev.category,
            categoryId: prev.categoryId, // Preserve categoryId
            note: parsed.note || text
          };
          
          console.log('🔄 Accumulated data:', updated);
          return updated;
        });
        
        // Update transaction data for display - removed as we'll use accumulatedData directly

        // This old category matching logic is removed - now handled by intelligent matching
      }
    } catch (error) {
      console.error('❌ Voice processing failed:', error);
    }
  };

  // Process audio with Groq fallback
  const processAudioWithGroq = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      console.log('🎯 Trying Groq as fallback...');
      
      const response = await fetch('/api/voice-groq/transcribe-and-parse', {
        method: 'POST',
        body: formData,
        headers: {
          'x-user-language': getCurrentLanguageForAPI(),
          'x-user-currency': userCurrency
        }
      });
      
      if (!response.ok) {
        throw new Error(`Groq HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ Groq processing result:', result.data);
      
      if (result.success && result.data) {
        // Set transcript from Groq STT
        const transcript = result.data.transcript || '';
        setTranscript(transcript);
        
        // Check for voice commands in transcript
        const command = detectVoiceCommand(transcript);
        if (command) {
          console.log('🎙️ Voice command detected in Groq transcript:', command);
          
          switch (command) {
            case 'cancel':
              onClose();
              return;
            case 'save':
              if (accumulatedData.amount && accumulatedData.description) {
                handleSave();
              } else {
                toast({
                  title: t('voice.incomplete_data'),
                  description: t('voice.fill_required_fields'),
                  variant: 'destructive'
                });
              }
              return;
            case 'repeat':
              startListening();
              return;
          }
        }
        
        // Category matched by Groq system
        const finalCategory = {
          name: result.data.category,
          id: result.data.categoryId
        };
        
        console.log('🏷️ Groq matched category:', finalCategory);
        
        // Store the parsed data for form pre-filling
        setAccumulatedData({
          amount: result.data.amount || '',
          description: result.data.description || '',
          type: result.data.type || 'expense',
          date: result.data.date || new Date().toISOString().split('T')[0],
          category: finalCategory.name,
          categoryId: finalCategory.id || '',
          note: transcript
        });
        
        setExtractedCategory(finalCategory.name);
        
        toast({
          title: t('voice.processing_complete'),
          description: t('voice.review_and_save'),
        });
        
        console.log('✅ Groq voice data extracted successfully');
        return true; // Success
      } else {
        throw new Error('No data returned from Groq processing');
      }
    } catch (error) {
      console.error('❌ Groq processing also failed:', error);
      throw error;
    }
  };

  // Process audio with Mistral (with automatic Groq fallback)
  const processAudioWithMistral = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      console.log('🎤 Sending audio to Mistral for processing...');
      
      const response = await fetch('/api/voice-mistral/transcribe-and-parse', {
        method: 'POST',
        body: formData,
        headers: {
          'x-user-language': getCurrentLanguageForAPI(),
          'x-user-currency': userCurrency
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ Mistral processing result:', result.data);
      
      if (result.success && result.data) {
        // Set transcript from Mistral STT
        const transcript = result.data.transcript || '';
        setTranscript(transcript);
        
        // Check for voice commands in transcript
        const command = detectVoiceCommand(transcript);
        if (command) {
          console.log('🎙️ Voice command detected in Mistral transcript:', command);
          
          switch (command) {
            case 'cancel':
              onClose();
              return;
            case 'save':
              if (accumulatedData.amount && accumulatedData.description) {
                handleSave();
              } else {
                toast({
                  title: t('voice.incomplete_data'),
                  description: t('voice.fill_required_fields'),
                  variant: 'destructive'
                });
              }
              return;
            case 'repeat':
              startListening();
              return;
          }
        }
        
        // Category is already intelligently matched by Mistral system
        const finalCategory = {
          name: result.data.category,
          id: result.data.categoryId
        };
        
        console.log('🏷️ Mistral intelligently matched category:', finalCategory);
        
        // Clean amount - remove currency symbols and ensure numeric format
        let cleanAmount = result.data.amount || '';
        if (typeof cleanAmount === 'string') {
          // Remove currency symbols: $, €, £, etc.
          cleanAmount = cleanAmount.replace(/[^0-9.,]/g, '');
          // Ensure proper decimal format
          cleanAmount = cleanAmount.replace(',', '.');
        }
        
        console.log('💰 Amount processing:', {
          original: result.data.amount,
          cleaned: cleanAmount
        });
        
        // Store the parsed data for form pre-filling
        setAccumulatedData({
          amount: cleanAmount,
          description: result.data.description || '',
          type: result.data.type || 'expense',
          date: result.data.date || new Date().toISOString().split('T')[0],
          category: finalCategory.name,
          categoryId: finalCategory.id || '',
          note: transcript // Store transcript as note
        });
        
        setExtractedCategory(finalCategory.name);
        
        toast({
          title: t('voice.processing_complete'),
          description: t('voice.review_and_save'),
        });
        
        console.log('✅ Mistral voice data extracted successfully');
      } else {
        throw new Error('No data returned from Mistral processing');
      }
      
    } catch (error) {
      console.error('❌ Mistral processing failed:', error);
      
      // Try Groq as fallback
      try {
        console.log('🔄 Attempting automatic fallback to Groq...');
        await processAudioWithGroq(audioBlob);
        console.log('✅ Groq fallback successful');
      } catch (groqError) {
        // Both failed, show detailed error
        let errorMessage = t('voice.processing_failed');
        let errorDescription = '';
        
        // Determine error type
        if (error instanceof Error) {
          if (error.message.includes('HTTP 429') || error.message.includes('rate limit')) {
            errorDescription = t('voice.rate_limit_error') || 'Too many requests. Please try again in a few seconds.';
          } else if (error.message.includes('HTTP 5') || error.message.includes('network')) {
            errorDescription = t('voice.network_error') || 'Network error. Please check your connection.';
          } else if (error.message.includes('HTTP 401') || error.message.includes('unauthorized')) {
            errorDescription = t('voice.auth_error') || 'Authentication error. Please contact support.';
          } else {
            errorDescription = error.message;
          }
        }
        
        toast({
          title: errorMessage,
          description: (
            <div>
              <p>{errorDescription}</p>
              <Button 
                size="sm" 
                variant="outline" 
                className="mt-2"
                onClick={() => {
                  setIsProcessing(false);
                  // Retry with the same audio blob
                  if (audioBlob) {
                    processAudioWithMistral(audioBlob);
                  }
                }}
              >
                {t('voice.retry') || 'Retry'}
              </Button>
            </div>
          ) as any,
          variant: 'destructive',
          duration: 10000 // Show for longer to allow retry
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Start Groq recording
  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        
        // Stop all tracks to free up microphone
        stream.getTracks().forEach(track => track.stop());
        
        // Clear timer
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        setRecordingSeconds(0);
        
        // Process audio with Mistral
        processAudioWithMistral(audioBlob);
      };
      
      mediaRecorder.start();
      setIsListening(true);
      setTranscript('');
      setRecordingSeconds(0);
      
      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          const newSeconds = prev + 1;
          if (newSeconds >= MAX_RECORDING_SECONDS) {
            // Auto-stop at max time
            console.log('⏱️ Max recording time reached, auto-stopping...');
            stopListening();
            return MAX_RECORDING_SECONDS;
          }
          return newSeconds;
        });
      }, 1000);
      
      // Reset form data
      setAccumulatedData({
        amount: '',
        description: '',
        type: 'expense',
        date: new Date().toISOString().split('T')[0],
        category: '',
        categoryId: null,
        note: ''
      });
      setExtractedCategory('');
      
      toast({
        title: t('voice.recording_started'),
        description: t('voice.speak_naturally'),
      });
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      
      let errorDescription = t('voice.microphone_error');
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          errorDescription = t('voice.microphone_permission_denied') || 'Microphone permission denied. Please allow access in your browser settings.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          errorDescription = t('voice.microphone_not_found') || 'No microphone found. Please connect a microphone and try again.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          errorDescription = t('voice.microphone_in_use') || 'Microphone is already in use by another application.';
        }
      }
      
      toast({
        title: t('voice.error'),
        description: errorDescription,
        variant: 'destructive'
      });
    }
  };

  // Stop Groq recording
  const stopListening = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
      
      toast({
        title: t('voice.recording_stopped'),
        description: t('voice.processing_with_groq'),
      });
    }
  };

  // Save transaction using accumulated data
  const handleSave = async () => {
    // Check for missing critical information
    const missingFields = [];
    if (!accumulatedData.amount) missingFields.push('amount');
    if (!accumulatedData.description) missingFields.push('description');
    
    if (missingFields.length > 0) {
      toast({
        title: t('voice.incomplete_data'),
        description: `${t('voice.fill_required_fields')}. ${t('voice.try_again')}.`,
        variant: 'destructive'
      });
      return;
    }

    // Validate amount is numeric
    const numericAmount = parseFloat(accumulatedData.amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({
        title: t('common.error'),
        description: t('voice.fill_required_fields'),
        variant: 'destructive'
      });
      return;
    }

    setIsSaving(true);
    try {
      console.log('💾 Saving transaction:', accumulatedData);

      // Create transaction using the main API
      const response = await apiRequest('POST', '/api/transactions', {
        amount: parseFloat(accumulatedData.amount),
        description: accumulatedData.description,
        type: accumulatedData.type,
        date: accumulatedData.date || new Date().toISOString().split('T')[0],
        categoryId: accumulatedData.categoryId || null, // Use matched category ID if available
        referenceNote: accumulatedData.note || transcript || ''
      });

      const result = await response.json();
      
      toast({
        title: t('voice.transaction_saved'),
        description: t('voice.transaction_success'),
      });
      
      // Clear draft after successful save
      localStorage.removeItem(VOICE_DRAFT_KEY);
      
      // Call onComplete to refresh the transaction list
      onComplete(result);
      onClose();
    } catch (error) {
      console.error('Failed to save transaction:', error);
      toast({
        title: t('voice.save_failed'),
        description: t('voice.try_again'),
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{t('voice.title')}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {t('voice.instructions')}
            </p>
          </div>



          {/* Voice Controls */}
          <div>
            <Button
              onClick={isListening ? stopListening : startListening}
              variant={isListening ? "destructive" : "default"}
              className="w-full"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full"></div>
                  {t('voice.processing_with_groq')}
                </>
              ) : isListening ? (
                <>
                  <MicOff className="h-4 w-4 mr-2" />
                  {t('voice.stop_listening')}
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  {t('voice.start_listening')}
                </>
              )}
            </Button>
            
            {(transcript || isProcessing || isListening) && (
              <div className="mt-2 bg-gray-50 dark:bg-gray-700 p-3 rounded text-sm">
                <strong>{t('voice.transcript')}:</strong> {transcript || (isProcessing ? t('voice.processing_with_groq') + '...' : '')}
                {isListening && (
                  <>
                    <span className="ml-2 animate-pulse text-blue-500">🎤 {t('voice.listening')}</span>
                    <span className="ml-2 text-gray-500">({recordingSeconds}s / {MAX_RECORDING_SECONDS}s)</span>
                  </>
                )}
                {isProcessing && <span className="ml-2 animate-pulse text-orange-500">🧠 {t('voice.processing_with_groq')}</span>}
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">{t('Amount')} ({userCurrency})</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={accumulatedData.amount}
                onChange={(e) => setAccumulatedData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder={userCurrency + "0.00"}
                className={accumulatedData.amount ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}
              />
            </div>

            <div>
              <Label htmlFor="description">{t('Description')}</Label>
              <Input
                id="description"
                value={accumulatedData.description}
                onChange={(e) => setAccumulatedData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t('Transaction description')}
                className={accumulatedData.description ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}
              />
            </div>

            <div>
              <Label htmlFor="category">{t('Category')}</Label>
              <Select 
                value={accumulatedData.categoryId?.toString() || ''} 
                onValueChange={(value) => {
                  if (value === 'create-new') {
                    setIsCreatingNewCategory(true);
                    setNewCategoryName(extractedCategory || '');
                  } else {
                    const selectedCategory = categories?.find(cat => cat.id.toString() === value);
                    if (selectedCategory) {
                      setAccumulatedData(prev => ({ 
                        ...prev, 
                        category: selectedCategory.name,
                        categoryId: selectedCategory.id 
                      }));
                      setExtractedCategory(selectedCategory.name);
                    }
                  }
                }}
              >
                <SelectTrigger className={accumulatedData.category ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}>
                  <SelectValue placeholder={t('voice.select_category')}>
                    {accumulatedData.category || (extractedCategory || t('voice.category_auto'))}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {/* Debug information - Show total categories and filtering info */}
                  {(!categories || categories.length === 0) && (
                    <SelectItem value="debug-info" disabled>
                      <span className="text-red-500 text-xs">
                        Debug: Total categories: {allCategories?.length || 0}, Type: {accumulatedData.type}, Filtered: {categories.length}
                      </span>
                    </SelectItem>
                  )}
                  
                  {/* Show AI suggested category first if it's not in existing categories */}
                  {extractedCategory && !categories?.find(cat => cat.name === extractedCategory) && (
                    <SelectItem value="ai-suggestion" disabled>
                      <span className="text-blue-600 font-medium">🤖 {t('voice.ai_suggested')}: {extractedCategory}</span>
                    </SelectItem>
                  )}
                  
                  {/* Show existing user categories (filtered by transaction type) */}
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full`} style={{ backgroundColor: category.color }}></span>
                        {category.name}
                        {category.name === extractedCategory && (
                          <span className="text-blue-500 text-xs">🤖 {t('voice.ai_suggested_short')}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                  
                  {/* Show all categories for debugging if none match the filter */}
                  {categories.length === 0 && allCategories && allCategories.length > 0 && (
                    <>
                      <SelectItem value="separator" disabled>
                        <span className="text-gray-400 text-xs">--- All Categories (Debug) ---</span>
                      </SelectItem>
                      {allCategories.map((category) => (
                        <SelectItem key={`debug-${category.id}`} value={category.id.toString()}>
                          <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full`} style={{ backgroundColor: category.color }}></span>
                            {category.name} ({category.type})
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                  
                  {/* Option to create new category */}
                  <SelectItem value="create-new">
                    <span className="text-green-600 font-medium">+ {t('voice.create_new_category')}</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              
              {/* Show AI confidence if available */}
              {extractedCategory && accumulatedData.category === extractedCategory && (
                <p className="text-xs text-gray-500 mt-1">
                  🤖 {t('voice.ai_suggested')}: {extractedCategory}
                </p>
              )}
              
              {/* New category creation */}
              {isCreatingNewCategory && (
                <div className="mt-2 p-3 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <Label htmlFor="newCategoryName" className="text-sm font-medium">
                    {t('voice.new_category_name')}
                  </Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="newCategoryName"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder={extractedCategory || t('voice.category_name_placeholder')}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (newCategoryName.trim()) {
                          try {
                            const newCategory = await apiRequest('/api/categories', {
                              method: 'POST',
                              body: JSON.stringify({
                                name: newCategoryName.trim(),
                                type: accumulatedData.type,
                                color: '#6366f1'
                              })
                            });
                            
                            setAccumulatedData(prev => ({
                              ...prev,
                              category: newCategory.name,
                              categoryId: newCategory.id
                            }));
                            setExtractedCategory(newCategory.name);
                            setIsCreatingNewCategory(false);
                            setNewCategoryName('');
                            
                            toast({
                              title: t('voice.category_created') || 'Category created',
                              description: newCategory.name,
                            });
                          } catch (error) {
                            toast({
                              title: t('common.error'),
                              description: t('voice.category_creation_failed') || 'Failed to create category',
                              variant: 'destructive'
                            });
                          }
                        }
                      }}
                      disabled={!newCategoryName.trim()}
                    >
                      {t('common.create') || 'Create'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsCreatingNewCategory(false);
                        setNewCategoryName('');
                      }}
                    >
                      {t('common.cancel') || 'Cancel'}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="type">{t('Type')}</Label>
              <Select 
                value={accumulatedData.type} 
                onValueChange={(value: 'income' | 'expense') => 
                  setAccumulatedData(prev => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger className={accumulatedData.type === 'income' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">{t('Expense')}</SelectItem>
                  <SelectItem value="income">{t('Income')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="date">{t('Date')}</Label>
              <Input
                id="date"
                type="date"
                value={accumulatedData.date}
                onChange={(e) => setAccumulatedData(prev => ({ ...prev, date: e.target.value }))}
                className={accumulatedData.date && accumulatedData.date !== new Date().toISOString().split('T')[0] ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaving || !accumulatedData.amount || !accumulatedData.description}
              className="flex-1"
            >
              {isSaving ? t('voice.saving') : t('voice.save_transaction')}
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1">
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}