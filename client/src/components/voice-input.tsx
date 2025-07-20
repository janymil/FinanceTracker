import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface VoiceInputProps {
  onTranscript: (transcript: string) => void;
  onError?: (error: string) => void;
  className?: string;
  language?: string;
}

export function VoiceInput({ onTranscript, onError, className, language }: VoiceInputProps) {
  const { t, i18n } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');
  const isCleaningUpRef = useRef(false);

  useEffect(() => {
    console.log('🔧 [VoiceInput] Initializing speech recognition...', {
      hasWebkitSpeechRecognition: 'webkitSpeechRecognition' in window,
      hasSpeechRecognition: 'SpeechRecognition' in window,
      userAgent: navigator.userAgent,
      language: language || getVoiceLanguage(i18n.language)
    });

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('❌ [VoiceInput] Speech Recognition not supported');
      onError?.(t('voiceInput.notSupported'));
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    
    console.log('✅ [VoiceInput] Speech recognition initialized successfully');

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language || getVoiceLanguage(i18n.language);
    recognition.maxAlternatives = 3; // Get multiple alternatives for better accuracy
    // Note: grammars property is deprecated and causes errors in modern browsers

    recognition.onstart = () => {
      console.log('🎤 [VoiceInput] Recording started');
      setIsListening(true);
      setTranscript('');
      transcriptRef.current = '';
    };

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      
      // Get the best alternative if multiple are available
      let bestTranscript = event.results[current][0].transcript;
      let bestConfidence = event.results[current][0].confidence;
      
      // Check other alternatives for better confidence
      for (let i = 1; i < event.results[current].length; i++) {
        const alternative = event.results[current][i];
        if (alternative.confidence > bestConfidence) {
          bestTranscript = alternative.transcript;
          bestConfidence = alternative.confidence;
        }
      }
      
      console.log('🗣️ [VoiceInput] Speech result:', {
        text: bestTranscript,
        confidence: bestConfidence,
        isFinal: event.results[current].isFinal,
        alternatives: event.results[current].length
      });
      
      if (event.results[current].isFinal) {
        // Clean up transcript - remove extra spaces and common recognition errors
        const cleanedText = bestTranscript
          .replace(/\s+/g, ' ') // Replace multiple spaces with single space
          .replace(/\bdollar\b/gi, 'dollars') // Normalize currency
          .replace(/\bcent\b/gi, 'cents')
          .trim();
          
        transcriptRef.current = transcriptRef.current + ' ' + cleanedText;
        setTranscript(transcriptRef.current);
        console.log('✅ [VoiceInput] Final transcript captured:', cleanedText);
        console.log('📝 [VoiceInput] Full transcript so far:', transcriptRef.current);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('❌ [VoiceInput] Speech recognition error:', {
        error: event.error,
        message: event.message || 'No message provided',
        type: event.type,
        target: event.target?.constructor?.name,
        timestamp: new Date().toISOString(),
        isCleaningUp: isCleaningUpRef.current
      });
      console.error('❌ [VoiceInput] Full error event:', event);
      
      // Don't show error to user if we're cleaning up (component unmounting)
      if (isCleaningUpRef.current && event.error === 'aborted') {
        console.log('✅ [VoiceInput] Ignoring aborted error during cleanup');
        return;
      }
      
      setIsListening(false);
      
      const errorMessages: Record<string, string> = {
        'no-speech': t('voiceInput.errors.noSpeech'),
        'audio-capture': t('voiceInput.errors.audioCapture'),
        'not-allowed': t('voiceInput.errors.notAllowed'),
        'network': t('voiceInput.errors.network'),
        'aborted': t('voiceInput.errors.aborted') || 'Voice input was cancelled'
      };
      
      onError?.(errorMessages[event.error] || t('voiceInput.errors.generic'));
    };

    recognition.onend = () => {
      console.log('🔚 [VoiceInput] Recording ended');
      setIsListening(false);
      const finalTranscript = transcriptRef.current.trim();
      
      console.log('🔍 [VoiceInput] Checking transcript:', {
        refValue: transcriptRef.current,
        stateValue: transcript,
        finalValue: finalTranscript,
        length: finalTranscript.length
      });
      
      if (finalTranscript) {
        console.log('📤 [VoiceInput] Sending transcript to dialog:', {
          transcript: finalTranscript,
          length: finalTranscript.length,
          timestamp: new Date().toISOString()
        });
        setIsProcessing(true);
        onTranscript(finalTranscript);
        setTimeout(() => setIsProcessing(false), 1000);
      } else {
        console.warn('⚠️ [VoiceInput] No transcript captured');
      }
    };

    recognitionRef.current = recognition;

    return () => {
      isCleaningUpRef.current = true;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.log('🧹 [VoiceInput] Cleanup: Recognition already stopped');
        }
      }
    };
  }, [language, i18n.language, onTranscript, onError, t]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      console.error('❌ [VoiceInput] Recognition not initialized');
      return;
    }

    if (isListening) {
      console.log('🛑 [VoiceInput] Stopping recognition...');
      recognitionRef.current.stop();
    } else {
      console.log('▶️ [VoiceInput] Starting recognition...');
      try {
        isCleaningUpRef.current = false;
        transcriptRef.current = '';
        setTranscript('');
        recognitionRef.current.start();
      } catch (error) {
        console.error('❌ [VoiceInput] Failed to start recognition:', error);
        
        // Handle the case where recognition is already running
        if (error instanceof Error && error.message.includes('already started')) {
          console.log('🔄 [VoiceInput] Recognition already running, stopping first...');
          recognitionRef.current.stop();
          setTimeout(() => {
            try {
              recognitionRef.current.start();
            } catch (retryError) {
              console.error('❌ [VoiceInput] Retry failed:', retryError);
              onError?.('Failed to start voice recognition');
            }
          }, 100);
        } else {
          onError?.('Failed to start voice recognition');
        }
      }
    }
  };

  const getVoiceLanguage = (lang: string): string => {
    const langMap: Record<string, string> = {
      'en-us': 'en-US',
      'es-pe': 'es-PE',
      'sk-sk': 'sk-SK'
    };
    return langMap[lang] || 'en-US';
  };

  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    return null;
  }

  return (
    <div className={cn('relative', className)}>
      <Button
        type="button"
        variant={isListening ? 'destructive' : 'outline'}
        size="icon"
        onClick={toggleListening}
        disabled={isProcessing}
        className={cn(
          'relative',
          isListening && 'animate-pulse'
        )}
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isListening ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
      
      {isListening && (
        <div className="absolute top-full mt-2 left-0 right-0 min-w-[200px] bg-background border rounded-md p-2 shadow-lg z-10">
          <p className="text-xs text-muted-foreground mb-1">{t('voiceInput.listening')}</p>
          {transcript && (
            <p className="text-sm">{transcript}</p>
          )}
        </div>
      )}
    </div>
  );
}