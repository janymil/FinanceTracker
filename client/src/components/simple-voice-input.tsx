import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, MicOff, X, Play, Loader2, Brain } from 'lucide-react';
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
  category: string;
  categoryId?: number;
}

interface SpeechAnalysis {
  confidence: number;
  speechRate: number;
  hasHesitation: boolean;
  isCompleteThought: boolean;
  hasRequiredInfo: boolean;
  sentimentCompleteness: number; // 0-1 scale
}

// Intelligent pause detection engine
class IntelligentPauseDetector {
  private lastSpeechTime: number = 0;
  private speechStartTime: number = 0;
  private totalWordCount: number = 0;
  private hesitationWords = ['um', 'uh', 'eh', 'hmm', 'well', 'let me think', 'you know'];
  
  analyzeSpeech(transcript: string, confidence: number): SpeechAnalysis {
    const words = transcript.trim().split(/\s+/);
    const currentTime = Date.now();
    
    // Calculate speech rate (words per minute)
    const duration = (currentTime - this.speechStartTime) / 1000 / 60; // minutes
    const speechRate = duration > 0 ? words.length / duration : 0;
    
    // Detect hesitation patterns
    const lowerTranscript = transcript.toLowerCase();
    const hasHesitation = this.hesitationWords.some(word => lowerTranscript.includes(word)) ||
                         lowerTranscript.includes('...') ||
                         /\b\w+\s+\w+\s+\w+\b/.test(lowerTranscript.replace(/[um|uh|eh]/g, '')) === false;
    
    // Analyze sentence completeness
    const isCompleteThought = this.analyzeCompleteness(transcript);
    
    // Check for required transaction info
    const hasRequiredInfo = this.hasTransactionInfo(transcript);
    
    // Calculate sentiment completeness (how "finished" the speech sounds)
    const sentimentCompleteness = this.calculateSentimentCompleteness(transcript, confidence);
    
    return {
      confidence,
      speechRate,
      hasHesitation,
      isCompleteThought,
      hasRequiredInfo,
      sentimentCompleteness
    };
  }
  
  private analyzeCompleteness(transcript: string): boolean {
    const lowerTranscript = transcript.toLowerCase().trim();
    
    // Check for sentence ending patterns
    const endsWithPunctuation = /[.!?]\s*$/.test(transcript);
    const endsWithCompletePhrase = /\b(done|finished|that's it|that's all)\s*$/.test(lowerTranscript);
    
    // Check for complete sentence structure
    const hasSubjectVerbObject = this.hasCompleteStructure(lowerTranscript);
    
    return endsWithPunctuation || endsWithCompletePhrase || hasSubjectVerbObject;
  }
  
  private hasCompleteStructure(text: string): boolean {
    // Check for complete transaction patterns in multiple languages
    const completePatterns = [
      // English: "I bought coffee for 3 dollars"
      /\b(i|we)\s+(bought|paid|spent|purchased)\s+\w+.*\s+(for|costing?)\s+\d+/i,
      // Slovak: "Kúpil som kávu za 3 eurá"
      /\b(kúpil|zaplatil)\s+som\s+\w+.*\s+za\s+\d+/i,
      // Spanish: "Compré café por 3 euros"
      /\b(compré|pagué)\s+\w+.*\s+(por|de)\s+\d+/i,
      // General amount + description pattern
      /\d+.*\b(euro|dollar|peso).*\b(coffee|food|gas|lunch|dinner)/i
    ];
    
    return completePatterns.some(pattern => pattern.test(text));
  }
  
  private hasTransactionInfo(transcript: string): boolean {
    const hasAmount = /\d+/.test(transcript) || 
                     /(one|two|three|four|five|six|seven|eight|nine|ten|jeden|dva|tri|uno|dos|tres)/i.test(transcript);
    const hasDescription = transcript.trim().split(/\s+/).length >= 3; // At least 3 words
    
    return hasAmount && hasDescription;
  }
  
