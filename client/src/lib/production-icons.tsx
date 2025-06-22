// Optimized production icon bundle - minimal imports to fix deployment loading
import { 
  DollarSign, TrendingUp, Home, Car, ShoppingBag, Utensils, Heart, Gamepad2,
  Plus, Edit3, Trash2, Upload, Download, CheckCircle, AlertCircle,
  TrendingDown, PiggyBank, Lightbulb, Settings, User, Menu, X
} from "lucide-react";

export const productionIcons = {
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
  "lightbulb": Lightbulb,
  "settings": Settings,
  "user": User,
  "menu": Menu,
  "x": X
};

export function ProductionIcon({ name, className = "h-4 w-4", ...props }: { 
  name: string; 
  className?: string; 
  [key: string]: any; 
}) {
  const IconComponent = productionIcons[name as keyof typeof productionIcons] || DollarSign;
  return <IconComponent className={className} {...props} />;
}