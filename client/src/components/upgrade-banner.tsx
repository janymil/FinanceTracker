import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, TrendingUp, BarChart3, Download } from "@/lib/icons-registry";
import { Link } from "wouter";

export default function UpgradeBanner() {
  return (
    <Card className="bg-gradient-to-r from-premium to-purple-600 text-white border-0">
      <CardContent className="p-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Crown className="h-6 w-6" />
              <h2 className="text-2xl font-bold">Unlock Advanced Analytics</h2>
            </div>
            <p className="text-purple-100 mb-6 text-lg">
              Get interactive charts, trend analysis, and detailed financial insights to take complete control of your money.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Interactive Charts</p>
                  <p className="text-purple-200 text-sm">Visual trends & analytics</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Advanced Budgets</p>
                  <p className="text-purple-200 text-sm">Category-wise tracking</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Download className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Export Data</p>
                  <p className="text-purple-200 text-sm">CSV & PDF reports</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/subscribe">
              <Button className="bg-white text-premium hover:bg-gray-100 font-medium px-6 py-3">
                <Crown className="h-4 w-4 mr-2" />
                Upgrade Now - $9.99/mo
              </Button>
            </Link>
            <Button variant="ghost" className="text-white border-white/30 hover:bg-white/10">
              Learn More
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
