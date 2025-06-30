import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertTriangle, FileText, Cpu, Search, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface ProcessingProgress {
  stage: 'pdf_validation' | 'text_extraction' | 'ocr_fallback' | 'ai_parsing' | 'categorization' | 'duplicate_detection' | 'complete' | 'connected';
  percentage: number;
  message: string;
  transactionsProcessed?: number;
  totalTransactions?: number;
  overallProgress?: number; // New field for continuous progress
}

interface PDFProcessingProgressProps {
  sessionId: string;
  onComplete?: (success: boolean) => void;
  onError?: (error: string) => void;
}

const stageIcons = {
  connected: Shield,
  pdf_validation: Shield,
  text_extraction: FileText,
  ocr_fallback: Search,
  ai_parsing: Cpu,
  categorization: Cpu,
  duplicate_detection: Search,
  complete: CheckCircle
};

const stageColors = {
  connected: "text-blue-500",
  pdf_validation: "text-purple-500",
  text_extraction: "text-blue-500",
  ocr_fallback: "text-orange-500",
  ai_parsing: "text-green-500",
  categorization: "text-green-500",
  duplicate_detection: "text-yellow-500",
  complete: "text-green-600"
};

export function PDFProcessingProgress({ sessionId, onComplete, onError }: PDFProcessingProgressProps) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<ProcessingProgress>({
    stage: 'connected',
    percentage: 0,
    message: 'Connecting to processing stream...',
    overallProgress: 0
  });
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Create SSE connection for progress updates
    const es = new EventSource(`/api/import/pdf-progress/${sessionId}`);
    setEventSource(es);

    es.onmessage = (event) => {
      try {
        const progressData: ProcessingProgress = JSON.parse(event.data);
        setProgress(progressData);

        // Check if processing is complete
        if (progressData.stage === 'complete') {
          onComplete?.(true);
          setTimeout(() => {
            es.close();
          }, 2000); // Keep connection open for 2 seconds to show completion
        }
      } catch (error) {
        console.error('Error parsing progress data:', error);
        setHasError(true);
        onError?.('Failed to parse progress data');
      }
    };

    es.onerror = (error) => {
      console.error('SSE error:', error);
      setHasError(true);
      onError?.('Connection error during processing');
      es.close();
    };

    es.onopen = () => {
      console.log('SSE connection opened for session:', sessionId);
    };

    // Cleanup on unmount
    return () => {
      es.close();
    };
  }, [sessionId, onComplete, onError]);

  // Get translated stage messages
  const getStageMessage = (stage: string, defaultMessage: string): string => {
    const stageKey = `pdf.processing.${stage}`;
    const translated = t(stageKey);
    return translated !== stageKey ? translated : defaultMessage;
  };

  const IconComponent = stageIcons[progress.stage] || FileText;
  const iconColor = stageColors[progress.stage] || "text-gray-500";

  return (
    <div className="space-y-4 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-lg border">
      {/* Header */}
      <div className="flex items-center gap-3">
        <IconComponent className={`h-6 w-6 ${iconColor}`} />
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {t('pdf.processing.title', 'Processing Bank Statement')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('pdf.processing.subtitle', 'AI-powered transaction extraction in progress')}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {getStageMessage(progress.stage, progress.message)}
          </span>
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
            {progress.overallProgress || progress.percentage}%
          </span>
        </div>
        <Progress 
          value={progress.overallProgress || progress.percentage} 
          className="h-3 bg-gray-200 dark:bg-gray-700"
        />
      </div>

      {/* Stage Details */}
      <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${progress.percentage >= 5 ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span>{t('pdf.processing.validation', 'Security Validation')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${progress.percentage >= 15 ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span>{t('pdf.processing.extraction', 'Text Extraction')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${progress.percentage >= 50 ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span>{t('pdf.processing.ai_parsing', 'AI Analysis')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${progress.percentage >= 75 ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span>{t('pdf.processing.categorization', 'Categorization')}</span>
        </div>
      </div>

      {/* Transaction Count */}
      {progress.transactionsProcessed && progress.totalTransactions && (
        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          {t('pdf.processing.transactions_processed', 'Processed {{processed}} of {{total}} transactions', {
            processed: progress.transactionsProcessed,
            total: progress.totalTransactions
          })}
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-700 dark:text-red-400">
            {t('pdf.processing.error', 'Processing error occurred')}
          </span>
        </div>
      )}

      {/* Completion State */}
      {progress.stage === 'complete' && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-sm text-green-700 dark:text-green-400">
            {progress.message}
          </span>
        </div>
      )}
    </div>
  );
}