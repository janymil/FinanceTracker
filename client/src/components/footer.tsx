import { Link, useLocation } from "wouter";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useTranslation } from 'react-i18next';
import { KaptiaLogo } from "@/components/KaptiaLogo";

interface FooterProps {
  sidebarCollapsed?: boolean;
}

export function Footer({ sidebarCollapsed }: FooterProps) {
  const { t } = useTranslation();
  const [location] = useLocation();
  const currentLang = location.match(/^\/([a-z]{2})(?:\/|$)/)?.[1] || localStorage.getItem('preferredLanguage') || 'en';

  const handleLinkClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Only apply sidebar margins if sidebarCollapsed is explicitly passed (i.e., we're in AppLayout)
  const sidebarMarginClass = sidebarCollapsed !== undefined 
    ? (sidebarCollapsed ? "lg:ml-16" : "lg:ml-64")
    : "";

  return (
    <footer className={cn(
      "bg-white/60 dark:bg-[#07080f]/80 backdrop-blur-xl border-t border-gray-200/60 dark:border-white/[0.06] transition-all duration-300 mt-auto",
      sidebarMarginClass
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-2">
              <KaptiaLogo className="h-6 w-6" />
              <span className="font-display text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                Kaptia
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm">
              {t("Snap receipts, speak expenses, and let AI turn your everyday spending into clear, useful insights.")}
            </p>
            <div className="text-xs text-gray-500 dark:text-gray-500 space-y-0.5">
              <p>NutriNova LLC • Albuquerque, NM 87120</p>
              <p>info@kaptia.app</p>
            </div>
          </div>

          {/* Product */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">{t("Product")}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={`/${currentLang}/features`} onClick={handleLinkClick} className="text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-white transition-colors">
                  {t("Features")}
                </Link>
              </li>
              <li>
                <Link href={`/${currentLang}#pricing`} onClick={handleLinkClick} className="text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-white transition-colors">
                  {t("Pricing")}
                </Link>
              </li>
              <li>
                <Link href={`/${currentLang}#how-it-works`} onClick={handleLinkClick} className="text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-white transition-colors">
                  {t("How it works")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">{t("Support")}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={`/${currentLang}/help`} onClick={handleLinkClick} className="text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-white transition-colors">
                  {t("nav.help", "Help Center")}
                </Link>
              </li>
              <li>
                <Link href={`/${currentLang}/contact`} onClick={handleLinkClick} className="text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-white transition-colors">
                  {t("Contact Us")}
                </Link>
              </li>
              <li>
                <Link href={`/${currentLang}#faq`} onClick={handleLinkClick} className="text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-white transition-colors">
                  {t("FAQ")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8 border-gray-200/60 dark:border-white/[0.06]" />
        
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <div>
            {t("© 2025 Kaptia. All rights reserved.")}
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <Link href={`/${currentLang}/privacy-policy`} onClick={handleLinkClick} className="hover:text-gray-900 dark:hover:text-white transition-colors">
              {t("Privacy Policy")}
            </Link>
            <Link href={`/${currentLang}/terms-of-service`} onClick={handleLinkClick} className="hover:text-gray-900 dark:hover:text-white transition-colors">
              {t("Terms of Service")}
            </Link>
            <Link href={`/${currentLang}/cookie-policy`} onClick={handleLinkClick} className="hover:text-gray-900 dark:hover:text-white transition-colors">
              {t("Cookie Policy")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
