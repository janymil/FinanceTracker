import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * The two dialogs that edit AI usage limits, lifted out of `admin-analytics.tsx`.
 *
 * That page is a single component of ~2,500 lines; these two blocks were the cleanest seam
 * because they own no data — they only render and edit the draft object the page hands them,
 * and the page still performs the save. Extracting them here leaves the page's state where it
 * was, so nothing about when a limit is loaded or saved changed. The remaining sections of
 * that page still need a running admin session before they can be moved safely.
 */

/** One row of the per-plan / per-function limit table while it is being edited. */
export interface LimitDraft {
  plan: string;
  functionName: string;
  monthlyRequestLimit: number;
  monthlyCostLimit: string | number;
  dailyRequestLimit: number;
  cooldownSeconds: number;
  description: string;
}

/** A per-user override, whose numeric fields are optional (empty means "use the plan's"). */
export interface UserOverrideDraft {
  userId: string;
  functionName: string;
  monthlyRequestLimit: number | null;
  monthlyCostLimit: string | number | null;
  isBlocked: boolean;
  reason: string;
}

const AI_FUNCTIONS = [
  { value: "categorizeExpense", label: "Expense Categorization" },
  { value: "generateFinancialTips", label: "Financial Tips" },
  { value: "generateContextualFinancialTips", label: "Contextual Tips" },
  { value: "generateDailyRecommendations", label: "Daily Recommendations" },
  { value: "generateSpendingInsights", label: "Spending Insights" },
  { value: "generateAIFinancialHealthScore", label: "Health Score" },
  { value: "generateTrendPredictions", label: "Trend Predictions" },
  { value: "generateExpensePredictions", label: "Expense Predictions" },
  { value: "parseBankStatement", label: "Bank Statement Parser" },
  { value: "generateFinancialMascot", label: "DALL-E Mascot" },
] as const;

interface DraftDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: T | null;
  onDraftChange: (update: (current: T) => T) => void;
  onSave: () => void;
  isSaving: boolean;
}

export function EditLimitDialog({
  open,
  onOpenChange,
  draft,
  onDraftChange,
  onSave,
  isSaving,
}: DraftDialogProps<LimitDraft>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Usage Limit</DialogTitle>
          <DialogDescription>
            Configure usage limits for {draft?.plan} plan - {draft?.functionName}
          </DialogDescription>
        </DialogHeader>
        {draft && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="monthlyRequests">Monthly Request Limit</Label>
              <Input
                id="monthlyRequests"
                type="number"
                value={draft.monthlyRequestLimit}
                onChange={(e) =>
                  onDraftChange((current) => ({
                    ...current,
                    monthlyRequestLimit: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="monthlyCost">Monthly Cost Limit ($)</Label>
              <Input
                id="monthlyCost"
                type="number"
                step="0.01"
                value={draft.monthlyCostLimit}
                onChange={(e) => onDraftChange((current) => ({ ...current, monthlyCostLimit: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="dailyRequests">Daily Request Limit</Label>
              <Input
                id="dailyRequests"
                type="number"
                value={draft.dailyRequestLimit}
                onChange={(e) =>
                  onDraftChange((current) => ({
                    ...current,
                    dailyRequestLimit: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="cooldown">Cooldown (seconds)</Label>
              <Input
                id="cooldown"
                type="number"
                value={draft.cooldownSeconds}
                onChange={(e) =>
                  onDraftChange((current) => ({
                    ...current,
                    cooldownSeconds: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={draft.description}
                onChange={(e) => onDraftChange((current) => ({ ...current, description: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={onSave} disabled={isSaving} className="flex-1">
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function UserOverrideDialog({
  open,
  onOpenChange,
  draft,
  onDraftChange,
  onSave,
  isSaving,
}: DraftDialogProps<UserOverrideDraft>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>User Override</DialogTitle>
          <DialogDescription>Set custom AI usage limits for a specific user</DialogDescription>
        </DialogHeader>
        {draft && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                value={draft.userId}
                onChange={(e) => onDraftChange((current) => ({ ...current, userId: e.target.value }))}
                placeholder="Enter Clerk user ID"
              />
            </div>
            <div>
              <Label htmlFor="functionNameOverride">Function Name</Label>
              <Select
                value={draft.functionName}
                onValueChange={(value) => onDraftChange((current) => ({ ...current, functionName: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select function" />
                </SelectTrigger>
                <SelectContent>
                  {AI_FUNCTIONS.map((fn) => (
                    <SelectItem key={fn.value} value={fn.value}>
                      {fn.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="monthlyRequestsOverride">Monthly Request Limit (optional)</Label>
              <Input
                id="monthlyRequestsOverride"
                type="number"
                value={draft.monthlyRequestLimit || ''}
                onChange={(e) =>
                  onDraftChange((current) => ({
                    ...current,
                    monthlyRequestLimit: e.target.value ? parseInt(e.target.value) : null,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="monthlyCostOverride">Monthly Cost Limit ($, optional)</Label>
              <Input
                id="monthlyCostOverride"
                type="number"
                step="0.01"
                value={draft.monthlyCostLimit || ''}
                onChange={(e) =>
                  onDraftChange((current) => ({ ...current, monthlyCostLimit: e.target.value || null }))
                }
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isBlocked"
                checked={draft.isBlocked}
                onChange={(e) => onDraftChange((current) => ({ ...current, isBlocked: e.target.checked }))}
              />
              <Label htmlFor="isBlocked">Block user from this function</Label>
            </div>
            {draft.isBlocked && (
              <div>
                <Label htmlFor="reason">Reason for blocking</Label>
                <Input
                  id="reason"
                  value={draft.reason}
                  onChange={(e) => onDraftChange((current) => ({ ...current, reason: e.target.value }))}
                  placeholder="Enter reason for blocking"
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={onSave} disabled={isSaving} className="flex-1">
                {isSaving ? "Saving..." : "Save Override"}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

