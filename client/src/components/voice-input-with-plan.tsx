import React, { useState } from 'react';
import { VoiceInput } from './voice-input';
import RequirePlan from './require-plan';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Mic, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceInputWithPlanProps {
  onTranscript: (transcript: string) => void;
  onError?: (error: string) => void;
  className?: string;
  language?: string;
}

interface VoiceUsageData {
  currentMonthUsage: number;
  maxUsage: number;
  remainingUsage: number;
}

export function VoiceInputWithPlan({ onTranscript, onError, className, language }: VoiceInputWithPlanProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [usageExceeded, setUsageExceeded] = useState(false);

  // Get voice input usage for free users
  const { data: voiceUsage, isLoading: usageLoading } = useQuery<VoiceUsageData>({
    queryKey: ['voice-usage', user?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/voice/usage");
      return response.json();
    },
    enabled: !!user && user.plan === 'free',
    refetchOnMount: true,
  });

  // Check if user has exceeded free tier limits
  const isUsageExceeded = user?.plan === 'free' && voiceUsage && voiceUsage.remainingUsage <= 0;

  const handleTranscript = async (transcript: string) => {
    if (user?.plan === 'free') {
      // Track usage for free users
      try {
        await apiRequest("POST", "/api/voice/track-usage", {
          body: JSON.stringify({ 
            transcript: transcript.length,
            plan: user.plan 
          })
        });
        
        // Refresh usage data
        // queryClient.invalidateQueries({ queryKey: ['voice-usage'] });
      } catch (error) {
        console.error('Failed to track voice usage:', error);
      }
    }
    
    onTranscript(transcript);
  };

  // For free users who have exceeded their limit, show upgrade prompt
  if (user?.plan === 'free' && isUsageExceeded) {
    return (
      <div className={cn("relative", className)}>
        <div className="relative">
          <Button
            disabled
            variant="outline"
            size="sm"
            className="opacity-50 cursor-not-allowed"
          >
            <Lock className="h-4 w-4 mr-2" />
            {t('Voice Input Limit Reached')}
          </Button>
        </div>
        
        <RequirePlan 
          plan="standard" 
          compact={true}
          feature={t('Voice Input')}
          description={t('Free users get 5 voice inputs per month. Upgrade for unlimited voice input.')}
          benefits={[
            t('Unlimited voice transaction input'),
            t('Advanced voice recognition'),
            t('Multi-language voice support'),
            t('Voice command processing')
          ]}
        >
          <div></div>
        </RequirePlan>
      </div>
    );
  }

  // For free users, show usage indicator
  if (user?.plan === 'free' && voiceUsage && !usageLoading) {
    return (
      <div className={cn("relative", className)}>
        <VoiceInput 
          onTranscript={handleTranscript}
          onError={onError}
          language={language}
        />
        
        {/* Usage indicator for free users */}
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
          {t('Voice inputs used')}: {voiceUsage.currentMonthUsage}/{voiceUsage.maxUsage}
        </div>
        
        {/* Warning when approaching limit */}
        {voiceUsage.remainingUsage <= 2 && voiceUsage.remainingUsage > 0 && (
          <div className="text-xs text-orange-600 dark:text-orange-400 mt-1 text-center">
            {t('{{count}} voice inputs remaining', { count: voiceUsage.remainingUsage })}
          </div>
        )}
      </div>
    );
  }

  // For standard+ users or free users with available usage, show regular voice input
  return (
    <VoiceInput 
      onTranscript={handleTranscript}
      onError={onError}
      className={className}
      language={language}
    />
  );
}