// Optimized production icon bundle - minimal imports to fix deployment loading
import { DollarSign, TrendingUp, Home, Car, ShoppingBag, Utensils, Heart, Gamepad2, Plus, Edit3, Trash2, Upload, Download, CheckCircle, AlertCircle, TrendingDown, PiggyBank, Lightbulb, Settings, User, Menu, X, CreditCard, PlusCircle, Calendar, Target, PieChart, BarChart3, ArrowUpRight, ArrowDownRight, Crown, Zap, Shield, Star, ChevronRight, Minus, Eye, EyeOff, RefreshCw, XCircle, Clock, Repeat, Filter, ChevronDown, ChevronUp, Receipt, Store, MoreHorizontal, LayoutDashboard, FileText, Users, Crosshair } from "@/lib/icons-registry";

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
  "x": X,
  "credit-card": CreditCard,
  "plus-circle": PlusCircle,
  "calendar": Calendar,
  "target": Target,
  "pie-chart": PieChart,
  "bar-chart-3": BarChart3,
  "arrow-up-right": ArrowUpRight,
  "arrow-down-right": ArrowDownRight,
  "crown": Crown,
  "zap": Zap,
  "shield": Shield,
  "star": Star,
  "chevron-right": ChevronRight,
  "minus": Minus,
  "eye": Eye,
  "eye-off": EyeOff,
  "refresh-cw": RefreshCw,
  "x-circle": XCircle,
  "clock": Clock,
  "repeat": Repeat,
  "filter": Filter,
  "chevron-down": ChevronDown,
  "chevron-up": ChevronUp,
  "receipt": Receipt,
  "store": Store,
  "more-horizontal": MoreHorizontal,
  "layout-dashboard": LayoutDashboard,
  "file-text": FileText,
  "users": Users,
  "crosshair": Crosshair
};

export function ProductionIcon({ name, className = "h-4 w-4", ...props }: { 
  name: string; 
  className?: string; 
  [key: string]: any; 
}) {
  const IconComponent = productionIcons[name as keyof typeof productionIcons] || DollarSign;
  return <IconComponent className={className} {...props} />;
}