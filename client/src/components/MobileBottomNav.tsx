import { Link, useLocation } from "wouter";
import { CreditCard, LayoutDashboard, Menu, PieChart, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { QuickAddMenuItems } from "@/components/QuickAddMenuItems";
import { requestQuickAdd } from "@/lib/quickAdd";
import { cn } from "@/lib/utils";

/**
 * The phone's main navigation, at the bottom where the thumb is.
 *
 * The four places people go most, and "+" in the middle for the thing they do most. "More" opens
 * the full menu (the same drawer the top bar's hamburger opens). Hidden from `lg` up, where the
 * sidebar is always visible.
 */
export function MobileBottomNav({ onMore }: { onMore: () => void }) {
  const { t } = useTranslation();
  const [path] = useLocation();
  const lang = path.match(/^\/([a-z]{2})(?:\/|$)/)?.[1] || "en";

  const items = [
    { href: `/${lang}/dashboard`, label: t("overview.nav.home"), icon: LayoutDashboard, match: (p: string) => p === "/" || p.endsWith("/dashboard") },
    { href: `/${lang}/transactions`, label: t("Transactions"), icon: CreditCard, match: (p: string) => p.includes("/transactions") },
  ];
  const after = [
    { href: `/${lang}/budget`, label: t("Budget"), icon: PieChart, match: (p: string) => p.includes("/budget") },
  ];

  const tab = (item: (typeof items)[number]) => {
    const active = item.match(path);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px]",
          active ? "font-semibold text-blue-700 dark:text-blue-300" : "font-medium text-gray-600 dark:text-gray-400",
        )}
      >
        <Icon className="h-[22px] w-[22px]" aria-hidden="true" />
        {item.label}
      </Link>
    );
  };

  return (
    <nav
      aria-label={t("overview.nav.label")}
      data-testid="mobile-bottom-nav"
      className="fixed inset-x-0 bottom-0 z-40 grid h-[68px] grid-cols-5 items-center border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden dark:border-gray-800 dark:bg-gray-900"
    >
      {items.map(tab)}
      <div className="flex justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("overview.add.button")}
              data-testid="mobile-quick-add"
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full border-4 border-gray-50 bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700 dark:border-gray-950"
            >
              <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" sideOffset={12} className="w-64 p-1.5">
            <QuickAddMenuItems onSelect={requestQuickAdd} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {after.map(tab)}
      <button
        type="button"
        onClick={onMore}
        className="flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-400"
      >
        <Menu className="h-[22px] w-[22px]" aria-hidden="true" />
        {t("overview.nav.more")}
      </button>
    </nav>
  );
}
