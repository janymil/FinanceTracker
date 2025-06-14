import { Link } from "wouter";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface FooterProps {
  sidebarCollapsed?: boolean;
}

export function Footer({ sidebarCollapsed = false }: FooterProps) {
  const handleLinkClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className={cn(
      "bg-background border-t transition-all duration-300",
      sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
    )}>
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">FinanzerPro</h3>
            <p className="text-sm text-muted-foreground">
              Take control of your finances with intelligent expense tracking, 
              budgeting, and AI-powered insights.
            </p>
            <div className="text-sm text-muted-foreground">
              <p>123 Finance Street</p>
              <p>San Francisco, CA 94105</p>
              <p>support@finanzerpro.app</p>
            </div>
          </div>

          {/* Product */}
          <div className="space-y-4">
            <h4 className="font-semibold">Product</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/pricing" onClick={handleLinkClick} className="text-muted-foreground hover:text-foreground transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h4 className="font-semibold">Support</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/contact" onClick={handleLinkClick} className="text-muted-foreground hover:text-foreground transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/help" onClick={handleLinkClick} className="text-muted-foreground hover:text-foreground transition-colors">
                  Help Center
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-6" />
        
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="text-sm text-muted-foreground">
            © 2025 FinanzerPro. All rights reserved.
          </div>
          <div className="flex items-center space-x-6 text-sm">
            <Link href="/privacy-policy" onClick={handleLinkClick} className="text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms-of-service" onClick={handleLinkClick} className="text-muted-foreground hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <Link href="/cookie-policy" onClick={handleLinkClick} className="text-muted-foreground hover:text-foreground transition-colors">
              Cookie Policy
            </Link>
            <Link href="/contact" onClick={handleLinkClick} className="text-muted-foreground hover:text-foreground transition-colors">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}