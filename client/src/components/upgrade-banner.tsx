import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, TrendingUp, BarChart3, Download } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { amountFor, currencyForLanguage, formatMoney } from "@shared/pricing";

export default function UpgradeBanner() {
  const { t, i18n } = useTranslation();
  const [location] = useLocation();
  const langMatch = location.match(/^\/([a-z]{2})(?:\/|$)/);
  const currentLang = langMatch ? langMatch[1] : (i18n.language || 'en').slice(0, 2);
  const currency = currencyForLanguage(currentLang);
  const premiumFrom = formatMoney(amountFor('premium', 'monthly', currency), currency);

  return (
    <Card className="bg-gradient-to-r from-premium to-purple-600 text-white border-0">
      <CardContent className="p-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Crown className="h-6 w-6" />
              <h2 className="text-2xl font-bold">{t('upgradeBanner.title')}</h2>
            </div>
            <p className="text-purple-100 mb-6 text-lg">{t('upgradeBanner.subtitle')}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{t('upgradeBanner.charts')}</p>
                  <p className="text-purple-200 text-sm">{t('upgradeBanner.charts_note')}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{t('upgradeBanner.budgets')}</p>
                  <p className="text-purple-200 text-sm">{t('upgradeBanner.budgets_note')}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Download className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{t('upgradeBanner.export')}</p>
                  <p className="text-purple-200 text-sm">{t('upgradeBanner.export_note')}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href={`/${currentLang}/subscribe`}>
              <Button className="bg-white text-premium hover:bg-gray-100 font-medium px-6 py-3">
                <Crown className="h-4 w-4 mr-2" />
                {t('upgradeBanner.cta', { price: premiumFrom })}
              </Button>
            </Link>
            <Link href={`/${currentLang}/pricing`}>
              <Button variant="ghost" className="text-white border-white/30 hover:bg-white/10">
                {t('upgradeBanner.learn_more')}
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
