import { trackEvent } from '@/lib/analytics';
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Crown, Check, ArrowLeft, CreditCard } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { useBillingRegion } from "@/hooks/useBillingRegion";
import type { PaymentGateway } from "@shared/billingRegion";
import { AutoRenewalNotice } from "@/components/AutoRenewalNotice";
import { PeruCheckoutDialog } from "@/components/checkout/PeruCheckoutDialog";
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

  /*
   * Where the Peru checkout opens.
   *
   * The Yape / Plin / transfer form used to be rendered *below* the plans, so the visitor had
   * to scroll past the cards to find the only payment method that needed explaining, and the
   * plan they clicked was asked again by a <select>. Clicking a plan now opens one dialog that
   * carries the plan, the period, the account to send to and the boleta/factura fields.
   */
  const [peruCheckout, setPeruCheckout] = useState<{ plan: PlanId; interval: BillingInterval } | null>(null);

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
    // provider cannot be asked for one. Another period is bought the same way, in the dialog.
    if (!paysWithMercadoPago && !user?.stripeSubscriptionId) {
      setPeruCheckout({ plan, interval });
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

    const intervalKey: BillingInterval = interval === 'year' ? 'yearly' : 'monthly';

    // Already paying: edit the subscription instead of buying a second one.
    if (hasActiveSubscription) {
      setLoading(true);
      try {
        await handleChangePlan(plan as PlanId, intervalKey);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Soles are charged through MercadoPago, which sells both a card subscription and the
    // wallets. Which one, the account to pay into and the boleta/factura are one dialog now:
    // nothing leaves this page until the person has seen all three.
    if (method === 'mercadopago') {
      setPeruCheckout({ plan: plan as PlanId, interval: intervalKey });
      return;
    }

    trackEvent('begin_checkout', 'subscription', `${plan}-${interval}`);
    setLoading(true);
    try {
      // Get the Clerk session token for authentication
      const token = await window.Clerk?.session?.getToken();

      const planName = interval === 'year' ? `${plan}-yearly` : plan;

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

          {/* The Peru checkout: card, Yape/Plin/transfer and the boleta/factura, in one dialog
              opened by the plan button the visitor actually clicked. */}
          {peruCheckout && user && (
            <PeruCheckoutDialog
              open={Boolean(peruCheckout)}
              onOpenChange={(open) => {
                if (!open) setPeruCheckout(null);
              }}
              plan={peruCheckout.plan}
              interval={peruCheckout.interval}
              lang={currentLang}
              accountEmail={user.email ?? ''}
              alreadyPaidPeriod={hasPaidPeriod}
            />
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

}
