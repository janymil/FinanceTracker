import { useState, useEffect } from "react";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { X, Settings, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { useToast } from "../hooks/use-toast";

interface MascotData {
  id: string;
  userId: string;
  imageUrl: string;
  healthScore: number;
  mood: string;
  lastGenerated: string;
  isEnabled: boolean;
}

interface FinancialHealth {
  score: number;
  trend: string;
  category: string;
}

export function FinancialMascot() {
  const { isReady, user } = useClerkUserReady();
  const { toast } = useToast();
  const [showSettings, setShowSettings] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Get user's financial health data
  const { data: financialHealth } = useQuery<FinancialHealth>({
    queryKey: ["/api/financial-health"],
    enabled: isReady && !!user?.id,
    refetchInterval: 5 * 60 * 1000, // Check every 5 minutes
    staleTime: 0,
    gcTime: 0,
  });

  // Get mascot data
  const { data: mascot, isLoading, refetch } = useQuery<MascotData>({
    queryKey: ["/api/mascot"],
    queryFn: async () => {
      const token = await window.Clerk.session?.getToken();
      const response = await fetch("/api/mascot", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        credentials: "include"
      });
      if (!response.ok) throw new Error('Failed to fetch mascot');
      return response.json();
    },
    enabled: isReady && !!user?.id,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    gcTime: 1000 * 60 * 10, // Keep in garbage collection for 10 minutes
  });



  // Generate new mascot
  const generateMascot = async () => {
    try {
      const response = await apiRequest('POST', '/api/mascot/generate');
      // Force immediate refetch to show new image
      await refetch();
      toast({ title: "New mascot generated!" });
      setIsGenerating(false);
    } catch (error: any) {
      toast({ title: "Failed to generate mascot", variant: "destructive" });
      setIsGenerating(false);
    }
  };

  // Toggle mascot visibility
  const toggleMascot = async (enabled: boolean) => {
    try {
      const response = await apiRequest('POST', '/api/mascot/toggle', { enabled });
      await queryClient.invalidateQueries({ queryKey: ["/api/mascot"] });
    } catch (error: any) {
      toast({ title: "Failed to toggle mascot", variant: "destructive" });
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    generateMascot();
  };

  const handleToggle = (enabled: boolean) => {
    toggleMascot(enabled);
  };

  // Don't render if user is not authenticated or mascot is disabled
  if (!isReady || !user?.id || !mascot?.isEnabled || isLoading) {
    return null;
  }

  // Determine mascot mood based on financial health
  const getMascotMood = (score: number) => {
    if (score >= 80) return "excellent";
    if (score >= 60) return "good";
    if (score >= 40) return "neutral";
    if (score >= 20) return "concerned";
    return "worried";
  };

  const currentMood = financialHealth ? getMascotMood(financialHealth.score) : "neutral";
  const shouldRegenerateMascot = mascot && Math.abs(mascot.healthScore - (financialHealth?.score || 0)) > 20;

  return (
    <>
      {/* Floating Mascot */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end space-y-2">
        {/* Settings Panel */}
        {showSettings && (
          <Card className="w-64 shadow-lg border border-gray-200 dark:border-gray-700">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Financial Mascot</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mascot-enabled" className="text-xs">
                    Show Mascot
                  </Label>
                  <Switch
                    id="mascot-enabled"
                    checked={mascot?.isEnabled || false}
                    onCheckedChange={handleToggle}
                  />
                </div>

                {mascot?.isEnabled && (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Current Mood:</span>
                        <Badge variant="outline" className="text-xs">
                          {currentMood}
                        </Badge>
                      </div>
                      
                      {financialHealth && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Health Score:</span>
                          <span className="text-xs font-medium">{financialHealth.score}%</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        onClick={handleGenerate}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <>
                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3 mr-1" />
                            Generate New
                          </>
                        )}
                      </Button>

                      {shouldRegenerateMascot && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Your financial health changed! Consider generating a new mascot.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mascot Container */}
        <div className="relative group">
          {/* Settings Button */}
          <Button
            variant="ghost"
            size="sm"
            className="absolute -top-2 -left-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-full z-10"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-3 w-3" />
          </Button>

          {/* Mascot Image */}
          <div className="relative">
            {mascot?.imageUrl ? (
              <img
                src={mascot.imageUrl}
                alt={`Financial mascot showing ${currentMood} mood`}
                className="w-20 h-20 rounded-full shadow-lg border-2 border-white dark:border-gray-700 cursor-pointer hover:scale-105 transition-transform animate-bounce"
                style={{ 
                  animationDuration: '3s',
                  animationIterationCount: 'infinite',
                  animationDirection: 'alternate'
                }}
                onClick={() => setShowSettings(!showSettings)}
              />
            ) : (
              <div 
                className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 shadow-lg border-2 border-white dark:border-gray-700 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Sparkles className="h-8 w-8 text-white" />
              </div>
            )}

            {/* Health Score Indicator */}
            {financialHealth && (
              <div className="absolute -bottom-1 -right-1 bg-white dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700 px-1.5 py-0.5">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  {financialHealth.score}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}