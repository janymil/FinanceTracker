import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, VolumeX, Volume2, Repeat, Download, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
// Helper function to get current language for API
function getCurrentLanguageForAPI(): string {
  if (typeof window !== 'undefined' && (window as any).i18next) {
    const lang = (window as any).i18next.language;
    return lang.startsWith('es') ? 'es-pe' : lang.startsWith('sk') ? 'sk-sk' : 'en-us';
  }
  return 'en-us';
}

interface DemoVideoProps {
  title: string;
  description: string;
  demoType: 'categorization' | 'tips' | 'health';
  onComplete?: () => void;
}

export function InteractiveDemoVideo({ title, description, demoType, onComplete }: DemoVideoProps) {
  const { t, i18n } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const generateDemoNarration = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const language = getCurrentLanguageForAPI();
      const response = await fetch('/api/demo/generate-narration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          demoType,
          language
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate narration: ${response.statusText}`);
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      
    } catch (err) {
      console.error('Error generating narration:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate narration');
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlay = () => {
    if (audioRef.current && audioUrl) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const replay = () => {
    if (audioRef.current && audioUrl) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setIsPlaying(true);
      setHasCompleted(false);
    }
  };

  const downloadAudio = () => {
    if (audioUrl) {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = `finanzerpro-${demoType}-demo-${i18n.language}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleAudioEnd = () => {
    setIsPlaying(false);
    setHasCompleted(true);
    onComplete?.();
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.addEventListener('ended', handleAudioEnd);
      audio.addEventListener('play', () => setIsPlaying(true));
      audio.addEventListener('pause', () => setIsPlaying(false));
      
      return () => {
        audio.removeEventListener('ended', handleAudioEnd);
        audio.removeEventListener('play', () => setIsPlaying(true));
        audio.removeEventListener('pause', () => setIsPlaying(false));
      };
    }
  }, [audioUrl]);

  // Cleanup audio URL when component unmounts
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      {/* Demo Visual Area */}
      <div className="relative aspect-video bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center">
        {/* Demo type specific visual */}
        <div className="text-center p-8">
          {demoType === 'categorization' && (
            <div className="space-y-4">
              <div className="w-32 h-32 mx-auto bg-blue-500 rounded-lg flex items-center justify-center">
                <Sparkles className="h-16 w-16 text-white" />
              </div>
              <h4 className="text-xl font-semibold text-gray-800 dark:text-white">
                {t('features.demo.categorization.title', 'AI Transaction Categorization')}
              </h4>
            </div>
          )}
          
          {demoType === 'tips' && (
            <div className="space-y-4">
              <div className="w-32 h-32 mx-auto bg-green-500 rounded-lg flex items-center justify-center">
                <Sparkles className="h-16 w-16 text-white" />
              </div>
              <h4 className="text-xl font-semibold text-gray-800 dark:text-white">
                {t('features.demo.tips.title', 'Financial Insights')}
              </h4>
            </div>
          )}
          
          {demoType === 'health' && (
            <div className="space-y-4">
              <div className="w-32 h-32 mx-auto bg-purple-500 rounded-lg flex items-center justify-center">
                <Sparkles className="h-16 w-16 text-white" />
              </div>
              <h4 className="text-xl font-semibold text-gray-800 dark:text-white">
                {t('features.demo.health.title', 'Financial Health Analysis')}
              </h4>
            </div>
          )}
        </div>
        
        {/* Audio Controls Overlay */}
        {audioUrl && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black bg-opacity-30">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlay}
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                {isMuted ? <VolumeX className="h-8 w-8" /> : <Volume2 className="h-8 w-8" />}
              </Button>
              
              {hasCompleted && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={replay}
                  className="text-white hover:bg-white hover:bg-opacity-20"
                >
                  <Repeat className="h-8 w-8" />
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="icon"
                onClick={downloadAudio}
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                <Download className="h-8 w-8" />
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {/* Hidden audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          muted={isMuted}
          preload="metadata"
        />
      )}
      
      <div className="p-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          {description}
        </p>
        
        {/* Generate Demo Button */}
        {!audioUrl && !isGenerating && (
          <Button
            onClick={generateDemoNarration}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {t('features.demo.generate', 'Generate AI Demo')}
          </Button>
        )}
        
        {/* Loading State */}
        {isGenerating && (
          <div className="flex items-center justify-center p-4 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 rounded-lg">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            <span className="text-blue-700 dark:text-blue-300 text-sm">
              {t('features.demo.generating', 'Generating AI narration...')}
            </span>
          </div>
        )}
        
        {/* Error State */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900 dark:bg-opacity-20 rounded-lg">
            <p className="text-red-700 dark:text-red-300 text-sm">
              {t('features.demo.error', 'Error generating demo')}: {error}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={generateDemoNarration}
              className="mt-2"
            >
              {t('features.demo.retry', 'Try Again')}
            </Button>
          </div>
        )}
        
        {/* Success State */}
        {hasCompleted && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900 dark:bg-opacity-20 rounded-lg">
            <p className="text-green-700 dark:text-green-300 text-sm font-medium">
              ✓ {t('features.demo.completed', 'Demo completed! This feature is available with your subscription.')}
            </p>
          </div>
        )}
        
        {/* Audio Ready State */}
        {audioUrl && !hasCompleted && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 rounded-lg">
            <p className="text-blue-700 dark:text-blue-300 text-sm font-medium">
              🎵 {t('features.demo.ready', 'Audio demo ready! Click play to start.')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}