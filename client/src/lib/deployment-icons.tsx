// Minimal icon set for production deployment to reduce bundle size
import { DollarSign, TrendingUp, Home, Car, ShoppingBag, Utensils, Heart, Gamepad2, Plus, Edit3, Trash2 } from "@/lib/icons-registry";

// Only essential icons for deployment
export const deploymentIcons = {
  "dollar-sign": DollarSign,
  "trending-up": TrendingUp,
  "home": Home,
  "car": Car,
  "shopping-bag": ShoppingBag,
  "utensils": Utensils,
  "heart": Heart,
  "gamepad-2": Gamepad2,
  "plus": Plus,
  "edit": Edit3,
  "trash": Trash2
};

// Deployment-optimized icon component
export function DeploymentIcon({ 
  name, 
  className = "h-4 w-4", 
  fallback = "dollar-sign",
  ...props 
}: { 
  name: string; 
  className?: string; 
  fallback?: keyof typeof deploymentIcons;
  [key: string]: any; 
}) {
  const IconComponent = deploymentIcons[name as keyof typeof deploymentIcons] || deploymentIcons[fallback];
  return <IconComponent className={className} {...props} />;
}