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
  Zap
} from 'lucide-react';

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
  const [recsFollowed, setRecsFollowed] = useState([4]);
  const [contextFactors, setContextFactors] = useState([5]);
  const [primaryScore, setPrimaryScore] = useState([75]);

  const handleSignUp = () => {
    setLocation('/auth');
  };

  const runAIDemo = async () => {
    if (!merchantName || !amount) {
      alert('Please fill in all fields');
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
      title: 'Smart Transaction Categorization',
      badge: 'All Plans',
      description: 'Our AI automatically categorizes every transaction with 95% accuracy by analyzing merchant names, transaction patterns, and your spending history. No more manual sorting - just intelligent automation.',
      benefits: [
        { title: 'Instant Categorization', desc: 'Every transaction is automatically sorted the moment it\'s imported' },
        { title: 'Learning Algorithm', desc: 'Gets smarter with your spending patterns over time' },
        { title: 'Custom Categories', desc: 'Adapts to your business-specific category structure' }
      ]
    },
    {
      id: 'tips',
      icon: Lightbulb,
      title: 'AI Financial Analysis',
      badge: 'Standard+',
      description: 'Get detailed 4-section financial analysis covering spending patterns, saving recommendations, budget optimization, and advanced insights tailored to your business needs.',
      benefits: [
        { title: 'Spending Patterns', desc: 'Deep analysis of your spending behaviors and trends' },
        { title: 'Saving Strategies', desc: 'Personalized recommendations to optimize your cash flow' },
        { title: 'Budget Optimization', desc: 'Smart adjustments to maximize your budget efficiency' },
        { title: 'Advanced Analysis', desc: 'Professional-grade financial insights and forecasting' }
      ]
    },
    {
      id: 'insights',
      icon: BarChart3,
      title: 'Intelligent Spending Insights',
      badge: 'Standard+',
      description: 'Advanced analysis of your expense transactions to identify unusual patterns, optimization opportunities, and spending trends that matter to your business growth.',
      benefits: [
        { title: 'Anomaly Detection', desc: 'Automatically identifies unusual spending patterns' },
        { title: 'Trend Analysis', desc: 'Spots emerging trends in your business expenses' },
        { title: 'Optimization Tips', desc: 'Actionable recommendations to reduce costs' }
      ]
    },
    {
      id: 'health',
      icon: Heart,
      title: 'Health Score',
      badge: 'Premium',
      description: 'Comprehensive financial health analysis with personalized scoring (0-100) that includes detailed factor breakdown, risk assessment, and AI-powered improvement recommendations.',
      benefits: [
        { title: 'Real-time Scoring', desc: 'Live financial health score from 0-100' },
        { title: 'Factor Analysis', desc: 'Detailed breakdown of what affects your score' },
        { title: 'Improvement Plan', desc: 'Actionable steps to boost your financial health' }
      ]
    },
    {
      id: 'predictions',
      icon: TrendingUp,
      title: 'Expense Predictions',
      badge: 'Premium',
      description: 'Advanced predictive analytics that forecast future expense patterns based on your historical data, seasonal trends, and business growth indicators.',
      benefits: [
        { title: 'Future Forecasting', desc: 'Predict expenses up to 6 months ahead' },
        { title: 'Seasonal Analysis', desc: 'Account for seasonal business variations' },
        { title: 'Budget Planning', desc: 'Data-driven budget creation for future periods' }
      ]
    },
    {
      id: 'trends',
      icon: BarChart3,
      title: 'AI Trend Predictions',
      badge: 'Premium',
      description: 'Sophisticated trend analysis that provides AI-powered forecasting for category spending, identifies emerging patterns, and predicts financial trajectory changes.',
      benefits: [
        { title: 'Category Trends', desc: 'Track spending trends by expense category' },
        { title: 'Growth Indicators', desc: 'Identify business growth or decline signals' },
        { title: 'Market Adaptation', desc: 'Adjust strategies based on trend predictions' }
      ]
    },
    {
      id: 'recommendations',
      icon: Calendar,
      title: 'Daily AI Recommendations',
      badge: 'Standard+',
      description: 'Start each day with personalized financial recommendations generated by AI analysis of your recent activity, upcoming obligations, and optimization opportunities.',
      benefits: [
        { title: 'Daily Fresh Insights', desc: 'New recommendations every 24 hours' },
        { title: 'Action-Oriented', desc: 'Specific steps you can take today' },
        { title: 'Priority-Based', desc: 'Most important recommendations first' }
      ]
    },
    {
      id: 'contextual',
      icon: Brain,
      title: 'Smart Financial Advisor',
      badge: 'Standard+',
      description: 'Intelligent financial advice that adapts to your current month\'s spending, budget status, and goal progress to provide the most relevant guidance when you need it.',
      benefits: [
        { title: 'Real-time Context', desc: 'Advice based on current financial situation' },
        { title: 'Goal-Aligned', desc: 'Tips that help achieve your specific goals' },
        { title: 'Budget-Aware', desc: 'Considers your budget constraints and targets' }
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

  return (
    <AppLayout isPublicPage={true}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-700 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 py-20 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              AI-Powered Financial Intelligence
            </h1>
            <p className="text-xl md:text-2xl mb-8 opacity-90 max-w-4xl mx-auto">
              Transform your business finances with 8 intelligent AI features that learn, adapt, and optimize your financial decisions in real-time.
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-12">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold">8</div>
                <div className="text-sm opacity-80">AI Functions</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold">3</div>
                <div className="text-sm opacity-80">Languages</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold">95%</div>
                <div className="text-sm opacity-80">Accuracy Rate</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold">24/7</div>
                <div className="text-sm opacity-80">AI Availability</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive AI Demo */}
      <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <Card className="mb-16 border-0 shadow-xl">
          <CardHeader className="text-center pb-8">
            <CardTitle className="text-3xl mb-4">Try Our AI Categorization</CardTitle>
            <CardDescription className="text-lg">
              See how our AI instantly categorizes your expenses with intelligent analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Enter Transaction Details</h3>
                <Input
                  placeholder="Merchant name (e.g., Starbucks)"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Amount (e.g., 15.50)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <Select value={demoLanguage} onValueChange={setDemoLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="sk">Slovak</SelectItem>
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
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Brain className="mr-2 h-4 w-4" />
                      Analyze with AI
                    </>
                  )}
                </Button>
              </div>
              
              <div className="bg-gradient-to-br from-blue-600 to-purple-700 text-white p-6 rounded-lg min-h-[300px] flex items-center">
                <div className="w-full">
                  <h3 className="text-lg font-semibold mb-4">AI Analysis Result</h3>
                  {demoResult ? (
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed">{demoResult}</pre>
                  ) : (
                    <p className="opacity-80">Enter transaction details to see AI categorization in action...</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features Section */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Complete AI Feature Suite</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Explore each of our 9 intelligent AI functions designed to revolutionize your financial management
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
                    <CardTitle className="text-lg">Categorization Accuracy Calculator</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span>Transactions per month:</span>
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
                        <div className="text-sm text-muted-foreground">Time saved per month:</div>
                        <div className="text-xl font-bold text-blue-600">{calculateTimeSaved()} hours</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'tips' && (
                <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg">Potential Savings Calculator</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span>Monthly expenses:</span>
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
                        <div className="text-sm text-muted-foreground">Potential monthly savings (5-15%):</div>
                        <div className="text-xl font-bold text-blue-600">{calculateSavings()}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'health' && (
                <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg">Health Score Simulator</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span>Savings rate:</span>
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
                          <span>Budget adherence:</span>
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
                        <div className="text-sm text-muted-foreground">Estimated Financial Health Score:</div>
                        <div className="text-xl font-bold text-blue-600">{calculateHealthScore()}/100</div>
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
            <CardTitle className="text-3xl mb-4 text-white">Global Financial Intelligence</CardTitle>
            <CardDescription className="text-blue-100 text-lg">
              Our AI speaks your language and understands your cultural financial context
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center p-6 bg-white/10 backdrop-blur rounded-lg">
                <Globe className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">English</h3>
                <p className="text-blue-100 text-sm">
                  Complete AI analysis in English with US business context and financial terminology
                </p>
              </div>
              <div className="text-center p-6 bg-white/10 backdrop-blur rounded-lg">
                <Globe className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Español</h3>
                <p className="text-blue-100 text-sm">
                  Análisis completo de IA en español con contexto empresarial latinoamericano
                </p>
              </div>
              <div className="text-center p-6 bg-white/10 backdrop-blur rounded-lg">
                <Globe className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Slovenčina</h3>
                <p className="text-blue-100 text-sm">
                  Kompletná AI analýza v slovenčine s kontextom európskeho podnikania
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl mb-4">Ready to Transform Your Financial Management?</CardTitle>
            <CardDescription className="text-lg max-w-2xl mx-auto">
              Join thousands of entrepreneurs who have revolutionized their business finances with AI-powered insights
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Button size="lg" onClick={handleSignUp} className="bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-700 hover:to-purple-800">
                <Zap className="mr-2 h-4 w-4" />
                Start with Free Account
              </Button>
              <Button size="lg" variant="outline" onClick={() => setLocation('/contact')}>
                <Clock className="mr-2 h-4 w-4" />
                Watch Demo
              </Button>
            </div>
            
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center">
                <Shield className="mr-1 h-4 w-4 text-green-600" />
                30-day money-back guarantee
              </div>
              <div className="flex items-center">
                <DollarSign className="mr-1 h-4 w-4 text-green-600" />
                No credit card required
              </div>
              <div className="flex items-center">
                <Clock className="mr-1 h-4 w-4 text-green-600" />
                Cancel anytime
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </AppLayout>
  );
}