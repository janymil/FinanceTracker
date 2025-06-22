// Optimized icon loading for deployment
import { 
  DollarSign, 
  TrendingUp, 
  Home, 
  Car, 
  ShoppingBag, 
  Utensils,
  Heart,
  Gamepad2,
  Plus,
  Edit3,
  Trash2,
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  TrendingDown,
  PiggyBank,
  Lightbulb
} from "lucide-react";

// Core icons used across the app
export const icons = {
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
  "trash": Trash2,
  "upload": Upload,
  "download": Download,
  "check": CheckCircle,
  "alert": AlertCircle,
  "trending-down": TrendingDown,
  "piggy-bank": PiggyBank,
  "lightbulb": Lightbulb
};

export type IconName = keyof typeof icons;

// Icon component with fallback
export function Icon({ name, className = "h-4 w-4", ...props }: { 
  name: IconName; 
  className?: string; 
  [key: string]: any; 
}) {
  const IconComponent = icons[name] || DollarSign;
  return <IconComponent className={className} {...props} />;
}

// Category icons specifically
export const categoryIcons = {
  "dollar-sign": DollarSign,
  "trending-up": TrendingUp,
  "home": Home,
  "car": Car,
  "shopping-bag": ShoppingBag,
  "utensils": Utensils,
  "heart": Heart,
  "gamepad-2": Gamepad2,
};

export type CategoryIconName = keyof typeof categoryIcons;