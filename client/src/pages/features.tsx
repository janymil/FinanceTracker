import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLocation } from 'wouter';
import { AppLayout } from '@/components/AppLayout';
import { SEO } from '@/components/SEO';
import { ExpenseCalculatorModal, DebtCalculatorModal } from '@/components/CalculatorModals';

import { 
  Brain, 
  Target, 
  BarChart3, 
  TrendingUp, 
  Calendar,
  Sparkles, 
  Shield, 
  Zap, 
  FileText, 
  Calculator as CalculatorIcon, 
  Receipt, 
  Users, 
  PieChart, 
  Download, 
  RefreshCw, 
  Globe,
  Heart,
  Lightbulb
} from 'lucide-react';

export default function FeaturesPage() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const [categoryTab, setCategoryTab] = useState('ai');
  const [activeAiTab, setActiveAiTab] = useState('categorization');
  
  // Modals for calculators
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [debtModalOpen, setDebtModalOpen] = useState(false);

  // Interactive demo sliders
  const [statementPages, setStatementPages] = useState([5]);
  const [historyMonths, setHistoryMonths] = useState([6]);

  // Language from route
  const langMatch = location.match(/^\/([a-z]{2})(?:\/|$)/);
  const currentLang = langMatch ? langMatch[1] : (localStorage.getItem('preferredLanguage') || 'en');

  const handleSignUp = () => {
    setLocation(`/${currentLang}/auth#sign-up`);
  };

  // AI features defined with proper translation keys
  const aiFeatures = [
    {
      id: 'categorization',
      icon: Brain,
      title: t('features.categorization.title', 'Intelligent Expense Categorization'),
      badge: t('features.categorization.badge', 'Standard+'),
      description: t('features.categorization.description', 'AI-powered automatic categorization of all your transactions with continuous learning and improvement'),
      benefits: [
        { title: t('features.categorization.benefits.instant.title', 'Instant Recognition'), desc: t('features.categorization.benefits.instant.desc', 'Immediately categorizes transactions as they are added') },
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
        { title: t('features.contextual.benefits.budget.title', 'Budget Awareness'), desc: t('features.contextual.benefits.budget.desc', 'Tips that consider your budget limits and goals') },
        { title: t('features.contextual.benefits.goal.title', 'Goal-oriented'), desc: t('features.contextual.benefits.goal.desc', 'Advice tailored to help you achieve your financial objectives') }
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
        { title: t('features.tips.benefits.optimization.title', 'Budget Optimization'), desc: t('features.tips.benefits.optimization.desc', 'Smart adjustments to maximize your budget efficiency') }
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
      id: 'statements',
      icon: FileText,
      title: t('features.statements.title', 'Smart Document Processing'),
      badge: t('features.statements.badge', 'Standard+'),
      description: t('features.statements.description', 'Upload PDF financial documents and let AI extract and categorize all transactions automatically'),
      benefits: [
        { title: t('features.statements.benefits.ocr.title', 'OCR Technology'), desc: t('features.statements.benefits.ocr.desc', 'Advanced text recognition from PDF financial documents') },
        { title: t('features.statements.benefits.processing.title', 'Bulk Processing'), desc: t('features.statements.benefits.processing.desc', 'Process hundreds of transactions at once') },
        { title: t('features.statements.benefits.categorization.title', 'Auto-categorization'), desc: t('features.statements.benefits.categorization.desc', 'AI categorizes all extracted transactions') }
      ]
    }
  ];

  const currentAiFeature = aiFeatures.find(f => f.id === activeAiTab) || aiFeatures[0];

  return (
    <AppLayout isPublicPage={true}>
      <SEO 
        title={`${t('Features')} | Kaptia`}
        description={t('features.hero.subtitle', 'Advanced artificial intelligence meets personal finance management')}
        keywords="kaptia features, ai finance, receipt scanning, budget management"
      />

      <div className="min-h-screen bg-[#f7f8fc] dark:bg-[#07080f] text-gray-900 dark:text-white relative bg-grid pb-20">
        {/* Glow accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 dark:border-white/10 bg-indigo-50/70 dark:bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
              <Sparkles className="h-3.5 w-3.5" />
              {t('Features')}
            </span>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white mt-4">
              {t('features.hero.title', 'AI-Powered Financial Intelligence')}
            </h1>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 mt-3 max-w-2xl mx-auto">
              {t('features.hero.subtitle', 'Advanced artificial intelligence meets personal finance management')}
            </p>

            {/* Metrics cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 max-w-4xl mx-auto">
              <div className="glass-card rounded-2xl p-4 text-center border border-gray-200/80 dark:border-white/10">
                <div className="font-display text-2xl sm:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">9</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">{t('features.hero.stats.ai_functions', 'AI Functions')}</div>
              </div>
              <div className="glass-card rounded-2xl p-4 text-center border border-gray-200/80 dark:border-white/10">
                <div className="font-display text-2xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-400">3</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">{t('features.hero.stats.languages', 'Languages')}</div>
              </div>
              <div className="glass-card rounded-2xl p-4 text-center border border-gray-200/80 dark:border-white/10">
                <div className="font-display text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">95%</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">{t('features.hero.stats.accuracy_rate', 'Accuracy Rate')}</div>
              </div>
              <div className="glass-card rounded-2xl p-4 text-center border border-gray-200/80 dark:border-white/10">
                <div className="font-display text-2xl sm:text-3xl font-extrabold text-purple-600 dark:text-purple-400">24/7</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">{t('features.hero.stats.ai_availability', '24/7 AI Availability')}</div>
              </div>
            </div>
          </div>

          {/* Segmented Category Tabs */}
          <Tabs value={categoryTab} onValueChange={setCategoryTab} className="w-full">
            <TabsList className="grid grid-cols-3 h-auto p-1.5 rounded-2xl bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl border border-gray-200/80 dark:border-white/10 shadow-sm gap-1 mb-8 max-w-xl mx-auto">
              <TabsTrigger 
                value="ai" 
                className="py-2.5 rounded-xl text-xs sm:text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all flex items-center gap-1.5 justify-center"
              >
                <Brain className="h-4 w-4" />
                <span>{t('AI Features', 'AI Features')}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="core" 
                className="py-2.5 rounded-xl text-xs sm:text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all flex items-center gap-1.5 justify-center"
              >
                <Target className="h-4 w-4" />
                <span>{t('Budgets & Goals', 'Budgets & Goals')}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="tools" 
                className="py-2.5 rounded-xl text-xs sm:text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all flex items-center gap-1.5 justify-center"
              >
                <CalculatorIcon className="h-4 w-4" />
                <span>{t('Calculators & Tools', 'Tools')}</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: AI FEATURES */}
            <TabsContent value="ai" className="space-y-6 focus-visible:outline-none">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* AI feature list */}
                <div className="space-y-2 lg:col-span-1">
                  {aiFeatures.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setActiveAiTab(f.id)}
                      className={`w-full text-left p-3.5 rounded-xl transition-all border flex items-center gap-3 ${
                        activeAiTab === f.id
                          ? "bg-white dark:bg-white/10 border-indigo-500/60 shadow-md text-gray-900 dark:text-white"
                          : "glass-card border-gray-200/60 dark:border-white/5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      }`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${
                        activeAiTab === f.id ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-white/5"
                      }`}>
                        <f.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-xs sm:text-sm truncate">{f.title}</div>
                        <div className="text-[11px] text-gray-400 dark:text-gray-500">{f.badge}</div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* AI active showcase card */}
                <div className="lg:col-span-2 glass-card rounded-2xl p-6 sm:p-8 border border-gray-200/80 dark:border-white/10 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md">
                          <currentAiFeature.icon className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="font-display text-xl sm:text-2xl font-bold">{currentAiFeature.title}</h3>
                          <Badge variant="outline" className="mt-1 text-xs border-indigo-200 dark:border-indigo-400/30 text-indigo-600 dark:text-indigo-400">
                            {currentAiFeature.badge}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                      {currentAiFeature.description}
                    </p>

                    <div className="grid sm:grid-cols-3 gap-3 mb-6">
                      {currentAiFeature.benefits.map((b, i) => (
                        <div key={i} className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-white/[0.02] border border-indigo-100/60 dark:border-white/5">
                          <h4 className="font-semibold text-xs text-gray-900 dark:text-white mb-1">{b.title}</h4>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">{b.desc}</p>
                        </div>
                      ))}
                    </div>

                    {/* Interactive Statement Simulator */}
                    {activeAiTab === 'statements' && (
                      <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/5 space-y-3">
                        <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-gray-400">
                          <span>{t('features.calculators.statements.pages')} {statementPages[0]}</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">~{statementPages[0] * 8} {t('features.calculators.statements.transactions')}</span>
                        </div>
                        <Slider
                          value={statementPages}
                          onValueChange={setStatementPages}
                          min={1}
                          max={25}
                          step={1}
                        />
                      </div>
                    )}

                    {/* Interactive Prediction Simulator */}
                    {activeAiTab === 'trends' && (
                      <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/5 space-y-3">
                        <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-gray-400">
                          <span>{t('features.calculators.predictions.historical_months', 'Historical months:')} {historyMonths[0]}</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">~{Math.min(95, 65 + historyMonths[0] * 4)}% {t('features.hero.stats.accuracy_rate', 'Accuracy')}</span>
                        </div>
                        <Slider
                          value={historyMonths}
                          onValueChange={setHistoryMonths}
                          min={1}
                          max={12}
                          step={1}
                        />
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t border-gray-100 dark:border-white/5 mt-6">
                    <Button 
                      onClick={handleSignUp} 
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl shadow-md text-sm"
                    >
                      {t('Try this feature free')}
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: CORE FEATURES (BUDGETS, GOALS, RECEIPTS, SECURITY) */}
            <TabsContent value="core" className="space-y-6 focus-visible:outline-none">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="glass-card rounded-2xl p-6 border border-gray-200/80 dark:border-white/10">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 w-fit mb-3">
                    <PieChart className="h-6 w-6" />
                  </div>
                  <h3 className="font-display font-bold text-lg mb-2">{t('features.core_features.budgets.title', 'Smart Budget Management')}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {t('features.core_features.budgets.description', 'Take control of your spending with intuitive budget tracking')}
                  </p>
                </div>

                <div className="glass-card rounded-2xl p-6 border border-gray-200/80 dark:border-white/10">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 w-fit mb-3">
                    <Target className="h-6 w-6" />
                  </div>
                  <h3 className="font-display font-bold text-lg mb-2">{t('features.core_features.goals.title', 'Savings Goals')}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {t('features.core_features.goals.description', 'Set and achieve financial targets with visual progress tracking')}
                  </p>
                </div>

                <div className="glass-card rounded-2xl p-6 border border-gray-200/80 dark:border-white/10">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 w-fit mb-3">
                    <Receipt className="h-6 w-6" />
                  </div>
                  <h3 className="font-display font-bold text-lg mb-2">{t('features.core_features.receipts.title', 'Receipt Processing')}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {t('features.core_features.receipts.description', 'Digitize receipts instantly with camera upload and automatic extraction')}
                  </p>
                </div>

                <div className="glass-card rounded-2xl p-6 border border-gray-200/80 dark:border-white/10">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 w-fit mb-3">
                    <RefreshCw className="h-6 w-6" />
                  </div>
                  <h3 className="font-display font-bold text-lg mb-2">{t('features.core_features.recurring.title', 'Recurring Transactions')}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {t('features.core_features.recurring.description', 'Automate regular expenses with smart reminder notifications')}
                  </p>
                </div>

                <div className="glass-card rounded-2xl p-6 border border-gray-200/80 dark:border-white/10">
                  <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 w-fit mb-3">
                    <Shield className="h-6 w-6" />
                  </div>
                  <h3 className="font-display font-bold text-lg mb-2">{t('features.core_features.security.title', 'Advanced Data Encryption')}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {t('features.core_features.security.description', 'Enterprise security with end-to-end data encryption')}
                  </p>
                </div>

                <div className="glass-card rounded-2xl p-6 border border-gray-200/80 dark:border-white/10">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 w-fit mb-3">
                    <Download className="h-6 w-6" />
                  </div>
                  <h3 className="font-display font-bold text-lg mb-2">{t('features.core_features.export.title', 'Data Export & Reports')}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {t('features.core_features.export.description', 'Export your financial data in CSV and PDF formats')}
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: TOOLS & CALCULATORS */}
            <TabsContent value="tools" className="space-y-6 focus-visible:outline-none">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                <div className="glass-card rounded-2xl p-6 border border-gray-200/80 dark:border-white/10 flex flex-col justify-between">
                  <div>
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 w-fit mb-3">
                      <CalculatorIcon className="h-6 w-6" />
                    </div>
                    <h3 className="font-display text-xl font-bold mb-2">{t('features.calculators.expense.title', 'Expense Estimation Calculator')}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                      {t('features.calculators.expense.description', 'Quick "Can I afford this?" analysis - no account required!')}
                    </p>
                  </div>
                  <Button 
                    onClick={() => setExpenseModalOpen(true)}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl"
                  >
                    <CalculatorIcon className="h-4 w-4 mr-2" />
                    {t('features.calculators.expense.open_button', 'Open Calculator')}
                  </Button>
                </div>

                <div className="glass-card rounded-2xl p-6 border border-gray-200/80 dark:border-white/10 flex flex-col justify-between">
                  <div>
                    <div className="p-2.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 w-fit mb-3">
                      <Target className="h-6 w-6" />
                    </div>
                    <h3 className="font-display text-xl font-bold mb-2">{t('features.calculators.debt.title', 'Debt Payoff Visualizer')}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                      {t('features.calculators.debt.description', 'Compare snowball vs avalanche strategies to crush debt faster')}
                    </p>
                  </div>
                  <Button 
                    onClick={() => setDebtModalOpen(true)}
                    className="w-full bg-red-600 hover:bg-red-500 text-white rounded-xl"
                  >
                    <Target className="h-4 w-4 mr-2" />
                    {t('features.calculators.debt.open_button', 'Open Calculator')}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Bottom CTA Banner */}
          <div className="mt-14 glass-card rounded-3xl p-8 sm:p-10 border border-indigo-200/60 dark:border-white/10 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 text-center">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">
              {t('features.cta.title', 'Ready to Transform Your Financial Management?')}
            </h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-xl mx-auto mb-6">
              {t('features.cta.subtitle', 'Join thousands of users who have revolutionized their personal finances with AI-powered insights')}
            </p>
            <Button
              onClick={handleSignUp}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-indigo-500/25 rounded-xl px-8"
            >
              <Zap className="mr-2 h-4 w-4" />
              {t('features.cta.start_free', 'Start with Free Account')}
            </Button>
          </div>
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
