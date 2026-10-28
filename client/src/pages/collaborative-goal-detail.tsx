import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Mail, MessageCircle, Plus, Send, Share2, Users } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { useUserTimeZone } from "@/hooks/useUserTimeZone";
import { apiRequest } from "@/lib/queryClient";
import { apiErrorMessage } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import {
  HeroCard,
  HeroStat,
  PageShell,
  Panel,
  PanelSkeleton,
  PanelTitle,
  linkButton,
  primaryButton,
  secondaryButton,
  useLangHref,
  useOverviewFormat,
} from "@/components/page/kit";
import { personName } from "@/lib/people";
import { planGoal } from "@shared/goalPlan";
import { dayKeyIn } from "@shared/ledger";
import { centsToNumber, isValidAmount, parseAmountToCents } from "@shared/money";

interface Person {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  profileImageUrl?: string | null;
}

interface Goal {
  id: number;
  name: string;
  description?: string | null;
  targetAmount: string;
  currentAmount: string;
  targetDate: string;
  category: string;
  challengeType?: string;
  createdBy: string;
  createdAt?: string | null;
  isParticipant?: boolean;
  goalDetails?: Record<string, unknown> | null;
  participants: Array<{ id: number; userId: string; role: string; currentContribution: string; user?: Person | null }>;
}

interface Contribution {
  id: number;
  userId: string;
  amount: string;
  description?: string | null;
  createdAt: string;
  user?: Person | null;
}

interface Message {
  id: number;
  message: string;
  createdAt: string;
  user?: Person | null;
}

function cents(value: string | number | null | undefined): number {
  try {
    return Math.abs(parseAmountToCents(value ?? 0));
  } catch {
    return 0;
  }
}

