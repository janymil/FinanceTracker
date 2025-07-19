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

    recognition.onstart = () => {
      console.log('🎤 [VoiceInput] Recording started');
      setIsListening(true);
      setTranscript('');
      transcriptRef.current = '';
    };

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcriptText = event.results[current][0].transcript;
      const confidence = event.results[current][0].confidence;
      
      console.log('🗣️ [VoiceInput] Speech result:', {
        text: transcriptText,
        confidence: confidence,
        isFinal: event.results[current].isFinal
      });
      
      if (event.results[current].isFinal) {
        transcriptRef.current = transcriptRef.current + ' ' + transcriptText;
        setTranscript(transcriptRef.current);
        console.log('✅ [VoiceInput] Final transcript captured:', transcriptText);
        console.log('📝 [VoiceInput] Full transcript so far:', transcriptRef.current);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('❌ [VoiceInput] Speech recognition error:', {
        error: event.error,
        message: event.message || 'No message provided',
        type: event.type,
        target: event.target?.constructor?.name,
        timestamp: new Date().toISOString()
      });
      console.error('❌ [VoiceInput] Full error event:', event);
      setIsListening(false);
      
      const errorMessages: Record<string, string> = {
        'no-speech': t('voiceInput.errors.noSpeech'),
        'audio-capture': t('voiceInput.errors.audioCapture'),
        'not-allowed': t('voiceInput.errors.notAllowed'),
        'network': t('voiceInput.errors.network')
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
      if (recognitionRef.current) {
        recognitionRef.current.abort();
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
        recognitionRef.current.start();
      } catch (error) {
        console.error('❌ [VoiceInput] Failed to start recognition:', error);
        onError?.('Failed to start voice recognition');
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