  private calculateSentimentCompleteness(transcript: string, confidence: number): number {
    let score = 0;
    
    // Base confidence score
    score += confidence * 0.3;
    
    // Length and completeness indicators
    const wordCount = transcript.trim().split(/\s+/).length;
    score += Math.min(wordCount / 10, 0.3); // Up to 0.3 for reasonable length
    
    // Completeness phrases boost
    const completenessIndicators = ['for', 'za', 'por', 'costing', 'total', 'altogether'];
    if (completenessIndicators.some(word => transcript.toLowerCase().includes(word))) {
      score += 0.2;
    }
    
    // Hesitation penalty
    if (this.hesitationWords.some(word => transcript.toLowerCase().includes(word))) {
      score -= 0.1;
    }
    
    // Final punctuation bonus
    if (/[.!?]\s*$/.test(transcript)) {
      score += 0.2;
    }
    
    return Math.max(0, Math.min(1, score));
  }
  
  calculateOptimalTimeout(analysis: SpeechAnalysis, currentTranscript: string): number {
    let baseTimeout = 2500; // Default 2.5 seconds
    
    // High confidence and complete thought = quick processing
    if (analysis.confidence > 0.8 && analysis.isCompleteThought && analysis.hasRequiredInfo) {
      baseTimeout = 1200; // 1.2 seconds
    }
    // Good info but maybe hesitation = medium wait
    else if (analysis.hasRequiredInfo && analysis.sentimentCompleteness > 0.6) {
      baseTimeout = 2000; // 2 seconds
    }
    // Incomplete info or low confidence = longer wait
    else if (!analysis.hasRequiredInfo || analysis.hasHesitation) {
      baseTimeout = 4000; // 4 seconds
    }
    // Very hesitant or unclear = longest wait
    else if (analysis.confidence < 0.5 || analysis.hasHesitation) {
      baseTimeout = 5000; // 5 seconds
    }
    
    // Adjust for speech rate (slow speakers get more time)
    if (analysis.speechRate < 100) { // Less than 100 words per minute
      baseTimeout += 1000;
    }
    
    console.log('🧠 Intelligent pause analysis:', {
      confidence: analysis.confidence,
      isComplete: analysis.isCompleteThought,
      hasInfo: analysis.hasRequiredInfo,
      sentiment: analysis.sentimentCompleteness,
      calculatedTimeout: baseTimeout
    });
    
    return baseTimeout;
  }
  
  setSpeechStartTime(time: number) {
    this.speechStartTime = time;
  }
  
  updateLastSpeechTime(time: number) {
    this.lastSpeechTime = time;
  }
}

