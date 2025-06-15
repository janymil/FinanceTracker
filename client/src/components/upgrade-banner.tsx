import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface UpgradeBannerProps {
  message?: string;
}

export default function UpgradeBanner({ message = "Unlock all features" }: UpgradeBannerProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        <span className="text-sm text-purple-800 dark:text-purple-200">{message}</span>
      </div>
      <Button 
        size="sm" 
        className="bg-purple-600 hover:bg-purple-700 text-white"
        onClick={() => setLocation("/pricing")}
      >
        Upgrade Now
      </Button>
    </div>
  );
}