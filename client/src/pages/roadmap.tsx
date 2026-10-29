import { useState, type ComponentType } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  CalendarClock,
  Check,
  Coins,
  FileDown,
  Mail,
  Lightbulb,
  ListChecks,
  MessageCircleQuestion,
  MessageSquareText,
  Mic,
  Repeat,
  Rocket,
  ShieldCheck,
  ShoppingBasket,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trophy,
  Users,
  Wallet,
  Receipt,
  Scale,
  Zap,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { PageHeader, PageShell, Panel, Segmented, primaryButton, useLangHref } from "@/components/page/kit";
import { cn } from "@/lib/utils";

/**
 * What Kaptia does today and what comes next, in the order of `docs/IMPLEMENTATION-PLAN.md`
 * (section 4, the release plan). No dates on purpose: a step ships when its "done when" is true.
 * When a step ships, move its features into `AVAILABLE` and drop the step.
 */

type Icon = ComponentType<{ className?: string }>;
type Stage = "now" | "next" | "later" | "horizon";
type Filter = "all" | Stage;

const AVAILABLE: { key: string; icon: Icon }[] = [
  { key: "capture", icon: Mic },
  { key: "budgets_goals", icon: Target },
  { key: "shared_goals", icon: Users },
  { key: "health", icon: Sparkles },
  { key: "reports", icon: BarChart3 },
  { key: "recurring", icon: Repeat },
  { key: "achievements", icon: Trophy },
  { key: "export", icon: FileDown },
  { key: "privacy", icon: ShieldCheck },
];

const STEPS: { stage: Exclude<Stage, "now">; key: string; features: { key: string; icon: Icon }[] }[] = [
  { stage: "next", key: "s1", features: [{ key: "accounts", icon: Wallet }, { key: "transfers", icon: ArrowLeftRight }] },
  { stage: "next", key: "s2", features: [{ key: "payday", icon: CalendarClock }] },
  { stage: "next", key: "s3", features: [{ key: "subscriptions", icon: ListChecks }] },
  { stage: "later", key: "s4", features: [{ key: "debts", icon: Scale }] },
  { stage: "later", key: "s5", features: [{ key: "watchdog", icon: Bell }] },
  { stage: "later", key: "s6", features: [{ key: "fast_capture", icon: Zap }] },
  { stage: "horizon", key: "s7", features: [{ key: "currency", icon: Coins }, { key: "negotiation", icon: MessageSquareText }] },
  {
    stage: "horizon",
    key: "s8",
    features: [
      { key: "ask", icon: MessageCircleQuestion },
      { key: "basket", icon: ShoppingBasket },
      { key: "what_if", icon: SlidersHorizontal },
    ],
  },
  {
    stage: "horizon",
    key: "s9",
    features: [
      { key: "household", icon: Users },
      { key: "tax", icon: Receipt },
      { key: "weekly", icon: Mail },
    ],
  },
];

const STAGE_STYLE: Record<Stage, { dot: string; chip: string; ring: string }> = {
  now: {
    dot: "bg-emerald-600 text-white dark:bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900",
    ring: "ring-emerald-100 dark:ring-emerald-950",
  },
  next: {
    dot: "bg-blue-700 text-white dark:bg-blue-500",
    chip: "bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-900",
    ring: "ring-blue-100 dark:ring-blue-950",
  },
  later: {
    dot: "bg-violet-600 text-white dark:bg-violet-500",
    chip: "bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-900",
    ring: "ring-violet-100 dark:ring-violet-950",
  },
  horizon: {
    dot: "bg-gray-400 text-white dark:bg-gray-600",
    chip: "bg-gray-100 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700",
    ring: "ring-gray-100 dark:ring-gray-800",
  },
};

function StageChip({ stage }: { stage: Stage }) {
  const { t } = useTranslation();
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", STAGE_STYLE[stage].chip)}>
      {stage === "now" && <Check className="h-3 w-3" aria-hidden="true" />}
      {t(`roadmap.stage.${stage}`)}
    </span>
  );
}

/** One row of the timeline: the dot on the line, and its card. */
function TimelineItem({ stage, children, last }: { stage: Stage; children: React.ReactNode; last?: boolean }) {
  return (
    <li className="relative pl-10 sm:pl-14">
      {!last && <span aria-hidden="true" className="absolute left-[15px] top-8 bottom-[-1.25rem] w-px bg-gray-200 sm:left-[19px] dark:bg-gray-800" />}
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full ring-4 sm:h-10 sm:w-10",
          STAGE_STYLE[stage].dot,
          STAGE_STYLE[stage].ring,
        )}
      >
        {stage === "now" ? <Check className="h-4 w-4" /> : <Rocket className="h-4 w-4" />}
      </span>
      {children}
    </li>
  );
}