export function SimpleVoiceInput({ onClose, onComplete }: SimpleVoiceInputProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [intelligentAnalysis, setIntelligentAnalysis] = useState<SpeechAnalysis | null>(null);
  
  const [transactionData, setTransactionData] = useState<TransactionData>({
    amount: '',
    description: '',
    type: 'expense',
    date: new Date().toISOString().split('T')[0],
    category: '',
    categoryId: undefined
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const recognitionRef = useRef<any>(null);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pauseDetector = useRef(new IntelligentPauseDetector());

  // Get user data
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    staleTime: 5 * 60 * 1000
  });

  // Get categories for mapping
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

  // Play greeting
  const playGreeting = () => {
    const audioFile = userLanguage.startsWith('sk') ? '/audio/voice-greeting-sk.mp3' :
                     userLanguage.startsWith('es') ? '/audio/voice-greeting-es.mp3' :
                     '/audio/voice-greeting-en.mp3';
    
    const audio = new Audio(audioFile);
    audio.play().catch(console.error);
  };

  // Enhanced speech recognition with intelligent pause detection
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      // Optimized settings for intelligent detection
      recognitionRef.current.continuous = true; // Keep listening for natural flow
      recognitionRef.current.interimResults = true;
      recognitionRef.current.maxAlternatives = 3;
      recognitionRef.current.lang = getRecognitionLanguage(userLanguage);

      let speechStartTime = Date.now();
      
      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let newFinalTranscript = '';
        let highestConfidence = 0;
        
        // Process all results and get highest confidence
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          const confidence = result[0].confidence || 0.5;
          
          highestConfidence = Math.max(highestConfidence, confidence);
          
          if (result.isFinal) {
            newFinalTranscript += transcript + ' ';
          } else {
            interimTranscript = transcript;
          }
        }
        
        // Update transcripts
        const completeTranscript = finalTranscript + newFinalTranscript + interimTranscript;
        setTranscript(completeTranscript);
        
        // Update final transcript if we got new final results
        if (newFinalTranscript) {
          setFinalTranscript(prev => prev + newFinalTranscript);
          pauseDetector.current.updateLastSpeechTime(Date.now());
        }
        
        // Intelligent analysis of current speech
        if (completeTranscript.trim().length > 3) {
          const analysis = pauseDetector.current.analyzeSpeech(completeTranscript, highestConfidence);
          setIntelligentAnalysis(analysis);
          
          // Immediate processing for high-confidence complete thoughts
          if (newFinalTranscript && 
              analysis.confidence > 0.85 && 
              analysis.isCompleteThought && 
              analysis.hasRequiredInfo &&
              analysis.sentimentCompleteness > 0.7) {
            console.log('🚀 Immediate processing: High confidence complete thought');
            processVoiceInput(completeTranscript);
            return;
          }
          
          // Clear any existing timeout
          if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
          }
          
          // Calculate intelligent timeout based on analysis
          const optimalTimeout = pauseDetector.current.calculateOptimalTimeout(analysis, completeTranscript);
          
          // Set adaptive timeout
          processingTimeoutRef.current = setTimeout(() => {
            if (completeTranscript.trim()) {
              console.log('🧠 Intelligent timeout processing after', optimalTimeout, 'ms');
              processVoiceInput(completeTranscript);
            }
          }, optimalTimeout);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          setIsListening(false);
          toast({
            title: 'Speech Recognition Error',
            description: 'Please try again',
            variant: 'destructive'
          });
        }
      };

      recognitionRef.current.onend = () => {
        console.log('🎤 Recognition ended');
        setIsListening(false);
        
        // Final processing of any remaining transcript
        const completeTranscript = (finalTranscript + transcript).trim();
        if (completeTranscript && completeTranscript.length > 3) {
          console.log('🏁 Final processing on recognition end');
          processVoiceInput(completeTranscript);
        }
      };

      recognitionRef.current.onstart = () => {
        speechStartTime = Date.now();
        pauseDetector.current.setSpeechStartTime(speechStartTime);
        console.log('🎤 Recognition started with intelligent pause detection');
      };
    }

    playGreeting();
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, [userLanguage]);

  // Enhanced voice processing
  const processVoiceInput = async (text: string) => {
    if (!text.trim() || text.length < 3 || isProcessing) return;
    
    console.log('🔍 Processing voice input:', text);
    setIsProcessing(true);
    
    // Clear any pending timeouts
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
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
        
        // Find matching category from user's categories
        let categoryId = undefined;
        let categoryName = parsed.category || '';
        
        if (categories && parsed.category) {
          const matchingCategory = (categories as any[]).find(cat => 
            cat.name.toLowerCase().includes(parsed.category.toLowerCase()) ||
            parsed.category.toLowerCase().includes(cat.name.toLowerCase())
          );
          
          if (matchingCategory) {
            categoryId = matchingCategory.id;
            categoryName = matchingCategory.name;
          }
        }
        
        // Update form fields with extracted data
        setTransactionData(prev => ({
          amount: parsed.amount || prev.amount,
          description: parsed.description || prev.description,
          type: parsed.type || prev.type,
          date: parsed.date || prev.date,
          category: categoryName || prev.category,
          categoryId: categoryId || prev.categoryId
        }));
        
        console.log('✅ Updated transaction data:', {
          amount: parsed.amount,
          description: parsed.description,
          type: parsed.type,
          date: parsed.date,
          category: categoryName,
          categoryId
        });
      }
    } catch (error) {
      console.error('❌ Voice processing failed:', error);
      toast({
        title: 'Processing Error',
        description: 'Failed to process voice input',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Start/stop listening
  const startListening = async () => {
    if (!recognitionRef.current) return;
    
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      setIsListening(true);
      setTranscript('');
      setFinalTranscript('');
      setIntelligentAnalysis(null);
      recognitionRef.current.start();
    } catch (error) {
      console.error('Microphone access denied:', error);
      toast({
        title: 'Microphone Access Required',
        description: 'Please allow microphone access to use voice input',
        variant: 'destructive'
      });
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  // Save transaction
  const handleSave = async () => {
    if (!transactionData.amount || !transactionData.description) {
      toast({
        title: 'Missing Information',
        description: 'Please provide amount and description',
        variant: 'destructive'
      });
      return;
    }

    setIsSaving(true);
    try {
      // Create transaction using the main API
      const response = await apiRequest('POST', '/api/transactions', {
        amount: parseFloat(transactionData.amount),
        description: transactionData.description,
        type: transactionData.type,
        date: transactionData.date,
        categoryId: transactionData.categoryId || null,
        referenceNote: transcript || ''
      });

      const result = await response.json();
      
      toast({
        title: 'Success',
        description: 'Transaction saved successfully',
      });
      
      // Call onComplete with the transaction data
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
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-500" />
            {t('voice.title')} 
            {intelligentAnalysis && (
              <span className="text-xs text-blue-600">
                AI: {Math.round(intelligentAnalysis.sentimentCompleteness * 100)}%
              </span>
            )}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {userLanguage.startsWith('sk') ? 
                '🧠 Inteligentné rozpoznávanie reči: Hovorte prirodzene, systém automaticky rozpozná, kedy ste skončili.' :
                userLanguage.startsWith('es') ? 
                '🧠 Reconocimiento inteligente: Habla naturalmente, el sistema detectará automáticamente cuando termines.' :
                '🧠 Intelligent speech recognition: Speak naturally, the system will automatically detect when you\'re finished.'
              }
            </p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={playGreeting}>
              <Play className="h-4 w-4 mr-2" />
              {t('voice.play_example')}
            </Button>
          </div>

          {/* Intelligent Analysis Display */}
          {intelligentAnalysis && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-3 rounded-lg border border-purple-200 dark:border-purple-700">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                  Intelligent Analysis
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span>Confidence:</span>
                  <span className={intelligentAnalysis.confidence > 0.7 ? 'text-green-600' : 'text-yellow-600'}>
                    {Math.round(intelligentAnalysis.confidence * 100)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Complete:</span>
                  <span className={intelligentAnalysis.isCompleteThought ? 'text-green-600' : 'text-gray-500'}>
                    {intelligentAnalysis.isCompleteThought ? '✓' : '○'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Has Info:</span>
                  <span className={intelligentAnalysis.hasRequiredInfo ? 'text-green-600' : 'text-gray-500'}>
                    {intelligentAnalysis.hasRequiredInfo ? '✓' : '○'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Readiness:</span>
                  <span className={intelligentAnalysis.sentimentCompleteness > 0.6 ? 'text-green-600' : 'text-yellow-600'}>
                    {Math.round(intelligentAnalysis.sentimentCompleteness * 100)}%
                  </span>
                </div>
              </div>
            </div>
          )}

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
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  🧠 Intelligent Processing...
                </>
              ) : isListening ? (
                <>
                  <MicOff className="h-4 w-4 mr-2" />
                  Stop Listening
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  Start Smart Listening
                </>
              )}
            </Button>
            
            {transcript && (
              <div className="mt-2 bg-gray-50 dark:bg-gray-700 p-3 rounded text-sm">
                <strong>Live Transcript:</strong> {transcript}
                {isListening && <span className="ml-2 animate-pulse text-red-500">🎤 Listening...</span>}
                {isProcessing && <span className="ml-2 animate-pulse text-purple-500">🧠 AI Processing...</span>}
              </div>
            )}
          </div>

          {/* Form Fields - Auto-filled from voice */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">{t('transaction.amount')} ({userCurrency})</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={transactionData.amount}
                onChange={(e) => setTransactionData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                className={transactionData.amount ? 'border-green-500 bg-green-50' : ''}
              />
            </div>

            <div>
              <Label htmlFor="description">{t('transaction.description')}</Label>
              <Input
                id="description"
                value={transactionData.description}
                onChange={(e) => setTransactionData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="e.g. Coffee at Starbucks"
                className={transactionData.description ? 'border-green-500 bg-green-50' : ''}
              />
            </div>

            {transactionData.category && (
              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={transactionData.category}
                  readOnly
                  className="bg-green-50 border-green-500"
                />
              </div>
            )}

            <div>
              <Label htmlFor="type">{t('transaction.type')}</Label>
              <Select 
                value={transactionData.type} 
                onValueChange={(value: 'income' | 'expense') => 
                  setTransactionData(prev => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger className={transactionData.type !== 'expense' ? 'border-green-500 bg-green-50' : ''}>
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
                value={transactionData.date}
                onChange={(e) => setTransactionData(prev => ({ ...prev, date: e.target.value }))}
                className={transactionData.date !== new Date().toISOString().split('T')[0] ? 'border-green-500 bg-green-50' : ''}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaving || !transactionData.amount || !transactionData.description}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Transaction'
              )}
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}