import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import {
  amountFor,
  formatMoney,
  type BillingCurrency,
  type BillingInterval,
  type PlanId,
} from "@shared/pricing";

interface AutoRenewalNoticeProps {
  plan: PlanId;
  interval: BillingInterval;
  currency: BillingCurrency;
  lang: string;
}

/**
 * Shown next to every buy button. Subscription law in the United States (FTC and state
 * auto-renewal rules) and consumer law in Peru expect the renewal terms to be visible
 * before payment, with the price taken from the same table that is charged.
 */
export function AutoRenewalNotice({ plan, interval, currency, lang }: AutoRenewalNoticeProps) {
  const { t } = useTranslation();
  const price = formatMoney(amountFor(plan, interval, currency), currency);
  const period = t(interval === "yearly" ? "checkout.period_yearly" : "checkout.period_monthly");

  return (
    <p className="mt-3 text-xs text-center text-gray-500 dark:text-gray-400" data-testid="auto-renewal-notice">
      {t("checkout.auto_renewal", { price, period })}{" "}
      <Link href={`/${lang}/terms-of-service`} className="underline">
        {t("checkout.auto_renewal_terms")}
      </Link>
    </p>
  );
}
