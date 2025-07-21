import React, { useState } from 'react';
import { Mic, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SimpleVoiceInput } from './simple-voice-input';
import { useTranslation } from 'react-i18next';

interface SimpleVoiceButtonProps {
  onComplete?: () => void;
  className?: string;
}

export default function SimpleVoiceButton({ onComplete, className }: SimpleVoiceButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { t } = useTranslation();

  const handleClose = () => {
    setIsModalOpen(false);
  };

  const handleComplete = () => {
    setIsModalOpen(false);
    onComplete?.();
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className={`${className} border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 relative`}
            >
              <div className="flex items-center">
                <Mic className="h-4 w-4 mr-2" />
                {t('voice.button_text')}
                <AlertTriangle className="h-3 w-3 ml-1 text-amber-500" />
              </div>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="flex items-start gap-2 p-1">
              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">
                  {t('voice.experimental_feature') || 'Experimental Feature'}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                  {t('voice.experimental_warning') || 
                    'Voice recognition may make errors. Please review all details before saving your transaction.'}
                </p>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {isModalOpen && (
        <SimpleVoiceInput
          onClose={handleClose}
          onComplete={handleComplete}
        />
      )}
    </>
  );
}