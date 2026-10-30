import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { needsAiConsent } from "@shared/aiConsent";

/**
 * What actually leaves the server, told feature by feature.
 *
 * The previous text was one sentence covering four functions and calling all of it "a small
 * piece of your data" — which is false in the direction that matters: a scanned receipt leaves
 * with the identifying lines blacked out, and automatic categories carry a shop and an amount,
 * not a person. Only the voice note leaves as recorded. Each row below names the payload the
 * code really sends, including the one place where a personal name can ride along: the names of
 * the categories the person created themselves (`userCategories` in `/api/auto-categorize`).
 */
const LEAVES = [
  {
    key: "receipts",
    title: "Scanning a receipt",
    detail:
      "The photo of the receipt, with the lines carrying the name, DNI or RUC, address, phone and account numbers blacked out. Only merchant, amounts and date are read.",
  },
  {
    key: "voice",
    title: "Voice note",
    detail:
      "The audio exactly as you record it, because the audio is what becomes text; that text is cleaned before it is analysed.",
  },
  {
    key: "categories",
    title: "Automatic categories",
    detail:
      "The merchant name, the amount, the description you type and the names of the categories you created yourself.",
  },
  {
    key: "tips",
    title: "Tips and reports",
    detail: "Totals per category, amounts and dates of your entries.",
  },
] as const;

/**
 * The AI question, asked once, at signup.
 *
 * Until this existed, `ai_enabled` defaulted to true: a brand-new account had voice input,
 * receipt scanning and categorisation switched on before anyone asked, while the privacy policy
 * said those functions were optional and consented. The default is now false and this is the
 * ask, so the answer in the database is one the person actually gave.
 *
 * It renders nothing unless the account says it was never asked (`aiConsentDecidedAt` is null —
 * see `shared/aiConsent.ts`). Failing open matters more than being shown: this is a full-screen
 * overlay on the first page a new customer sees, so an exception here would take the app with
 * it. Any problem leaves the overlay closed and the account on its safe default.
 */
export function AiConsentDialog() {
  const { user, isAuthenticated } = useAuth();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);

  const language = String(i18n.language || "en").slice(0, 2).toLowerCase();
  const policyHref = `/${["en", "es", "sk"].includes(language) ? language : "en"}/privacy`;

  const answer = async (allow: boolean) => {
    setSaving(allow);
    setFailed(false);
    try {
      // The server stamps when it was answered; the body only carries the choice.
      await apiRequest("PUT", "/api/auth/user", { aiEnabled: allow });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch {
      setFailed(true);
    } finally {
      setSaving(null);
    }
  };

  let mustAsk = false;
  try {
    mustAsk = Boolean(isAuthenticated) && needsAiConsent(user as { aiConsentDecidedAt?: string | null } | null);
  } catch {
    mustAsk = false;
  }
  if (!mustAsk) return null;

  const busy = saving !== null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-consent-title"
      aria-describedby="ai-consent-body"
    >
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#0f111a]">
        <div className="mb-3 flex items-center gap-2 text-indigo-600 dark:text-indigo-300">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em]">
            {t("aiConsent.eyebrow", "Your data")}
          </span>
        </div>

        <h2 id="ai-consent-title" className="font-display text-xl font-bold">
          {t("aiConsent.title", "Can Kaptia use AI with your data?")}
        </h2>
        <p id="ai-consent-body" className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {t(
            "aiConsent.body",
            "Apart from the voice note, none of this carries your name, your document or your account numbers. This is what leaves in each case:"
          )}
        </p>
        <dl className="mt-3 space-y-2 text-sm" data-testid="ai-consent-leaves">
          {LEAVES.map((item) => (
            <div key={item.key}>
              <dt className="font-medium text-gray-800 dark:text-gray-100">
                {t(`aiConsent.${item.key}_title`, item.title)}
              </dt>
              <dd className="text-gray-600 dark:text-gray-300">
                {t(`aiConsent.${item.key}_detail`, item.detail)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {t(
            "aiConsent.note",
            "AI features come with the paid plans. Answering now sets the switch for when you upgrade, and you can change it any time in your profile."
          )}
        </p>

        {failed && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {t("aiConsent.failed", "We could not save your choice. Try again.")}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <Button
            type="button"
            disabled={busy}
            onClick={() => answer(true)}
            className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 font-medium text-white hover:from-blue-500 hover:to-purple-500"
          >
            {saving === true ? t("aiConsent.saving", "Saving…") : t("aiConsent.allow", "Yes, use AI features")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => answer(false)}
            className="h-11 w-full rounded-xl font-medium"
          >
            {saving === false ? t("aiConsent.saving", "Saving…") : t("aiConsent.decline", "No, keep AI off")}
          </Button>
        </div>

        <a
          href={policyHref}
          className="mt-4 block text-center text-xs text-gray-500 underline underline-offset-2 dark:text-gray-400"
        >
          {t("aiConsent.privacy_link", "Read the privacy policy")}
        </a>
      </div>
    </div>
  );
}
