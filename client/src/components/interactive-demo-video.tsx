import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX,
  Maximize,
  ChevronLeft,
  ChevronRight,
  Target,
  Lightbulb,
  BarChart3,
  Heart,
  FileText,
  TrendingUp,
  Calendar,
  Brain,
  Sparkles
} from 'lucide-react';

interface DemoStep {
  id: string;
  title: string;
  description: string;
  duration: number;
  thumbnail: string;
  voiceover: string;
  actions: DemoAction[];
}

interface DemoAction {
  type: 'click' | 'type' | 'highlight' | 'result' | 'wait';
  target?: string;
  value?: string;
  duration: number;
  description: string;
}

interface VideoDemoProps {
  featureId: string;
  onClose?: () => void;
}

const InteractiveDemoVideo: React.FC<VideoDemoProps> = ({ featureId, onClose }) => {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentAction, setCurrentAction] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Demo data for each AI function
  const demoScenarios = {
    categorization: {
      title: t('features.categorization.title'),
      icon: Target,
      color: 'from-blue-600 to-purple-700',
      steps: [
        {
          id: 'upload',
          title: 'Upload Receipt',
          description: 'User uploads a Starbucks receipt',
          duration: 3000,
          thumbnail: '/demo-thumbnails/receipt-upload.jpg',
          voiceover: 'Start by uploading any receipt or entering transaction details manually',
          actions: [
            { type: 'click', target: 'upload-button', duration: 500, description: 'Click upload button' },
            { type: 'wait', duration: 1000, description: 'File picker opens' },
            { type: 'click', target: 'receipt-file', duration: 500, description: 'Select receipt image' },
            { type: 'wait', duration: 1000, description: 'Image processing begins' }
          ]
        },
        {
          id: 'ocr',
          title: 'OCR Processing',
          description: 'AI extracts text from the receipt',
          duration: 4000,
          thumbnail: '/demo-thumbnails/ocr-processing.jpg',
          voiceover: 'Our advanced OCR technology instantly reads the receipt and extracts key information',
          actions: [
            { type: 'highlight', target: 'receipt-image', duration: 1000, description: 'Highlight receipt' },
            { type: 'result', target: 'extracted-text', duration: 2000, description: 'Show extracted text' },
            { type: 'wait', duration: 1000, description: 'Processing animation' }
          ]
        },
        {
          id: 'categorization',
          title: 'AI Categorization',
          description: 'AI analyzes merchant and suggests category',
          duration: 5000,
          thumbnail: '/demo-thumbnails/ai-analysis.jpg',
          voiceover: 'AI analyzes the merchant name, amount, and your spending patterns to suggest the perfect category',
          actions: [
            { type: 'highlight', target: 'merchant-name', duration: 1500, description: 'Highlight Starbucks' },
            { type: 'result', target: 'ai-thinking', duration: 2000, description: 'Show AI analysis' },
            { type: 'result', target: 'suggested-category', duration: 1500, description: 'Food & Dining suggested' }
          ]
        },
        {
          id: 'save',
          title: 'Save Transaction',
          description: 'Transaction saved with 95% confidence',
          duration: 2000,
          thumbnail: '/demo-thumbnails/transaction-saved.jpg',
          voiceover: 'The transaction is automatically categorized and saved to your financial records',
          actions: [
            { type: 'click', target: 'save-button', duration: 500, description: 'Click save' },
            { type: 'result', target: 'success-message', duration: 1500, description: 'Transaction saved' }
          ]
        }
      ]
    },
    tips: {
      title: t('features.tips.title'),
      icon: Lightbulb,
      color: 'from-green-600 to-blue-700',
      steps: [
        {
          id: 'dashboard',
          title: 'Access AI Analysis',
          description: 'Navigate to AI financial analysis',
          duration: 3000,
          thumbnail: '/demo-thumbnails/dashboard-nav.jpg',
          voiceover: 'Access your personalized AI financial analysis from the dashboard',
          actions: [
            { type: 'click', target: 'ai-analysis-card', duration: 1000, description: 'Click AI Analysis' },
            { type: 'wait', duration: 2000, description: 'Loading analysis' }
          ]
        },
        {
          id: 'analysis',
          title: 'AI Generates Insights',
          description: '4-section detailed financial analysis',
          duration: 8000,
          thumbnail: '/demo-thumbnails/ai-insights.jpg',
          voiceover: 'AI analyzes your spending patterns, identifies optimization opportunities, and provides actionable recommendations',
          actions: [
            { type: 'result', target: 'spending-patterns', duration: 2000, description: 'Show spending analysis' },
            { type: 'result', target: 'saving-strategies', duration: 2000, description: 'Show savings tips' },
            { type: 'result', target: 'budget-optimization', duration: 2000, description: 'Show budget tips' },
            { type: 'result', target: 'advanced-insights', duration: 2000, description: 'Show forecasts' }
          ]
        }
      ]
    },
    health: {
      title: t('features.health.title'),
      icon: Heart,
      color: 'from-pink-600 to-red-700',
      steps: [
        {
          id: 'scoring',
          title: 'Financial Health Calculation',
          description: 'AI calculates comprehensive health score',
          duration: 6000,
          thumbnail: '/demo-thumbnails/health-score.jpg',
          voiceover: 'AI analyzes multiple financial factors to calculate your comprehensive health score',
          actions: [
            { type: 'result', target: 'score-calculation', duration: 3000, description: 'Show score calculation' },
            { type: 'result', target: 'final-score', duration: 2000, description: 'Display 78/100 score' },
            { type: 'result', target: 'improvement-plan', duration: 1000, description: 'Show improvement tips' }
          ]
        }
      ]
    },
    statements: {
      title: t('features.statements.title'),
      icon: FileText,
      color: 'from-orange-600 to-yellow-700',
      steps: [
        {
          id: 'upload-pdf',
          title: 'Upload Bank Statement',
          description: 'Upload PDF bank statement',
          duration: 4000,
          thumbnail: '/demo-thumbnails/pdf-upload.jpg',
          voiceover: 'Upload your bank statement PDF and watch AI extract every transaction automatically',
          actions: [
            { type: 'click', target: 'pdf-upload', duration: 1000, description: 'Upload PDF' },
            { type: 'wait', duration: 3000, description: 'PDF processing' }
          ]
        },
        {
          id: 'extraction',
          title: 'AI Transaction Extraction',
          description: 'Extract and categorize transactions',
          duration: 7000,
          thumbnail: '/demo-thumbnails/transaction-extraction.jpg',
          voiceover: 'AI identifies transaction patterns, extracts amounts and dates, then categorizes each transaction',
          actions: [
            { type: 'result', target: 'transactions-found', duration: 3000, description: 'Show 47 transactions found' },
            { type: 'result', target: 'categorization-progress', duration: 3000, description: 'Show auto-categorization' },
            { type: 'result', target: 'completion', duration: 1000, description: 'Processing complete' }
          ]
        }
      ]
    }
  };

  const currentDemo = demoScenarios[featureId as keyof typeof demoScenarios];
  const FeatureIcon = currentDemo?.icon || Target;

  useEffect(() => {
    if (isPlaying && currentDemo) {
      const step = currentDemo.steps[currentStep];
      const action = step.actions[currentAction];
      
      intervalRef.current = setTimeout(() => {
        if (currentAction < step.actions.length - 1) {
          setCurrentAction(prev => prev + 1);
        } else if (currentStep < currentDemo.steps.length - 1) {
          setCurrentStep(prev => prev + 1);
          setCurrentAction(0);
        } else {
          setIsPlaying(false);
          setProgress(100);
        }
      }, action.duration);
    }

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [isPlaying, currentStep, currentAction, currentDemo]);

  const handlePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleRestart = () => {
    setIsPlaying(false);
    setCurrentStep(0);
    setCurrentAction(0);
    setProgress(0);
  };

  const handleStepChange = (direction: 'prev' | 'next') => {
    setIsPlaying(false);
    if (direction === 'prev' && currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    } else if (direction === 'next' && currentStep < currentDemo.steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
    setCurrentAction(0);
  };

  if (!currentDemo) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-8 text-center">
          <p>Demo not available for this feature yet.</p>
        </CardContent>
      </Card>
    );
  }

  const currentStepData = currentDemo.steps[currentStep];
  const currentActionData = currentStepData.actions[currentAction];

  return (
    <Card className={`w-full max-w-6xl mx-auto ${isFullscreen ? 'fixed inset-4 z-50' : ''}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 bg-gradient-to-br ${currentDemo.color} text-white rounded-lg`}>
              <FeatureIcon className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl">{currentDemo.title}</CardTitle>
              <p className="text-sm text-muted-foreground">Interactive Demo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {currentStep + 1} / {currentDemo.steps.length}
            </Badge>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                ×
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Video Player Area */}
        <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg overflow-hidden aspect-video">
          {/* Demo Visualization */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white p-8">
              <div className="mb-4">
                <FeatureIcon className="h-16 w-16 mx-auto mb-4 text-blue-400" />
                <h3 className="text-2xl font-bold mb-2">{currentStepData.title}</h3>
                <p className="text-gray-300 mb-4">{currentStepData.description}</p>
              </div>
              
              {/* Current Action Indicator */}
              <div className="bg-black/50 rounded-lg p-4 max-w-md mx-auto">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Now: {currentActionData.description}</span>
                </div>
                <div className="text-xs text-gray-400">{currentStepData.voiceover}</div>
              </div>
            </div>
          </div>
          
          {/* Play/Pause Overlay */}
          {!isPlaying && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <Button 
                variant="ghost" 
                size="lg" 
                onClick={handlePlay}
                className="text-white hover:bg-white/20"
              >
                <Play className="h-12 w-12" />
              </Button>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handlePlay}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleRestart}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsMuted(!isMuted)}>
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => handleStepChange('prev')}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-2">{currentStepData.title}</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => handleStepChange('next')}
              disabled={currentStep === currentDemo.steps.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className={`bg-gradient-to-r ${currentDemo.color} h-2 rounded-full transition-all duration-300`}
            style={{ 
              width: `${((currentStep * 100) + (currentAction * 100 / currentStepData.actions.length)) / currentDemo.steps.length}%` 
            }}
          ></div>
        </div>

        {/* Step Timeline */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {currentDemo.steps.map((step, index) => (
            <div 
              key={step.id}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                index === currentStep 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
              onClick={() => {
                setCurrentStep(index);
                setCurrentAction(0);
                setIsPlaying(false);
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  index === currentStep ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'
                }`}>
                  {index + 1}
                </div>
                <h4 className="font-medium text-sm">{step.title}</h4>
              </div>
              <p className="text-xs text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white rounded-lg p-6 text-center">
          <h3 className="text-xl font-bold mb-2">{t('features.demo.signup_prompt')}</h3>
          <p className="mb-4 opacity-90">Experience all 9 AI-powered features with your own financial data</p>
          <Button variant="secondary" size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
            {t('features.demo.signup_button')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default InteractiveDemoVideo;