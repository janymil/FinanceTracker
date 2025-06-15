
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, User, ArrowRight } from "lucide-react";

export default function ChooseAuth() {
  const [, setLocation] = useLocation();

  const handleReplitLogin = () => {
    window.location.href = '/sign-in-clerk';
  };

  const handleClerkLogin = () => {
    setLocation('/sign-in-clerk');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Choose Your Login Method
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Select how you'd like to access FinanzerPro
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Replit Login */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={handleReplitLogin}>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
                  <User className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <CardTitle className="text-xl">Login with Replit</CardTitle>
              <CardDescription>
                Use your existing Replit account to sign in quickly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  One-click authentication
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  No additional passwords to remember
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Seamless Replit integration
                </div>
              </div>
              <Button className="w-full" onClick={handleReplitLogin}>
                Continue with Replit
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Clerk Login */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={handleClerkLogin}>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <CardTitle className="text-xl">Login with Clerk</CardTitle>
              <CardDescription>
                Secure authentication with advanced features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Multi-factor authentication
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Social login options
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Enhanced security features
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={handleClerkLogin}>
                Continue with Clerk
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Both methods provide secure access to your FinanzerPro account
          </p>
        </div>
      </div>
    </div>
  );
}
