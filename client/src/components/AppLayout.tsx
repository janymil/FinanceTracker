import { useState } from "react";
import { useUser } from "@clerk/clerk-react";
import Header from "@/components/header";
import Sidebar from "@/components/sidebar";
import { AnonymousHeader } from "@/components/anonymous-header";
import { Footer } from "@/components/footer";
import { CookieBanner } from "@/components/cookie-banner";
import { FinancialMascot } from "@/components/financial-mascot";

interface AppLayoutProps {
  children: React.ReactNode;
  isPublicPage?: boolean;
}

export function AppLayout({ children, isPublicPage = false }: AppLayoutProps) {
  const { user, isSignedIn } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // For authenticated users, show the full app layout
  if (isSignedIn && user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header 
          onMenuClick={() => setSidebarOpen(true)} 
          sidebarCollapsed={sidebarCollapsed}
        />
        <div className="flex">
          <Sidebar 
            open={sidebarOpen}
            collapsed={sidebarCollapsed}
            onOpenChange={setSidebarOpen}
            onCollapsedChange={setSidebarCollapsed}
          />
          <main className={`flex-1 transition-all duration-300 ${
            sidebarCollapsed ? 'ml-16' : 'ml-64'
          } lg:ml-0`}>
            <div className="p-6">
              {children}
            </div>
          </main>
        </div>
        <FinancialMascot />
      </div>
    );
  }

  // For anonymous users or public pages, show minimal layout
  return (
    <div className="min-h-screen bg-background">
      <AnonymousHeader />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
}