function FeatureCard({ icon: Icon, title, desc, example }: { icon: Icon; title: string; desc: string; example?: string }) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50/60 p-4 transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-950/40 dark:hover:border-gray-700">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-gray-800 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <h4 className="text-[15px] font-semibold text-gray-900 dark:text-white">{title}</h4>
      </div>
      <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{desc}</p>
      {example && (
        <p className="mt-auto border-l-2 border-gray-300 pl-3 text-sm italic text-gray-700 dark:border-gray-600 dark:text-gray-300">
          {example}
        </p>
      )}
    </div>
  );
}

export default function RoadmapPage() {
  const { t } = useTranslation();
  const href = useLangHref();
  const [filter, setFilter] = useState<Filter>("all");

  const steps = STEPS.filter((step) => filter === "all" || step.stage === filter);
  const showNow = filter === "all" || filter === "now";
  const upcoming = STEPS.reduce((sum, step) => sum + step.features.length, 0);

  return (
    <PageShell testId="roadmap-page">
      <SEO title={`${t("roadmap.title")} | Kaptia`} description={t("roadmap.subtitle")} />
      <PageHeader title={t("roadmap.title")} subtitle={t("roadmap.subtitle")} />

      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-indigo-700 to-violet-700 p-6 text-white sm:p-8">
        <div aria-hidden="true" className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden="true" className="absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-violet-400/20 blur-2xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex max-w-2xl flex-col gap-2">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
              {t("roadmap.hero.eyebrow")}
            </span>
            <h2 className="font-display text-xl font-bold leading-snug sm:text-2xl">{t("roadmap.hero.title")}</h2>
            <p className="text-sm text-white/80 sm:text-[15px]">{t("roadmap.hero.text")}</p>
          </div>
          <dl className="grid shrink-0 grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/10 px-4 py-3">
              <dt className="text-xs text-white/70">{t("roadmap.hero.available")}</dt>
              <dd className="text-2xl font-bold">{AVAILABLE.length}</dd>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-3">
              <dt className="text-xs text-white/70">{t("roadmap.hero.coming")}</dt>
              <dd className="text-2xl font-bold">{upcoming}</dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="-mx-1 overflow-x-auto px-1">
        <Segmented
          label={t("roadmap.filter")}
          value={filter}
          onChange={setFilter}
          options={(["all", "now", "next", "later", "horizon"] as const).map((value) => ({
            value,
            label: value === "all" ? t("roadmap.stage.all") : t(`roadmap.stage.${value}`),
          }))}
        />
      </div>

      <ol className="flex flex-col gap-5">
        {showNow && (
          <TimelineItem stage="now" last={steps.length === 0}>
            <Panel labelledBy="roadmap-now">
              <div className="flex flex-col gap-1">
                <StageChip stage="now" />
                <h3 id="roadmap-now" className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                  {t("roadmap.now.title")}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t("roadmap.now.text")}</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {AVAILABLE.map(({ key, icon }) => (
                  <FeatureCard key={key} icon={icon} title={t(`roadmap.available.${key}.title`)} desc={t(`roadmap.available.${key}.desc`)} />
                ))}
              </div>
            </Panel>
          </TimelineItem>
        )}

        {steps.map((step, index) => (
          <TimelineItem key={step.key} stage={step.stage} last={index === steps.length - 1}>
            <Panel labelledBy={`roadmap-${step.key}`}>
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StageChip stage={step.stage} />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {t("roadmap.step", { number: STEPS.indexOf(step) + 1 })}
                  </span>
                </div>
                <h3 id={`roadmap-${step.key}`} className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                  {t(`roadmap.steps.${step.key}`)}
                </h3>
              </div>
              <div className={cn("mt-4 grid gap-3", step.features.length > 1 && "sm:grid-cols-2", step.features.length > 2 && "xl:grid-cols-3")}>
                {step.features.map(({ key, icon }) => (
                  <FeatureCard
                    key={key}
                    icon={icon}
                    title={t(`roadmap.features.${key}.title`)}
                    desc={t(`roadmap.features.${key}.desc`)}
                    example={t(`roadmap.features.${key}.example`)}
                  />
                ))}
              </div>
            </Panel>
          </TimelineItem>
        ))}
      </ol>

      <Panel className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <Lightbulb className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t("roadmap.idea.title")}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t("roadmap.idea.text")}</p>
          </div>
        </div>
        <Link href={href("/contact")} className={primaryButton}>
          {t("roadmap.idea.cta")}
        </Link>
      </Panel>
    </PageShell>
  );
}
