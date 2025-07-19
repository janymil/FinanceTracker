import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocation } from 'wouter';
import { AppLayout } from '@/components/AppLayout';
import { ExpenseCalculatorModal, DebtCalculatorModal } from '@/components/CalculatorModals';

import { 
  Brain, 
  Target, 
  BarChart3, 
  Heart, 
  TrendingUp, 
  Calendar,
  Lightbulb,
  Settings,
  Scale,
  Globe,
  Sparkles,
  Clock,
  DollarSign,
  Shield,
  Zap,
  FileText,
  Calculator as CalculatorIcon,
  Receipt,
  Users,
  PieChart,
  Wallet,
  CreditCard,
  Upload,
  Download,
  Lock,
  Smartphone,
  RefreshCw,
  BookOpen,
  Bell
} from 'lucide-react';

// Feature showcase component
function FeatureShowcaseCard({ title, description, icon: Icon, features }: { 
  title: string; 
  description: string; 
  icon: any;
  features: string[];
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
              <span>{feature}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function FeaturesPage() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('categorization');
  const [demoLoading, setDemoLoading] = useState(false);
  
  // Modal states
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [debtModalOpen, setDebtModalOpen] = useState(false);
  
  
  // Calculator states
  const [transactions, setTransactions] = useState([100]);
  const [expenses, setExpenses] = useState([5000]);
  const [businessSize, setBusinessSize] = useState([2]);
  const [savingsRate, setSavingsRate] = useState([15]);
  const [budgetAdherence, setBudgetAdherence] = useState([80]);
  const [dataMonths, setDataMonths] = useState([12]);
  const [trendStrength, setTrendStrength] = useState([3]);
  const [pagesInStatement, setPagesInStatement] = useState([5]);
  const [historicalMonths, setHistoricalMonths] = useState([6]);
  const [recsFollowed, setRecsFollowed] = useState([4]);
  const [contextFactors, setContextFactors] = useState([5]);
  const [primaryScore, setPrimaryScore] = useState([75]);

  const handleSignUp = () => {
    setLocation('/auth');
  };


  const aiFeatures = [
    {
      id: 'categorization',
      icon: Brain,
      title: t('features.categorization.title', 'Intelligent Expense Categorization'),
      badge: t('features.categorization.badge', 'Standard+'),
      description: t('features.categorization.description', 'AI-powered automatic categorization of all your transactions with continuous learning and improvement'),
      benefits: [
        { title: t('features.categorization.benefits.instant.title', 'Instant Recognition'), desc: t('features.categorization.benefits.instant.desc', 'Immediately categorizes transactions as they\'re added') },
        { title: t('features.categorization.benefits.learning.title', 'Continuous Learning'), desc: t('features.categorization.benefits.learning.desc', 'Gets smarter with each transaction you process') },
        { title: t('features.categorization.benefits.custom.title', 'Custom Categories'), desc: t('features.categorization.benefits.custom.desc', 'Adapts to your unique spending patterns and categories') }
      ]
    },
    {
      id: 'contextual',
      icon: Target,
      title: t('features.contextual.title', 'Contextual Financial Tips'),
      badge: t('features.contextual.badge', 'Standard+'),
      description: t('features.contextual.description', 'Receive personalized financial advice based on your specific transaction patterns and spending behavior'),
      benefits: [
        { title: t('features.contextual.benefits.realtime.title', 'Real-time Analysis'), desc: t('features.contextual.benefits.realtime.desc', 'Instant insights based on your current financial activity') },
        { title: t('features.contextual.benefits.budget.title', 'Budget Awareness'), desc: t('features.contextual.benefits.budget.desc', 'Advice that considers your current budget and spending limits') },
        { title: t('features.contextual.benefits.goal.title', 'Goal-Oriented'), desc: t('features.contextual.benefits.goal.desc', 'Tips aligned with your specific financial goals and targets') }
      ]
    },
    {
      id: 'tips',
      icon: Lightbulb,
      title: t('features.tips.title', 'AI Financial Tips'),
      badge: t('features.tips.badge', 'Premium'),
      description: t('features.tips.description', 'Daily personalized recommendations to optimize your financial health and achieve your money goals faster'),
      benefits: [
        { title: t('features.tips.benefits.patterns.title', 'Spending Patterns'), desc: t('features.tips.benefits.patterns.desc', 'Deep analysis of your spending behaviors and trends') },
        { title: t('features.tips.benefits.strategies.title', 'Saving Strategies'), desc: t('features.tips.benefits.strategies.desc', 'Personalized recommendations to optimize your cash flow') },
        { title: t('features.tips.benefits.optimization.title', 'Budget Optimization'), desc: t('features.tips.benefits.optimization.desc', 'Smart adjustments to maximize your budget efficiency') },
        { title: t('features.tips.benefits.analysis.title', 'Advanced Analysis'), desc: t('features.tips.benefits.analysis.desc', 'Professional-grade financial insights and forecasting') }
      ]
    },
    {
      id: 'insights',
      icon: BarChart3,
      title: t('features.insights.title', 'Intelligent Spending Insights'),
      badge: t('features.insights.badge', 'Standard+'),
      description: t('features.insights.description', 'Advanced analysis of your expense transactions to identify patterns, anomalies, and optimization opportunities'),
      benefits: [
        { title: t('features.insights.benefits.anomaly.title', 'Anomaly Detection'), desc: t('features.insights.benefits.anomaly.desc', 'Automatically identifies unusual spending patterns') },
        { title: t('features.insights.benefits.trend.title', 'Trend Analysis'), desc: t('features.insights.benefits.trend.desc', 'Spots emerging trends in your business expenses') },
        { title: t('features.insights.benefits.optimization.title', 'Optimization Tips'), desc: t('features.insights.benefits.optimization.desc', 'Actionable recommendations to reduce costs') }
      ]
    },
    {
      id: 'health',
      icon: Heart,
      title: t('features.health.title', 'Financial Health Score'),
      badge: t('features.health.badge', 'Premium'),
      description: t('features.health.description', 'Comprehensive AI-powered financial health analysis with personalized scoring and improvement recommendations'),
      benefits: [
        { title: t('features.health.benefits.scoring.title', 'Real-time Scoring'), desc: t('features.health.benefits.scoring.desc', 'Live financial health score from 0-100') },
        { title: t('features.health.benefits.analysis.title', 'Factor Analysis'), desc: t('features.health.benefits.analysis.desc', 'Detailed breakdown of what affects your score') },
        { title: t('features.health.benefits.plan.title', 'Improvement Plan'), desc: t('features.health.benefits.plan.desc', 'Personalized action plan to boost your financial health') }
      ]
    },
    {
      id: 'trends',
      icon: TrendingUp,
      title: t('features.trends.title', 'Trend Predictions'),
      badge: t('features.trends.badge', 'Premium'),
      description: t('features.trends.description', 'AI-powered forecasting of your financial trends with predictive analytics and future spending patterns'),
      benefits: [
        { title: t('features.trends.benefits.growth.title', 'Growth Forecasting'), desc: t('features.trends.benefits.growth.desc', 'Predict future income and expense trends') },
        { title: t('features.trends.benefits.category.title', 'Category Analysis'), desc: t('features.trends.benefits.category.desc', 'Detailed predictions by spending category') },
        { title: t('features.trends.benefits.adaptation.title', 'Adaptive Learning'), desc: t('features.trends.benefits.adaptation.desc', 'Improves accuracy with your spending patterns') }
      ]
    },
    {
      id: 'predictions',
      icon: Calendar,
      title: t('features.predictions.title', 'Expense Predictions'),
      badge: t('features.predictions.badge', 'Premium'),
      description: t('features.predictions.description', 'Advanced AI algorithms predict your future expenses to help you plan and budget more effectively'),
      benefits: [
        { title: t('features.predictions.benefits.forecasting.title', 'Smart Forecasting'), desc: t('features.predictions.benefits.forecasting.desc', 'Predict expenses up to 12 months ahead') },
        { title: t('features.predictions.benefits.seasonal.title', 'Seasonal Patterns'), desc: t('features.predictions.benefits.seasonal.desc', 'Recognizes seasonal spending variations') },
        { title: t('features.predictions.benefits.planning.title', 'Planning Support'), desc: t('features.predictions.benefits.planning.desc', 'Better budget planning with future insights') }
      ]
    },
    {
      id: 'recommendations',
      icon: Sparkles,
      title: t('features.recommendations.title', 'Daily Recommendations'),
      badge: t('features.recommendations.badge', 'Premium'),
      description: t('features.recommendations.description', 'Personalized daily financial recommendations powered by AI to optimize your spending and savings'),
      benefits: [
        { title: t('features.recommendations.benefits.daily.title', 'Daily Updates'), desc: t('features.recommendations.benefits.daily.desc', 'Fresh recommendations delivered every day') },
        { title: t('features.recommendations.benefits.action.title', 'Actionable Advice'), desc: t('features.recommendations.benefits.action.desc', 'Practical steps you can take immediately') },
        { title: t('features.recommendations.benefits.priority.title', 'Priority-based'), desc: t('features.recommendations.benefits.priority.desc', 'Focus on what matters most for your finances') }
      ]
    },
    {
      id: 'statements',
      icon: FileText,
      title: t('features.statements.title', 'Bank Statement Processing'),
      badge: t('features.statements.badge', 'Standard+'),
      description: t('features.statements.description', 'Upload PDF bank statements and let AI extract and categorize all transactions automatically'),
      benefits: [
        { title: t('features.statements.benefits.ocr.title', 'OCR Technology'), desc: t('features.statements.benefits.ocr.desc', 'Advanced text recognition from PDF statements') },
        { title: t('features.statements.benefits.processing.title', 'Bulk Processing'), desc: t('features.statements.benefits.processing.desc', 'Process hundreds of transactions at once') },
        { title: t('features.statements.benefits.categorization.title', 'Auto-categorization'), desc: t('features.statements.benefits.categorization.desc', 'AI categorizes all extracted transactions') }
      ]
    }
  ];

  const activeFeature = aiFeatures.find(f => f.id === activeTab) || aiFeatures[0];

  // Calculator helper functions
  const calculateTimeSaved = () => {
    return (transactions[0] * 2 / 60).toFixed(1);
  };

  const calculateSavings = () => {
    const minSavings = Math.floor(expenses[0] * 0.05);
    const maxSavings = Math.floor(expenses[0] * 0.15);
    return `$${minSavings} - $${maxSavings}`;
  };

  const calculateHealthScore = () => {
    return Math.min(100, Math.floor((savingsRate[0] * 1.5) + (budgetAdherence[0] * 0.5)));
  };

  const calculatePredictionAccuracy = () => {
    return Math.min(95, Math.floor(60 + (dataMonths[0] * 1.2)));
  };

  const calculateExtractedTransactions = () => {
    return Math.floor(pagesInStatement[0] * 8.5); // Average 8.5 transactions per page
  };

  const calculatePredictionRange = () => {
    return Math.min(12, Math.floor(historicalMonths[0] * 1.5)); // Max 12 months prediction
  };

  return (
    <AppLayout isPublicPage={true}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-700 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 py-20 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              {t('features.hero.title', 'AI-Powered Financial Intelligence')}
            </h1>
            <p className="text-xl md:text-2xl mb-8 opacity-90 max-w-4xl mx-auto">
              {t('features.hero.subtitle', 'Advanced artificial intelligence meets personal finance management')}
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-12">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold">9</div>
                <div className="text-sm opacity-80">{t('features.hero.stats.ai_functions', 'AI Functions')}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold">3</div>
                <div className="text-sm opacity-80">{t('features.hero.stats.languages', 'Languages')}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold">95%</div>
                <div className="text-sm opacity-80">{t('features.hero.stats.accuracy_rate', 'Accuracy Rate')}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold">24/7</div>
                <div className="text-sm opacity-80">{t('features.hero.stats.ai_availability', '24/7 AI Availability')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Core Features Section */}
      <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('features.core_features.title')}</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              {t('features.core_features.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureShowcaseCard
              title={t('features.core_features.budgets.title')}
              description={t('features.core_features.budgets.description')}
              icon={PieChart}
              features={[
                t('features.core_features.budgets.features.categories'),
                t('features.core_features.budgets.features.tracking'),
                t('features.core_features.budgets.features.comparison'),
                t('features.core_features.budgets.features.alerts')
              ]}
            />
            <FeatureShowcaseCard
              title={t('features.core_features.goals.title')}
              description={t('features.core_features.goals.description')}
              icon={Target}
              features={[
                t('features.core_features.goals.features.types'),
                t('features.core_features.goals.features.sharing'),
                t('features.core_features.goals.features.visualization'),
                t('features.core_features.goals.features.predictions')
              ]}
            />
            <FeatureShowcaseCard
              title={t('features.core_features.receipts.title')}
              description={t('features.core_features.receipts.description')}
              icon={Receipt}
              features={[
                t('features.core_features.receipts.features.extraction'),
                t('features.core_features.receipts.features.categorization'),
                t('features.core_features.receipts.features.storage'),
                t('features.core_features.receipts.features.reports')
              ]}
            />
            <FeatureShowcaseCard
              title={t('features.core_features.recurring.title')}
              description={t('features.core_features.recurring.description')}
              icon={RefreshCw}
              features={[
                t('features.core_features.recurring.features.frequency'),
                t('features.core_features.recurring.features.automation'),
                t('features.core_features.recurring.features.flexibility'),
                t('features.core_features.recurring.features.reminders')
              ]}
            />
            <FeatureShowcaseCard
              title={t('features.core_features.currency.title')}
              description={t('features.core_features.currency.description')}
              icon={Globe}
              features={[
                t('features.core_features.currency.features.support'),
                t('features.core_features.currency.features.interface'),
                t('features.core_features.currency.features.consistency'),
                t('features.core_features.currency.features.preference')
              ]}
            />
            <FeatureShowcaseCard
              title={t('features.core_features.export.title')}
              description={t('features.core_features.export.description')}
              icon={Download}
              features={[
                t('features.core_features.export.features.formats'),
                t('features.core_features.export.features.import'),
                t('features.core_features.export.features.ranges'),
                t('features.core_features.export.features.tax_reports')
              ]}
            />
            <FeatureShowcaseCard
              title={t('features.core_features.collaboration.title')}
              description={t('features.core_features.collaboration.description')}
              icon={Users}
              features={[
                t('features.core_features.collaboration.features.shared_goals'),
                t('features.core_features.collaboration.features.planning'),
                t('features.core_features.collaboration.features.updates'),
                t('features.core_features.collaboration.features.notifications')
              ]}
            />
            <FeatureShowcaseCard
              title={t('features.core_features.security.title')}
              description={t('features.core_features.security.description')}
              icon={Shield}
              features={[
                t('features.core_features.security.features.encryption'),
                t('features.core_features.security.features.privacy'),
                t('features.core_features.security.features.authentication'),
                t('features.core_features.security.features.audits')
              ]}
            />
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('features.section.title', 'AI-Powered Financial Features')}</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              {t('features.section.subtitle', 'Experience the future of personal finance with our intelligent automation suite')}
            </p>
          </div>

          {/* Feature Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {aiFeatures.map((feature) => (
              <Button
                key={feature.id}
                variant={activeTab === feature.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab(feature.id)}
                className="text-xs"
              >
                <feature.icon className="mr-1 h-3 w-3" />
                {feature.title.split(' ').slice(0, 2).join(' ')}
              </Button>
            ))}
          </div>

          {/* Active Feature Content */}
          <Card className="border-0 shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-blue-600 to-purple-700 text-white rounded-lg">
                    <activeFeature.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">{activeFeature.title}</CardTitle>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-gradient-to-r from-blue-600 to-purple-700 text-white">
                  {activeFeature.badge}
                </Badge>
              </div>
              <CardDescription className="text-base leading-relaxed mt-4">
                {activeFeature.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {activeFeature.benefits.map((benefit, index) => (
                  <div key={index} className="p-4 bg-blue-50 dark:bg-gray-800 rounded-lg border-l-4 border-blue-600">
                    <h4 className="font-semibold mb-2">{benefit.title}</h4>
                    <p className="text-sm text-muted-foreground">{benefit.desc}</p>
                  </div>
                ))}
              </div>

              {/* Interactive Calculator based on active tab */}
              {activeTab === 'categorization' && (
                <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg">{t('features.calculators.categorization.title', 'Categorization Accuracy Calculator')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span>{t('features.calculators.categorization.transactions_label', 'Transactions per month:')}</span>
                          <span className="font-semibold">{transactions[0]}</span>
                        </div>
                        <Slider
                          value={transactions}
                          onValueChange={setTransactions}
                          max={1000}
                          min={50}
                          step={10}
                        />
                      </div>
                      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border-l-4 border-blue-600">
                        <div className="text-sm text-muted-foreground">{t('features.calculators.categorization.time_saved', 'Time saved per month:')}</div>
                        <div className="text-xl font-bold text-blue-600">{calculateTimeSaved()} {t('features.calculators.categorization.hours', 'hours')}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'tips' && (
                <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg">{t('features.calculators.savings.title', 'Potential Savings Calculator')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span>{t('features.calculators.savings.expenses_label', 'Monthly expenses:')}</span>
                          <span className="font-semibold">${expenses[0]}</span>
                        </div>
                        <Slider
                          value={expenses}
                          onValueChange={setExpenses}
                          max={20000}
                          min={1000}
                          step={100}
                        />
                      </div>
                      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border-l-4 border-blue-600">
                        <div className="text-sm text-muted-foreground">{t('features.calculators.savings.potential_savings', 'Potential monthly savings (5-15%):')}</div>
                        <div className="text-xl font-bold text-blue-600">{calculateSavings()}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'health' && (
                <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg">{t('features.calculators.health.title', 'Health Score Simulator')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span>{t('features.calculators.health.savings_rate', 'Savings rate:')}</span>
                          <span className="font-semibold">{savingsRate[0]}%</span>
                        </div>
                        <Slider
                          value={savingsRate}
                          onValueChange={setSavingsRate}
                          max={50}
                          min={0}
                          step={1}
                        />
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <span>{t('features.calculators.health.budget_adherence', 'Budget adherence:')}</span>
                          <span className="font-semibold">{budgetAdherence[0]}%</span>
                        </div>
                        <Slider
                          value={budgetAdherence}
                          onValueChange={setBudgetAdherence}
                          max={100}
                          min={0}
                          step={1}
                        />
                      </div>
                      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border-l-4 border-blue-600">
                        <div className="text-sm text-muted-foreground">{t('features.calculators.health.estimated_score', 'Estimated Financial Health Score:')}</div>
                        <div className="text-xl font-bold text-blue-600">{calculateHealthScore()}/100</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'predictions' && (
                <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg">{t('features.calculators.predictions.title', 'Prediction Range Calculator')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span>{t('features.calculators.predictions.historical_months', 'Historical data months:')}</span>
                          <span className="font-semibold">{historicalMonths[0]} {t('features.calculators.predictions.months', 'months')}</span>
                        </div>
                        <Slider
                          value={historicalMonths}
                          onValueChange={setHistoricalMonths}
                          max={24}
                          min={3}
                          step={1}
                        />
                      </div>
                      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border-l-4 border-blue-600">
                        <div className="text-sm text-muted-foreground">{t('features.calculators.predictions.prediction_range', 'Prediction range:')}</div>
                        <div className="text-xl font-bold text-blue-600">{calculatePredictionRange()} {t('features.calculators.predictions.months_ahead', 'months ahead')}</div>
                      </div>
                      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border-l-4 border-green-600">
                        <div className="text-sm text-muted-foreground">{t('features.calculators.predictions.prediction_accuracy', 'Prediction accuracy:')}</div>
                        <div className="text-xl font-bold text-green-600">{Math.min(95, Math.floor(65 + (historicalMonths[0] * 1.1)))}%</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'statements' && (
                <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg">{t('features.calculators.statements.title', 'Statement Processing Calculator')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span>{t('features.calculators.statements.pages', 'Pages in statement:')}</span>
                          <span className="font-semibold">{pagesInStatement[0]} {t('features.calculators.statements.pages_unit', 'pages')}</span>
                        </div>
                        <Slider
                          value={pagesInStatement}
                          onValueChange={setPagesInStatement}
                          max={20}
                          min={1}
                          step={1}
                        />
                      </div>
                      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border-l-4 border-blue-600">
                        <div className="text-sm text-muted-foreground">{t('features.calculators.statements.estimated_transactions', 'Estimated transactions:')}</div>
                        <div className="text-xl font-bold text-blue-600">{calculateExtractedTransactions()} {t('features.calculators.statements.transactions', 'transactions')}</div>
                      </div>
                      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border-l-4 border-green-600">
                        <div className="text-sm text-muted-foreground">{t('features.calculators.statements.processing_time', 'Processing time saved:')}</div>
                        <div className="text-xl font-bold text-green-600">{Math.floor(calculateExtractedTransactions() * 1.5)} {t('features.calculators.statements.minutes', 'minutes')}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Multilingual Support */}
        <Card className="mb-16 border-0 shadow-xl bg-gradient-to-r from-blue-600 to-purple-700 text-white">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl mb-4 text-white">{t('features.multilingual.title', 'Full Multilingual Support')}</CardTitle>
            <CardDescription className="text-blue-100 text-lg">
              {t('features.multilingual.subtitle', 'Native language support for English, Spanish, and Slovak with culturally aware AI responses')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center p-6 bg-white/10 backdrop-blur rounded-lg">
                <Globe className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">{t('features.multilingual.english.title', 'English (Global)')}</h3>
                <p className="text-blue-100 text-sm">
                  {t('features.multilingual.english.description', 'Complete AI analysis in English with global financial context and best practices')}
                </p>
              </div>
              <div className="text-center p-6 bg-white/10 backdrop-blur rounded-lg">
                <Globe className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">{t('features.multilingual.spanish.title', 'Español (Latinoamérica)')}</h3>
                <p className="text-blue-100 text-sm">
                  {t('features.multilingual.spanish.description', 'Complete AI analysis in Spanish with Latin American business context and cultural understanding')}
                </p>
              </div>
              <div className="text-center p-6 bg-white/10 backdrop-blur rounded-lg">
                <Globe className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">{t('features.multilingual.slovak.title', 'Slovenčina (Europa)')}</h3>
                <p className="text-blue-100 text-sm">
                  {t('features.multilingual.slovak.description', 'Complete AI analysis in Slovak with European business context and regulations')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Free Financial Calculators */}
        <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('features.tools.title', 'Free Financial Tools')}</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              {t('features.tools.subtitle', 'Essential tools to manage your finances effectively')}
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
            {/* Expense Estimation Calculator Card */}
            <Card className="border-0 shadow-xl hover:shadow-2xl transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CalculatorIcon className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{t('features.calculators.expense.title', 'Expense Estimation Calculator')}</CardTitle>
                    <CardDescription className="text-base">
                      {t('features.calculators.expense.description', 'Quick "Can I afford this?" analysis - no account required!')}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    {t('features.calculators.expense.features', 'Features:')}
                  </div>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• {t('features.calculators.expense.feature1', 'Affordability analysis')}</li>
                    <li>• {t('features.calculators.expense.feature2', 'Savings timeline calculation')}</li>
                    <li>• {t('features.calculators.expense.feature3', 'Monthly budget recommendations')}</li>
                  </ul>
                  <Button 
                    onClick={() => setExpenseModalOpen(true)}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                    size="lg"
                  >
                    <CalculatorIcon className="h-4 w-4 mr-2" />
                    {t('features.calculators.expense.open_button', 'Open Calculator')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Debt Payoff Calculator Card */}
            <Card className="border-0 shadow-xl hover:shadow-2xl transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Target className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{t('features.calculators.debt.title', 'Debt Payoff Visualizer')}</CardTitle>
                    <CardDescription className="text-base">
                      {t('features.calculators.debt.description', 'Compare snowball vs avalanche strategies to crush your debt faster!')}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    {t('features.calculators.debt.features', 'Features:')}
                  </div>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• {t('features.calculators.debt.feature1', 'Snowball vs Avalanche comparison')}</li>
                    <li>• {t('features.calculators.debt.feature2', 'Interest savings calculation')}</li>
                    <li>• {t('features.calculators.debt.feature3', 'Payoff timeline visualization')}</li>
                  </ul>
                  <Button 
                    onClick={() => setDebtModalOpen(true)}
                    className="w-full bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700"
                    size="lg"
                  >
                    <Target className="h-4 w-4 mr-2" />
                    {t('features.calculators.debt.open_button', 'Open Calculator')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Call to Action */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl mb-4">{t('features.cta.title', 'Ready to Transform Your Financial Management?')}</CardTitle>
            <CardDescription className="text-lg max-w-2xl mx-auto">
              {t('features.cta.subtitle', 'Join thousands of entrepreneurs who have revolutionized their business finances with AI-powered insights')}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Button size="lg" onClick={handleSignUp} className="bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-700 hover:to-purple-800">
                <Zap className="mr-2 h-4 w-4" />
                {t('features.cta.start_free', 'Start with Free Account')}
              </Button>
            </div>
            
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Calculator Modals */}
      <ExpenseCalculatorModal 
        isOpen={expenseModalOpen} 
        onClose={() => setExpenseModalOpen(false)} 
      />
      <DebtCalculatorModal 
        isOpen={debtModalOpen} 
        onClose={() => setDebtModalOpen(false)} 
      />
    </AppLayout>
  );
}