function initials(person: Person | null | undefined): string {
  return `${person?.firstName?.[0] ?? ""}${person?.lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

/**
 * One shared goal: how far the group is, who put in what, and the conversation around it.
 *
 * Amounts were printed as "$" whatever the currency, dates in the browser's default format, the
 * share text was English in every language, and the contribution form asked whose money it was
 * although the server always records it as the signed-in person's. All of that is fixed here; the
 * chart now shows the pot growing towards the target instead of a line of unrelated payments.
 */
export default function CollaborativeGoalDetailPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const f = useOverviewFormat();
  const href = useLangHref();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isReady, user } = useClerkUserReady();
  const timeZone = useUserTimeZone();
  const someone = t("page.shared.someone");
  const enabled = isReady && !!user?.id && !!id;
  const inviteCode = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("code") : null;

  const goalQuery = useQuery<Goal>({
    queryKey: ["collaborative-goal", id, inviteCode],
    enabled,
    retry: false,
    queryFn: async () => {
      const url = inviteCode ? `/api/collaborative-goals/${id}?code=${encodeURIComponent(inviteCode)}` : `/api/collaborative-goals/${id}`;
      return (await apiRequest("GET", url)).json();
    },
  });
  const goal = goalQuery.data;
  const member = goal?.isParticipant !== false;

  const contributionsQuery = useQuery<Contribution[]>({
    queryKey: ["collaborative-goal-contributions", id],
    enabled: enabled && !!goal && member,
    queryFn: async () => (await apiRequest("GET", `/api/collaborative-goals/${id}/contributions`)).json(),
  });
  const messagesQuery = useQuery<Message[]>({
    queryKey: ["collaborative-goal-messages", id],
    enabled: enabled && !!goal && member,
    refetchInterval: 30_000,
    queryFn: async () => (await apiRequest("GET", `/api/collaborative-goals/${id}/messages`)).json(),
  });
  const contributions = contributionsQuery.data ?? [];
  const messages = messagesQuery.data ?? [];

  const [contribute, setContribute] = useState({ open: false, amount: "", note: "" });
  const [invite, setInvite] = useState({ open: false, email: "" });
  const [draft, setDraft] = useState("");

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["collaborative-goal", id] });
    queryClient.invalidateQueries({ queryKey: ["collaborative-goal-contributions", id] });
    queryClient.invalidateQueries({ queryKey: ["collaborative-goals"] });
  };

  const addContribution = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/collaborative-goals/${id}/contributions`, {
        amount: centsToNumber(parseAmountToCents(contribute.amount)),
        note: contribute.note.trim(),
      });
    },
    onSuccess: () => {
      refresh();
      toast({ title: t("page.shared.contribution_added") });
      setContribute({ open: false, amount: "", note: "" });
    },
    onError: (error) => toast({ title: t("page.shared.contribution_failed"), description: apiErrorMessage(error, t("page.common.try_again")), variant: "destructive" }),
  });

  const sendInvite = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/collaborative-goals/${id}/invite`, { email: invite.email.trim() })).json(),
    onSuccess: (result: { emailSent?: boolean }) => {
      toast({
        title: t("collaborative_goal_detail.messages.invitation_sent"),
        // The answer is the same whether or not the address has an account, so this form cannot be
        // used to check who is a customer.
        description: result?.emailSent
          ? t("collaborative_goal_detail.messages.invitation_email_sent")
          : t("collaborative_goal_detail.messages.already_participant"),
      });
      setInvite({ open: false, email: "" });
    },
    onError: (error) => toast({ title: t("collaborative_goal_detail.messages.invitation_failed"), description: apiErrorMessage(error, t("page.common.try_again")), variant: "destructive" }),
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/collaborative-goals/${id}/messages`, { message: draft.trim(), messageType: "text" });
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["collaborative-goal-messages", id] });
    },
    onError: (error) => toast({ title: t("page.shared.message_failed"), description: apiErrorMessage(error, t("page.common.try_again")), variant: "destructive" }),
  });

  const join = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/collaborative-goals/${id}/join`, { joinCode: inviteCode ?? "" });
    },
    onSuccess: () => {
      refresh();
      toast({ title: t("collaborative_goal_detail.messages.joined"), description: t("collaborative_goal_detail.messages.joined_description") });
    },
    onError: (error) => toast({ title: t("page.shared.join_failed"), description: apiErrorMessage(error, t("page.common.try_again")), variant: "destructive" }),
  });

  const timeline = useMemo(() => {
    let running = 0;
    const byDay = new Map<string, number>();
    for (const contribution of [...contributions].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())) {
      running += cents(contribution.amount);
      byDay.set(dayKeyIn(contribution.createdAt, timeZone), running);
    }
    return Array.from(byDay.entries()).map(([day, total]) => ({ day, label: f.dateLabel(day), total: total / 100 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contributions, timeZone]);

  if (goalQuery.isLoading || !isReady) {
    return (
      <PageShell>
        <PanelSkeleton className="h-10 w-40" />
        <PanelSkeleton className="h-64" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <PanelSkeleton className="h-72 lg:col-span-2" />
          <PanelSkeleton className="h-72" />
        </div>
      </PageShell>
    );
  }

  if (!goal) {
    return (
      <PageShell>
        <Panel label={t("collaborative_goal_detail.errors.goal_not_found")} className="flex flex-col items-center gap-3 py-12 text-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t("collaborative_goal_detail.errors.goal_not_found")}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t("collaborative_goal_detail.errors.goal_not_found_description")}</p>
          <button type="button" className={secondaryButton} onClick={() => setLocation(href("/collaborative-goals"))}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("collaborative_goal_detail.buttons.back")}
          </button>
        </Panel>
      </PageShell>
    );
  }

  const plan = planGoal(goal, new Date(), timeZone);
  const members = Math.max(1, goal.participants.length);
  const perPerson = plan.monthlyNeededCents !== null ? Math.ceil(plan.monthlyNeededCents / members) : null;
  const mine = goal.participants.find((participant) => participant.userId === user?.id);
  const isCreator = goal.createdBy === user?.id;
  const contributors = [...goal.participants]
    .map((participant) => ({ participant, cents: cents(participant.currentContribution) }))
    .sort((a, b) => b.cents - a.cents);
  const contributedTotal = contributors.reduce((sum, entry) => sum + entry.cents, 0);
  const amountOk = isValidAmount(contribute.amount) && (() => {
    try {
      return parseAmountToCents(contribute.amount) > 0;
    } catch {
      return false;
    }
  })();

  const share = async () => {
    const text = t("page.shared.share_text", { name: goal.name, amount: f.money(plan.targetCents) });
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: goal.name, text, url });
        return;
      }
    } catch {
      // Cancelled or unavailable: fall back to copying.
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast({ title: t("collaborative_goal_detail.messages.link_copied"), description: t("collaborative_goal_detail.messages.link_copied_description") });
    } catch {
      toast({ title: t("collaborative_goal_detail.messages.copy_failed"), variant: "destructive" });
    }
  };

  const time = (value: string) => new Intl.DateTimeFormat(f.locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(value));

  return (
    <PageShell testId="shared-goal-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={href("/collaborative-goals")} className={cn(linkButton, "inline-flex items-center gap-1.5")}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("collaborative_goal_detail.buttons.back")}
        </Link>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryButton} onClick={share}>
            <Share2 className="h-4 w-4" aria-hidden="true" />
            {t("collaborative_goal_detail.actions.share_goal")}
          </button>
          {isCreator && (
            <button type="button" className={secondaryButton} onClick={() => setInvite({ open: true, email: "" })}>
              <Mail className="h-4 w-4" aria-hidden="true" />
              {t("collaborative_goal_detail.actions.invite_friends")}
            </button>
          )}
        </div>
      </div>

      {!member && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-100">{t("collaborative_goal_detail.join_prompt")}</p>
          <button type="button" className={primaryButton} disabled={join.isPending} onClick={() => join.mutate()}>
            {t("collaborative_goal_detail.buttons.join")}
          </button>
        </div>
      )}

      <HeroCard
        tone="violet"
        testId="shared-goal-hero"
        label={
          <span className="flex flex-col gap-0.5">
            <span className="text-xl font-bold text-white sm:text-2xl">{goal.name}</span>
            <span>{t(`collaborative_goals.categories.${goal.category}`, goal.category)} · {t(`collaborative_goals.challenge_types.${goal.challengeType ?? "collaborative"}`, goal.challengeType ?? "")}</span>
          </span>
        }
        amount={f.money(plan.savedCents)}
        sub={t("page.shared.hero_goal_sub", { target: f.money(plan.targetCents), pct: plan.percent })}
      >
        {goal.description && <p className="max-w-2xl text-sm text-white/90">{goal.description}</p>}
        <div className="h-3 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white/90" style={{ width: `${plan.percent}%` }} />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          <HeroStat
            label={f.dateLabel(plan.targetDay)}
            value={plan.reached
              ? t("page.goals.pace_reached")
              : plan.overdue ? t("page.goals.days_late", { count: -plan.daysLeft }) : t("page.goals.days_left", { count: plan.daysLeft })}
          />
          <HeroStat label={t("page.shared.each_per_month")} value={perPerson !== null ? f.money(perPerson) : "—"} note={t("page.shared.members", { count: members })} />
          <HeroStat label={t("page.shared.your_contribution")} value={f.money(cents(mine?.currentContribution))} />
        </div>
        {member && !plan.reached && (
          <div>
            <button
              type="button"
              onClick={() => setContribute({ open: true, amount: "", note: "" })}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-violet-800 hover:bg-violet-50"
              data-testid="shared-contribute"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("page.shared.add_contribution")}
            </button>
          </div>
        )}
      </HeroCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Panel labelledBy="growth-title" className="flex flex-col gap-4">
            <PanelTitle id="growth-title">{t("page.shared.growth_title")}</PanelTitle>
            {timeline.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-600 dark:text-gray-400">{t("collaborative_goal_detail.sections.no_contributions")}</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeline} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} width={70} tickFormatter={(value) => f.money(Number(value) * 100)} />
                    <Tooltip formatter={(value) => [f.money(Number(value) * 100), t("page.shared.saved_together")]} />
                    <ReferenceLine y={plan.targetCents / 100} stroke="#7c3aed" strokeDasharray="5 5" label={{ value: t("page.goals.stat_target"), position: "insideTopRight", fontSize: 12 }} />
                    <Area type="monotone" dataKey="total" stroke="#6d28d9" fill="#ddd6fe" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <Panel labelledBy="contributors-title" className="flex flex-col gap-3">
            <PanelTitle id="contributors-title">
              <Users className="h-4 w-4 text-gray-500" aria-hidden="true" />
              {t("page.shared.contributors_title", { count: goal.participants.length })}
            </PanelTitle>
            <ul className="flex flex-col gap-3">
              {contributors.map(({ participant, cents: amount }) => (
                <li key={participant.id} className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={participant.user?.profileImageUrl ?? ""} />
                    <AvatarFallback>{initials(participant.user)}</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-semibold text-gray-900 dark:text-white">{personName(participant.user, someone)}</span>
                        {participant.role === "creator" && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            {t("collaborative_goal_detail.sections.creator")}
                          </span>
                        )}
                        {participant.userId === user?.id && <span className="text-xs text-gray-500">({t("page.shared.you")})</span>}
                      </span>
                      <span className="whitespace-nowrap font-semibold tabular-nums text-gray-900 dark:text-white">{f.money(amount)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                      <div className="h-full rounded-full bg-violet-600" style={{ width: `${contributedTotal > 0 ? Math.max(2, (amount * 100) / contributedTotal) : 0}%` }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          {goal.goalDetails && Object.keys(goal.goalDetails).length > 0 && (
            <Panel labelledBy="details-title" className="flex flex-col gap-3">
              <PanelTitle id="details-title">{t("collaborative_goal_detail.charts.goal_details")}</PanelTitle>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Object.entries(goal.goalDetails).map(([key, value]) => (
                  <div key={key} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60">
                    <dt className="text-xs text-gray-600 dark:text-gray-400">{t(`collaborative_goal_detail.goal_fields.${key}`, key)}</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Panel labelledBy="activity-title" className="flex flex-col gap-3">
            <PanelTitle id="activity-title">{t("collaborative_goal_detail.sections.recent_activity")}</PanelTitle>
            {contributions.length === 0 ? (
              <p className="py-4 text-sm text-gray-600 dark:text-gray-400">{t("collaborative_goal_detail.sections.no_contributions")}</p>
            ) : (
              <ul className="flex flex-col">
                {[...contributions]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 8)
                  .map((contribution) => (
                    <li key={contribution.id} className="flex items-start gap-3 border-b border-gray-100 py-2.5 last:border-b-0 dark:border-gray-800">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{initials(contribution.user)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="text-gray-900 dark:text-white">
                          {t("page.shared.activity_line", { name: personName(contribution.user, someone), amount: f.money(cents(contribution.amount)) })}
                        </p>
                        {contribution.description && <p className="truncate text-xs italic text-gray-600 dark:text-gray-400">“{contribution.description}”</p>}
                        <p className="text-xs text-gray-500">{f.dateLabel(dayKeyIn(contribution.createdAt, timeZone))}</p>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </Panel>

          {member && (
            <Panel labelledBy="chat-title" className="flex flex-col gap-3">
              <PanelTitle id="chat-title">
                <MessageCircle className="h-4 w-4 text-gray-500" aria-hidden="true" />
                {t("collaborative_goal_detail.chat.group_chat")}
              </PanelTitle>
              <div className="flex max-h-72 flex-col gap-3 overflow-y-auto rounded-xl bg-gray-50 p-3 dark:bg-gray-800/40" aria-live="polite">
                {messages.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-600 dark:text-gray-400">{t("collaborative_goal_detail.chat.no_messages")}</p>
                ) : (
                  messages.map((message) => (
                    <div key={message.id} className="flex flex-col">
                      <span className="flex items-baseline gap-2 text-xs">
                        <span className="font-semibold text-gray-900 dark:text-white">{personName(message.user, someone)}</span>
                        <span className="text-gray-500">{time(message.createdAt)}</span>
                      </span>
                      <span className="text-sm text-gray-800 dark:text-gray-200">{message.message}</span>
                    </div>
                  ))
                )}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (draft.trim() && !sendMessage.isPending) sendMessage.mutate();
                }}
              >
                <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t("collaborative_goal_detail.chat.type_message")} aria-label={t("collaborative_goal_detail.chat.type_message")} />
                <button type="submit" className={cn(primaryButton, "px-3")} disabled={!draft.trim() || sendMessage.isPending} aria-label={t("a11y.send")}>
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
              </form>
            </Panel>
          )}
        </div>
      </div>

      <Dialog open={contribute.open} onOpenChange={(open) => setContribute((current) => ({ ...current, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("page.shared.add_contribution")}</DialogTitle>
            <DialogDescription>{t("page.shared.contribution_description", { name: goal.name })}</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (amountOk && !addContribution.isPending) addContribution.mutate();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contribution-amount">{t("page.form.amount")}</Label>
              <Input
                id="contribution-amount"
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                value={contribute.amount}
                onChange={(event) => setContribute((current) => ({ ...current, amount: event.target.value }))}
                placeholder="0.00"
                className="h-12 text-xl font-semibold tabular-nums"
              />
              <div className="flex flex-wrap gap-2 pt-1">
                {perPerson !== null && (
                  <button
                    type="button"
                    className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    onClick={() => setContribute((current) => ({ ...current, amount: String(centsToNumber(perPerson)) }))}
                  >
                    {t("page.shared.chip_my_month", { amount: f.money(perPerson) })}
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contribution-note">{t("page.form.note")}</Label>
              <Textarea id="contribution-note" rows={2} maxLength={500} value={contribute.note} onChange={(event) => setContribute((current) => ({ ...current, note: event.target.value }))} />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className={cn(secondaryButton, "justify-center")} onClick={() => setContribute({ open: false, amount: "", note: "" })}>
                {t("page.common.cancel")}
              </button>
              <button type="submit" className={cn(primaryButton, "justify-center")} disabled={!amountOk || addContribution.isPending}>
                {t("page.shared.add_contribution")}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={invite.open} onOpenChange={(open) => setInvite((current) => ({ ...current, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("collaborative_goal_detail.actions.invite_friends")}</DialogTitle>
            <DialogDescription>{t("collaborative_goal_detail.actions.invite_description")}</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email.trim()) && !sendInvite.isPending) sendInvite.mutate();
            }}
          >
            <Input type="email" autoComplete="email" value={invite.email} onChange={(event) => setInvite((current) => ({ ...current, email: event.target.value }))} placeholder={t("collaborative_goal_detail.actions.email_placeholder")} aria-label={t("page.shared.email")} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className={cn(secondaryButton, "justify-center")} onClick={() => setInvite({ open: false, email: "" })}>
                {t("page.common.cancel")}
              </button>
              <button type="submit" className={cn(primaryButton, "justify-center")} disabled={sendInvite.isPending}>
                {sendInvite.isPending ? t("collaborative_goal_detail.actions.sending") : t("collaborative_goal_detail.actions.send_invitation")}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
