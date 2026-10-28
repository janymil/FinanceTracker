import { useTranslation } from "react-i18next";
import { DatabaseBackup, Download, FileUp, ShieldCheck } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { useUserTimeZone } from "@/hooks/useUserTimeZone";
import { cn } from "@/lib/utils";
import { StatTile, useOverviewFormat } from "./kit";
import { dayKeyIn } from "@shared/ledger";

type Tab = "export" | "import" | "backup";

/**
 * The top of Data management: what the account holds, when it was last backed up, and the three
 * things a person comes here to do, as large targets instead of a row of small tabs.
 */
export function DataOverview({
  activeTab,
  onTab,
  lastBackup,
  autoBackup,
}: {
  activeTab: string;
  onTab: (tab: Tab) => void;
  lastBackup: string | null;
  autoBackup: boolean | null;
}) {
  const { t } = useTranslation();
  const f = useOverviewFormat();
  const timeZone = useUserTimeZone();
  const { data } = useTransactions();
  const rows = Array.isArray(data) ? (data as { date: string; categoryId?: number | null }[]) : [];
  const first = rows.reduce<string | null>((min, row) => {
    const day = dayKeyIn(row.date, timeZone);
    return !min || day < min ? day : min;
  }, null);
  const categoriesUsed = new Set(rows.map((row) => row.categoryId).filter(Boolean)).size;

  const actions: { tab: Tab; icon: typeof Download; title: string; body: string }[] = [
    { tab: "export", icon: Download, title: t("page.data.export_title"), body: t("page.data.export_body") },
    { tab: "import", icon: FileUp, title: t("page.data.import_title"), body: t("page.data.import_body") },
    { tab: "backup", icon: DatabaseBackup, title: t("page.data.backup_title"), body: t("page.data.backup_body") },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="data-overview">
        <StatTile
          label={t("page.data.transactions")}
          value={String(rows.length)}
          note={first ? t("page.data.since", { date: f.dateLabel(first) }) : t("page.data.nothing_yet")}
        />
        <StatTile label={t("page.data.categories")} value={String(categoriesUsed)} note={t("page.data.categories_note")} />
        <StatTile
          label={t("page.data.last_backup")}
          value={lastBackup ? f.dateLabel(dayKeyIn(lastBackup, timeZone)) : "—"}
          note={lastBackup ? undefined : t("page.data.no_backup")}
          tone={lastBackup ? "default" : "warn"}
        />
        <StatTile
          icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
          label={t("page.data.auto_backup")}
          value={autoBackup === null ? "—" : autoBackup ? t("page.data.on") : t("page.data.off")}
          tone={autoBackup ? "good" : autoBackup === false ? "warn" : "default"}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3" role="tablist" aria-label={t("page.data.title")}>
        {actions.map(({ tab, icon: Icon, title, body }) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => onTab(tab)}
            data-testid={`export-tab-${tab}`}
            className={cn(
              "flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
              activeTab === tab
                ? "border-blue-700 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/50"
                : "border-gray-200 bg-white hover:border-blue-300 dark:border-gray-800 dark:bg-gray-900",
            )}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{title}</span>
              <span className="text-[13px] text-gray-600 dark:text-gray-400">{body}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
