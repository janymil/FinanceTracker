import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Gift, Sparkles, CheckCircle, Lock } from "lucide-react";
import { SEO } from "@/components/SEO";

const redeemSchema = z.object({
  code1: z.string().min(1, "Code 1 is required"),
  code2: z.string().optional(),
});

type RedeemForm = z.infer<typeof redeemSchema>;

interface RedeemStatus {
  redeemedCodes: Array<{
    code: string;
    redeemedAt: string;
    tier: string;
  }>;
  plan: string;
  totalRedeemed: number;
  canRedeemMore: boolean;
  remainingSlots: number;
}

export default function RedeemPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [redeemStatus, setRedeemStatus] = useState<RedeemStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const form = useForm<RedeemForm>({
    resolver: zodResolver(redeemSchema),
    defaultValues: {
      code1: "",
      code2: "",
    },
  });

  // Fetch current redemption status
  useEffect(() => {
    const fetchRedeemStatus = async () => {
      if (!isLoaded || !isSignedIn) return;
      
      try {
        const token = await getToken();
        const response = await fetch("/api/my-codes", {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const status = await response.json();
          setRedeemStatus(status);
        }
      } catch (error) {
        console.error("Failed to fetch redeem status:", error);
      } finally {
        setStatusLoading(false);
      }
    };

    fetchRedeemStatus();
  }, [isLoaded, isSignedIn, getToken]);

  const onSubmit = async (data: RedeemForm) => {
    try {
      setIsSubmitting(true);
      const token = await getToken();

      const codes = [data.code1];
      if (data.code2?.trim()) {
        codes.push(data.code2.trim());
      }

      const response = await fetch("/api/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ codes }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to redeem codes");
      }

      const { plan, validCodes, invalidCodes } = result;

      if (invalidCodes.length > 0) {
        toast({
          title: "Some codes were invalid",
          description: `Invalid codes: ${invalidCodes.join(", ")}`,
          variant: "destructive",
        });
      }

      if (validCodes.length > 0) {
        toast({
          title: "Codes redeemed successfully!",
          description: `You've been upgraded to ${plan} plan with ${result.totalCodes} total codes.`,
        });
        
        // Refresh status after successful redemption
        const statusResponse = await fetch("/api/my-codes", {
          headers: { "Authorization": `Bearer ${token}` },
        });
        if (statusResponse.ok) {
          const newStatus = await statusResponse.json();
          setRedeemStatus(newStatus);
        }
        form.reset();
      } else {
        throw new Error("No valid codes provided");
      }
    } catch (error) {
      console.error("Redemption error:", error);
      toast({
        title: "Redemption failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <SEO 
        title="Redeem AppSumo Code - FinanzerPro"
        description="Redeem your AppSumo codes to unlock Standard or Premium features in FinanzerPro."
      />
      
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="shadow-xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                <Gift className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Redeem AppSumo Code
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300">
                Enter your AppSumo redemption codes to unlock premium features
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div>
                {/* Current Redemption Status */}
                {!statusLoading && redeemStatus && (
                  <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Your Redeemed Codes
                    </h3>
                    
                    {redeemStatus.totalRedeemed > 0 ? (
                      <div className="space-y-2">
                        {redeemStatus.redeemedCodes.map((codeData, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-white dark:bg-gray-600 rounded border">
                            <span className="font-mono text-sm">{codeData.code}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(codeData.redeemedAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                        <div className="mt-3 p-2 bg-green-50 dark:bg-green-900 rounded border border-green-200 dark:border-green-700">
                          <p className="text-sm text-green-700 dark:text-green-300">
                            <strong>Current Plan:</strong> {redeemStatus.plan.toUpperCase()}
                          </p>
                          {redeemStatus.canRedeemMore ? (
                            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                              You can redeem {redeemStatus.remainingSlots} more code(s) {redeemStatus.remainingSlots === 1 ? 'to unlock Premium' : ''}
                            </p>
                          ) : (
                            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                              Maximum codes redeemed - Premium plan activated!
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        No codes redeemed yet. Redeem 1 code for Standard plan or 2 codes for Premium plan.
                      </p>
                    )}
                  </div>
                )}

                {/* Show form only if user can redeem more codes */}
                {!statusLoading && (!redeemStatus || redeemStatus.canRedeemMore) && (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="code1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-purple-500" />
                          Code 1 (Required)
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Enter your first redemption code"
                            className="h-12 text-center font-mono tracking-wider uppercase"
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="code2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-blue-500" />
                          Code 2 (Optional - for Premium)
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Enter your second redemption code"
                            className="h-12 text-center font-mono tracking-wider uppercase"
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">How it works:</h4>
                    <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                      <li>• 1 Code = Standard Plan (Enhanced features)</li>
                      <li>• 2 Codes = Premium Plan (All features unlocked)</li>
                      <li>• Codes are single-use and cannot be transferred</li>
                    </ul>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Redeeming codes...
                      </>
                    ) : (
                      <>
                        <Gift className="mr-2 h-4 w-4" />
                        Redeem Codes
                      </>
                    )}
                  </Button>
                </form>
                </Form>
              )}

              {/* Show message when user has redeemed maximum codes */}
              {!statusLoading && redeemStatus && !redeemStatus.canRedeemMore && (
                <div className="text-center p-6">
                  <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                    <Lock className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-green-700 dark:text-green-300 mb-2">
                    All Codes Redeemed!
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    You've reached the maximum number of redemptions and have Premium access.
                  </p>
                </div>
              )}

              {/* Loading state */}
              {statusLoading && (
                <div className="text-center p-6">
                  <Loader2 className="mx-auto w-8 h-8 animate-spin text-gray-400" />
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Loading redemption status...</p>
                </div>
              )}

              <div className="mt-6 text-center">
                <Button
                  variant="ghost"
                  onClick={() => setLocation("/dashboard")}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}