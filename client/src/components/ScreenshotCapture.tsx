import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Camera } from 'lucide-react';

interface ScreenshotData {
  name: string;
  title: string;
  description: string;
  dataUrl: string;
  timestamp: string;
}

export function ScreenshotCapture() {
  const [screenshots, setScreenshots] = useState<ScreenshotData[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);

  const captureCurrentPage = async () => {
    setIsCapturing(true);
    
    try {
      // Install html2canvas if not already available
      if (!(window as any).html2canvas) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        document.head.appendChild(script);
        
        await new Promise((resolve) => {
          script.onload = resolve;
        });
      }

      const html2canvas = (window as any).html2canvas;
      
      // Capture the main content area
      const mainContent = document.querySelector('main') || document.body;
      const canvas = await html2canvas(mainContent, {
        backgroundColor: '#ffffff',
        scale: 1,
        useCORS: true,
        allowTaint: true,
        width: 1200,
        height: 800
      });

      const dataUrl = canvas.toDataURL('image/png');
      
      // Determine page info from current URL
      const path = window.location.pathname;
      const pageInfo = getPageInfo(path);
      
      const newScreenshot: ScreenshotData = {
        name: pageInfo.name,
        title: pageInfo.title,
        description: pageInfo.description,
        dataUrl,
        timestamp: new Date().toISOString()
      };

      setScreenshots(prev => [...prev, newScreenshot]);
      
      // Also save to backend for demo use
      await fetch('/api/save-screenshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newScreenshot)
      });
      
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      alert('Screenshot capture failed. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  const captureAllPages = async () => {
    const pages = [
      '/dashboard',
      '/transactions', 
      '/budgets',
      '/reports',
      '/trends',
      '/calendar'
    ];

    for (const page of pages) {
      // Navigate to page
      window.location.href = page;
      
      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Capture screenshot
      await captureCurrentPage();
      
      // Wait between captures
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  const downloadScreenshot = (screenshot: ScreenshotData) => {
    const link = document.createElement('a');
    link.href = screenshot.dataUrl;
    link.download = `${screenshot.name}-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={captureCurrentPage} disabled={isCapturing}>
          <Camera className="w-4 h-4 mr-2" />
          {isCapturing ? 'Capturing...' : 'Capture Current Page'}
        </Button>
        
        <Button onClick={captureAllPages} variant="outline" disabled={isCapturing}>
          <Camera className="w-4 h-4 mr-2" />
          Capture All Pages
        </Button>
      </div>

      {screenshots.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Captured Screenshots</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {screenshots.map((screenshot, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-2">
                <img 
                  src={screenshot.dataUrl} 
                  alt={screenshot.title}
                  className="w-full h-32 object-cover rounded border"
                />
                <h4 className="font-medium">{screenshot.title}</h4>
                <p className="text-sm text-gray-600">{screenshot.description}</p>
                <p className="text-xs text-gray-500">
                  {new Date(screenshot.timestamp).toLocaleString()}
                </p>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => downloadScreenshot(screenshot)}
                >
                  <Download className="w-3 h-3 mr-1" />
                  Download
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getPageInfo(path: string) {
  const pageMap: Record<string, { name: string; title: string; description: string }> = {
    '/dashboard': {
      name: 'dashboard',
      title: 'Dashboard Overview',
      description: 'Complete financial overview with income, expenses, and recent transactions'
    },
    '/transactions': {
      name: 'transactions', 
      title: 'Transaction Management',
      description: 'Easy transaction tracking with AI-powered categorization'
    },
    '/budgets': {
      name: 'budgets',
      title: 'Budget Tracking', 
      description: 'Set and monitor spending limits by category'
    },
    '/reports': {
      name: 'reports',
      title: 'Analytics & Reports',
      description: 'Detailed insights into your spending patterns'
    },
    '/trends': {
      name: 'trends',
      title: 'AI Trends & Predictions',
      description: 'AI-powered financial forecasting and recommendations'
    },
    '/calendar': {
      name: 'calendar',
      title: 'Calendar View',
      description: 'Monthly view of all your financial activities'
    }
  };

  return pageMap[path] || {
    name: 'unknown',
    title: 'FinanzerPro Page',
    description: 'FinanzerPro application screenshot'
  };
}