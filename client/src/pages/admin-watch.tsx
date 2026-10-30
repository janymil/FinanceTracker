/**
 * Watch — the Error Guard screen (blueprint 07 §10).
 *
 * Written for a person, not for a developer: every label is plain language, technical
 * evidence is collapsed behind "Technical details", and the first thing on the page is
 * the answer to one question — *is anything broken right now, and does it touch money?*
 */
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { sendTestProblem } from '@/lib/errorGuard';
import { signInUrl } from '@/lib/authRedirect';
import {
  kindLabel,
  severityLabel,
  type GuardGroup,
  type GuardJobRun,
  type GuardSummary,
} from '@shared/errorGuard/types';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  EyeOff,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';

async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** "5 minutes ago" — never a raw timestamp in the main view. */
function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return 'unknown';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

function times(count: number): string {
  return `${count} ${count === 1 ? 'time' : 'times'}`;
}

function severityClasses(severity: GuardGroup['severity']): string {
  switch (severity) {
    case 'critical':
      return 'border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20';
    case 'error':
      return 'border-l-4 border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/10';
    case 'warning':
      return 'border-l-4 border-l-yellow-400';
    default:
      return 'border-l-4 border-l-slate-300';
  }
}

function severityBadge(severity: GuardGroup['severity']) {
  const tone =
    severity === 'critical'
      ? 'bg-red-600 text-white'
      : severity === 'error'
        ? 'bg-amber-500 text-white'
        : severity === 'warning'
          ? 'bg-yellow-100 text-yellow-900'
          : 'bg-slate-200 text-slate-800';
  return <Badge className={cn('text-xs font-medium', tone)}>{severityLabel(severity)}</Badge>;
}

/** Confidence in words, never a percentage the reader has to interpret. */
function confidenceText(confidence: number): string {
  if (confidence >= 0.8) return 'I am fairly sure';
  if (confidence >= 0.5) return 'I think this is it, but check';
  return 'This is a guess — verify it';
}

