import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Lock, Target, TrendingUp, BarChart3, Calendar, Check } from "lucide-react";
import { Link } from "wouter";

interface UpgradePromptProps {
  requiredPlan: 'free' | 'standard' | 'premium';
  feature: string;
  description: string;
  benefits: string[];
  icon?: React.ComponentType<{ className?: string }>;
}

export default function UpgradePrompt({ 
  requiredPlan, 
  feature, 
  description, 
  benefits, 
  icon: Icon = Lock 
}: UpgradePromptProps) {
  const planColors = {
    free: {
      gradient: "from-gray-100 to-slate-100 dark:from-gray-900 dark:to-slate-900",
      accent: "bg-gray-600",
      badge: "bg-gray-500"
    },
    standard: {
      gradient: "from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900",
      accent: "bg-blue-600",
      badge: "bg-blue-500"
    },
    premium: {
      gradient: "from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900", 
      accent: "bg-purple-600",
      badge: "bg-purple-500"
    }
  };

  const colors = planColors[requiredPlan] || planColors.standard;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-8">
        <div className={`mx-auto w-24 h-24 bg-gradient-to-br ${colors.gradient} rounded-full flex items-center justify-center mb-6`}>
          <Icon className={`h-12 w-12 ${requiredPlan === 'standard' ? 'text-blue-600' : requiredPlan === 'premium' ? 'text-purple-600' : 'text-gray-600'}`} />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          {feature}
        </h1>
        
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
          {description}
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} Feature
          </CardTitle>
          <CardDescription>
            This feature is available for {requiredPlan} subscribers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                <Check className="h-8 w-8 text-green-600 mx-auto mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {benefit}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link href="/subscribe">
              <Button size="lg" className={`${colors.accent} hover:opacity-90 text-white`}>
                <Crown className="h-4 w-4 mr-2" />
                Upgrade to {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Feature Preview */}
      <Card className="opacity-60 pointer-events-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5" />
              {feature} Preview
            </CardTitle>
            <Badge className={`${colors.badge} text-white`}>
              <Crown className="h-3 w-3 mr-1" />
              {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} Only
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
              <p className="text-gray-500 dark:text-gray-400">Feature preview available after upgrade</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}