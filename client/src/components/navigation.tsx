import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TrendingUp, Crown, ChevronDown, User, Settings, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useClerk } from "@clerk/clerk-react";
import { clearUserSession } from "@/lib/queryClient";

export default function Navigation() {
  const { user, clerkUser } = useAuth();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    // Clear user session data while preserving AI tips and theme
    clearUserSession();
    // Use default Clerk signOut with redirectUrl
    await signOut({ redirectUrl: '/' });
  };

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <TrendingUp className="h-8 w-8 text-primary mr-3" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">FinanzerPro</span>
            </div>
            <div className="hidden md:block ml-10">
              <div className="flex items-baseline space-x-4">
                <Link href="/">
                  <a className="text-primary bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-md text-sm font-medium">
                    Dashboard
                  </a>
                </Link>
                <a href="#" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                  Transactions
                </a>
                <a href="#" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                  Budget
                </a>
                <a href="#" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                  Reports
                </a>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {user?.plan === 'premium' ? (
              <Badge className="bg-purple-600 text-white text-xs px-3 py-1 rounded-full">
                <Crown className="h-3 w-3 mr-1" />
                Premium
              </Badge>
            ) : user?.plan === 'standard' ? (
              <Badge className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full">
                <Crown className="h-3 w-3 mr-1" />
                Standard
              </Badge>
            ) : (
              <>
                <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs px-3 py-1 rounded-full">
                  Free
                </Badge>
                <Link href="/subscribe">
                  <Button size="sm" className="bg-premium hover:bg-premium/90 text-white">
                    <Crown className="h-4 w-4 mr-1" />
                    Upgrade
                  </Button>
                </Link>
              </>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2 h-auto p-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={clerkUser?.imageUrl || user?.profileImageUrl} alt={clerkUser?.firstName || user?.firstName || "User"} />
                    <AvatarFallback className="bg-primary text-white">
                      J
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">
                    Jan Milata
                  </span>
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem>
                  <User className="h-4 w-4 mr-2" />
                  Profile Settings
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="h-4 w-4 mr-2" />
                  Account Settings
                </DropdownMenuItem>
                {!user?.isPremium && (
                  <DropdownMenuItem asChild>
                    <Link href="/subscribe">
                      <Crown className="h-4 w-4 mr-2" />
                      Upgrade to Premium
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}