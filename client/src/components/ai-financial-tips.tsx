import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain } from 'lucide-react';
import { RequirePlan } from './require-plan';
import { useClerkUserReady } from '@/hooks/useClerkUserReady';

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

function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('clerk-token') || ''}`
  };
}

export default function AIFinancialTips({ summary }: AIFinancialTipsProps) {
  const { isReady: isUserReady, user } = useClerkUserReady();
  const [tips, setTips] = useState<FinancialTip[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load stored tips on component mount
  useEffect(() => {
    if (!isUserReady || !user?.id) return;

    const loadStoredTips = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/ai/tips/stored', {
          headers: getAuthHeaders()
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.tips && Array.isArray(data.tips) && data.tips.length > 0) {
            setTips(data.tips);
          }
        }
      } catch (error) {
        console.error('Error loading stored tips:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredTips();
  }, [isUserReady, user?.id]);

  const generateNewTips = async () => {
    if (!summary || !isUserReady || !user?.id) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/tip', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          totalIncome: summary.totalIncome,
          totalExpenses: summary.totalExpenses,
          transactionsByCategory: summary.transactionsByCategory
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.tips && Array.isArray(data.tips)) {
          setTips(data.tips);
        }
      } else {
        console.error('Failed to generate tips:', response.statusText);
      }
    } catch (error) {
      console.error('Error generating tips:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <RequirePlan plan="premium" feature="AI Financial Tips">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-500" />
            AI Financial Tips
          </CardTitle>
          <CardDescription>
            Get personalized financial advice based on your spending patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!tips ? (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-3">Personalized AI Analysis</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Generate insights based on your monthly spending data
                </p>
              </div>
              
              <div>
                <h5 className="text-sm font-medium mb-2">AI Analysis Features:</h5>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    Spending pattern analysis
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    Personalized saving recommendations
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    Budget optimization suggestions
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    Context-aware financial advice
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button 
                  onClick={generateNewTips} 
                  disabled={isGenerating || !summary}
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Get AI Tip
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {tips.map((tip: FinancialTip, index: number) => (
                <div key={index} className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border">
                  <div className="flex items-start gap-3">
                    <Brain className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-medium text-sm mb-1">{tip.title}</h4>
                      <p className="text-sm text-muted-foreground">{tip.description}</p>
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="flex justify-end mt-4">
                <Button 
                  onClick={generateNewTips} 
                  disabled={isGenerating || !summary}
                  variant="outline"
                  size="sm"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Generating New Tips...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Get New AI Tip
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