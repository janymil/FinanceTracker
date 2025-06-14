import { ScreenshotCapture } from '@/components/ScreenshotCapture';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ScreenshotAdminPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Screenshot Capture Admin</h1>
          <p className="text-gray-600 mt-2">
            Capture real screenshots of FinanzerPro for demo purposes
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live Screenshot Capture</CardTitle>
          <CardDescription>
            Use this tool to capture real screenshots of the current FinanzerPro application.
            These screenshots will be used to create an authentic demo experience.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScreenshotCapture />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">To capture all demo screenshots:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Make sure you're logged into FinanzerPro with sample data</li>
              <li>Navigate to each page you want to capture (Dashboard, Transactions, Budgets, etc.)</li>
              <li>Click "Capture Current Page" on each page</li>
              <li>Downloaded screenshots will be saved and used for the demo</li>
            </ol>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">Recommended pages to capture:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Dashboard - showing financial summary and recent transactions</li>
              <li>Transactions - with a list of sample transactions</li>
              <li>Budgets - displaying budget progress bars</li>
              <li>Reports - showing charts and analytics</li>
              <li>Trends - AI predictions and forecasts (Premium feature)</li>
              <li>Calendar - monthly transaction view</li>
            </ul>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Tips for best screenshots:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Ensure pages are fully loaded before capturing</li>
              <li>Use sample data that looks realistic</li>
              <li>Capture at desktop resolution (1200px+ width)</li>
              <li>Make sure all UI elements are visible</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}