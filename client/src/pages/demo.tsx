import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Play, Pause, SkipForward, SkipBack, X } from "lucide-react";
import { useLocation } from "wouter";

interface DemoStep {
  id: number;
  title: string;
  description: string;
  screenshot: string;
  duration: number;
  features: string[];
}

const demoSteps: DemoStep[] = [
  {
    id: 1,
    title: "Dashboard Overview",
    description: "Complete financial overview showing $4,000 income, $577.15 expenses, and $3,422.85 net balance with real transaction data.",
    screenshot: "/attached_assets/image_1749915936622.png",
    duration: 4000,
    features: ["Real-time financial summary", "Income and expense tracking", "Transaction counters"]
  },
  {
    id: 2,
    title: "Budget Status Alert",
    description: "Critical budget monitoring showing 577% utilization and $477.15 overspending with clear visual indicators.",
    screenshot: "/attached_assets/image_1749916144876.png",
    duration: 4500,
    features: ["Budget status alerts", "Overspending warnings", "Financial health monitoring"]
  },
  {
    id: 3,
    title: "Budget Creation",
    description: "Create new budgets with intuitive category selection, amount specification, and flexible date ranges.",
    screenshot: "/attached_assets/image_1749915441662.png",
    duration: 4000,
    features: ["Category-based budgets", "Amount specification", "Date range selection"]
  },
  {
    id: 4,
    title: "Budget Management",
    description: "Edit existing budgets for Entertainment category with $100 amount and custom date ranges for precise control.",
    screenshot: "/attached_assets/image_1749916014048.png",
    duration: 4000,
    features: ["Budget editing", "Category selection", "Amount adjustments"]
  },
  {
    id: 5,
    title: "Budget Editing Interface",
    description: "Streamlined budget editing with dropdown category selection and date picker controls for easy modifications.",
    screenshot: "/attached_assets/image_1749915848462.png",
    duration: 4500,
    features: ["Category dropdown", "Date pickers", "Update controls"]
  },
  {
    id: 6,
    title: "Premium Features",
    description: "Upgrade to unlock AI-powered insights, advanced analytics, trend predictions, and comprehensive financial management tools.",
    screenshot: "/attached_assets/image_1749915441662.png",
    duration: 4500,
    features: ["AI insights", "Advanced analytics", "Trend predictions"]
  }
];

export default function Demo() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    document.title = "Demo - FinanzerPro";
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + 100;
          if (newProgress >= demoSteps[currentStep].duration) {
            if (currentStep < demoSteps.length - 1) {
              setCurrentStep(prev => prev + 1);
              return 0;
            } else {
              setIsPlaying(false);
              return demoSteps[currentStep].duration;
            }
          }
          return newProgress;
        });
      }, 100);
    }

    return () => clearInterval(interval);
  }, [isPlaying, currentStep]);

  const handlePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => {
    if (currentStep < demoSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
      setProgress(0);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      setProgress(0);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    setCurrentStep(stepIndex);
    setProgress(0);
    setIsPlaying(false);
  };

  const handleClose = () => {
    setLocation('/');
  };

  const handleGetStarted = () => {
    setLocation('/auth');
  };

  const progressPercentage = (progress / demoSteps[currentStep].duration) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-primary mr-3" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">FinanzerPro Demo</span>
            </div>
            <Button onClick={handleClose} variant="ghost" size="icon">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Demo Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Video/Screenshot Display */}
          <div className="lg:col-span-3">
            <Card className="overflow-hidden">
              <div className="relative bg-gray-900 aspect-video">
                <img 
                  src={demoSteps[currentStep].screenshot}
                  alt={demoSteps[currentStep].title}
                  className="w-full h-full object-contain bg-white"
                  onError={(e) => {
                    e.currentTarget.src = `https://via.placeholder.com/800x500/1f2937/ffffff?text=${encodeURIComponent(demoSteps[currentStep].title)}`;
                  }}
                />
                
                {/* Overlay with play button when not playing */}
                {!isPlaying && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <Button onClick={handlePlay} size="lg" className="bg-primary/90 hover:bg-primary text-white">
                      <Play className="h-6 w-6 mr-2" />
                      {currentStep === 0 ? 'Start Demo' : 'Continue'}
                    </Button>
                  </div>
                )}
                
                {/* Progress Bar */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-4">
                  <div className="flex items-center gap-4 mb-2">
                    <Button onClick={handlePrevious} variant="ghost" size="icon" className="text-white hover:bg-white/20">
                      <SkipBack className="h-4 w-4" />
                    </Button>
                    <Button onClick={handlePlay} variant="ghost" size="icon" className="text-white hover:bg-white/20">
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button onClick={handleNext} variant="ghost" size="icon" className="text-white hover:bg-white/20">
                      <SkipForward className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 bg-gray-600 rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-100"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                    <span className="text-white text-sm">
                      {currentStep + 1} / {demoSteps.length}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Step Information */}
              <CardContent className="p-6">
                <h2 className="text-2xl font-bold mb-2">{demoSteps[currentStep].title}</h2>
                <p className="text-muted-foreground mb-4">{demoSteps[currentStep].description}</p>
                
                <div className="flex flex-wrap gap-2">
                  {demoSteps[currentStep].features.map((feature, index) => (
                    <span key={index} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
                      {feature}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Step Navigation */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Demo Steps</CardTitle>
                <CardDescription>Click any step to jump to it</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {demoSteps.map((step, index) => (
                  <button
                    key={step.id}
                    onClick={() => handleStepClick(index)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      currentStep === index 
                        ? 'bg-primary text-white' 
                        : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="font-medium text-sm">{step.title}</div>
                    <div className={`text-xs mt-1 ${
                      currentStep === index ? 'text-white/80' : 'text-muted-foreground'
                    }`}>
                      Step {index + 1}
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* CTA Card */}
            <Card className="mt-6">
              <CardContent className="p-6 text-center">
                <h3 className="font-bold mb-2">Ready to get started?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Join thousands of users taking control of their finances with FinanzerPro
                </p>
                <Button onClick={handleGetStarted} className="w-full mb-3">
                  Start Free Today
                </Button>
                <p className="text-xs text-muted-foreground mb-3">
                  No credit card required • 3 free transactions
                </p>
                <div className="text-xs text-left space-y-1 bg-gray-50 dark:bg-gray-800 p-3 rounded">
                  <p className="font-medium">What you get free:</p>
                  <p>• Basic transaction tracking</p>
                  <p>• Manual categorization</p>
                  <p>• Simple dashboard</p>
                  <p className="text-primary font-medium mt-2">Upgrade for AI features & unlimited transactions</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}