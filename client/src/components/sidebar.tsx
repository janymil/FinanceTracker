import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  TrendingDown,
  LayoutDashboard,
  CreditCard,
  PieChart,
  FileText,
  Target,
  Calendar,
  Download,
  BarChart3,
  Crown,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Crosshair,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const { user } = useAuth();
  const [location] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      href: "/",
      premium: false,
    },
    {
      title: "Transactions",
      icon: CreditCard,
      href: "/transactions",
      premium: false,
    },
    {
      title: "Income",
      icon: TrendingUp,
      href: "/income",
      premium: false,
    },
    {
      title: "Expenses",
      icon: TrendingDown,
      href: "/expenses",
      premium: false,
    },
    {
      title: "Budget",
      icon: Target,
      href: "/budget",
      premium: true,
      accessible: true, // Show pro badge but keep accessible
    },
    {
      title: "Categories",
      icon: CreditCard,
      href: "/categories",
      premium: false,
    },
    {
      title: "Goals",
      icon: Crosshair,
      href: "/goals",
      premium: true,
    },
    {
      title: "Reports",
      icon: FileText,
      href: "/reports",
      premium: false,
    },
    {
      title: "Analytics",
      icon: BarChart3,
      href: "/analytics",
      premium: true,
    },
    {
      title: "Trends",
      icon: TrendingUp,
      href: "/trends",
      premium: true,
    },
    {
      title: "Calendar View",
      icon: Calendar,
      href: "/calendar",
      premium: true,
    },
    {
      title: "Export Data",
      icon: Download,
      href: "/export",
      premium: true,
    },
  ];

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  const canAccess = (item: any) => {
    // If item has accessible property set to true, always allow access
    if (item.accessible === true) {
      return true;
    }
    // Otherwise, check premium status
    return !item.premium || user?.isPremium;
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
                FinanceFlow
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
              const accessible = canAccess(item);

              return (
                <div key={item.title} className="relative">
                  {accessible ? (
                    <Link href={item.href}>
                      <Button
                        variant={active ? "default" : "ghost"}
                        className={cn(
                          "w-full justify-start",
                          isCollapsed ? "px-2" : "px-3",
                          active && "bg-primary text-white",
                          !active && "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                        )}
                      >
                        <Icon className={cn("h-4 w-4", !isCollapsed && "mr-3")} />
                        {!isCollapsed && (
                          <span className="flex items-center justify-between w-full">
                            {item.title}
                            {item.premium && (
                              <Badge className="bg-premium text-white text-xs ml-2">
                                <Crown className="h-3 w-3 mr-1" />
                                Pro
                              </Badge>
                            )}
                          </span>
                        )}
                      </Button>
                    </Link>
                  ) : (
                    <div className="relative">
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-start opacity-50 cursor-not-allowed",
                          isCollapsed ? "px-2" : "px-3",
                          "text-gray-400 dark:text-gray-600"
                        )}
                        disabled
                      >
                        <Icon className={cn("h-4 w-4", !isCollapsed && "mr-3")} />
                        {!isCollapsed && (
                          <span className="flex items-center justify-between w-full">
                            {item.title}
                            <Badge className="bg-premium text-white text-xs ml-2">
                              <Crown className="h-3 w-3 mr-1" />
                              Pro
                            </Badge>
                          </span>
                        )}
                      </Button>
                      {!user?.isPremium && (
                        <Link href="/subscribe">
                          <div className="absolute inset-0 cursor-pointer" />
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!isCollapsed && (
            <>
              <Separator className="my-6" />
              
              {/* Upgrade section for free users */}
              {!user?.isPremium && (
                <div className="bg-gradient-to-br from-premium/10 to-blue-50 dark:from-premium/20 dark:to-gray-800 p-4 rounded-lg">
                  <div className="flex items-center mb-2">
                    <Crown className="h-5 w-5 text-premium mr-2" />
                    <span className="font-semibold text-gray-900 dark:text-white">
                      Upgrade to Premium
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Unlock advanced analytics, unlimited history, and export features.
                  </p>
                  <Link href="/subscribe">
                    <Button className="w-full bg-premium hover:bg-premium/90 text-white">
                      <Crown className="h-4 w-4 mr-2" />
                      Upgrade Now
                    </Button>
                  </Link>
                </div>
              )}
            </>
          )}
        </nav>

        {/* Footer */}
        {!isCollapsed && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>v1.0.0</span>
              {user?.isPremium ? (
                <Badge className="bg-premium text-white">
                  <Crown className="h-3 w-3 mr-1" />
                  Premium
                </Badge>
              ) : (
                <Badge variant="secondary">Free</Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}