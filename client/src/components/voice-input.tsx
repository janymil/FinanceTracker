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

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      onError?.(t('voiceInput.notSupported'));
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language || getVoiceLanguage(i18n.language);

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
    };

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcriptText = event.results[current][0].transcript;
      
      if (event.results[current].isFinal) {
        setTranscript(prev => prev + ' ' + transcriptText);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
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
      setIsListening(false);
      if (transcript.trim()) {
        setIsProcessing(true);
        onTranscript(transcript.trim());
        setTimeout(() => setIsProcessing(false), 1000);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [language, i18n.language, onTranscript, onError, t, transcript]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
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