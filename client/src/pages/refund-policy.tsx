import { Link, useLocation } from "wouter";
import { SEO } from "@/components/SEO";
import { AppLayout } from "@/components/AppLayout";
import { useTranslation } from 'react-i18next';

export default function RefundPolicy() {
  const [location] = useLocation();
  const { t } = useTranslation();
  const currentLang = location.match(/^\/([a-z]{2})(?:\/|$)/)?.[1] || localStorage.getItem('preferredLanguage') || 'en';

  return (
    <AppLayout>
      <SEO
        title={t("refund.seo.title")}
        description={t("refund.seo.description")}
        canonical={`https://kaptia.app/${currentLang}/refund-policy`}
      />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">{t("refund.title")}</h1>
        <p className="text-muted-foreground mb-8">{t("refund.last_updated")}</p>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg my-6">
          <h3 className="text-base font-semibold text-blue-900 dark:text-blue-200 mb-1">{t("refund.summary_title")}</h3>
          <p className="text-sm text-blue-800 dark:text-blue-300">{t("refund.summary_text")}</p>
        </div>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("refund.cancel_title")}</h2>
            <p className="mb-4">{t("refund.cancel_desc")}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("refund.after_title")}</h2>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>{t("refund.after_1")}</li>
              <li>{t("refund.after_2")}</li>
              <li>{t("refund.after_3")}</li>
              <li>{t("refund.after_4")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("refund.rules_title")}</h2>
            <p className="mb-4">{t("refund.rules_desc")}</p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>{t("refund.rules_yes_1")}</li>
              <li>{t("refund.rules_yes_2")}</li>
              <li>{t("refund.rules_yes_3")}</li>
              <li>{t("refund.rules_yes_4")}</li>
            </ul>
            <p className="mb-4">{t("refund.rules_window")}</p>
            <h3 className="text-lg font-semibold mb-2">{t("refund.rules_no_title")}</h3>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>{t("refund.rules_no_1")}</li>
              <li>{t("refund.rules_no_2")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("refund.yearly_title")}</h2>
            <p className="mb-4">{t("refund.yearly_desc")}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("refund.how_title")}</h2>
            <p className="mb-4">{t("refund.how_desc")}</p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>{t("refund.how_1")}</li>
              <li>{t("refund.how_2")}</li>
              <li>{t("refund.how_3")}</li>
            </ul>
            <p className="mb-4">{t("refund.how_after")}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("refund.law_title")}</h2>
            <p className="mb-4">
              {t("refund.law_desc")}{" "}
              <Link href={`/${currentLang}/reclamaciones`} className="text-indigo-600 dark:text-indigo-300 underline">
                {t("refund.law_link")}
              </Link>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("refund.contact_title")}</h2>
            <p className="mb-4">{t("refund.contact_desc")}</p>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
