import { useState, useEffect } from "react";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { X, Settings, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { useToast } from "../hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useDashboardOverview } from "@/components/dashboard/overviewShared";

interface MascotData {
  id: string;
  userId: string;
  imageUrl: string;
  healthScore: number;
  mood: string;
  lastGenerated: string;
  isEnabled: boolean;
}

export function FinancialMascot() {
  const { isReady, user } = useClerkUserReady();
  const { toast } = useToast();
  const [showSettings, setShowSettings] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mascot, setMascot] = useState<MascotData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Default: bottom-right corner; on a phone, above the bottom bar (MobileBottomNav, 68px).
  const [position, setPosition] = useState(() => ({
    x: 16,
    y: typeof window !== 'undefined' && window.innerWidth < 1024 ? 84 : 16,
  }));
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const { t } = useTranslation();

  /*
   * The face needs one number, and the app can compute it.
   *
   * This component used to call the AI health endpoint for the whole answer - from every page,
   * next to the dashboard card that asks for the same thing, and with three retries of its own.
   * Two AI calls for one screen is what pushed the tips panel past the server's concurrency
   * limit, and the panel then said "no tips for this period" about a month that had plenty.
   * The score here is the same rubric the card prints, computed from data already in the cache.
   */
  // This month's score from the dashboard overview: the same rubric and the same time zone as the
  // score card. It used to ask for the month summary without saying which month, which the server
  // refuses (400), so the face never had a number.
  const overviewQuery = useDashboardOverview(undefined);
  const financialHealth = overviewQuery.data ? { score: overviewQuery.data.health.score } : null;

  // Fetch mascot data
  const fetchMascot = async () => {
    if (!isReady || !user?.id) return;

    try {
      const token = await window.Clerk?.session?.getToken();
      const response = await fetch("/api/mascot", {
        headers: {
          ...(token && { "Authorization": `Bearer ${token}` }),
          "Content-Type": "application/json"
        },
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setMascot(data);
        // Cache mascot data for production fallback
        localStorage.setItem(`mascot_${user.id}`, JSON.stringify(data));
      } else if (response.status === 401 || response.status === 403) {
        console.log('Mascot API: Authentication issue, checking localStorage for cached mascot data');
        // Try to get cached mascot data from localStorage for production fallback
        const cachedMascot = localStorage.getItem(`mascot_${user.id}`);
        if (cachedMascot) {
          try {
            const parsedMascot = JSON.parse(cachedMascot);
            setMascot(parsedMascot);
            return;
          } catch (parseError) {
            console.warn('Failed to parse cached mascot data');
          }
        }

        // Set a default mascot state for unauthenticated users
        setMascot({
          id: '',
          userId: user?.id || '',
          imageUrl: '',
          healthScore: 50,
          mood: 'neutral',
          lastGenerated: '',
          isEnabled: true
        });
      } else {
        console.error('Mascot API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to fetch mascot:', error);
      // Fallback to cached data on network errors
      const cachedMascot = localStorage.getItem(`mascot_${user?.id}`);
      if (cachedMascot) {
        try {
          const parsedMascot = JSON.parse(cachedMascot);
          setMascot(parsedMascot);
        } catch (parseError) {
          console.warn('Failed to parse cached mascot data');
        }
      }
    }
  };

  // Load cached mascot data immediately on mount
  useEffect(() => {
    if (user?.id) {
      const cachedMascot = localStorage.getItem(`mascot_${user.id}`);
      if (cachedMascot) {
        try {
          const parsedMascot = JSON.parse(cachedMascot);
          setMascot(parsedMascot);
          console.log('Loaded cached mascot data:', parsedMascot);
        } catch (parseError) {
          console.warn('Failed to parse cached mascot data');
        }
      }
    }
  }, [user?.id]);

  // Fetch fresh data from API with retry logic
  useEffect(() => {
    if (isReady && user?.id) {
      const fetchWithRetry = async (retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            await fetchMascot();
            break;
          } catch (error) {
            console.log(`Fetch attempt ${i + 1} failed, retrying...`);
            if (i === retries - 1) {
              console.log('All fetch attempts failed, using cached data if available');
            } else {
              await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
            }
          }
        }
      };

      fetchWithRetry();
    }
  }, [isReady, user?.id]);



  // Generate new mascot
  /**
   * Why the picture was not created, in the person's language. The server answers with a
   * stable code for a switched-off account, a free plan, a spent allowance or a rate limit,
   * so those no longer look like the same broken button.
   */
  const generateFailureDescription = (code?: string) => {
    switch (code) {
      case "plan_required":
        return t("mascot.plan_required");
      case "ai_disabled":
        return t("mascot.ai_disabled");
      case "ai_quota_exceeded":
        return t("mascot.quota_exceeded");
      case "ai_rate_limited":
        return t("mascot.rate_limited");
      default:
        return t("mascot.try_again");
    }
  };

  const generateMascot = async () => {
    try {
      const token = await window.Clerk?.session?.getToken();
      const response = await fetch("/api/mascot/generate", {
        method: "POST",
        headers: {
          ...(token && { "Authorization": `Bearer ${token}` }),
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({})
      });

      if (!response.ok) {
        let code: string | undefined;
        try {
          code = (await response.json())?.code;
        } catch {
          // A body that is not JSON tells us nothing extra; the generic wording is honest.
        }
        toast({
          title: t("mascot.generate_failed"),
          description: generateFailureDescription(code),
          variant: "destructive"
        });
        return;
      }

      const data = await response.json();
      setMascot(data);
      localStorage.setItem(`mascot_${user?.id}`, JSON.stringify(data));
      toast({ title: t("mascot.new_generated") });
    } catch (error) {
      // The connection dropped, so the mascot may or may not exist: ask them to try again.
      toast({
        title: t("mascot.generate_failed"),
        description: generateFailureDescription(undefined),
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle mascot visibility
  const toggleMascot = async (enabled: boolean) => {
    try {
      const token = await window.Clerk?.session?.getToken();
      const response = await fetch("/api/mascot/toggle", {
        method: "POST",
        headers: {
          ...(token && { "Authorization": `Bearer ${token}` }),
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ enabled })
      });

      if (response.ok) {
        const data = await response.json();
        setMascot(data);
        localStorage.setItem(`mascot_${user?.id}`, JSON.stringify(data));
      }
    } catch (error: any) {
      toast({ title: t("mascot.toggle_failed"), variant: "destructive" });
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    await generateMascot();
  };

  const handleToggle = (enabled: boolean) => {
    toggleMascot(enabled);
  };

  // Drag functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.mascot-image')) {
      setIsDragging(true);
      const rect = e.currentTarget.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const newX = window.innerWidth - (e.clientX - dragOffset.x) - 96; // 96px for mascot width
    const newY = window.innerHeight - (e.clientY - dragOffset.y) - 96; // 96px for mascot height

    // Keep mascot within screen bounds
    const boundedX = Math.max(16, Math.min(newX, window.innerWidth - 112));
    const boundedY = Math.max(16, Math.min(newY, window.innerHeight - 112));

    setPosition({ x: boundedX, y: boundedY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
      };
    }
  }, [isDragging, dragOffset]);

  // Don't render if user is not authenticated or loading
  if (!isReady || !user?.id || isLoading) {
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
  // Only a mascot that was really generated can be out of date. A new account gets the
  // default state (no image, score 50), which used to show the warning before any mascot
  // existed at all.
  const shouldRegenerateMascot = Boolean(
    mascot?.lastGenerated &&
      financialHealth &&
      Math.abs(mascot.healthScore - financialHealth.score) > 20
  );

  // If mascot is disabled, show a small restore button
  if (mascot && mascot.isEnabled === false) {
    return (
      <div 
        className="fixed z-50"
        style={{ 
          bottom: `${position.y}px`, 
          right: `${position.x}px` 
        }}
      >
        <Button
          size="sm"
          variant="outline"
          className="bg-white dark:bg-gray-800 shadow-lg border-2 border-blue-200 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-500"
          onClick={() => handleToggle(true)}
          title={t("mascot.show")}
        >
          <Sparkles className="h-4 w-4 text-blue-500" />
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Floating Mascot */}
      <div 
        className="fixed z-50 flex flex-col items-end space-y-2"
        style={{ 
          bottom: `${position.y}px`, 
          right: `${position.x}px`,
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Settings Panel */}
        {showSettings && (
          <Card className="w-64 shadow-lg border border-gray-200 dark:border-gray-700">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{t("mascot.settings")}</h3>
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
                    {t("mascot.show_mascot")}
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
                        <span className="text-xs text-muted-foreground">{t("mascot.current_mood")}:</span>
                        <Badge variant="outline" className="text-xs">
                          {currentMood}
                        </Badge>
                      </div>

                      {financialHealth && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{t("mascot.health_score")}:</span>
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
                            {t("mascot.generating")}
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3 mr-1" />
                            {t("mascot.generate_new")}
                          </>
                        )}
                      </Button>

                      {shouldRegenerateMascot && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          {t("mascot.health_changed")}
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
            aria-label={t('a11y.mascot_settings')}
          >
            <Settings className="h-3 w-3" />
          </Button>

          {/* Mascot Image */}
          <div className="relative">
            {mascot?.imageUrl ? (
              <img
                src={mascot.imageUrl}
                alt={t("mascot.alt_text", { mood: currentMood })}
                className="mascot-image w-20 h-20 rounded-full shadow-lg border-2 border-white dark:border-gray-700 cursor-pointer hover:scale-105 transition-transform animate-bounce"
                style={{ 
                  animationDuration: '3s',
                  animationIterationCount: 'infinite',
                  animationDirection: 'alternate'
                }}
                onClick={() => setShowSettings(!showSettings)}
                onError={(e) => {
                  console.error('Mascot image failed to load:', mascot.imageUrl);
                  console.log('Image src attribute:', e.currentTarget.src);
                  // Don't hide permanently stored images, only expired DALL-E URLs
                  if (!mascot.imageUrl?.startsWith('/uploads/')) {
                    e.currentTarget.style.display = 'none';
                    if (!isGenerating) {
                      toast({
                        title: t("mascot.image_expired"),
                        description: t("mascot.click_generate"),
                        variant: "default"
                      });
                    }
                  }
                }}
                onLoad={() => {
                  console.log('Mascot image loaded successfully:', mascot.imageUrl);
                }}
              />
            ) : (
              <div 
                className="mascot-image w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 shadow-lg border-2 border-white dark:border-gray-700 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform group"
                onClick={() => setShowSettings(!showSettings)}
                title={t("mascot.generate_prompt")}
              >
                {isGenerating ? (
                  <RefreshCw className="h-8 w-8 text-white animate-spin" />
                ) : (
                  <Sparkles className="h-8 w-8 text-white group-hover:animate-pulse" />
                )}
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