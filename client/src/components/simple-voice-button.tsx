import React, { useState } from 'react';
import { Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsModalOpen(true)}
        className={`${className} border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950`}
        title={t('voice.button_title')}
      >
        <Mic className="h-4 w-4 mr-2" />
        {t('voice.button_text')}
      </Button>

      {isModalOpen && (
        <SimpleVoiceInput
          onClose={handleClose}
          onComplete={handleComplete}
        />
      )}
    </>
  );
}