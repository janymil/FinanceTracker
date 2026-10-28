import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarDays, Check, Mail, Plus, Trophy, UserPlus, Users, X } from "lucide-react";
import RequirePlan from "@/components/require-plan";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { useUserTimeZone } from "@/hooks/useUserTimeZone";
import { apiRequest } from "@/lib/queryClient";
import { apiErrorMessage } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { personName } from "@/lib/people";
import {
  EmptyState,
  HeroCard,
  HeroStat,
  LoadError,
  Meter,
  PageHeader,
  PageShell,
  Panel,
  PanelSkeleton,
  PanelTitle,
  primaryButton,
  secondaryButton,
  useLangHref,
  useOverviewFormat,
} from "@/components/page/kit";
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

interface SharedGoal {
  id: number;
  name: string;
  description?: string | null;
  targetAmount: string;
  currentAmount: string;
  targetDate: string;
  category: string;
  challengeType: string;
  status?: string;
  createdAt?: string | null;
  participants: Array<{ id: number; userId: string; currentContribution: string; role: string; user?: Person | null }>;
}

interface Friend {
  id: number;
  friend: Person;
}

interface FriendRequest {
  id: number;
  requester: Person;
}

const CHALLENGES = ["collaborative", "competitive", "milestone"] as const;
const CATEGORIES = ["vacation", "home", "emergency", "education", "wedding", "other"] as const;

