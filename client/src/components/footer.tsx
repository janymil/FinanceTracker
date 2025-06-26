import { Link } from "wouter";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useTranslation } from 'react-i18next';

interface FooterProps {
  sidebarCollapsed?: boolean;
}

export function Footer({ sidebarCollapsed }: FooterProps) {
  const { t } = useTranslation();
  const handleLinkClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Only apply sidebar margins if sidebarCollapsed is explicitly passed (i.e., we're in AppLayout)
  const sidebarMarginClass = sidebarCollapsed !== undefined 
    ? (sidebarCollapsed ? "lg:ml-16" : "lg:ml-64")
    : "";

  return (
    <footer className={cn(
      "bg-background border-t transition-all duration-300",
      sidebarMarginClass
    )}>
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t("FinanzerPro")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("Take control of your finances with intelligent expense tracking, budgeting, and AI-powered insights.")}
            </p>
            <div className="text-sm text-muted-foreground">
              <p>{t("NutriNova LLC")}</p>
              <p>{t("2105 Vista Oeste NW")}</p>
              <p>{t("Albuquerque, NM 87120")}</p>
              <p>{t("info@finanzerpro.com")}</p>
            </div>
          </div>

          {/* Product */}
          <div className="space-y-4">
            <h4 className="font-semibold">{t("Product")}</h4>
            <ul className="space-y-2 text-sm">
              {/* Pricing removed as requested */}
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h4 className="font-semibold">{t("Support")}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/contact" onClick={handleLinkClick} className="text-muted-foreground hover:text-foreground transition-colors">
                  {t("Contact Us")}
                </Link>
              </li>
              <li>
                <Link href="/help" onClick={handleLinkClick} className="text-muted-foreground hover:text-foreground transition-colors">
                  {t("Help Center")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-6" />
        
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="text-sm text-muted-foreground">
            {t("© 2025 FinanzerPro. All rights reserved.")}
          </div>
          <div className="flex items-center space-x-6 text-sm">
            <Link href="/privacy-policy" onClick={handleLinkClick} className="text-muted-foreground hover:text-foreground transition-colors">
              {t("Privacy Policy")}
            </Link>
            <Link href="/terms-of-service" onClick={handleLinkClick} className="text-muted-foreground hover:text-foreground transition-colors">
              {t("Terms of Service")}
            </Link>
            <Link href="/cookie-policy" onClick={handleLinkClick} className="text-muted-foreground hover:text-foreground transition-colors">
              {t("Cookie Policy")}
            </Link>
            <Link href="/contact" onClick={handleLinkClick} className="text-muted-foreground hover:text-foreground transition-colors">
              {t("Contact")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}