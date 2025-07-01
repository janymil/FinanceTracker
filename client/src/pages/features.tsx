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
import { ExpenseEstimationCalculator } from '@/components/Calculator';

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
  FileText
} from 'lucide-react';

// Helper function to get current language for video files
function getCurrentLanguageForAPI(): string {
  if (typeof window !== 'undefined' && (window as any).i18next) {
    const lang = (window as any).i18next.language;
    return lang.startsWith('es') ? 'es-pe' : lang.startsWith('sk') ? 'sk-sk' : 'en-us';
  }
  return 'en-us';
}

// Static video card component
function DemoVideoCard({ title, description, demoType }: { 
  title: string; 
  description: string; 
  demoType: 'categorization' | 'tips' | 'health' 
}) {
  const { t } = useTranslation();
  const language = getCurrentLanguageForAPI();
  // Always use en-us for now since that's the only video we have
  const videoPath = `/demo-videos/categorization-demo-en-us.mp4`;

  const handleWatchDemo = () => {
    const videoElement = document.querySelector(`#video-${demoType}`) as HTMLVideoElement;
    if (videoElement) {
      videoElement.load(); // Reload the video source
      videoElement.currentTime = 0; // Reset to beginning
      videoElement.play().catch(error => {
        console.error('Error playing video:', error);
        // If autoplay fails, just show the video controls
        videoElement.setAttribute('controls', 'true');
      });
      // Scroll to video if not visible
      videoElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg flex items-center justify-center mb-4">
          <video 
            id={`video-${demoType}`}
            controls 
            preload="metadata"
            className="w-full h-full rounded-lg"
          >
            <source src={videoPath} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
        <Button onClick={handleWatchDemo} className="w-full" size="sm">
          <Sparkles className="mr-2 h-4 w-4" />
          {t('features.cta.watch_demo')}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function FeaturesPage() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('categorization');
  const [demoLoading, setDemoLoading] = useState(false);
  
  // Demo state
  const [merchantName, setMerchantName] = useState('');
  const [amount, setAmount] = useState('');
  const [demoLanguage, setDemoLanguage] = useState('en');
  const [demoResult, setDemoResult] = useState('');
  
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

  const runAIDemo = async () => {
    if (!merchantName || !amount) {
      alert(t('features.demo.fill_fields'));
      return;
    }
    
    setDemoLoading(true);
    
    try {
      // Call the real AI categorization API
      const response = await fetch('/api/ai/categorize-expense', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-language': demoLanguage === 'en' ? 'en-us' : demoLanguage === 'es' ? 'es-pe' : 'sk-sk'
        },
        body: JSON.stringify({
          description: merchantName,
          amount: parseFloat(amount)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to categorize expense');
      }

      const result = await response.json();
      
      const results = {
        en: `✅ Real AI Categorization Complete\n\nMerchant: ${merchantName}\nAmount: $${amount}\nSuggested Category: ${result.category}\nConfidence: ${Math.round(result.confidence * 100)}%\nProcessing Time: ${result.processingTime || '0.3'} seconds\n\nAI Analysis: ${result.reasoning || 'Based on merchant analysis and spending patterns.'}`,
        es: `✅ Categorización IA Real Completa\n\nComerciante: ${merchantName}\nCantidad: $${amount}\nCategoría Sugerida: ${result.category}\nConfianza: ${Math.round(result.confidence * 100)}%\nTiempo de Procesamiento: ${result.processingTime || '0.3'} segundos\n\nAnálisis IA: ${result.reasoning || 'Basado en análisis del comerciante y patrones de gasto.'}`,
        sk: `✅ Skutočná AI Kategorizácia Dokončená\n\nObchodník: ${merchantName}\nSuma: $${amount}\nNavrhovaná Kategória: ${result.category}\nSpoľahlivosť: ${Math.round(result.confidence * 100)}%\nČas Spracovania: ${result.processingTime || '0.3'} sekúnd\n\nAI Analýza: ${result.reasoning || 'Na základe analýzy obchodníka a vzorov výdavkov.'}`
      };
      
      setDemoResult(results[demoLanguage as keyof typeof results]);
    } catch (error) {
      console.error('AI Demo Error:', error);
      const errorResults = {
        en: `❌ AI Demo Error\n\nPlease sign up for a free account to test the real AI categorization system.\n\nThis demo requires authentication to access our AI services.`,
        es: `❌ Error de Demo IA\n\nPor favor regístrate para una cuenta gratuita para probar el sistema real de categorización IA.\n\nEsta demo requiere autenticación para acceder a nuestros servicios de IA.`,
        sk: `❌ Chyba AI Demo\n\nProsím zaregistrujte sa pre bezplatný účet na testovanie skutočného AI kategorizačného systému.\n\nTáto demo vyžaduje autentifikáciu pre prístup k našim AI službám.`
      };
      setDemoResult(errorResults[demoLanguage as keyof typeof errorResults]);
    } finally {
      setDemoLoading(false);
    }
  };

  const aiFeatures = [
    {
      id: 'categorization',
      icon: Target,
      title: t('features.categorization.title'),
      badge: t('features.categorization.badge'),
      description: t('features.categorization.description'),
      benefits: [
        { title: t('features.categorization.benefits.instant.title'), desc: t('features.categorization.benefits.instant.desc') },
        { title: t('features.categorization.benefits.learning.title'), desc: t('features.categorization.benefits.learning.desc') },
        { title: t('features.categorization.benefits.custom.title'), desc: t('features.categorization.benefits.custom.desc') }
      ]
    },
    {
      id: 'tips',
      icon: Lightbulb,
      title: t('features.tips.title'),
      badge: t('features.tips.badge'),
      description: t('features.tips.description'),
      benefits: [
        { title: t('features.tips.benefits.patterns.title'), desc: t('features.tips.benefits.patterns.desc') },
        { title: t('features.tips.benefits.strategies.title'), desc: t('features.tips.benefits.strategies.desc') },
        { title: t('features.tips.benefits.optimization.title'), desc: t('features.tips.benefits.optimization.desc') },
        { title: t('features.tips.benefits.analysis.title'), desc: t('features.tips.benefits.analysis.desc') }
      ]
    },
    {
      id: 'insights',
      icon: BarChart3,
      title: t('features.insights.title'),
      badge: t('features.insights.badge'),
      description: t('features.insights.description'),
      benefits: [
        { title: t('features.insights.benefits.anomaly.title'), desc: t('features.insights.benefits.anomaly.desc') },
        { title: t('features.insights.benefits.trend.title'), desc: t('features.insights.benefits.trend.desc') },
        { title: t('features.insights.benefits.optimization.title'), desc: t('features.insights.benefits.optimization.desc') }
      ]
    },
    {
      id: 'health',
      icon: Heart,
      title: t('features.health.title'),
      badge: t('features.health.badge'),
      description: t('features.health.description'),
      benefits: [
        { title: t('features.health.benefits.scoring.title'), desc: t('features.health.benefits.scoring.desc') },
        { title: t('features.health.benefits.analysis.title'), desc: t('features.health.benefits.analysis.desc') },
        { title: t('features.health.benefits.plan.title'), desc: t('features.health.benefits.plan.desc') }
      ]
    },
    {
      id: 'statements',
      icon: FileText,
      title: t('features.statements.title'),
      badge: t('features.statements.badge'),
      description: t('features.statements.description'),
      benefits: [
        { title: t('features.statements.benefits.processing.title'), desc: t('features.statements.benefits.processing.desc') },
        { title: t('features.statements.benefits.ocr.title'), desc: t('features.statements.benefits.ocr.desc') },
        { title: t('features.statements.benefits.categorization.title'), desc: t('features.statements.benefits.categorization.desc') }
      ]
    },
    {
      id: 'predictions',
      icon: TrendingUp,
      title: t('features.predictions.title'),
      badge: t('features.predictions.badge'),
      description: t('features.predictions.description'),
      benefits: [
        { title: t('features.predictions.benefits.forecasting.title'), desc: t('features.predictions.benefits.forecasting.desc') },
        { title: t('features.predictions.benefits.seasonal.title'), desc: t('features.predictions.benefits.seasonal.desc') },
        { title: t('features.predictions.benefits.planning.title'), desc: t('features.predictions.benefits.planning.desc') }
      ]
    },
    {
      id: 'trends',
      icon: BarChart3,
      title: t('features.trends.title'),
      badge: t('features.trends.badge'),
      description: t('features.trends.description'),
      benefits: [
        { title: t('features.trends.benefits.category.title'), desc: t('features.trends.benefits.category.desc') },
        { title: t('features.trends.benefits.growth.title'), desc: t('features.trends.benefits.growth.desc') },
        { title: t('features.trends.benefits.adaptation.title'), desc: t('features.trends.benefits.adaptation.desc') }
      ]
    },
    {
      id: 'recommendations',
      icon: Calendar,
      title: t('features.recommendations.title'),
      badge: t('features.recommendations.badge'),
      description: t('features.recommendations.description'),
      benefits: [
        { title: t('features.recommendations.benefits.daily.title'), desc: t('features.recommendations.benefits.daily.desc') },
        { title: t('features.recommendations.benefits.action.title'), desc: t('features.recommendations.benefits.action.desc') },
        { title: t('features.recommendations.benefits.priority.title'), desc: t('features.recommendations.benefits.priority.desc') }
      ]
    },
    {
      id: 'contextual',
      icon: Brain,
      title: t('features.contextual.title'),
      badge: t('features.contextual.badge'),
      description: t('features.contextual.description'),
      benefits: [
        { title: t('features.contextual.benefits.realtime.title'), desc: t('features.contextual.benefits.realtime.desc') },
        { title: t('features.contextual.benefits.goal.title'), desc: t('features.contextual.benefits.goal.desc') },
        { title: t('features.contextual.benefits.budget.title'), desc: t('features.contextual.benefits.budget.desc') }
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
              {t('features.hero.title')}
            </h1>
            <p className="text-xl md:text-2xl mb-8 opacity-90 max-w-4xl mx-auto">
              {t('features.hero.subtitle')}
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-12">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold">9</div>
                <div className="text-sm opacity-80">{t('features.hero.stats.ai_functions')}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold">3</div>
                <div className="text-sm opacity-80">{t('features.hero.stats.languages')}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold">95%</div>
                <div className="text-sm opacity-80">{t('features.hero.stats.accuracy_rate')}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold">24/7</div>
                <div className="text-sm opacity-80">{t('features.hero.stats.ai_availability')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Free Expense Estimation Calculator */}
      <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('features.tools.title')}</h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            {t('features.tools.subtitle')}
          </p>
        </div>
        
        <div className="max-w-4xl mx-auto mb-16">
          <ExpenseEstimationCalculator isStandalone={true} />
        </div>
      </div>

      {/* Interactive AI Demo */}
      <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <Card className="mb-16 border-0 shadow-xl">
          <CardHeader className="text-center pb-8">
            <CardTitle className="text-3xl mb-4">{t('features.demo.title')}</CardTitle>
            <CardDescription className="text-lg">
              {t('features.demo.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('features.demo.merchant_label')}</h3>
                <Input
                  placeholder={t('features.demo.merchant_placeholder')}
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder={t('features.demo.amount_placeholder')}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <Select value={demoLanguage} onValueChange={setDemoLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">{t('features.demo.languages.en')}</SelectItem>
                    <SelectItem value="es">{t('features.demo.languages.es')}</SelectItem>
                    <SelectItem value="sk">{t('features.demo.languages.sk')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  onClick={runAIDemo} 
                  disabled={demoLoading}
                  className="w-full"
                  size="lg"
                >
                  {demoLoading ? (
                    <>
                      <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                      {t('features.demo.demo_loading')}
                    </>
                  ) : (
                    <>
                      <Brain className="mr-2 h-4 w-4" />
                      {t('features.demo.demo_button')}
                    </>
                  )}
                </Button>
              </div>
              
              <div className="bg-gradient-to-br from-blue-600 to-purple-700 text-white p-6 rounded-lg min-h-[300px] flex items-center">
                <div className="w-full">
                  <h3 className="text-lg font-semibold mb-4">{t('features.demo_result.title')}</h3>
                  {demoResult ? (
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed">{demoResult}</pre>
                  ) : (
                    <p className="opacity-80">{t('features.demo_result.placeholder')}</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Interactive Video Demos */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('features.video_demos.title', 'AI Feature Demonstrations')}</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              {t('features.video_demos.subtitle', 'Experience our AI features with interactive voice-guided demonstrations in your language.')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <DemoVideoCard
              title={t('features.video_demos.categorization.title', 'Smart Categorization')}
              description={t('features.video_demos.categorization.description', 'Watch how our AI intelligently categorizes your transactions based on merchant patterns and spending behavior.')}
              demoType="categorization"
            />
            
            <DemoVideoCard
              title={t('features.video_demos.tips.title', 'Financial Insights')}
              description={t('features.video_demos.tips.description', 'Discover how AI analyzes your spending patterns to provide personalized financial recommendations.')}
              demoType="tips"
            />
            
            <DemoVideoCard
              title={t('features.video_demos.health.title', 'Health Analysis')}
              description={t('features.video_demos.health.description', 'See how AI evaluates your financial health and provides actionable improvement strategies.')}
              demoType="health"
            />
          </div>
        </div>

        {/* Features Section */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('features.section.title')}</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              {t('features.section.subtitle')}
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
                    <CardTitle className="text-lg">{t('features.calculators.categorization.title')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span>{t('features.calculators.categorization.transactions_label')}</span>
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
                        <div className="text-sm text-muted-foreground">{t('features.calculators.categorization.time_saved')}</div>
                        <div className="text-xl font-bold text-blue-600">{calculateTimeSaved()} {t('features.calculators.categorization.hours')}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'tips' && (
                <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg">{t('features.calculators.savings.title')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span>{t('features.calculators.savings.expenses_label')}</span>
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
                        <div className="text-sm text-muted-foreground">{t('features.calculators.savings.potential_savings')}</div>
                        <div className="text-xl font-bold text-blue-600">{calculateSavings()}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'health' && (
                <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg">{t('features.calculators.health.title')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span>{t('features.calculators.health.savings_rate')}</span>
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
                          <span>{t('features.calculators.health.budget_adherence')}</span>
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
                        <div className="text-sm text-muted-foreground">{t('features.calculators.health.estimated_score')}</div>
                        <div className="text-xl font-bold text-blue-600">{calculateHealthScore()}/100</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'predictions' && (
                <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg">{t('features.calculators.predictions.title')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span>{t('features.calculators.predictions.historical_months')}</span>
                          <span className="font-semibold">{historicalMonths[0]} {t('features.calculators.predictions.months')}</span>
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
                        <div className="text-sm text-muted-foreground">{t('features.calculators.predictions.prediction_range')}</div>
                        <div className="text-xl font-bold text-blue-600">{calculatePredictionRange()} {t('features.calculators.predictions.months_ahead')}</div>
                      </div>
                      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border-l-4 border-green-600">
                        <div className="text-sm text-muted-foreground">{t('features.calculators.predictions.prediction_accuracy')}</div>
                        <div className="text-xl font-bold text-green-600">{Math.min(95, Math.floor(65 + (historicalMonths[0] * 1.1)))}%</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'statements' && (
                <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg">{t('features.calculators.statements.title')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span>{t('features.calculators.statements.pages')}</span>
                          <span className="font-semibold">{pagesInStatement[0]} {t('features.calculators.statements.pages_unit')}</span>
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
                        <div className="text-sm text-muted-foreground">{t('features.calculators.statements.estimated_transactions')}</div>
                        <div className="text-xl font-bold text-blue-600">{calculateExtractedTransactions()} {t('features.calculators.statements.transactions')}</div>
                      </div>
                      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border-l-4 border-green-600">
                        <div className="text-sm text-muted-foreground">{t('features.calculators.statements.processing_time')}</div>
                        <div className="text-xl font-bold text-green-600">{Math.floor(calculateExtractedTransactions() * 1.5)} {t('features.calculators.statements.minutes')}</div>
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
            <CardTitle className="text-3xl mb-4 text-white">{t('features.multilingual.title')}</CardTitle>
            <CardDescription className="text-blue-100 text-lg">
              {t('features.multilingual.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center p-6 bg-white/10 backdrop-blur rounded-lg">
                <Globe className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">{t('features.multilingual.english.title')}</h3>
                <p className="text-blue-100 text-sm">
                  {t('features.multilingual.english.description')}
                </p>
              </div>
              <div className="text-center p-6 bg-white/10 backdrop-blur rounded-lg">
                <Globe className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">{t('features.multilingual.spanish.title')}</h3>
                <p className="text-blue-100 text-sm">
                  {t('features.multilingual.spanish.description')}
                </p>
              </div>
              <div className="text-center p-6 bg-white/10 backdrop-blur rounded-lg">
                <Globe className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">{t('features.multilingual.slovak.title')}</h3>
                <p className="text-blue-100 text-sm">
                  {t('features.multilingual.slovak.description')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl mb-4">{t('features.cta.title')}</CardTitle>
            <CardDescription className="text-lg max-w-2xl mx-auto">
              {t('features.cta.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Button size="lg" onClick={handleSignUp} className="bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-700 hover:to-purple-800">
                <Zap className="mr-2 h-4 w-4" />
                {t('features.cta.start_free')}
              </Button>
              <Button size="lg" variant="outline" onClick={() => setLocation('/contact')}>
                <Clock className="mr-2 h-4 w-4" />
                {t('features.cta.watch_demo')}
              </Button>
            </div>
            
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center">
                <Shield className="mr-1 h-4 w-4 text-green-600" />
                {t('features.cta.guarantee')}
              </div>
              <div className="flex items-center">
                <DollarSign className="mr-1 h-4 w-4 text-green-600" />
                {t('features.cta.no_card')}
              </div>
              <div className="flex items-center">
                <Clock className="mr-1 h-4 w-4 text-green-600" />
                {t('features.cta.cancel_anytime')}
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </AppLayout>
  );
}