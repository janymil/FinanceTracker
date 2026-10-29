import { useAuth } from "@/hooks/useAuth";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { Button } from "@/components/ui/button";
import { useTranslation } from 'react-i18next';
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useClerk, useUser } from "@clerk/clerk-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Crown, 
  ChevronDown, 
  User, 
  Settings, 
  LogOut, 
  Menu,
  Plus,
  Moon,
  Sun,
  HelpCircle,
  Gift,
  BookOpen,
  Map as MapIcon
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { CurrencySelector } from "@/components/CurrencySelector";
import { useCurrency } from "@/context/CurrencyContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { clearUserSession } from "@/lib/queryClient";
import { useTheme } from "@/context/ThemeContext";
import { QUICK_ADD_EVENT, type QuickAddMode, type QuickAddPreset, type QuickAddRequest } from "@/lib/quickAdd";
import { TransactionFormDialog } from "@/components/TransactionFormDialog";
import { QuickAddMenuItems } from "@/components/QuickAddMenuItems";
import { SimpleVoiceInput } from "@/components/simple-voice-input";
import UploadReceiptModal from "@/components/UploadReceiptModal";

interface HeaderProps {
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
}

export default function Header({ onMenuClick, sidebarCollapsed }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { user: clerkUser } = useUser();
  const { isReady } = useClerkUserReady();
  const [currentPath] = useLocation();
  
  // Extract current language from URL to build language-aware links
  const currentLang = currentPath.match(/^\/([a-z]{2})\//)?.[1] || 'en';

  const { canChangeCurrency } = useCurrency();
  const { toast } = useToast();
  const { signOut } = useClerk();
  
  const handleLogout = async () => {
    try {
      // Use Clerk signOut first
      await signOut({ redirectUrl: '/' });
      // Clear session after successful signout
      clearUserSession();
    } catch (error) {
      console.error('Logout error:', error);
      // If signOut fails, clear session and redirect
      clearUserSession();
      window.location.href = '/';
    }
  };
  const { theme, toggleTheme } = useTheme();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [quickAddPreset, setQuickAddPreset] = useState<QuickAddPreset | undefined>(undefined);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const queryClient = useQueryClient();

  // The three ways to add a transaction. The forms live here, once; any other control asks for
  // one through `requestQuickAdd` (see lib/quickAdd.ts), with what it already knows as a preset.
  const openQuickAdd = (mode: QuickAddMode, preset?: QuickAddPreset) => {
    if (mode === "type") {
      setQuickAddPreset(preset);
      setIsDialogOpen(true);
    } else if (mode === "voice") {
      setIsVoiceOpen(true);
    } else {
      setIsScanOpen(true);
    }
  };

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<QuickAddRequest>).detail;
      if (detail) openQuickAdd(detail.mode, detail.preset);
    };
    window.addEventListener(QUICK_ADD_EVENT, listener);
    return () => window.removeEventListener(QUICK_ADD_EVENT, listener);
  }, []);



  return (
    <header className={cn(
      "bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 h-16 fixed top-0 right-0 z-40 transition-all duration-300",
      sidebarCollapsed ? "lg:left-16" : "lg:left-64",
      "left-0"
    )}>
      <div className="flex items-center justify-between h-full px-4">
        {/* Left side - Mobile menu button and quick actions */}
        <div className="flex items-center space-x-4">
          <Button aria-label={t('a11y.open_menu')}
            variant="ghost"
            size="sm"
            onClick={onMenuClick}
            className="lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Add a transaction: typed, spoken or scanned. On a phone the bottom bar's "+" opens
              the same three (components/MobileBottomNav.tsx). */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="hidden md:inline-flex h-10 rounded-xl px-4 font-semibold"
                data-testid="quick-add-trigger"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("overview.add.button")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 p-1.5">
              <QuickAddMenuItems onSelect={(mode) => openQuickAdd(mode)} />
            </DropdownMenuContent>
          </DropdownMenu>

          {isVoiceOpen && (
            <SimpleVoiceInput
              onClose={() => setIsVoiceOpen(false)}
              onComplete={() => {
                setIsVoiceOpen(false);
                queryClient.invalidateQueries({ queryKey: ['transactions'] });
                queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
              }}
            />
          )}
          <UploadReceiptModal open={isScanOpen} onOpenChange={setIsScanOpen} hideTrigger />

          <TransactionFormDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} preset={quickAddPreset} />
        </div>

        {/* Right side - User menu and premium status */}
        <div className="flex items-center space-x-3">
          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label={t('a11y.toggle_theme')}
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </Button>

          {/* Premium status */}
          {user?.plan === 'premium' ? (
            <Badge className="bg-premium text-white hidden sm:flex">
              <Crown className="h-3 w-3 mr-1" />
{t("Premium")}
            </Badge>
          ) : (
            <Link href="/subscribe">
              <Button size="sm" className="bg-premium hover:bg-premium/90 text-white hidden sm:flex">
                <Crown className="h-4 w-4 mr-1" />
                {t("Upgrade")}
              </Button>
            </Link>
          )}

          {/* Currency selector - show until user has transactions (currency becomes locked) */}
          {user?.currency && canChangeCurrency && <CurrencySelector variant="icon" className="mr-2" />}

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2 h-auto p-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={clerkUser?.imageUrl ?? user?.profileImageUrl ?? undefined} alt={clerkUser?.fullName || clerkUser?.firstName || "User"} />
                  <AvatarFallback className="bg-primary text-white">
                    {clerkUser?.firstName?.[0] || clerkUser?.fullName?.[0] || user?.firstName?.[0] || user?.email?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden lg:block">
                  {clerkUser?.fullName || (clerkUser?.firstName ? `${clerkUser.firstName} ${clerkUser.lastName || ''}`.trim() : (clerkUser?.primaryEmailAddress?.emailAddress || user?.email))}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-500 hidden lg:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {clerkUser?.fullName || (clerkUser?.firstName ? `${clerkUser.firstName} ${clerkUser.lastName || ''}`.trim() : (clerkUser?.primaryEmailAddress?.emailAddress || user?.email))}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {clerkUser?.primaryEmailAddress?.emailAddress || user?.email}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <User className="h-4 w-4 mr-2" />
{t("Profile & Account Configuration")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem 
                disabled 
                className="cursor-not-allowed opacity-60"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                <div className="flex flex-col">
                  <span>Financial Courses</span>
                  <span className="text-xs text-gray-400">Soon available</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/help">
                  <HelpCircle className="h-4 w-4 mr-2" />
{t("Help & Documentation")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/${currentLang}/roadmap`}>
                  <MapIcon className="h-4 w-4 mr-2" />
                  {t("roadmap.menu")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/redeem">
                  <Gift className="h-4 w-4 mr-2" />
                  {t("Redeem Code")}
                </Link>
              </DropdownMenuItem>
              {user?.plan !== 'premium' && (
                <DropdownMenuItem asChild>
                  <Link href="/subscribe">
                    <Crown className="h-4 w-4 mr-2" />
{t("Upgrade to Premium")}
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
{t("Sign Out")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}