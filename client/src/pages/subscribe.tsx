import { trackEvent } from '@/lib/analytics';
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Crown, Check, ArrowLeft, CreditCard } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { useBillingRegion } from "@/hooks/useBillingRegion";
import type { PaymentGateway } from "@shared/billingRegion";
import { AutoRenewalNotice } from "@/components/AutoRenewalNotice";
import {
  amountFor,
  formatMoney,
  planKey,
  yearlySaving,
  type BillingCurrency,
  type BillingInterval,
  type PlanId,
} from "@shared/pricing";

export default function Subscribe() {
  const [location, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { t, i18n } = useTranslation();

  const langMatch = location.match(/^\/([a-z]{2})(?:\/|$)/);
  const currentLang = langMatch
    ? langMatch[1]
    : (localStorage.getItem('preferredLanguage') || i18n.language || 'en').slice(0, 2);

  /*
   * The interval the visitor already chose.
   *
   * `/pricing` and the landing price cards send the plan they clicked (`?plan=premium-yearly`),
   * and the landing also remembers it across sign-up (`localStorage.selectedPlan`). Both used to
   * be dropped here, so someone who clicked "Premium yearly" arrived at a page showing monthly —
   * and paying monthly. The query string wins, then the remembered choice, then monthly.
   */
  const query = new URLSearchParams(location.includes('?') ? location.slice(location.indexOf('?')) : '');
  const rememberedPlan = (query.get('plan') || localStorage.getItem('selectedPlan') || '').toLowerCase();
  const initialInterval: BillingInterval =
    query.get('interval') === 'yearly' || rememberedPlan.endsWith('-yearly') ? 'yearly' : 'monthly';
  const rememberedPlanId = rememberedPlan.replace('-yearly', '');
  const [billing, setBilling] = useState<BillingInterval>(initialInterval);

  // Which payment methods this visitor may use. Peru is MercadoPago only; everywhere else the
  // person chooses, because a Peruvian abroad still pays with a Peruvian MercadoPago account.
  const region = useBillingRegion(currentLang);
  const gateways: PaymentGateway[] = region.gateways?.length ? region.gateways : [region.gateway];
  const [chosenMethod, setChosenMethod] = useState<PaymentGateway | null>(null);
  const method: PaymentGateway =
    chosenMethod && gateways.includes(chosenMethod) ? chosenMethod : region.gateway;
  // MercadoPago charges soles, Stripe charges dollars — the page must quote the one being used.
  const currency: BillingCurrency = method === 'mercadopago' ? 'pen' : 'usd';
  const priceLabel = (plan: PlanId, interval: BillingInterval) =>
    formatMoney(amountFor(plan, interval, currency), currency);


  // Get user's current plan and billing interval
  const userPlan = user && 'plan' in user && user.plan ? user.plan : 'free';
  const userBillingInterval = user && 'billingInterval' in user && user.billingInterval ? user.billingInterval : 'monthly';

  /*
   * Somebody already paying. Their next click is a *change*, not a purchase: buying again would
   * create a second subscription — or, in Peru, a second authorisation — for the same access.
   */
  const paysWithMercadoPago = Boolean(user?.mpPreapprovalId) && !user?.stripeSubscriptionId;
  /*
   * A period bought once — Yape, Plin, a transfer — is not a subscription: there is no provider
   * to change it with. It still means "this account is already paying", so it must never be sent
   * into checkout again: that would charge a card on top of the wallet payment.
   */
  const paidUntilMs = user?.paidUntil ? Date.parse(String(user.paidUntil)) : NaN;
  const hasPaidPeriod = Number.isFinite(paidUntilMs) && paidUntilMs > Date.now();
  const hasActiveSubscription = Boolean(
    user && user.plan !== 'free' && (user.stripeSubscriptionId || user.mpPreapprovalId || hasPaidPeriod),
  );

  const isCurrentPlan = (plan: string, interval: 'monthly' | 'yearly') => {
    // For free plan, billing interval doesn't matter
    if (plan === 'free') {
      return userPlan === 'free';
    }
    return userPlan === plan && userBillingInterval === interval;
  };

  /** The plan the person picked on the price page, so the page can point at it. */

  const getButtonText = (plan: string, interval: 'monthly' | 'yearly') => {
    if (isCurrentPlan(plan, interval)) {
      return t('subscribe.current_plan');
    }
    if (hasActiveSubscription) {
      return t('subscribe.change_plan', 'Change to this plan');
    }
    return t('subscribe.subscribe_now');
  };

  /**
   * A plan change goes to the endpoint that edits the subscription that already exists.
   * Everything else is a first purchase.
   */
  const handleChangePlan = async (plan: PlanId, interval: BillingInterval) => {
    // Paid a period with Yape, Plin or a transfer: there is no subscription to edit, and the
    // provider cannot be asked for one. Another period is bought the same way, below the plans.
    if (!paysWithMercadoPago && !user?.stripeSubscriptionId) {
      alert(t('subscribe.change_wallet', 'Your plan was paid for one period. Pay another period the same way, below.'));
      document.querySelector('[data-testid="peru-payments"]')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const token = await window.Clerk?.session?.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'x-user-language': currentLang,
    };

    if (paysWithMercadoPago) {
      const response = await fetch('/api/mercadopago/subscribe', {
        method: 'POST',
        headers,
        body: JSON.stringify({ plan, interval }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.init_point) {
        window.location.href = data.init_point;
        return;
      }
      if (response.ok && data?.changed) {
        alert(data.message || t('subscribe.change_scheduled', 'Your plan change has been applied.'));
        window.location.reload();
        return;
      }
      alert(data?.error || t('subscribe.payment_error'));
      return;
    }

    const response = await fetch('/api/change-subscription', {
      method: 'POST',
      headers,
      body: JSON.stringify({ plan: planKey(plan, interval), currency }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      alert(
        data.type === 'upgrade'
          ? t('subscribe.upgrade_applied', 'Upgraded. The difference is charged now.')
          : t('subscribe.downgrade_scheduled', 'Scheduled. The new plan starts when the paid period ends.'),
      );
      window.location.reload();
      return;
    }
    alert(data?.error || t('subscribe.payment_error'));
  };

  const handleSubscribe = async (plan: string, interval: 'month' | 'year' = 'month') => {
    if (!user) {
      setLocation('/auth');
      return;
    }

    // Already paying: edit the subscription instead of buying a second one.
    if (hasActiveSubscription) {
      setLoading(true);
      try {
        await handleChangePlan(plan as PlanId, interval === 'year' ? 'yearly' : 'monthly');
      } finally {
        setLoading(false);
      }
      return;
    }

    trackEvent('begin_checkout', 'subscription', `${plan}-${interval}`);
    setLoading(true);
    try {
      // Get the Clerk session token for authentication
      const token = await window.Clerk?.session?.getToken();

      const planName = interval === 'year' ? `${plan}-yearly` : plan;

      // The method the person picked decides the gateway: soles through MercadoPago (offered
      // everywhere), dollars by card through Stripe (everywhere except Peru).
      if (currency === 'pen') {
        const mpResponse = await fetch('/api/mercadopago/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-user-language': currentLang,
          },
          body: JSON.stringify({
            plan,
            interval: interval === 'year' ? 'yearly' : 'monthly',
          }),
        });

        const mpData = await mpResponse.json().catch(() => ({}));

        if (mpResponse.ok && mpData?.init_point) {
          window.location.href = mpData.init_point;
          return;
        }

        alert(mpData?.error || t('subscribe.payment_error'));
        setLoading(false);
        return;
      }

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-user-language': currentLang,
        },
        // `currency` makes the server pick the price list that matches what this page showed.
        body: JSON.stringify({ plan: planName, currency }),
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('Full response from server:', responseData);
        const { url } = responseData;
        console.log('Extracted URL:', url);
        
        if (url && url.trim()) {
          console.log('Valid URL found, redirecting to:', url);
          // Redirect to Stripe checkout (shows prorated billing for existing customers)
          window.location.href = url;
          return;
        } else {
          console.error('No valid URL received from checkout session');
          console.error('Response data:', responseData);
          setLoading(false);
        }
      } else {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to create checkout session:', error);
        
        if (error.error === "You are already subscribed to this plan") {
          alert("You are already subscribed to this plan.");
        } else {
          alert(`Subscription error: ${error.error || 'Please try again'}`);
        }
        setLoading(false);
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setLoading(false);
    }
  };

  const plans = {
    standard: {
      name: t('plans.standard'),
      monthlyLabel: priceLabel('standard', 'monthly'),
      yearlyLabel: priceLabel('standard', 'yearly'),
      yearlySavingLabel: formatMoney(yearlySaving('standard', currency), currency),
      features: [
        t('subscribe.plans.standard.features.0'),
        t('subscribe.plans.standard.features.1'),
        t('subscribe.plans.standard.features.2'),
        t('subscribe.plans.standard.features.3'),
        t('subscribe.plans.standard.features.4'),
        t('subscribe.plans.standard.features.5')
      ]
    },
    premium: {
      name: t('plans.premium'),
      monthlyLabel: priceLabel('premium', 'monthly'),
      yearlyLabel: priceLabel('premium', 'yearly'),
      yearlySavingLabel: formatMoney(yearlySaving('premium', currency), currency),
      features: [
        t('subscribe.plans.premium.features.0'),
        t('subscribe.plans.premium.features.1'),
        t('subscribe.plans.premium.features.2'),
        t('subscribe.plans.premium.features.3'),
        t('subscribe.plans.premium.features.4'),
        t('subscribe.plans.premium.features.5'),
        t('subscribe.plans.premium.features.6'),
        t('subscribe.plans.premium.features.7')
      ]
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <Button 
              variant="outline" 
              onClick={() => setLocation(`/${currentLang}`)}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('subscribe.back_to_home')}
            </Button>
            <h1 className="text-4xl font-bold mb-4">{t('subscribe.title')}</h1>
            <p className="text-gray-600 dark:text-gray-300">
              {t('subscribe.subtitle')}
            </p>
            {currency === 'pen' && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2" data-testid="mercadopago-note">
                {t('subscribe.mercadopago_note')}
              </p>
            )}
            {gateways.length > 1 && (
              <div
                className="mt-4 flex flex-wrap items-center justify-center gap-2"
                data-testid="payment-method"
              >
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {t('subscribe.pay_method')}
                </span>
                <Button
                  size="sm"
                  variant={method === 'stripe' ? 'default' : 'outline'}
                  data-testid="pay-method-stripe"
                  onClick={() => setChosenMethod('stripe')}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  {t('subscribe.pay_method_card')}
                </Button>
                <Button
                  size="sm"
                  variant={method === 'mercadopago' ? 'default' : 'outline'}
                  data-testid="pay-method-mercadopago"
                  onClick={() => setChosenMethod('mercadopago')}
                >
                  {t('subscribe.pay_method_mercadopago')}
                </Button>
              </div>
            )}
          </div>

          {/* Billing Toggle */}
          <Tabs value={billing} onValueChange={(value) => setBilling(value as BillingInterval)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8">
              <TabsTrigger value="monthly">{t('subscribe.billing.monthly')}</TabsTrigger>
              <TabsTrigger value="yearly">
                {t('subscribe.billing.yearly')}
                <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800">
                  {t('subscribe.billing.save_percentage')}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="monthly">
              <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                {/* Standard Plan */}
                <Card className={`relative ${isCurrentPlan('standard', 'monthly') ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}`}>
                  {isCurrentPlan('standard', 'monthly') && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-green-700 text-white px-4 py-1">
                        {t('subscribe.current_plan')}
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-8 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-transparent">
                    <div className="p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-blue-100 dark:bg-blue-900">
                      <TrendingUp className="h-8 w-8 text-blue-600" />
                    </div>
                    <CardTitle className="text-3xl">{t('subscribe.plan_title', { plan: plans.standard.name })}</CardTitle>
                    <div className="text-5xl font-bold mb-2 text-blue-600">
                      {plans.standard.monthlyLabel}
                      <span className="text-lg font-normal text-gray-500">{t('subscribe.per_month')}</span>
                    </div>
                    <CardDescription>{t('subscribe.billing_description')}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="space-y-4 mb-8">
                      {plans.standard.features.map((feature, index) => (
                        <div key={index} className="flex items-center">
                          <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    <Button 
                      onClick={() => !isCurrentPlan('standard', 'monthly') && handleSubscribe('standard', 'month')}
                      data-testid="subscribe-standard-monthly"
                      disabled={loading || isCurrentPlan('standard', 'monthly')}
                      className={`w-full py-6 text-lg ${
                        isCurrentPlan('standard', 'monthly') 
                          ? 'bg-green-600 hover:bg-green-600 cursor-default' 
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {isCurrentPlan('standard', 'monthly') ? (
                        <>
                          <Badge className="h-5 w-5 mr-2" />
                          {getButtonText('standard', 'monthly')}
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-5 w-5 mr-2" />
                          {loading ? t('subscribe.processing') : t('subscribe.subscribe_for_month', { price: plans.standard.monthlyLabel })}
                        </>
                      )}
                    </Button>
                    <AutoRenewalNotice plan="standard" interval="monthly" currency={currency} lang={currentLang} />
                  </CardContent>
                </Card>

                {/* Premium Plan */}
                <Card className={`relative ${
                  isCurrentPlan('premium', 'monthly') 
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                    : 'border-purple-200 dark:border-purple-800'
                }`}>
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className={`px-4 py-1 ${
                      isCurrentPlan('premium', 'monthly')
                        ? 'bg-green-700 text-white'
                        : 'bg-purple-600 text-white'
                    }`}>
                      {isCurrentPlan('premium', 'monthly') ? (
                        t('subscribe.current_plan')
                      ) : (
                        <>
                          <Crown className="h-3 w-3 mr-1" />
                          {t('subscribe.most_popular')}
                        </>
                      )}
                    </Badge>
                  </div>
                  <CardHeader className="text-center pb-8 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-transparent">
                    <div className="p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-purple-100 dark:bg-purple-900">
                      <Crown className="h-8 w-8 text-purple-600" />
                    </div>
                    <CardTitle className="text-3xl">{t('subscribe.plan_title', { plan: plans.premium.name })}</CardTitle>
                    <div className="text-5xl font-bold mb-2 text-purple-600">
                      {plans.premium.monthlyLabel}
                      <span className="text-lg font-normal text-gray-500">{t('subscribe.per_month')}</span>
                    </div>
                    <CardDescription>{t('subscribe.billing_description')}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="space-y-4 mb-8">
                      {plans.premium.features.map((feature, index) => (
                        <div key={index} className="flex items-center">
                          <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    <Button 
                      onClick={() => !isCurrentPlan('premium', 'monthly') && handleSubscribe('premium', 'month')}
                      data-testid="subscribe-premium-monthly"
                      disabled={loading || isCurrentPlan('premium', 'monthly')}
                      className={`w-full py-6 text-lg ${
                        isCurrentPlan('premium', 'monthly') 
                          ? 'bg-green-600 hover:bg-green-600 cursor-default' 
                          : 'bg-purple-600 hover:bg-purple-700'
                      }`}
                    >
                      {isCurrentPlan('premium', 'monthly') ? (
                        <>
                          <Badge className="h-5 w-5 mr-2" />
                          {getButtonText('premium', 'monthly')}
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-5 w-5 mr-2" />
                          {loading ? t('subscribe.processing') : t('subscribe.subscribe_for_month', { price: plans.premium.monthlyLabel })}
                        </>
                      )}
                    </Button>
                    <AutoRenewalNotice plan="premium" interval="monthly" currency={currency} lang={currentLang} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="yearly">
              <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                {/* Standard Plan - Yearly */}
                <Card className={`relative ${isCurrentPlan('standard', 'yearly') ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}`}>
                  {isCurrentPlan('standard', 'yearly') && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-green-700 text-white px-4 py-1">
                        {t('subscribe.current_plan')}
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-8 bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-transparent">
                    <div className="p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-blue-100 dark:bg-blue-900">
                      <TrendingUp className="h-8 w-8 text-blue-600" />
                    </div>
                    <CardTitle className="text-3xl">{t('subscribe.plan_title', { plan: plans.standard.name })}</CardTitle>
                    <div className="text-5xl font-bold mb-2 text-blue-600">
                      {plans.standard.yearlyLabel}
                      <span className="text-lg font-normal text-gray-500">{t('subscribe.per_year')}</span>
                    </div>
                    <CardDescription>
                      {t('subscribe.save_per_year', { amount: plans.standard.yearlySavingLabel })}
                    </CardDescription>
                    <Badge className="mt-2 bg-green-100 text-green-800">
                      {t('subscribe.discount_percentage')}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="space-y-4 mb-8">
                      {plans.standard.features.map((feature, index) => (
                        <div key={index} className="flex items-center">
                          <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    <Button 
                      onClick={() => !isCurrentPlan('standard', 'yearly') && handleSubscribe('standard', 'year')}
                      data-testid="subscribe-standard-yearly"
                      disabled={loading || isCurrentPlan('standard', 'yearly')}
                      className={`w-full py-6 text-lg ${
                        isCurrentPlan('standard', 'yearly') 
                          ? 'bg-green-600 hover:bg-green-600 cursor-default' 
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {isCurrentPlan('standard', 'yearly') ? (
                        <>
                          <Badge className="h-5 w-5 mr-2" />
                          {getButtonText('standard', 'yearly')}
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-5 w-5 mr-2" />
                          {loading ? t('subscribe.processing') : t('subscribe.subscribe_for_year', { price: plans.standard.yearlyLabel })}
                        </>
                      )}
                    </Button>
                    <AutoRenewalNotice plan="standard" interval="yearly" currency={currency} lang={currentLang} />
                  </CardContent>
                </Card>

                {/* Premium Plan - Yearly */}
                <Card className={`relative ${
                  isCurrentPlan('premium', 'yearly') 
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                    : 'border-purple-200 dark:border-purple-800'
                }`}>
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className={`px-4 py-1 ${
                      isCurrentPlan('premium', 'yearly')
                        ? 'bg-green-700 text-white'
                        : 'bg-purple-600 text-white'
                    }`}>
                      {isCurrentPlan('premium', 'yearly') ? (
                        t('subscribe.current_plan')
                      ) : (
                        <>
                          <Crown className="h-3 w-3 mr-1" />
                          {t('subscribe.best_value')}
                        </>
                      )}
                    </Badge>
                  </div>
                  <CardHeader className="text-center pb-8 bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-transparent">
                    <div className="p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-purple-100 dark:bg-purple-900">
                      <Crown className="h-8 w-8 text-purple-600" />
                    </div>
                    <CardTitle className="text-3xl">{t('subscribe.plan_title', { plan: plans.premium.name })}</CardTitle>
                    <div className="text-5xl font-bold mb-2 text-purple-600">
                      {plans.premium.yearlyLabel}
                      <span className="text-lg font-normal text-gray-500">{t('subscribe.per_year')}</span>
                    </div>
                    <CardDescription>
                      {t('subscribe.save_per_year', { amount: plans.premium.yearlySavingLabel })}
                    </CardDescription>
                    <Badge className="mt-2 bg-green-100 text-green-800">
                      {t('subscribe.best_value_discount')}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="space-y-4 mb-8">
                      {plans.premium.features.map((feature, index) => (
                        <div key={index} className="flex items-center">
                          <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    <Button 
                      onClick={() => !isCurrentPlan('premium', 'yearly') && handleSubscribe('premium', 'year')}
                      data-testid="subscribe-premium-yearly"
                      disabled={loading || isCurrentPlan('premium', 'yearly')}
                      className={`w-full py-6 text-lg ${
                        isCurrentPlan('premium', 'yearly') 
                          ? 'bg-green-600 hover:bg-green-600 cursor-default' 
                          : 'bg-purple-600 hover:bg-purple-700'
                      }`}
                    >
                      {isCurrentPlan('premium', 'yearly') ? (
                        <>
                          <Badge className="h-5 w-5 mr-2" />
                          {getButtonText('premium', 'yearly')}
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-5 w-5 mr-2" />
                          {loading ? t('subscribe.processing') : t('subscribe.subscribe_for_year', { price: plans.premium.yearlyLabel })}
                        </>
                      )}
                    </Button>
                    <AutoRenewalNotice plan="premium" interval="yearly" currency={currency} lang={currentLang} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* ============ PERU: Yape / Plin / transfer, and the tax document ============ */}
          {currency === 'pen' && (
            <PeruPayments lang={currentLang} signedIn={Boolean(user)} defaultPlan={rememberedPlanId === 'standard' ? 'standard' : 'premium'} defaultInterval={initialInterval} />
          )}


          {/* Only show sign-in text for non-logged-in users */}
          {!user && (
            <div className="text-center mt-8">
              <p className="text-gray-600 dark:text-gray-300">
                {t('subscribe.already_have_account')}{' '}
                <a 
                  href="/auth"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  {t('subscribe.sign_in_here')}
                </a>
              </p>
            </div>
          )}

          {/* Security & Terms */}
          <div className="text-center mt-8 space-y-2">
            <p className="text-sm text-gray-500">
              {method === 'mercadopago'
                ? t('subscribe.secure_payment_mercadopago')
                : t('subscribe.secure_payment')}
            </p>
            <p className="text-xs text-gray-400">
              {t('subscribe.terms_agreement')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

/**
 * Paying in Peru without a card: Yape, Plin or a bank transfer.
 *
 * These cannot start a repeating charge — MercadoPago's subscriptions are cards only, and Yape's
 * approval token is single-use — so what is sold here is **one period**, confirmed by a person
 * before access opens. The block says that in plain words instead of borrowing the auto-renewal
 * notice from the card section, which would be a promise nothing here can keep.
 *
 * The same block asks for the boleta/factura data, because the document is issued by hand in
 * SUNAT and this is the only moment the customer is looking at the amount.
 */
function PeruPayments({
  lang,
  signedIn,
  defaultPlan,
  defaultInterval,
}: {
  lang: string;
  signedIn: boolean;
  defaultPlan: PlanId;
  defaultInterval: BillingInterval;
}) {
  const { t } = useTranslation();
  const [plan, setPlan] = useState<PlanId>(defaultPlan);
  const [interval, setInterval] = useState<BillingInterval>(defaultInterval);
  const [method, setMethod] = useState<'yape' | 'plin' | 'transfer'>('yape');
  const [operationNumber, setOperationNumber] = useState('');
  const [payerName, setPayerName] = useState('');
  const [kind, setKind] = useState<'boleta' | 'factura'>('boleta');
  const [documentType, setDocumentType] = useState<'dni' | 'ruc'>('dni');
  const [documentNumber, setDocumentNumber] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [fiscalAddress, setFiscalAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const amount = formatMoney(amountFor(plan, interval, 'pen'), 'pen');

  const headers = async (): Promise<Record<string, string>> => {
    const token = await window.Clerk?.session?.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'x-user-language': lang,
    };
  };

  const saveTaxData = async () => {
    if (!documentNumber) return true;
    const response = await fetch('/api/billing-profile', {
      method: 'PUT',
      headers: await headers(),
      body: JSON.stringify({
        kind,
        documentType,
        documentNumber,
        businessName: businessName || undefined,
        fiscalAddress: fiscalAddress || undefined,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data?.error || t('subscribe.peru.tax_error', 'Check the document data.'));
      return false;
    }
    return true;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      if (!signedIn) {
        window.location.href = `/${lang}/auth`;
        return;
      }
      if (!(await saveTaxData())) return;

      const response = await fetch('/api/payments/manual', {
        method: 'POST',
        headers: await headers(),
        body: JSON.stringify({
          plan,
          interval,
          method,
          operationNumber,
          payerName: payerName || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || t('subscribe.payment_error'));
        return;
      }
      setResult(
        t(
          'subscribe.peru.sent',
          'We received your payment details. We activate the plan once it is confirmed, usually within one working day.',
        ),
      );
      setOperationNumber('');
    } catch {
      setError(t('subscribe.payment_error'));
    } finally {
      setBusy(false);
    }
  };


  const field =
    'mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0f111a] px-3 py-2 text-sm';

  return (
    <div className="mt-12 max-w-3xl mx-auto" data-testid="peru-payments">
      <Card>
        <CardHeader>
          <CardTitle>{t('subscribe.peru.title', 'Pay with Yape, Plin or a bank transfer')}</CardTitle>
          <CardDescription>
            {t(
              'subscribe.peru.subtitle',
              'Peru only. This payment covers one period and does not renew automatically: we remind you before it ends.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm font-medium">
                {t('subscribe.peru.plan', 'Plan')}
                <select className={field} value={plan} onChange={(e) => setPlan(e.target.value as PlanId)}>
                  <option value="standard">{t('plans.standard')} — {formatMoney(amountFor('standard', interval, 'pen'), 'pen')}</option>
                  <option value="premium">{t('plans.premium')} — {formatMoney(amountFor('premium', interval, 'pen'), 'pen')}</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                {t('subscribe.peru.period', 'Period')}
                <select className={field} value={interval} onChange={(e) => setInterval(e.target.value as BillingInterval)}>
                  <option value="monthly">{t('subscribe.billing.monthly')}</option>
                  <option value="yearly">{t('subscribe.billing.yearly')}</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                {t('subscribe.peru.method', 'How you paid')}
                <select
                  className={field}
                  value={method}
                  onChange={(e) => setMethod(e.target.value as 'yape' | 'plin' | 'transfer')}
                >
                  <option value="yape">Yape</option>
                  <option value="plin">Plin</option>
                  <option value="transfer">{t('subscribe.peru.transfer', 'Bank transfer')}</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                {t('subscribe.peru.operation', 'Operation number')}
                <Input
                  className="mt-1"
                  required
                  maxLength={64}
                  value={operationNumber}
                  onChange={(e) => setOperationNumber(e.target.value)}
                  placeholder={t('subscribe.peru.operation_hint', 'The code your app gave you')}
                />
              </label>
            </div>


            <fieldset className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
              <legend className="px-1 text-sm font-semibold">
                {t('subscribe.peru.tax_title', 'Your boleta or factura')}
              </legend>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-sm">
                  {t('subscribe.peru.tax_kind', 'Document')}
                  <select
                    className={field}
                    value={kind}
                    onChange={(e) => {
                      const value = e.target.value as 'boleta' | 'factura';
                      setKind(value);
                      setDocumentType(value === 'factura' ? 'ruc' : 'dni');
                    }}
                  >
                    <option value="boleta">{t('subscribe.peru.boleta', 'Boleta (DNI)')}</option>
                    <option value="factura">{t('subscribe.peru.factura', 'Factura (RUC)')}</option>
                  </select>
                </label>
                <label className="text-sm">
                  {documentType === 'ruc' ? 'RUC' : 'DNI'}
                  <Input
                    className="mt-1"
                    inputMode="numeric"
                    maxLength={11}
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder={documentType === 'ruc' ? '20123456789' : '12345678'}
                  />
                </label>
                {kind === 'factura' && (
                  <>
                    <label className="text-sm">
                      {t('subscribe.peru.business_name', 'Razón social')}
                      <Input className="mt-1" maxLength={160} value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                    </label>
                    <label className="text-sm">
                      {t('subscribe.peru.fiscal_address', 'Fiscal address')}
                      <Input className="mt-1" maxLength={240} value={fiscalAddress} onChange={(e) => setFiscalAddress(e.target.value)} />
                    </label>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t(
                  'subscribe.peru.tax_note',
                  'Your document is issued in SUNAT and sent to your e-mail. Keep your data exact: a factura with the wrong RUC cannot be corrected.',
                )}
              </p>
            </fieldset>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">
                {busy ? t('subscribe.processing') : t('subscribe.peru.submit', 'I paid — confirm my payment')}
              </Button>
              <span className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">{amount}</span>
            </div>

            {result && (
              <p className="text-sm text-emerald-700 dark:text-emerald-400" data-testid="peru-payments-sent">
                {result}
              </p>
            )}
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

}