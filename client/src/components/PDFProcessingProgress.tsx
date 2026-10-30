import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertTriangle, FileText, Cpu, Search, Shield, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface ProcessingProgress {
  stage: 'pdf_validation' | 'text_extraction' | 'ocr_fallback' | 'ai_parsing' | 'categorization' | 'duplicate_detection' | 'complete' | 'connected';
  percentage: number;
  message: string;
  transactionsProcessed?: number;
  totalTransactions?: number;
  overallProgress?: number;
}

interface PDFProcessingProgressProps {
  sessionId: string;
  /** How to obtain a Clerk token; the stream itself is opened with a short-lived ticket. */
  getToken?: () => Promise<string | null>;
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

/** A statement with the AI step can run for minutes; after this much silence we say so. */
const STALL_AFTER_MS = 25_000;

const formatElapsed = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};

/**
 * Shows what the import is doing, for as long as it takes.
 *
 * It used to sit at 0% telling the person it was connected: the stream needed a header the
 * browser cannot send, and the early steps were written before the browser was listening. The
 * stream now takes a ticket, replays what already happened and keeps a heartbeat, and this
 * component keeps counting time even when an event is late, so a slow step never looks dead.
 */
export function PDFProcessingProgress({ sessionId, getToken, onComplete, onError }: PDFProcessingProgressProps) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<ProcessingProgress>({
    stage: 'connected',
    percentage: 0,
    message: 'Connecting to processing stream...',
    overallProgress: 0
  });
  const [lastEventAt, setLastEventAt] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stalled, setStalled] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;

    const openStream = async () => {
      try {
        const token = getToken ? await getToken() : null;
        if (cancelled) return;

        const ticketResponse = await fetch('/api/import/pdf-progress-ticket', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ sessionId }),
        });
        if (!ticketResponse.ok) {
          throw new Error(`Progress ticket refused (${ticketResponse.status})`);
        }
        const { ticket } = await ticketResponse.json();
        if (cancelled) return;

        source = new EventSource(`/api/import/pdf-progress/${encodeURIComponent(sessionId)}?ticket=${encodeURIComponent(ticket)}`);

        source.onmessage = (event) => {
          try {
            const data: ProcessingProgress = JSON.parse(event.data);
            setLastEventAt(Date.now());
            setStalled(false);
            setHasError(false);
            // Never move the bar backwards: a retried step reports the same stage again.
            setProgress((previous) => ({
              ...data,
              percentage: Math.max(previous.percentage, data.percentage ?? 0),
            }));

            if (data.stage === 'complete') {
              onComplete?.(true);
              setTimeout(() => source?.close(), 2000);
            }
          } catch (error) {
            console.error('Could not read a progress event:', error, event.data);
          }
        };

        source.onerror = () => {
          // A dropped stream is not a failed import: the upload request is still running and it
          // is what reports the result. EventSource reconnects with the same ticket by itself.
          if (source?.readyState === EventSource.CLOSED) {
            setHasError(true);
          }
        };
      } catch (error) {
        console.error('Could not open the progress stream:', error);
        setHasError(true);
      }
    };

    void openStream();

    return () => {
      cancelled = true;
      source?.close();
    };
    // `onComplete`/`onError` are re-created by the page on every render; reconnecting on that
    // would restart the stream. The session is what identifies the import.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
      setStalled(Date.now() - lastEventAt > STALL_AFTER_MS);
    }, 1000);
    return () => clearInterval(timer);
  }, [lastEventAt]);

  const IconComponent = stageIcons[progress.stage] ?? Shield;
  const iconColor = stageColors[progress.stage] ?? 'text-blue-500';
  const percentage = progress.overallProgress || progress.percentage;

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-3">
        <div className="animate-pulse">
          <IconComponent className={`h-6 w-6 ${iconColor}`} />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {t('pdf.processing.title', 'Processing Bank Statement')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('pdf.processing.subtitle', 'AI-powered transaction extraction in progress')}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t(`pdf.processing.${progress.stage}`, progress.message)}
          </span>
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{percentage}%</span>
        </div>
        <Progress value={percentage} className="h-3 bg-gray-200 dark:bg-gray-700" />
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>{t('pdf.processing.elapsed', { time: formatElapsed(elapsedSeconds) })}</span>
          <span>{t('pdf.processing.keep_open')}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${percentage >= 5 ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span>{t('pdf.processing.validation', 'Security Validation')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${percentage >= 15 ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span>{t('pdf.processing.extraction', 'Text Extraction')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${percentage >= 50 ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span>{t('pdf.processing.ai_parsing', 'AI Analysis')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${percentage >= 75 ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span>{t('pdf.processing.categorization', 'Categorization')}</span>
        </div>
      </div>

      {/* The AI step can take minutes with nothing to report. Say that, instead of freezing. */}
      {stalled && progress.stage !== 'complete' && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
          <Loader2 className="h-4 w-4 text-amber-600 animate-spin" />
          <span className="text-sm text-amber-800 dark:text-amber-200">
            {t('pdf.processing.stalled')}
          </span>
        </div>
      )}

      {progress.transactionsProcessed && progress.totalTransactions && (
        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          {t('pdf.processing.transactions_processed', {
            processed: progress.transactionsProcessed,
            total: progress.totalTransactions
          })}
        </div>
      )}

      {hasError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-700 dark:text-red-400">
            {t('pdf.processing.reconnecting')}
          </span>
        </div>
      )}

      {progress.stage === 'complete' && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-sm text-green-700 dark:text-green-400">{progress.message}</span>
        </div>
      )}
    </div>
  );
}
