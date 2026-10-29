import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, TrendingUp, Check, X } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { useBillingRegion } from "@/hooks/useBillingRegion";
import { amountFor, formatMoney } from "@shared/pricing";

interface UpgradePromptProps {
  currentPlan: string;
  onDismiss: () => void;
}

export function UpgradePrompt({ currentPlan, onDismiss }: UpgradePromptProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { t, i18n } = useTranslation();
  const currency = useBillingRegion(i18n.language?.slice(0, 2) || 'en').currency;

  useEffect(() => {
    // Check if user selected a paid plan during signup
    const storedPlan = localStorage.getItem('selectedPlan');
    if (storedPlan && storedPlan !== 'free' && currentPlan === 'free') {
      setSelectedPlan(storedPlan);
    }
  }, [currentPlan]);

  const handleUpgrade = async (plan: string) => {
    setLoading(true);
    try {
      // Match the currency to the page language, exactly like /pricing showed it.
      const lang = (window.location.pathname.match(/^\/([a-z]{2})(?:\/|$)/)?.[1]
        || localStorage.getItem('preferredLanguage')
        || 'en').slice(0, 2);
      const currency = lang === 'es' ? 'pen' : 'usd';

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-language': lang,
        },
        body: JSON.stringify({ plan, currency }),
      });

      if (response.ok) {
        const { url } = await response.json();
        window.location.href = url;
      } else {
        console.error('Failed to create checkout session');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    localStorage.removeItem('selectedPlan');
    onDismiss();
  };

  if (!selectedPlan) {
    return null;
  }

  const planDetails = {
    standard: {
      name: t('upgrade.standard_name'),
      price: `${formatMoney(amountFor('standard', 'monthly', currency), currency)}/${t('checkout.period_monthly')} · ${formatMoney(amountFor('standard', 'yearly', currency), currency)}/${t('checkout.period_yearly')}`,
      color: 'blue',
      icon: TrendingUp,
      features: [
        t('upgrade.standard_features.goals'),
        t('upgrade.standard_features.charts'),
        t('upgrade.standard_features.ai_categorization'),
        t('upgrade.standard_features.calendar'),
        t('upgrade.standard_features.unlimited_history')
      ]
    },
    premium: {
      name: t('upgrade.premium_name'),
      price: `${formatMoney(amountFor('premium', 'monthly', currency), currency)}/${t('checkout.period_monthly')} · ${formatMoney(amountFor('premium', 'yearly', currency), currency)}/${t('checkout.period_yearly')}`,
      color: 'purple',
      icon: Crown,
      features: [
        t('upgrade.premium_features.everything'),
        t('upgrade.premium_features.ai_tips'),
        t('upgrade.premium_features.trends'),
        t('upgrade.premium_features.prediction'),
        t('upgrade.premium_features.recommendations'),
        t('upgrade.premium_features.backup'),
        t('upgrade.premium_features.data_management')
      ]
    }
  };

  const plan = planDetails[selectedPlan as keyof typeof planDetails];
  const IconComponent = plan.icon;

  return (
    <Card className="border-2 border-dashed border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50">
      <CardHeader className="relative">
        <Button aria-label={t('a11y.close')}
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="absolute -top-2 -right-2 h-8 w-8 rounded-full"
        >
          <X className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-full bg-${plan.color}-100`}>
            <IconComponent className={`h-6 w-6 text-${plan.color}-600`} />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2">
              {t('upgrade.complete_upgrade', { plan: plan.name })}
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {t('upgrade.ready_to_activate')}
              </Badge>
            </CardTitle>
            <CardDescription>
              {t('upgrade.selected_plan_description', { plan: plan.name })}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">{t('upgrade.what_you_get')}</h4>
            <div className="space-y-1">
              {plan.features.slice(0, 4).map((feature, index) => (
                <div key={index} className="flex items-center text-sm">
                  <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
              {plan.features.length > 4 && (
                <div className="text-sm text-gray-500">
                  {t('upgrade.more_features', { count: plan.features.length - 4 })}
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="text-center p-4 bg-white rounded-lg border">
              <div className={`text-2xl font-bold text-${plan.color}-600`}>
                {plan.price}
              </div>
              <div className="text-sm text-gray-500">
                {t('upgrade.cancel_anytime')}
              </div>
            </div>
            
            <div className="space-y-2">
              <Button
                onClick={() => handleUpgrade(selectedPlan)}
                disabled={loading}
                className={`w-full bg-${plan.color}-600 hover:bg-${plan.color}-700`}
              >
                {loading ? t('upgrade.processing') : t('upgrade.upgrade_to', { plan: plan.name })}
              </Button>
              
              <Button
                variant="outline"
                onClick={handleDismiss}
                className="w-full"
              >
                {t('upgrade.maybe_later')}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}