function initials(person: Person | null | undefined): string {
  return `${person?.firstName?.[0] ?? ""}${person?.lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

function safeCents(value: string | number | null | undefined): number {
  try {
    return Math.abs(parseAmountToCents(value ?? 0));
  } catch {
    return 0;
  }
}

/**
 * Goals saved for together with friends or family.
 *
 * Every amount here used to be printed in US dollars whatever the account's currency, several
 * messages were English in every language, a failed request said nothing, and the third tab
 * ("Achievements") was a placeholder that never filled. Now: one screen with the goals, what each
 * person has put in and what each needs to add per month, and the people beside them — with
 * pending friend requests answered right where they appear.
 */
export default function CollaborativeGoalsPage() {
  const { t } = useTranslation();
  const f = useOverviewFormat();
  const href = useLangHref();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isReady, user } = useClerkUserReady();
  const timeZone = useUserTimeZone();
  const enabled = isReady && !!user?.id;
  const someone = t("page.shared.someone");

  const goalsQuery = useQuery<SharedGoal[]>({
    queryKey: ["collaborative-goals", user?.id],
    enabled,
    queryFn: async () => (await apiRequest("GET", "/api/collaborative-goals")).json(),
  });
  const friendsQuery = useQuery<Friend[]>({
    queryKey: ["friends", user?.id],
    enabled,
    queryFn: async () => (await apiRequest("GET", "/api/friends")).json(),
  });
  const requestsQuery = useQuery<FriendRequest[]>({
    queryKey: ["friend-requests", user?.id],
    enabled,
    queryFn: async () => (await apiRequest("GET", "/api/friends/requests")).json(),
  });

  const goals = goalsQuery.data ?? [];
  const friends = friendsQuery.data ?? [];
  const requests = requestsQuery.data ?? [];

  const now = new Date();
  const enriched = useMemo(
    () =>
      goals.map((goal) => {
        const plan = planGoal(goal, now, timeZone);
        const mine = goal.participants.find((p) => p.userId === user?.id);
        const members = Math.max(1, goal.participants.length);
        return {
          goal,
          plan,
          mineCents: safeCents(mine?.currentContribution),
          perPersonMonthly: plan.monthlyNeededCents !== null ? Math.ceil(plan.monthlyNeededCents / members) : null,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goals, timeZone, user?.id],
  );

  const totalRaised = enriched.reduce((sum, entry) => sum + entry.plan.savedCents, 0);
  const totalMine = enriched.reduce((sum, entry) => sum + entry.mineCents, 0);
  // Everyone in any of the goals except the person looking.
  const people = new Set(goals.flatMap((goal) => goal.participants.map((p) => p.userId)).filter((id) => id !== user?.id));

  const [create, setCreate] = useState({ open: false, name: "", description: "", target: "", date: "", category: "vacation", challengeType: "collaborative" });
  const [invite, setInvite] = useState({ open: false, email: "" });

  const createGoal = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/collaborative-goals", {
        name: create.name.trim(),
        description: create.description.trim(),
        targetAmount: centsToNumber(parseAmountToCents(create.target)),
        targetDate: create.date,
        category: create.category,
        challengeType: create.challengeType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collaborative-goals"] });
      toast({ title: t("page.shared.created") });
      setCreate((current) => ({ ...current, open: false, name: "", description: "", target: "", date: "" }));
    },
    onError: (error) => toast({ title: t("page.shared.create_failed"), description: apiErrorMessage(error, t("page.common.try_again")), variant: "destructive" }),
  });

  const sendRequest = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/friends/request", { recipientEmail: invite.email.trim() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      toast({ title: t("page.shared.request_sent"), description: t("page.shared.request_sent_body") });
      setInvite({ open: false, email: "" });
    },
    onError: (error) => toast({ title: t("page.shared.request_failed"), description: apiErrorMessage(error, t("page.common.try_again")), variant: "destructive" }),
  });

  const answer = useMutation({
    mutationFn: async ({ id, accept }: { id: number; accept: boolean }) => {
      if (accept) await apiRequest("POST", `/api/friends/accept/${id}`);
      else await apiRequest("DELETE", `/api/friends/reject/${id}`);
      return accept;
    },
    onSuccess: (accepted) => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
      toast({ title: accepted ? t("page.shared.request_accepted") : t("page.shared.request_declined") });
    },
    onError: (error) => toast({ title: t("page.shared.request_failed"), description: apiErrorMessage(error, t("page.common.try_again")), variant: "destructive" }),
  });

  const targetOk = isValidAmount(create.target) && (() => {
    try {
      return parseAmountToCents(create.target) > 0;
    } catch {
      return false;
    }
  })();
  const createValid = create.name.trim() && targetOk && create.date;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email.trim());
  const loading = goalsQuery.isLoading;

  return (
    <RequirePlan plan="standard" feature="Collaborative Savings Goals">
      <PageShell testId="shared-goals-page">
        <PageHeader
          title={t("page.shared.title")}
          subtitle={t("page.shared.subtitle")}
          actions={
            <>
              <button type="button" className={secondaryButton} onClick={() => setInvite({ open: true, email: "" })}>
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                {t("page.shared.add_friend")}
              </button>
              <button type="button" className={primaryButton} onClick={() => setCreate((current) => ({ ...current, open: true }))} data-testid="shared-new">
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t("page.shared.new")}
              </button>
            </>
          }
        />

        {goalsQuery.error && <LoadError onRetry={() => goalsQuery.refetch()} />}

        {requests.length > 0 && (
          <Panel labelledBy="requests-title" className="flex flex-col gap-3 border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/30">
            <PanelTitle id="requests-title">
              <Mail className="h-4 w-4 text-blue-700 dark:text-blue-300" aria-hidden="true" />
              {t("page.shared.requests_title", { count: requests.length })}
            </PanelTitle>
            <ul className="flex flex-col gap-2">
              {requests.map((request) => (
                <li key={request.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 dark:bg-gray-900">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={request.requester.profileImageUrl ?? ""} />
                    <AvatarFallback>{initials(request.requester)}</AvatarFallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{personName(request.requester, someone)}</span>
                    <span className="truncate text-xs text-gray-600 dark:text-gray-400">{request.requester.email}</span>
                  </span>
                  <button type="button" className={primaryButton} disabled={answer.isPending} onClick={() => answer.mutate({ id: request.id, accept: true })}>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    {t("page.shared.accept")}
                  </button>
                  <button type="button" className={secondaryButton} disabled={answer.isPending} onClick={() => answer.mutate({ id: request.id, accept: false })}>
                    <X className="h-4 w-4" aria-hidden="true" />
                    {t("page.shared.decline")}
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <PanelSkeleton className="h-52 lg:col-span-12" />
            <PanelSkeleton className="h-80 lg:col-span-8" />
            <PanelSkeleton className="h-80 lg:col-span-4" />
          </div>
        ) : (
          <>
            {goals.length > 0 && (
              <HeroCard
                tone="violet"
                testId="shared-hero"
                label={t("page.shared.hero_label")}
                amount={f.money(totalRaised)}
                sub={t("page.shared.hero_sub", { amount: f.money(totalMine) })}
                help={t("page.shared.hero_help")}
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                  <HeroStat label={t("page.shared.stat_goals")} value={String(goals.length)} />
                  <HeroStat label={t("page.shared.stat_people")} value={String(people.size)} />
                  <HeroStat label={t("page.shared.stat_friends")} value={String(friends.length)} />
                </div>
              </HeroCard>
            )}

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="flex flex-col gap-5 lg:col-span-8">
                {goals.length === 0 ? (
                  <Panel label={t("page.shared.title")}>
                    <EmptyState
                      icon={<Users className="h-6 w-6" aria-hidden="true" />}
                      title={t("page.shared.empty_title")}
                      body={t("page.shared.empty_body")}
                      action={
                        <button type="button" className={primaryButton} onClick={() => setCreate((current) => ({ ...current, open: true }))}>
                          {t("page.shared.new")}
                        </button>
                      }
                    />
                  </Panel>
                ) : (
                  <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    {enriched.map(({ goal, plan, mineCents, perPersonMonthly }) => (
                      <li key={goal.id} className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900" data-testid="shared-goal-card">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-col gap-1">
                            <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">{goal.name}</h3>
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {t(`collaborative_goals.challenge_types.${goal.challengeType}`, goal.challengeType)}
                              {" · "}
                              {t(`collaborative_goals.categories.${goal.category}`, goal.category)}
                            </span>
                          </div>
                          {plan.reached && <Trophy className="h-5 w-5 shrink-0 text-amber-500" aria-label={t("page.goals.pace_reached")} />}
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">{f.money(plan.savedCents)}</span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">{t("page.goals.of_target", { amount: f.money(plan.targetCents) })}</span>
                          </div>
                          <Meter
                            percent={plan.percent}
                            tone={plan.reached ? "good" : plan.overdue ? "bad" : "neutral"}
                            label={t("page.goals.meter_label", { name: goal.name, pct: plan.percent })}
                          />
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {t("page.shared.your_part", { amount: f.money(mineCents), pct: plan.savedCents > 0 ? Math.round((mineCents * 100) / plan.savedCents) : 0 })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex -space-x-2">
                            {goal.participants.slice(0, 5).map((participant) => (
                              <Avatar key={participant.id} className="h-8 w-8 border-2 border-white dark:border-gray-900">
                                <AvatarImage src={participant.user?.profileImageUrl ?? ""} />
                                <AvatarFallback className="text-xs">{initials(participant.user)}</AvatarFallback>
                              </Avatar>
                            ))}
                            {goal.participants.length > 5 && (
                              <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-xs font-semibold dark:border-gray-900 dark:bg-gray-800">
                                +{goal.participants.length - 5}
                              </span>
                            )}
                          </div>
                          <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                            {plan.reached
                              ? t("page.goals.pace_reached")
                              : plan.overdue
                                ? t("page.goals.days_late", { count: -plan.daysLeft })
                                : t("page.goals.days_left", { count: plan.daysLeft })}
                          </span>
                        </div>
                        {perPersonMonthly !== null && (
                          <p className="rounded-xl bg-violet-50 px-3 py-2 text-[13px] text-violet-900 dark:bg-violet-950 dark:text-violet-200">
                            {t("page.shared.per_person", { amount: f.money(perPersonMonthly) })}
                          </p>
                        )}
                        <Link href={href(`/collaborative-goals/${goal.id}`)} className={cn(secondaryButton, "justify-center")}>
                          {t("page.shared.open")}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <aside className="flex flex-col gap-5 lg:col-span-4">
                <Panel labelledBy="friends-title" className="flex flex-col gap-3" testId="shared-friends">
                  <PanelTitle
                    id="friends-title"
                    aside={
                      <button type="button" className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300" onClick={() => setInvite({ open: true, email: "" })}>
                        {t("page.shared.add_friend")}
                      </button>
                    }
                  >
                    {t("page.shared.friends_title", { count: friends.length })}
                  </PanelTitle>
                  {friends.length === 0 ? (
                    <p className="py-4 text-sm text-gray-600 dark:text-gray-400">{t("page.shared.friends_empty")}</p>
                  ) : (
                    <ul className="flex flex-col">
                      {friends.map((friendship) => (
                        <li key={friendship.id} className="flex items-center gap-3 border-b border-gray-100 py-2.5 last:border-b-0 dark:border-gray-800">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={friendship.friend.profileImageUrl ?? ""} />
                            <AvatarFallback>{initials(friendship.friend)}</AvatarFallback>
                          </Avatar>
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{personName(friendship.friend, someone)}</span>
                            <span className="truncate text-xs text-gray-600 dark:text-gray-400">{friendship.friend.email}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
                <Panel labelledBy="how-title" className="flex flex-col gap-2">
                  <PanelTitle id="how-title">{t("page.shared.how_title")}</PanelTitle>
                  <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-gray-700 dark:text-gray-300">
                    <li>{t("page.shared.how_1")}</li>
                    <li>{t("page.shared.how_2")}</li>
                    <li>{t("page.shared.how_3")}</li>
                  </ol>
                </Panel>
              </aside>
            </div>
          </>
        )}

        <Dialog open={create.open} onOpenChange={(open) => setCreate((current) => ({ ...current, open }))}>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md" data-testid="shared-form">
            <DialogHeader>
              <DialogTitle>{t("page.shared.new_title")}</DialogTitle>
              <DialogDescription>{t("page.shared.new_description")}</DialogDescription>
            </DialogHeader>
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (createValid && !createGoal.isPending) createGoal.mutate();
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="shared-name">{t("page.goals.name")}</Label>
                <Input id="shared-name" maxLength={100} value={create.name} onChange={(event) => setCreate((current) => ({ ...current, name: event.target.value }))} placeholder={t("page.shared.name_placeholder")} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="shared-target">{t("page.goals.target")}</Label>
                  <Input id="shared-target" inputMode="decimal" autoComplete="off" value={create.target} onChange={(event) => setCreate((current) => ({ ...current, target: event.target.value }))} placeholder="0.00" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="shared-date">{t("page.goals.by_when")}</Label>
                  <Input id="shared-date" type="date" min={dayKeyIn(new Date(), timeZone)} value={create.date} onChange={(event) => setCreate((current) => ({ ...current, date: event.target.value }))} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="shared-category">{t("page.form.category")}</Label>
                <Select value={create.category} onValueChange={(value) => setCreate((current) => ({ ...current, category: value }))}>
                  <SelectTrigger id="shared-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>{t(`collaborative_goals.categories.${category}`, category)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">{t("page.shared.challenge_label")}</legend>
                {CHALLENGES.map((type) => (
                  <label
                    key={type}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3",
                      create.challengeType === type ? "border-blue-700 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/50" : "border-gray-200 dark:border-gray-700",
                    )}
                  >
                    <input
                      type="radio"
                      name="challenge"
                      value={type}
                      checked={create.challengeType === type}
                      onChange={() => setCreate((current) => ({ ...current, challengeType: type }))}
                      className="mt-1"
                    />
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{t(`collaborative_goals.challenge_types.${type}`)}</span>
                      <span className="text-xs text-gray-600 dark:text-gray-400">{t(`page.shared.challenge_${type}`)}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="shared-description">{t("page.goals.why")}</Label>
                <Textarea id="shared-description" rows={2} maxLength={1000} value={create.description} onChange={(event) => setCreate((current) => ({ ...current, description: event.target.value }))} />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" className={cn(secondaryButton, "justify-center")} onClick={() => setCreate((current) => ({ ...current, open: false }))}>
                  {t("page.common.cancel")}
                </button>
                <button type="submit" className={cn(primaryButton, "justify-center")} disabled={!createValid || createGoal.isPending} data-testid="shared-save">
                  {t("page.goals.create")}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={invite.open} onOpenChange={(open) => setInvite((current) => ({ ...current, open }))}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("page.shared.add_friend")}</DialogTitle>
              <DialogDescription>{t("page.shared.add_friend_description")}</DialogDescription>
            </DialogHeader>
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (emailValid && !sendRequest.isPending) sendRequest.mutate();
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="friend-email">{t("page.shared.email")}</Label>
                <Input id="friend-email" type="email" autoComplete="email" value={invite.email} onChange={(event) => setInvite((current) => ({ ...current, email: event.target.value }))} />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" className={cn(secondaryButton, "justify-center")} onClick={() => setInvite({ open: false, email: "" })}>
                  {t("page.common.cancel")}
                </button>
                <button type="submit" className={cn(primaryButton, "justify-center")} disabled={!emailValid || sendRequest.isPending}>
                  {t("page.shared.send_request")}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageShell>
    </RequirePlan>
  );
}
