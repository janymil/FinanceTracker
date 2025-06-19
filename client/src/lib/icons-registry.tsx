// Comprehensive icon registry for financial categories and UI components
import {
  // Core UI icons
  Lock, Check, Circle, ChevronRight, ChevronDown, ChevronUp, ChevronLeft,
  Plus, Minus, X, Edit3, Trash2, Search, Filter, Settings, Menu, MoreHorizontal, MoreVertical,
  
  // Navigation & Layout
  Home, LayoutDashboard, FileText, Calendar, TrendingUp, TrendingDown, BarChart3, User, Users,
  CreditCard, Target, Crosshair, ArrowRight, ArrowLeft, ArrowUp, ArrowDown,
  
  // Financial icons
  DollarSign, PiggyBank, Coins, Banknote, Calculator, Receipt, Wallet,
  
  // Category icons for expenses/income/budget/goals
  Car, Bus, Plane, Train, Fuel, // Transportation
  Building, Building2, Zap, // Housing & Utilities
  Utensils, Coffee, Pizza, Apple, // Food & Dining
  ShoppingBag, ShoppingCart, Shirt, Gift, // Shopping & Personal
  Heart, Pill, Stethoscope, Hospital, // Healthcare
  Gamepad2, Film, Music, Camera, Headphones, // Entertainment
  GraduationCap, Book, Laptop, School, // Education
  Briefcase, Factory, Wrench, Hammer, // Work & Business
  Map, MapPin, Luggage, Hotel, // Travel & Vacation
  Baby, PawPrint, Trees, Flower, // Family & Pets
  Shield, Umbrella, // Insurance & Security
  HandCoins, Trophy, // Goals & Savings
  
  // Additional utility icons
  Upload, Download, Copy, Share, ExternalLink, Info, AlertCircle,
  Bell, Eye, EyeOff, Star, Bookmark, Tag, Folder, File, Database, Cloud,
  Mail, Phone, Globe, Clock, RefreshCw, RotateCcw, Maximize, Minimize,
  Play, Pause, Volume2, Image, Video, Mic, Printer, Save, Archive,
  
  // Status & feedback icons
  AlertTriangle, XCircle, Loader2, Lightbulb, Crown,
  Award, Medal, Flag, ThumbsUp, Smile, Frown
} from "lucide-react";

// Export all icons individually for direct import
export {
  Lock, Check, Circle, ChevronRight, ChevronDown, ChevronUp, ChevronLeft,
  Plus, Minus, X, Edit3, Trash2, Search, Filter, Settings, Menu, MoreHorizontal, MoreVertical,
  Home, LayoutDashboard, FileText, Calendar, TrendingUp, TrendingDown, BarChart3, User, Users,
  CreditCard, Target, Crosshair, ArrowRight, ArrowLeft, ArrowUp, ArrowDown,
  DollarSign, PiggyBank, Coins, Banknote, Calculator, Receipt, Wallet,
  Car, Bus, Plane, Train, Fuel, Building, Building2, Zap,
  Utensils, Coffee, Pizza, Apple, ShoppingBag, ShoppingCart, Shirt, Gift,
  Heart, Pill, Stethoscope, Hospital, Gamepad2, Film, Music, Camera, Headphones,
  GraduationCap, Book, Laptop, School, Briefcase, Factory, Wrench, Hammer,
  Map, MapPin, Luggage, Hotel, Baby, PawPrint, Trees, Flower,
  Shield, Umbrella, HandCoins, Trophy,
  Upload, Download, Copy, Share, ExternalLink, Info, AlertCircle,
  Bell, Eye, EyeOff, Star, Bookmark, Tag, Folder, File, Database, Cloud,
  Mail, Phone, Globe, Clock, RefreshCw, RotateCcw, Maximize, Minimize,
  Play, Pause, Volume2, Image, Video, Mic, Printer, Save, Archive,
  AlertTriangle, XCircle, Loader2, Lightbulb, Crown,
  Award, Medal, Flag, ThumbsUp, Smile, Frown
};

