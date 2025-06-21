import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, TrendingUp, Check, X } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";

interface UpgradePromptProps {
  currentPlan: string;
  onDismiss: () => void;
}

export function UpgradePrompt({ currentPlan, onDismiss }: UpgradePromptProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { currency } = useCurrency();

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
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan }),
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
      name: 'Standard',
      price: `${currency}4.99/month`,
      color: 'blue',
      icon: TrendingUp,
      features: [
        'Goals and budget management',
        'Interactive charts and reports', 
        'AI expense categorization',
        'Calendar view and reminders',
        'Unlimited transaction history'
      ]
    },
    premium: {
      name: 'Premium',
      price: `${currency}9.99/month`,
      color: 'purple',
      icon: Crown,
      features: [
        'Everything in Standard plan',
        'AI financial tips and insights',
        'Advanced trends analysis',
        'Expense prediction',
        'Daily personalized recommendations',
        'Cloud data backup',
        'Data management (CSV, PDF)'
      ]
    }
  };

  const plan = planDetails[selectedPlan as keyof typeof planDetails];
  const IconComponent = plan.icon;

  return (
    <Card className="border-2 border-dashed border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50">
      <CardHeader className="relative">
        <Button
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
              Complete Your {plan.name} Upgrade
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Ready to activate
              </Badge>
            </CardTitle>
            <CardDescription>
              You selected the {plan.name} plan. Complete your upgrade to unlock all features.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">What you'll get:</h4>
            <div className="space-y-1">
              {plan.features.slice(0, 4).map((feature, index) => (
                <div key={index} className="flex items-center text-sm">
                  <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
              {plan.features.length > 4 && (
                <div className="text-sm text-gray-500">
                  +{plan.features.length - 4} more features
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
                Cancel anytime
              </div>
            </div>
            
            <div className="space-y-2">
              <Button
                onClick={() => handleUpgrade(selectedPlan)}
                disabled={loading}
                className={`w-full bg-${plan.color}-600 hover:bg-${plan.color}-700`}
              >
                {loading ? 'Processing...' : `Upgrade to ${plan.name}`}
              </Button>
              
              <Button
                variant="outline"
                onClick={handleDismiss}
                className="w-full"
              >
                Maybe later
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}