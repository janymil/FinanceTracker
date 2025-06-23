import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, ArrowRight } from 'lucide-react';

interface SubscriptionSchedule {
  hasSchedule: boolean;
  currentPlanEnds?: string;
  newPlanStarts?: string;
  currentPlan?: string;
  newPlan?: string;
}

export function SubscriptionSchedule() {
  const [schedule, setSchedule] = useState<SubscriptionSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuth();

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/subscription-schedule', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSchedule(data);
      }
    } catch (error) {
      console.error('Error fetching subscription schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getPlanName = (priceId: string) => {
    const planMap: { [key: string]: string } = {
      'price_1RcxhjFlf8efPaoOWM6JarOv': 'Standard Monthly',
      'price_1RcxhhFlf8efPaoOoxa7StkA': 'Standard Yearly',
      'price_1RcxhfFlf8efPaoOAYNVWEDc': 'Premium Monthly',
      'price_1RcxhaFlf8efPaoOrkTMX7BZ': 'Premium Yearly'
    };
    return planMap[priceId] || 'Unknown Plan';
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!schedule?.hasSchedule) {
    return null;
  }

  return (
    <Card className="w-full border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
          <Clock className="h-5 w-5" />
          Upcoming Plan Change
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-orange-300 text-orange-700 dark:border-orange-600 dark:text-orange-300">
              Current Plan
            </Badge>
            <span className="font-medium">{getPlanName(schedule.currentPlan!)}</span>
          </div>
          <ArrowRight className="h-4 w-4 text-orange-600" />
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-green-300 text-green-700 dark:border-green-600 dark:text-green-300">
              New Plan
            </Badge>
            <span className="font-medium">{getPlanName(schedule.newPlan!)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-orange-600" />
            <span className="text-gray-600 dark:text-gray-400">Current plan ends:</span>
            <span className="font-medium">{formatDate(schedule.currentPlanEnds!)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-green-600" />
            <span className="text-gray-600 dark:text-gray-400">New plan starts:</span>
            <span className="font-medium">{formatDate(schedule.newPlanStarts!)}</span>
          </div>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-orange-200 dark:border-orange-800">
          Your current plan will remain active until the end of your billing period. No immediate charges will apply.
        </div>
      </CardContent>
    </Card>
  );
}