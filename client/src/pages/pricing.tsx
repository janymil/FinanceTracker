import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Crown, TrendingUp, Star, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { SEO } from "@/components/SEO";
import { useUser } from "@clerk/clerk-react";
import { AppLayout } from "@/components/AppLayout";
import {
  amountFor,
  currencyForLanguage,
  formatMoney,
  monthlyEquivalent,
  yearlySaving,
  type BillingCurrency,
  type BillingInterval,
  type PlanId,
} from "@shared/pricing";

/**
 * Public price list.
 *
 * Rules this page follows:
 *  - every amount comes from `shared/pricing.ts`, which mirrors the live Stripe prices,
 *    so the number shown is the number charged;
 *  - the currency follows the page language (Spanish -> soles, otherwise dollars);
 *  - all copy lives in the translation files (sk / en / es).
 */
export default function Pricing() {
  const [location, setLocation] = useLocation();
  const { user } = useUser();
  const { t, i18n } = useTranslation();

  const langMatch = location.match(/^\/([a-z]{2})(?:\/|$)/);
  const currentLang = langMatch
    ? langMatch[1]
    : (localStorage.getItem('preferredLanguage') || i18n.language || 'en').slice(0, 2);

  const currency: BillingCurrency = currencyForLanguage(currentLang);

  // Public page: the visitor is not signed in, so nobody's plan is highlighted.
  const userPlan = 'free';

  const go = (path: string) => setLocation(`/${currentLang}${path}`);

  const handleGetStarted = (plan: string) => {
    if (!user) {
      go('/auth');
      return;
    }
    if (plan === 'free') {
      go('/dashboard');
      return;
    }
    go(`/subscribe?plan=${plan}`);
  };

  const money = (plan: PlanId, interval: BillingInterval) =>
    formatMoney(amountFor(plan, interval, currency), currency);

  const featuresOf = (plan: 'free' | PlanId): string[] => {
    const value = t(`pricing.plans.${plan}.features`, { returnObjects: true });
    return Array.isArray(value) ? (value as string[]) : [];
  };

  const isCurrentPlan = (plan: string): boolean => userPlan === plan;

  const buttonLabel = (plan: 'free' | PlanId) => {
    if (isCurrentPlan(plan)) return t('pricing.current_plan');
    return plan === 'free' ? t('pricing.get_started_free') : t('pricing.subscribe_now');
  };

  const planCard = (plan: 'free' | PlanId, interval: BillingInterval) => {
    const isFree = plan === 'free';
    const icon = isFree ? <Star className="h-8 w-8 text-gray-600 dark:text-gray-300" />
      : plan === 'standard' ? <TrendingUp className="h-8 w-8 text-blue-600" />
      : <Crown className="h-8 w-8 text-purple-600" />;
    const iconBg = isFree ? 'bg-gray-100 dark:bg-gray-700'
      : plan === 'standard' ? 'bg-blue-100 dark:bg-blue-900'
      : 'bg-purple-100 dark:bg-purple-900';
    const accent = isFree ? 'text-gray-900 dark:text-white'
      : plan === 'standard' ? 'text-blue-600'
      : 'text-purple-600';
    const border = isCurrentPlan(plan) ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
      : plan === 'standard' ? 'border-blue-500'
      : plan === 'premium' ? 'border-purple-500'
      : '';

    const price = isFree ? formatMoney(0, currency) : money(plan, interval);
    const periodLabel = interval === 'monthly' ? t('pricing.per_month') : t('pricing.per_year');
    const checkoutPlan = interval === 'yearly' ? `${plan}-yearly` : plan;

    return (
      <Card className={`border-2 relative ${border}`}>
        {isCurrentPlan(plan) && (
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
            <Badge className="bg-green-500 text-white px-4 py-1">{t('pricing.current_plan')}</Badge>
          </div>
        )}
        {plan === 'standard' && (
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
            <Badge className="bg-blue-600 text-white px-4 py-1">{t('pricing.most_popular')}</Badge>
          </div>
        )}
        <CardHeader className="text-center pb-8">
          <div className={`${iconBg} p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center`}>
            {icon}
          </div>
          <CardTitle className="text-2xl">{t(`pricing.plans.${plan}.name`)}</CardTitle>
          <div className={`text-4xl font-bold ${accent}`}>
            {price}
            {!isFree && <span className="text-lg font-normal text-gray-500">{periodLabel}</span>}
          </div>
          {!isFree && interval === 'yearly' && (
            <>
              <div className="text-sm text-green-600 font-medium mt-1">
                {t('pricing.save_per_year', {
                  amount: formatMoney(yearlySaving(plan as PlanId, currency), currency),
                })}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {t('pricing.monthly_equivalent', {
                  amount: formatMoney(monthlyEquivalent(plan as PlanId, currency), currency),
                })}
              </div>
            </>
          )}
          <CardDescription className="mt-3">{t(`pricing.plans.${plan}.tagline`)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            {featuresOf(plan).map((feature, index) => (
              <div key={index} className="flex items-center">
                <Check className="h-5 w-5 text-success mr-3 flex-shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
          <Button
            onClick={() => handleGetStarted(isFree ? 'free' : checkoutPlan)}
            className={`w-full mt-6 ${plan === 'standard' ? 'bg-blue-600 hover:bg-blue-700' : plan === 'premium' ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
            variant={isFree ? 'outline' : 'default'}
            disabled={isCurrentPlan(plan)}
          >
            {buttonLabel(plan)}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout isPublicPage={true}>
      <SEO
        title={t('pricing.seo_title')}
        description={t('pricing.seo_description')}
        keywords={t('pricing.seo_keywords')}
        canonical={`https://kaptia.app/${currentLang}/pricing`}
      />
      <div className="min-h-screen bg-[#f7f8fc] dark:bg-[#07080f] text-gray-900 dark:text-white relative bg-grid pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <div className="mb-6">
            <button
              onClick={() => go('')}
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              <span>{t('pricing.back_home')}</span>
            </button>
          </div>
        </div>

        <section className="pt-6 pb-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="max-w-3xl mx-auto">
              <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
                {t('pricing.hero_title')}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                  {' '}{t('pricing.hero_highlight')}
                </span>
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-4">{t('pricing.hero_subtitle')}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {currency === 'pen' ? t('pricing.currency_note_pen') : t('pricing.currency_note_usd')}
              </p>
            </div>
          </div>
        </section>

        <section className="pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Tabs defaultValue="monthly" className="w-full">
              <div className="flex justify-center mb-8">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="monthly">{t('pricing.monthly')}</TabsTrigger>
                  <TabsTrigger value="yearly">{t('pricing.yearly')}</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="monthly">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {planCard('free', 'monthly')}
                  {planCard('standard', 'monthly')}
                  {planCard('premium', 'monthly')}
                </div>
              </TabsContent>

              <TabsContent value="yearly">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {planCard('free', 'yearly')}
                  {planCard('standard', 'yearly')}
                  {planCard('premium', 'yearly')}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

