import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3,
  BookOpen,
  Calendar,
  Crown,
  CreditCard,
  Download,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Menu,
  Target,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  X,
  ChevronLeft,
  ChevronRight,
  Crosshair,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export default function Sidebar({ isOpen, setIsOpen, isCollapsed, setIsCollapsed }: SidebarProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const [currentPath] = location;

  // Get fresh user data including plan from database
  const { data: databaseUser } = useQuery({
    queryKey: ["auth-user", user?.id],
    enabled: !!user?.id,
    staleTime: 0, // Always fetch fresh data for plan info
    queryFn: async () => {
      const response = await fetch("/api/auth/user", {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch user');
      return response.json();
    },
  });

  const currentPlan = databaseUser?.plan || user?.plan || 'free';

  if (!user) {
    return null;
  }

  const hasAccess = (requiredPlan: string) => {
    const planHierarchy = { free: 0, standard: 1, premium: 2 };
    return planHierarchy[currentPlan as keyof typeof planHierarchy] >= planHierarchy[requiredPlan as keyof typeof planHierarchy];
  };

  // Extract current language from URL to build language-aware links
  const currentLang = currentPath.match(/^\/([a-z]{2})\//)?.[1] || 'en';

  const menuItems = [
    {
      title: t("Dashboard"),
      icon: LayoutDashboard,
      href: `/${currentLang}/dashboard`,
      requiredPlan: "free",
      badge: null,
    },
    {
      title: t("Transactions"),
      icon: CreditCard,
      href: `/${currentLang}/transactions`,
      requiredPlan: "free",
      badge: null,
    },
    {
      title: t("Income"),
      icon: TrendingUp,
      href: `/${currentLang}/income`,
      requiredPlan: "free",
      badge: null,
    },
    {
      title: t("Expenses"),
      icon: TrendingDown,
      href: `/${currentLang}/expenses`,
      requiredPlan: "free",
      badge: null,
    },
    {
      title: t("Budget"),
      icon: Target,
      href: `/${currentLang}/budget`,
      requiredPlan: "standard" as const,
      badge: "Standard" as const,
    },
    {
      title: t("Categories"),
      icon: CreditCard,
      href: `/${currentLang}/categories`,
      requiredPlan: "free",
      badge: null,
    },
    {
      title: t("Goals"),
      icon: Crosshair,
      href: `/${currentLang}/goals`,
      requiredPlan: "standard" as const,
      badge: "Standard" as const,
    },
    {
      title: t("Collaborative Goals"),
      icon: Users,
      href: `/${currentLang}/collaborative-goals`,
      requiredPlan: "standard" as const,
      badge: "Standard" as const,
    },
    {
      title: t("Reports"),
      icon: FileText,
      href: `/${currentLang}/reports`,
      requiredPlan: "free",
      badge: null,
    },
    {
      title: t("Trends"),
      icon: TrendingUp,
      href: `/${currentLang}/trends`,
      requiredPlan: "premium" as const,
      badge: "Premium" as const,
    },
    {
      title: t("Calendar View"),
      icon: Calendar,
      href: `/${currentLang}/calendar`,
      requiredPlan: "standard" as const,
      badge: "Standard" as const,
    },
    {
      title: t("Data Management"),
      icon: Download,
      href: `/${currentLang}/export`,
      requiredPlan: "premium" as const,
      badge: "Premium" as const,
    },
  ];

  const isActive = (href: string) => {
    // Special case for dashboard - check if current path ends with /dashboard
    if (href.endsWith('/dashboard')) {
      return currentPath.endsWith('/dashboard');
    }
    return currentPath.startsWith(href);
  };

  const canAccess = (premium: boolean) => {
    return !premium || user?.plan === 'premium';
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 left-0 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-50 transition-all duration-300 flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          {!isCollapsed && (
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-primary mr-3" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                FinanzerPro
              </span>
            </div>
          )}

          <div className="flex items-center space-x-2">
            {/* Desktop collapse button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:flex"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>

            {/* Mobile close button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="lg:hidden"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              const accessible = hasAccess(item.requiredPlan || "free");

              return (
                <div key={item.title} className="relative">
                  <Link href={item.href}>
                    <Button
                      variant={active ? "default" : "ghost"}
                      className={cn(
                        "w-full justify-start",
                        isCollapsed ? "px-2" : "px-3",
                        active && "bg-primary text-white",
                        !active && "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                      )}
                      onClick={() => setIsOpen(false)}
                    >
                      <Icon className={cn("h-4 w-4", !isCollapsed && "mr-3")} />
                      {!isCollapsed && (
                        <div className="flex items-center justify-between w-full min-w-0">
                          <span className="truncate">{item.title}</span>
                          {item.badge && !accessible && (
                            <div className={cn(
                              "inline-flex items-center px-2 py-0.5 ml-2 text-[10px] font-medium text-white rounded-full border-0 shrink-0",
                              item.badge === "Standard" ? "bg-blue-500" : "bg-purple-500"
                            )}>
                              <Crown className="h-2.5 w-2.5 mr-1" />
                              <span className="leading-none">{item.badge}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>

          {!isCollapsed && (
            <>
              <Separator className="my-6" />
            </>
          )}
        </nav>

        {/* Footer */}
        {!isCollapsed && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>v1.0.0</span>
              {currentPlan === 'premium' ? (
                <Badge className="bg-premium text-white">
                  <Crown className="h-3 w-3 mr-1" />
                  Premium
                </Badge>
              ) : (
                <Badge variant="secondary">{currentPlan}</Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}