// Icon registry object for programmatic access
export const iconRegistry = {
  // Core UI
  lock: Lock,
  check: Check,
  circle: Circle,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  chevronLeft: ChevronLeft,
  plus: Plus,
  minus: Minus,
  x: X,
  edit3: Edit3,
  trash2: Trash2,
  search: Search,
  filter: Filter,
  settings: Settings,
  menu: Menu,
  moreHorizontal: MoreHorizontal,
  moreVertical: MoreVertical,
  
  // Navigation
  home: Home,
  layoutDashboard: LayoutDashboard,
  fileText: FileText,
  calendar: Calendar,
  trendingUp: TrendingUp,
  trendingDown: TrendingDown,
  barChart3: BarChart3,
  user: User,
  users: Users,
  creditCard: CreditCard,
  target: Target,
  crosshair: Crosshair,
  
  // Financial
  dollarSign: DollarSign,
  piggyBank: PiggyBank,
  coins: Coins,
  banknote: Banknote,
  calculator: Calculator,
  receipt: Receipt,
  wallet: Wallet,
  
  // Transportation
  car: Car,
  bus: Bus,
  plane: Plane,
  train: Train,
  fuel: Fuel,
  
  // Housing
  building: Building,
  building2: Building2,
  zap: Zap,
  
  // Food
  utensils: Utensils,
  coffee: Coffee,
  pizza: Pizza,
  apple: Apple,
  
  // Shopping
  shoppingBag: ShoppingBag,
  shoppingCart: ShoppingCart,
  shirt: Shirt,
  gift: Gift,
  
  // Healthcare
  heart: Heart,
  pill: Pill,
  stethoscope: Stethoscope,
  hospital: Hospital,
  
  // Entertainment
  gamepad2: Gamepad2,
  film: Film,
  music: Music,
  camera: Camera,
  headphones: Headphones,
  
  // Education
  graduationCap: GraduationCap,
  book: Book,
  laptop: Laptop,
  school: School,
  
  // Work
  briefcase: Briefcase,
  factory: Factory,
  wrench: Wrench,
  hammer: Hammer,
  
  // Travel
  map: Map,
  mapPin: MapPin,
  luggage: Luggage,
  hotel: Hotel,
  
  // Family & Pets
  baby: Baby,
  pawPrint: PawPrint,
  trees: Trees,
  flower: Flower,
  
  // Security
  shield: Shield,
  umbrella: Umbrella,
  
  // Goals
  handCoins: HandCoins,
  trophy: Trophy,
  
  // Utility
  upload: Upload,
  download: Download,
  copy: Copy,
  share: Share,
  externalLink: ExternalLink,
  info: Info,
  alertCircle: AlertCircle,
  bell: Bell,
  eye: Eye,
  eyeOff: EyeOff,
  star: Star,
  bookmark: Bookmark,
  tag: Tag,
  folder: Folder,
  file: File,
  database: Database,
  cloud: Cloud,
  mail: Mail,
  phone: Phone,
  globe: Globe,
  clock: Clock,
  refreshCw: RefreshCw,
  rotateCcw: RotateCcw,
  maximize: Maximize,
  minimize: Minimize,
  play: Play,
  pause: Pause,
  volume2: Volume2,
  image: Image,
  video: Video,
  mic: Mic,
  printer: Printer,
  save: Save,
  archive: Archive,
  
  // Status
  alertTriangle: AlertTriangle,
  xCircle: XCircle,
  loader2: Loader2,
  lightbulb: Lightbulb,
  crown: Crown,
  award: Award,
  medal: Medal,
  flag: Flag,
  thumbsUp: ThumbsUp,
  smile: Smile,
  frown: Frown
};

// Helper function to get icon by name
export function getIcon(name: string) {
  return iconRegistry[name as keyof typeof iconRegistry] || Lock;
}

// Category icon mapping for financial app
export const categoryIcons = {
  // Expense categories
  "transportation": Car,
  "food": Utensils,
  "shopping": ShoppingBag,
  "entertainment": Gamepad2,
  "healthcare": Heart,
  "housing": Building,
  "education": GraduationCap,
  "travel": Plane,
  "utilities": Zap,
  "other": Circle,
  
  // Income categories
  "salary": Briefcase,
  "business": Factory,
  "investment": TrendingUp,
  "gift": Gift,
  "rental": Building,
  "freelance": Laptop,
  
  // Goal categories
  "savings": PiggyBank,
  "vacation": Plane,
  "house": Building,
  "car": Car,
  "emergency": Shield,
  "retirement": Trophy,
  "education-goal": GraduationCap,
  
  // Legacy icon names for backward compatibility
  "trending-up": TrendingUp,
  "dollar-sign": DollarSign,
  "heart": Heart,
  "home": Building,
  "shopping-bag": ShoppingBag,
  "plane": Plane,
  "shield": Shield,
  "piggy-bank": PiggyBank,
  "laptop": Laptop,
  "credit-card": CreditCard,
  "target": Target
};

export type CategoryIconName = keyof typeof categoryIcons;

// Default exports for backward compatibility
export default iconRegistry;