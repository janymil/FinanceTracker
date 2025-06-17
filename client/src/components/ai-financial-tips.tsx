import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, Sparkles, TrendingUp, GraduationCap, Brain, AlertTriangle, Target, DollarSign, PiggyBank, BarChart3 } from "lucide-react";
import { useClerkUserReady } from '@/hooks/useClerkUserReady';
import { useToast } from "@/hooks/use-toast";
import RequirePlan from "./require-plan";

interface FinancialTip {
  id: string;
  type: 'warning' | 'suggestion' | 'achievement' | 'trend';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  category?: string;
  amount?: number;
  recommendation?: string;
  actionable: boolean;
}

interface AIFinancialTipsProps {
  summary?: {
    totalIncome: number;
    totalExpenses: number;
    transactionsByCategory: Array<{
      categoryName: string;
      amount: number;
      type: string;
    }>;
  };
}

export default function AIFinancialTips({ summary }: AIFinancialTipsProps) {
  const { toast } = useToast();
  const { isLoaded, isSignedIn, user, getAuthHeaders } = useClerkUserReady();
  const [tips, setTips] = useState<FinancialTip[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<string>('free');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  // Fetch user plan
  useEffect(() => {
    const fetchUserPlan = async () => {
      if (!isLoaded || !isSignedIn || !user?.id) return;
      
      try {
        const authHeaders = await getAuthHeaders();
        const response = await fetch('/api/auth/user', {
          headers: authHeaders
        });
        if (response.ok) {
          const userData = await response.json();
          setUserPlan(userData.plan || 'free');
        }
      } catch (error) {
        console.error('Error fetching user plan:', error);
      }
    };

    fetchUserPlan();
  }, [isLoaded, isSignedIn, user?.id, getAuthHeaders]);

  // Load stored tips on component mount
  useEffect(() => {
    const loadStoredTips = async () => {
      if (!isLoaded || !isSignedIn || !user?.id || userPlan !== 'premium') {
        setIsLoading(false);
        return;
      }

      try {
        const authHeaders = await getAuthHeaders();
        const response = await fetch('/api/ai/tips/stored', {
          headers: authHeaders
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.tips) {
            setTips(data.tips);
            setGeneratedAt(data.generatedAt);
          }
        }
      } catch (error) {
        console.error('Error loading stored tips:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredTips();
  }, [isLoaded, isSignedIn, user?.id, userPlan]);

  const generateNewTips = async () => {
    if (!summary || !isLoaded || !isSignedIn || !user?.id) return;
    
    try {
      setIsGenerating(true);
      
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/ai/tip', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          totalIncome: summary.totalIncome,
          totalExpenses: summary.totalExpenses,
          transactionsByCategory: summary.transactionsByCategory
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.tips) {
          setTips(data.tips);
          setGeneratedAt(new Date().toISOString());
          toast({
            title: "AI Tips Generated",
            description: "Your personalized financial insights have been updated!",
          });
        }
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "Failed to generate AI tips",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error generating tips:', error);
      toast({
        title: "Error",
        description: "Failed to generate AI tips. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getIconForType = (type: string) => {
    const iconMap: Record<string, any> = {
      'warning': AlertTriangle,
      'suggestion': Lightbulb,
      'achievement': Target,
      'trend': TrendingUp,
      'spending': DollarSign,
      'saving': PiggyBank,
      'analysis': BarChart3
    };
    return iconMap[type] || Brain;
  };

  const getColorForType = (type: string) => {
    const colorMap: Record<string, string> = {
      'warning': 'text-red-500',
      'suggestion': 'text-blue-500',
      'achievement': 'text-green-500',
      'trend': 'text-purple-500',
      'spending': 'text-orange-500',
      'saving': 'text-teal-500',
      'analysis': 'text-indigo-500'
    };
    return colorMap[type] || 'text-gray-500';
  };

  const parseAndGroupTips = (tips: FinancialTip[]) => {
    const sections: Record<string, any[]> = {
      'Spending Pattern Analysis': [],
      'Personalized Saving Recommendations': [],
      'Budget Optimization Suggestions': [],
      'Context-Aware Financial Advice': []
    };

    tips.forEach(tip => {
      const content = tip.description;
      
      // Group content by type and keywords
      if (content.includes('spending') || content.includes('expense') || tip.type === 'warning') {
        sections['Spending Pattern Analysis'].push(tip);
      } else if (content.includes('saving') || content.includes('save') || tip.type === 'achievement') {
        sections['Personalized Saving Recommendations'].push(tip);
      } else if (content.includes('budget') || content.includes('optimization') || tip.type === 'suggestion') {
        sections['Budget Optimization Suggestions'].push(tip);
      } else {
        sections['Context-Aware Financial Advice'].push(tip);
      }
    });

    return sections;
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            AI Financial Tips
          </CardTitle>
          <CardDescription>Sign in to access AI-powered financial insights</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <RequirePlan plan="premium" feature="AI Financial Tips">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            AI Financial Tips
            <Sparkles className="h-4 w-4 text-yellow-500" />
          </CardTitle>
          <CardDescription>
            Sophisticated AI-powered financial analysis with personalized recommendations
            {generatedAt && (
              <div className="text-xs text-muted-foreground mt-1">
                Last updated: {new Date(generatedAt).toLocaleDateString()}
              </div>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : !tips ? (
            <div className="text-center py-8">
              <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                No AI analysis available yet. Generate personalized insights based on your financial data.
              </p>
              <Button 
                onClick={generateNewTips} 
                disabled={isGenerating || !summary}
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Generate AI Insights
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Display organized sections */}
              {Object.entries(parseAndGroupTips(tips)).map(([sectionTitle, sectionTips]) => {
                if (sectionTips.length === 0) return null;
                
                const Icon = getIconForType(sectionTitle.toLowerCase().includes('spending') ? 'spending' : 
                                         sectionTitle.toLowerCase().includes('saving') ? 'saving' :
                                         sectionTitle.toLowerCase().includes('budget') ? 'suggestion' : 'analysis');
                
                return (
                  <div key={sectionTitle} className="space-y-3">
                    <h4 className="flex items-center gap-2 font-semibold text-sm">
                      <Icon className={`h-4 w-4 ${getColorForType(sectionTitle.toLowerCase().includes('spending') ? 'spending' : 
                                                                  sectionTitle.toLowerCase().includes('saving') ? 'saving' :
                                                                  sectionTitle.toLowerCase().includes('budget') ? 'suggestion' : 'analysis')}`} />
                      {sectionTitle}
                    </h4>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                      {sectionTips.map((tip, index) => (
                        <div key={`${sectionTitle}-${index}`} className="text-sm leading-relaxed">
                          <strong className="text-foreground">{tip.title}:</strong>{' '}
                          <span className="text-muted-foreground">{tip.description}</span>
                          {tip.recommendation && (
                            <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                              💡 {tip.recommendation}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Generate new tips button */}
              <div className="pt-4 border-t">
                <Button 
                  onClick={generateNewTips} 
                  disabled={isGenerating || !summary}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Generating Fresh Insights...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate New Insights
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </RequirePlan>
  );
}