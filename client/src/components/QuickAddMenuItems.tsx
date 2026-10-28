import { Camera, Mic, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { QuickAddMode } from "@/lib/quickAdd";

const ITEMS: Array<{ mode: QuickAddMode; icon: typeof Pencil; tile: string }> = [
  { mode: "type", icon: Pencil, tile: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  { mode: "voice", icon: Mic, tile: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  { mode: "scan", icon: Camera, tile: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
];

/** The three ways to add a transaction, as menu items. Shared by the top bar and the phone's bottom bar. */
export function QuickAddMenuItems({ onSelect }: { onSelect: (mode: QuickAddMode) => void }) {
  const { t } = useTranslation();
  return (
    <>
      {ITEMS.map(({ mode, icon: Icon, tile }) => (
        <DropdownMenuItem
          key={mode}
          onSelect={() => onSelect(mode)}
          className="flex cursor-pointer items-center gap-3 rounded-lg p-2.5"
          data-testid={`quick-add-${mode}`}
        >
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tile}`}>
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{t(`overview.add.${mode}`)}</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">{t(`overview.add.${mode}_desc`)}</span>
          </span>
        </DropdownMenuItem>
      ))}
    </>
  );
}
