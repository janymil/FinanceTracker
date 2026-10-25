/**
 * How much of this month's AI allowance is left.
 *
 * The numbers come from `GET /api/ai/usage`, which applies the same rules the server enforces
 * (`shared/aiQuota`), so the meter can never promise more than the API will allow. Three states:
 * free plan (AI is a paid feature), running low (from 80%), out of actions (with the reset day).
 */
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AiUsage {
  plan: string;
  monthlyLimit: number;
  monthlyUsed: number;
  monthlyRemaining: number;
  dailyLimit: number;
  dailyUsed: number;
  usedRatio: number;
  state: 'ok' | 'warning' | 'blocked';
  resetsAt: string;
}

export function AiUsageMeter({ className = '' }: { className?: string }) {
  const { getToken, isSignedIn } = useAuth();
  const { t, i18n } = useTranslation();
  const [usage, setUsage] = useState<AiUsage | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!isSignedIn) return;
      try {
        const token = await getToken();
        const response = await fetch('/api/ai/usage', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) return;
        const data = (await response.json()) as AiUsage;
        if (!cancelled) setUsage(data);
      } catch (error) {
        // A meter that fails to load must not break the page it sits on.
        console.warn('Could not load AI usage:', error);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [getToken, isSignedIn]);

  if (!usage) return null;

  const resetDate = new Date(usage.resetsAt).toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'short',
  });

  // Free plan: AI is not part of it, so show the value rather than a 0 of 0.
  if (usage.monthlyLimit === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-blue-600" />
            {t('aiUsage.freeTitle')}
          </CardTitle>
          <CardDescription>{t('aiUsage.freeBody')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/subscribe" className="text-sm font-medium text-blue-600 hover:underline">
            {t('aiUsage.upgrade')}
          </Link>
        </CardContent>
      </Card>
    );
  }

  const percent = Math.round(usage.usedRatio * 100);
  const barColor =
    usage.state === 'blocked'
      ? 'bg-red-500'
      : usage.state === 'warning'
        ? 'bg-amber-500'
        : 'bg-green-500';

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-blue-600" />
          {t('aiUsage.title')}
        </CardTitle>
        <CardDescription>
          {t('aiUsage.usedOf', { used: usage.monthlyUsed, limit: usage.monthlyLimit })} ·{' '}
          {t('aiUsage.resetsOn', { date: resetDate })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-2 rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t('aiUsage.remaining', { count: usage.monthlyRemaining })}
          </span>
          <span className="font-medium">{percent}%</span>
        </div>

        {usage.state === 'warning' && (
          <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {t('aiUsage.warning')}
          </p>
        )}

        {usage.state === 'blocked' && (
          <div className="space-y-1">
            <p className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {t('aiUsage.blocked', { date: resetDate })}
            </p>
            <Link href="/subscribe" className="text-sm font-medium text-blue-600 hover:underline">
              {t('aiUsage.upgrade')}
            </Link>
          </div>
        )}

        <p className="text-xs text-muted-foreground">{t('aiUsage.whatIsAction')}</p>
      </CardContent>
    </Card>
  );
}

export default AiUsageMeter;
