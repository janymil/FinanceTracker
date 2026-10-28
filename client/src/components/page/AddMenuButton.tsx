import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { QuickAddMenuItems } from "@/components/QuickAddMenuItems";
import { requestQuickAdd, type QuickAddPreset } from "@/lib/quickAdd";
import { primaryButton } from "./kit";

/**
 * "Add" on a page: the same three ways as the top bar (type, say, scan), opening the same forms,
 * with what the page knows (income on Income, the day on Calendar) already filled in.
 */
export function AddMenuButton({ label, preset, testId }: { label?: string; preset?: QuickAddPreset; testId?: string }) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={primaryButton} data-testid={testId}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {label ?? t("overview.add.button")}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-1.5">
        <QuickAddMenuItems onSelect={(mode) => requestQuickAdd(mode, preset)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
