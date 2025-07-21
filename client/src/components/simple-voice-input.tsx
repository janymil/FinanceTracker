import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, MicOff, X, Play } from 'lucide-react';
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

  const recognitionRef = useRef<any>(null);

  // Get user data
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    staleTime: 5 * 60 * 1000
  });

  // Get categories for matching
  const { data: categories } = useQuery({
    queryKey: ['/api/categories'],
    staleTime: 5 * 60 * 1000
  });

  const userLanguage = (user as any)?.language || i18n.language || 'en-us';
  const userCurrency = (user as any)?.currency || '$';

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

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;  // Keep listening continuously
      recognitionRef.current.interimResults = true;  // Show interim results
      recognitionRef.current.maxAlternatives = 1;
      recognitionRef.current.lang = getRecognitionLanguage(userLanguage);

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        // Process all results and accumulate everything in this session
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript + ' ';
          } else {
            interimTranscript += result[0].transcript;
          }
        }
        
        // Show the complete session transcript (all sentences spoken so far)
        const sessionTranscript = finalTranscript + interimTranscript;
        console.log('🎤 Session transcript:', sessionTranscript);
        setTranscript(sessionTranscript);
        
        // DO NOT process here - only when user manually stops the session
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        // Keep the session alive by restarting recognition if user hasn't stopped manually
        if (isListening) {
          console.log('🔄 Browser stopped recognition, restarting to continue session...');
          setTimeout(() => {
            if (recognitionRef.current && isListening) {
              try {
                recognitionRef.current.start();
              } catch (error) {
                console.log('Failed to restart recognition:', error);
                setIsListening(false);
              }
            }
          }, 100);
        }
      };
    }

    // No greeting audio - removed per user request
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [userLanguage]);

  // Process voice input - completely rewritten
  const processVoiceInput = async (text: string) => {
    if (!text.trim() || text.length < 5) return;
    
    console.log('🔍 Processing voice input:', text);
    
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

        // Set category - simple matching between backend result and user categories
        if (parsed.category && categories) {
          console.log('🏷️ Parsed category from voice:', parsed.category);
          console.log('🏷️ Available user categories:', (categories as any[]).map(c => c.name));
          
          // Find matching category (simple case-insensitive match first)
          const matchingCategory = (categories as any[]).find(cat => {
            const categoryName = cat.name.toLowerCase();
            const parsedCategoryLower = parsed.category.toLowerCase();
            
            // Direct match
            if (categoryName === parsedCategoryLower) return true;
            
            // Basic English-Slovak mapping (just essential ones)
            const basicMappings: { [key: string]: string } = {
              'food': 'jedlo',
              'transportation': 'doprava', 
              'shopping': 'nákupy',
              'entertainment': 'zábava',
              'healthcare': 'zdravie',
              'utilities': 'služby'
            };
            
            return categoryName === basicMappings[parsedCategoryLower];
          });
          
          if (matchingCategory) {
            console.log('✅ Matched category:', matchingCategory.name);
            setExtractedCategory(matchingCategory.name);
            setAccumulatedData(prev => ({ 
              ...prev, 
              category: matchingCategory.name,
              categoryId: matchingCategory.id 
            }));
          } else {
            console.log('❌ No matching category found, using raw category:', parsed.category);
            setExtractedCategory(parsed.category);
            setAccumulatedData(prev => ({ ...prev, category: parsed.category }));
          }
        } else if (parsed.category) {
          console.log('🏷️ Setting category without user categories:', parsed.category);
          setExtractedCategory(parsed.category);
          setAccumulatedData(prev => ({ ...prev, category: parsed.category }));
        }
      }
    } catch (error) {
      console.error('❌ Voice processing failed:', error);
    }
  };

  // Start/stop listening
  const startListening = () => {
    if (recognitionRef.current) {
      setIsListening(true);
      setTranscript(''); // Clear transcript to start fresh session
      
      // Reset accumulated data but keep today's date as default
      setAccumulatedData({
        amount: '',
        description: '',
        type: 'expense',
        date: new Date().toISOString().split('T')[0], // Always default to today
        category: '',
        categoryId: null,
        note: ''
      });
      setExtractedCategory('');
      
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    
    // Process the ENTIRE session transcript when user manually stops
    if (transcript.trim()) {
      console.log('🛑 User ended session, processing complete transcript:', transcript);
      processVoiceInput(transcript.trim());
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
        title: 'Missing Information',
        description: `Please provide: ${missingFields.join(', ')}. Try speaking again with more details.`,
        variant: 'destructive'
      });
      return;
    }

    // Validate amount is numeric
    const numericAmount = parseFloat(accumulatedData.amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please provide a valid amount greater than 0',
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
        title: 'Success',
        description: `Transaction saved: ${accumulatedData.description}`,
      });
      
      // Call onComplete to refresh the transaction list
      onComplete(result);
      onClose();
    } catch (error) {
      console.error('Failed to save transaction:', error);
      toast({
        title: 'Error',
        description: 'Failed to save transaction',
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
            <Button variant="ghost" size="sm" className="mt-2" onClick={playGreeting}>
              <Play className="h-4 w-4 mr-2" />
              {t('voice.play_example')}
            </Button>
          </div>



          {/* Voice Controls */}
          <div>
            <Button
              onClick={isListening ? stopListening : startListening}
              variant={isListening ? "destructive" : "default"}
              className="w-full"
            >
              {isListening ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
              {isListening ? 'Stop & Process' : 'Start Listening'}
            </Button>
            
            {transcript && (
              <div className="mt-2 bg-gray-50 dark:bg-gray-700 p-3 rounded text-sm">
                <strong>{t('voice.transcript')}:</strong> {transcript}
                {isListening && <span className="ml-2 animate-pulse text-blue-500">🎤 Listening...</span>}
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">{t('transaction.amount')} ({userCurrency})</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={accumulatedData.amount}
                onChange={(e) => setAccumulatedData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                className={accumulatedData.amount ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}
              />
            </div>

            <div>
              <Label htmlFor="description">{t('transaction.description')}</Label>
              <Input
                id="description"
                value={accumulatedData.description}
                onChange={(e) => setAccumulatedData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t('transaction.description_placeholder')}
                className={accumulatedData.description ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}
              />
            </div>

            <div>
              <Label htmlFor="category">{t('transaction.category')}</Label>
              <Input
                id="category"
                value={extractedCategory || accumulatedData.category || ''}
                readOnly
                className={extractedCategory || accumulatedData.category ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'bg-muted/50'}
                placeholder="Category will be detected automatically..."
              />
            </div>

            <div>
              <Label htmlFor="type">{t('transaction.type')}</Label>
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
                  <SelectItem value="expense">{t('types.expense')}</SelectItem>
                  <SelectItem value="income">{t('types.income')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="date">{t('transaction.date')}</Label>
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