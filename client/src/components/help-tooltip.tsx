import type { ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from 'react-i18next';

interface HelpTooltipProps {
  /** What the panel does. Kept short: it is read while hovering, not studied. */
  children: ReactNode;
  /** Accessible name for the button. Defaults to a generic "What this does". */
  label?: string;
  className?: string;
}

/**
 * The little "?" that explains a panel.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every panel on the dashboard is one sentence of plain language away from making sense, and the
 * same icon was being hand-wired into each one that got around to it. This is the one copy of
 * that wiring: an icon, a tooltip, and the accessibility that is easy to forget when it is pasted
 * by hand — a real `button` (so it can be reached with the keyboard and read by a screen reader)
 * with a name, not a bare icon.
 *
 * USAGE
 * -----
 *   <HelpTooltip>{t('help.health_advisor')}</HelpTooltip>
 *
 * Put it next to the panel's title. Rich content is fine: pass nodes, not only a string.
 */
export function HelpTooltip({ children, label, className }: HelpTooltipProps) {
  const { t } = useTranslation();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label ?? t('help.what_this_does')}
            className={`inline-flex shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-gray-200 ${className ?? ''}`}
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