function Explained({ group }: { group: GuardGroup }) {
  const analysis = group.aiAnalysis;
  if (!analysis) return null;

  const rows: Array<{ label: string; value: string }> = [
    { label: 'What probably happened', value: analysis.likelyCause },
    { label: 'What the user sees', value: analysis.userImpact },
    { label: 'Where to look', value: analysis.whereToLook },
    { label: 'What to do', value: analysis.suggestedFix },
  ];

  return (
    <div className="mt-4 rounded-lg border bg-muted/40 p-4">
      <p className="text-sm font-medium">{analysis.plainSummary}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</p>
            <p className="text-sm">{row.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{confidenceText(analysis.confidence)}</span>
        {analysis.moneyRisk !== 'none' && (
          <Badge variant="outline" className="text-xs">
            {analysis.moneyRisk === 'likely' ? 'Money is probably affected' : 'Money could be affected'}
          </Badge>
        )}
        {group.aiModel && <span>· explained by {group.aiModel}</span>}
      </div>
    </div>
  );
}

function StatusBanner({ summary }: { summary: GuardSummary | undefined }) {
  if (!summary) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">Checking how things are…</CardContent>
      </Card>
    );
  }

  const urgent = summary.needAttentionNow > 0;
  const something = summary.openProblems > 0;

  const tone = urgent
    ? 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
    : something
      ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20'
      : 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20';

  const Icon = urgent ? AlertOctagon : something ? AlertTriangle : CheckCircle2;
  const iconTone = urgent ? 'text-red-600' : something ? 'text-amber-600' : 'text-emerald-600';

  const headline = urgent
    ? summary.needAttentionNow === 1
      ? 'One problem needs your attention now'
      : `${summary.needAttentionNow} problems need your attention now`
    : something
      ? summary.openProblems === 1
        ? 'One thing to look at, nothing urgent'
        : `${summary.openProblems} things to look at, nothing urgent`
      : 'Everything is working';

  const detail = urgent
    ? summary.moneyProblems > 0
      ? 'Some of these can affect amounts or balances. Read them first.'
      : 'Kaptia is reporting failures that are not minor. Start with the first one.'
    : something
      ? 'Nothing here is blocking users. Fix them when you have time.'
      : `No open problems. Last event was ${timeAgo(summary.lastEventAt)}.`;

  return (
    <Card className={cn('border', tone)}>
      <CardContent className="flex items-start gap-4 py-5">
        <Icon className={cn('mt-1 h-8 w-8 shrink-0', iconTone)} />
        <div>
          <p className="text-xl font-semibold">{headline}</p>
          <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  emphasis,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: typeof Activity;
  emphasis?: 'danger';
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <Icon className={cn('h-4 w-4', emphasis === 'danger' ? 'text-red-500' : 'text-muted-foreground')} />
        </div>
        <p className={cn('mt-2 text-2xl font-bold', emphasis === 'danger' && 'text-red-600')}>{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function ProblemCard({
  group,
  onResolve,
  onIgnore,
  onExplain,
  busy,
}: {
  group: GuardGroup;
  onResolve: (group: GuardGroup) => void;
  onIgnore: (group: GuardGroup) => void;
  onExplain: (group: GuardGroup) => void;
  busy: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Card className={cn('shadow-sm', severityClasses(group.severity))}>
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center gap-2">
          {severityBadge(group.severity)}
          <Badge variant="outline" className="text-xs">
            {kindLabel(group.kind)}
          </Badge>
          {group.moneyPath && (
            <Badge className="bg-purple-600 text-xs text-white">
              <Wallet className="mr-1 h-3 w-3" /> Touches money
            </Badge>
          )}
          {group.status !== 'open' && (
            <Badge variant="secondary" className="text-xs">
              {group.status === 'resolved' ? 'Marked as fixed' : 'Hidden'}
            </Badge>
          )}
        </div>

        <p className="mt-3 text-base font-semibold leading-snug">{group.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Happened {times(group.eventCount)} · last {timeAgo(group.lastSeen)}
          {group.route ? ` · in ${group.route}` : ''}
        </p>

        <Explained group={group} />

        <div className="mt-4 flex flex-wrap gap-2">
          {group.status === 'open' && (
            <>
              <Button size="sm" variant="outline" onClick={() => onResolve(group)} disabled={busy}>
                <Check className="mr-1 h-4 w-4" /> Mark as fixed
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onIgnore(group)} disabled={busy}>
                <EyeOff className="mr-1 h-4 w-4" /> Hide this
              </Button>
            </>
          )}
          <Button size="sm" variant="secondary" onClick={() => onExplain(group)} disabled={busy}>
            <Sparkles className="mr-1 h-4 w-4" />
            {group.aiAnalysis ? 'Explain again' : 'Explain this to me'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowDetails((value) => !value)}>
            {showDetails ? 'Hide technical details' : 'Technical details'}
          </Button>
        </div>

        {showDetails && (
          <div className="mt-4 space-y-3 rounded-lg border bg-muted/30 p-3 text-xs">
            <div>
              <p className="font-semibold">What the app reported</p>
              <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px]">{group.message}</pre>
            </div>
            {group.release && (
              <p>
                <span className="font-semibold">Version:</span> {group.release}
              </p>
            )}
            <p>
              <span className="font-semibold">First seen:</span> {timeAgo(group.firstSeen)} ·{' '}
              <span className="font-semibold">Internal id:</span> <code>{group.id}</code>
            </p>
            <p className="text-muted-foreground">
              Stack traces and request ids are kept with every sample. Give a developer this id to find them.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminWatch() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  // Whether the server would accept a password at all (see server/adminAuth.ts). False until
  // it says otherwise, so a shut door is never painted as an open one.
  const [passwordLoginEnabled, setPasswordLoginEnabled] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'open' | 'resolved' | 'ignored'>('open');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const status = await adminFetch<{ authenticated: boolean; passwordLoginEnabled?: boolean }>(
          '/api/admin-analytics/auth-status',
        );
        setIsAuthenticated(Boolean(status.authenticated));
        setPasswordLoginEnabled(Boolean(status.passwordLoginEnabled));
      } catch {
        setIsAuthenticated(false);
      } finally {
        setAuthChecked(true);
      }
    };
    void checkAuth();
  }, []);

  const summaryQuery = useQuery<GuardSummary>({
    queryKey: ['admin-watch-summary'],
    queryFn: () => adminFetch<GuardSummary>('/api/admin/watch/summary'),
    enabled: isAuthenticated,
    refetchInterval: 15_000,
  });

  const groupsQuery = useQuery<GuardGroup[]>({
    queryKey: ['admin-watch-groups', statusFilter],
    queryFn: () => adminFetch<GuardGroup[]>(`/api/admin/watch/groups?status=${statusFilter}`),
    enabled: isAuthenticated,
    refetchInterval: 15_000,
  });

  const jobsQuery = useQuery<GuardJobRun[]>({
    queryKey: ['admin-watch-jobs'],
    queryFn: () => adminFetch<GuardJobRun[]>('/api/admin/watch/jobs'),
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });

  const summary = summaryQuery.data;
  const groups = groupsQuery.data ?? [];
  const jobs = jobsQuery.data ?? [];

  const refreshAll = () => {
    void summaryQuery.refetch();
    void groupsQuery.refetch();
    void jobsQuery.refetch();
  };

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoggingIn(true);
    try {
      await adminFetch('/api/admin-analytics/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setIsAuthenticated(true);
      setPassword('');
      refreshAll();
    } catch {
      toast({ title: 'Wrong password', description: 'That is not the admin password.', variant: 'destructive' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const updateStatus = async (group: GuardGroup, status: 'resolved' | 'ignored') => {
    setBusyId(group.id);
    try {
      await adminFetch(`/api/admin/watch/groups/${group.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      toast({
        title: status === 'resolved' ? 'Marked as fixed' : 'Hidden',
        description:
          status === 'resolved'
            ? 'If it happens again, it will come back by itself.'
            : 'It stays hidden, even if it happens again.',
      });
      await Promise.all([summaryQuery.refetch(), groupsQuery.refetch()]);
    } catch {
      toast({ title: 'Could not update', description: 'Try again in a moment.', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const explainGroup = async (group: GuardGroup) => {
    setBusyId(group.id);
    try {
      const result = await adminFetch<{ ok: boolean; message?: string }>(
        `/api/admin/watch/groups/${group.id}/analyze`,
        { method: 'POST' },
      );
      if (result.ok) {
        toast({ title: 'Explanation ready', description: 'Read it under the problem title.' });
      } else {
        toast({
          title: 'No explanation yet',
          description: result.message ?? 'The AI is not available right now.',
        });
      }
      await groupsQuery.refetch();
    } catch {
      toast({
        title: 'Could not ask for an explanation',
        description: 'Try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Proves the whole pipeline end to end: browser capture → ingest → aggregate → screen.
   * If this produces a card, the guard is wired correctly.
   */
  const handleTest = async () => {
    setSendingTest(true);
    try {
      sendTestProblem();
      await new Promise((resolve) => setTimeout(resolve, 400));
      await adminFetch('/api/admin/watch/flush', { method: 'POST' });
      await Promise.all([summaryQuery.refetch(), groupsQuery.refetch()]);
      toast({ title: 'Test problem sent', description: 'It should appear in the list below.' });
    } catch {
      toast({
        title: 'The test could not be sent',
        description: 'The Watch endpoint did not answer.',
        variant: 'destructive',
      });
    } finally {
      setSendingTest(false);
    }
  };

  // The sign-in page keeps the language prefix of the address the visitor is on.
  const lang = window.location.pathname.match(/^\/([a-z]{2})(\/|$)/)?.[1] || 'en';

  if (!authChecked) {
    return (
      <div className="container mx-auto max-w-2xl p-6">
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">Checking your access…</CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated && !passwordLoginEnabled) {
    return (
      <div className="container mx-auto max-w-2xl p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Kaptia Watch</CardTitle>
            <CardDescription>Administrator account required.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-blue-50 p-3 text-sm dark:bg-blue-900/20">
              <p className="font-medium">Password sign-in is switched off on this site.</p>
              <p className="mt-1 text-muted-foreground">
                Sign in with the Kaptia account that has administrator rights, then open this page again.
              </p>
            </div>
            <Button asChild className="w-full">
              <a href={signInUrl(lang, window.location.pathname + window.location.search)}>Go to sign-in</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto max-w-2xl p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Kaptia Watch</CardTitle>
            <CardDescription>
              A plain-language view of what is failing in Kaptia. Administrator access only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={login} className="space-y-4">
              <div>
                <Label htmlFor="watch-password">Administrator password</Label>
                <Input
                  id="watch-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter administrator password"
                  autoComplete="current-password"
                  className="mt-1"
                />
              </div>
              <Button type="submit" disabled={isLoggingIn || password.length === 0} className="w-full">
                {isLoggingIn ? 'Checking…' : 'Open Watch'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Watch</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            What is failing in Kaptia, in plain language. Money problems come first; technical details
            stay hidden until you ask for them.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className="mr-1 h-4 w-4" /> Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={handleTest} disabled={sendingTest}>
            <Activity className="mr-1 h-4 w-4" />
            {sendingTest ? 'Sending…' : 'Send a test problem'}
          </Button>
        </div>
      </div>

      <StatusBanner summary={summary} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Open problems"
          value={summary ? summary.openProblems : '—'}
          hint="Distinct issues, not single failures"
          icon={AlertTriangle}
        />
        <StatTile
          label="Needs attention now"
          value={summary ? summary.needAttentionNow : '—'}
          hint="Breaks money or blocks a user"
          icon={AlertOctagon}
          emphasis={(summary?.needAttentionNow ?? 0) > 0 ? 'danger' : undefined}
        />
        <StatTile
          label="Touches money"
          value={summary ? summary.moneyProblems : '—'}
          hint="Amounts, balances, budgets, exports"
          icon={Wallet}
          emphasis={(summary?.moneyProblems ?? 0) > 0 ? 'danger' : undefined}
        />
        <StatTile
          label="Failures in 24 hours"
          value={summary ? summary.eventsLast24h : '—'}
          hint="Every occurrence, including repeats"
          icon={Clock}
        />
      </div>

      <Tabs defaultValue="problems">
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="problems">Problems</TabsTrigger>
          <TabsTrigger value="jobs">Background jobs</TabsTrigger>
          <TabsTrigger value="how">How this works</TabsTrigger>
        </TabsList>

        <TabsContent value="problems" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(['open', 'resolved', 'ignored'] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={statusFilter === value ? 'default' : 'outline'}
                onClick={() => setStatusFilter(value)}
              >
                {value === 'open' ? 'Open' : value === 'resolved' ? 'Marked fixed' : 'Hidden'}
              </Button>
            ))}
          </div>

          {groupsQuery.isLoading ? (
            <Card>
              <CardContent className="py-8 text-sm text-muted-foreground">Loading problems…</CardContent>
            </Card>
          ) : groups.length === 0 ? (
            <Card>
              <CardContent className="space-y-3 py-10 text-center">
                <ShieldCheck className="mx-auto h-10 w-10 text-emerald-500" />
                <p className="text-lg font-medium">
                  {statusFilter === 'open' ? 'No open problems — this is the good state' : 'Nothing in this list'}
                </p>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">
                  {statusFilter === 'open'
                    ? 'When something fails in Kaptia it appears here, already grouped and explained.'
                    : 'Switch back to Open to see what is happening right now.'}
                </p>
                {statusFilter === 'open' && (
                  <Button size="sm" variant="outline" onClick={handleTest} disabled={sendingTest}>
                    Send a test problem to prove this works
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            groups.map((group) => (
              <ProblemCard
                key={group.id}
                group={group}
                busy={busyId === group.id}
                onResolve={(item) => updateStatus(item, 'resolved')}
                onIgnore={(item) => updateStatus(item, 'ignored')}
                onExplain={explainGroup}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="jobs" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Scheduled jobs</CardTitle>
              <CardDescription>
                Backups, e-mails and clean-up tasks. If a job stops running it is marked late here —
                that is usually how a vanished cron shows up.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    No job has reported a run yet. Nothing is broken — jobs appear the first time
                    they record one.
                  </p>
                  <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-[11px]">
{`curl -X POST "$APP_URL/api/admin/watch/job-run" \\
  -H 'content-type: application/json' \\
  -d '{"jobName":"healthcheck","status":"ok"}'`}
                  </pre>
                </div>
              ) : (
                <div className="divide-y">
                  {jobs.map((job) => {
                    const failed = job.status === 'failed';
                    const late = job.stale;
                    return (
                      <div
                        key={job.jobName}
                        className="flex flex-wrap items-center justify-between gap-2 py-3"
                      >
                        <div>
                          <p className="font-medium">{job.jobName}</p>
                          <p className="text-sm text-muted-foreground">
                            Last run {timeAgo(job.startedAt)}
                            {job.durationMs !== null
                              ? ` · took ${Math.max(1, Math.round(job.durationMs / 1000))}s`
                              : ''}
                            {job.errorCode ? ` · ${job.errorCode}` : ''}
                          </p>
                        </div>
                        <Badge
                          className={
                            failed || late ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
                          }
                        >
                          {failed ? 'Failed' : late ? 'Late' : 'OK'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="how" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">How this screen works</CardTitle>
              <CardDescription>Five things worth knowing before you trust it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-medium">It groups, it does not list</p>
                <p className="text-muted-foreground">
                  A hundred identical failures are one card: “happened 100 times”. One card means one
                  thing to fix.
                </p>
              </div>
              <div>
                <p className="font-medium">It only knows what Kaptia reports</p>
                <p className="text-muted-foreground">
                  Crashes, failed requests, features that failed silently and money checks that did not
                  add up are covered. A blank page caused by an ad-blocker, a dead connection or a
                  browser extension is usually invisible. Nothing sees everything.
                </p>
              </div>
              <div>
                <p className="font-medium">It does not store customer data</p>
                <p className="text-muted-foreground">
                  Messages are scrubbed of e-mails, IBANs, card and phone numbers before they are
                  saved. Request bodies and query strings are never sent. Clicks are recorded as
                  button names, never as visible text.
                </p>
              </div>
              <div>
                <p className="font-medium">AI explanations are optional</p>
                <p className="text-muted-foreground">
                  “Explain this to me” sends only the scrubbed message and the top lines of the stack
                  trace. If AI is switched off or the daily budget is spent, the problem list still
                  works — you simply do not get the explanation.
                  {summary && (
                    <>
                      {' '}
                      Today: {summary.aiCallsToday} of {summary.aiCallsBudget} explanations used
                      {summary.aiEnabled ? '' : ' · AI is switched off'}.
                    </>
                  )}
                </p>
              </div>
              <div>
                <p className="font-medium">The tracker reports on itself</p>
                <p className="text-muted-foreground">
                  {summary
                    ? `Since the server started: ${summary.accepted} reports accepted, ${summary.dropped} dropped, ${summary.flushFailures} failed saves${
                        summary.health?.bufferedGroups
                          ? `, ${summary.health.bufferedGroups} waiting to be saved`
                          : ''
                      }.`
                    : 'Statistics unavailable right now.'}{' '}
                  If “dropped” or “failed saves” keeps growing, this screen is not telling you the
                  whole truth — that matters more than any single problem listed here.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
