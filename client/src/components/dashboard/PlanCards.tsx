import { Link } from "wouter";
import { Check, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel, useLangHref } from "./overviewShared";

/**
 * The one upgrade card a free account sees.
 *
 * The old dashboard drew five locked panels for a free account, so most of the page was a wall of
 * padlocks. Everything a free plan can compute is shown; what it cannot is named once, here.
 */
export function FreePlanCard() {
  const { t } = useTranslation();
  const href = useLangHref();
  const benefits = ["reminders", "goals", "trends", "receipts"] as const;

  return (
    <Panel labelledBy="upgrade-title" testId="dashboard-upgrade" className="flex flex-wrap items-center gap-6">
      <div className="flex min-w-[260px] flex-1 flex-col gap-2">
        <h2 id="upgrade-title" className="text-lg font-semibold text-gray-900 dark:text-white">{t("overview.upgrade.title")}</h2>
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{t("overview.upgrade.body")}</p>
      </div>
      <ul className="grid min-w-[260px] flex-[2] grid-cols-1 gap-2.5 sm:grid-cols-2">
        {benefits.map((key) => (
          <li key={key} className="flex items-start gap-2.5 text-sm text-gray-800 dark:text-gray-200">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            {t(`overview.upgrade.${key}`)}
          </li>
        ))}
      </ul>
      <Link href={href("/subscribe")} className="inline-flex h-11 items-center rounded-xl bg-blue-600 px-5 text-[15px] font-semibold text-white hover:bg-blue-700">
        {t("overview.upgrade.cta")}
      </Link>
    </Panel>
  );
}

/** Where a Standard account would see the adviser: one line saying what it is, not a locked panel. */
export function AdviserTeaser() {
  const { t } = useTranslation();
  const href = useLangHref();

  return (
    <Panel label={t("financialHealthAdvisor")} testId="dashboard-adviser-teaser" className="flex flex-wrap items-center gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
        <Sparkles className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="flex min-w-[240px] flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold text-gray-900 dark:text-white">{t("overview.adviser_teaser.title")}</span>
        <span className="text-sm text-gray-600 dark:text-gray-400">{t("overview.adviser_teaser.body")}</span>
      </div>
      <Link href={href("/subscribe")} className="inline-flex h-10 items-center rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700">
        {t("overview.adviser_teaser.cta")}
      </Link>
    </Panel>
  );
}
