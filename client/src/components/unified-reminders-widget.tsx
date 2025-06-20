import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Calendar, TrendingUp } from "lucide-react";

export default function UnifiedRemindersWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Reminders & Streaks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-blue-600" />
              <div>
                <p className="font-medium">Expense Reminder</p>
                <p className="text-sm text-muted-foreground">Track recurring expenses</p>
              </div>
            </div>
            <Badge variant="secondary">Active</Badge>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <div>
                <p className="font-medium">Savings Streak</p>
                <p className="text-sm text-muted-foreground">7 days running</p>
              </div>
            </div>
            <Badge variant="secondary">7 days</Badge>
          </div>
          
          <Button variant="outline" className="w-full">
            View All Reminders
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}