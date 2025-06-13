import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Bell, 
  Clock, 
  Calendar,
  Flame,
  Target,
  Plus,
  Settings,
  CheckCircle,
  Crown,
  TrendingUp,
  Zap
} from 'lucide-react';
import { useLocation } from 'wouter';

interface RemindersStreaksProps {}

interface Reminder {
  id: string;
  title: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  isActive: boolean;
  type: 'budget' | 'transaction' | 'goal' | 'review';
}

interface Streak {
  id: string;
  name: string;
  description: string;
  currentStreak: number;
  bestStreak: number;
  targetDays: number;
  lastCompleted: string;
  category: 'saving' | 'budgeting' | 'tracking' | 'goals';
}

export default function RemindersStreaks({}: RemindersStreaksProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'reminders' | 'streaks'>('reminders');
  const [isReminderDialogOpen, setIsReminderDialogOpen] = useState(false);
  const [newReminder, setNewReminder] = useState({
    title: '',
    description: '',
    frequency: 'daily' as const,
    time: '09:00',
    type: 'transaction' as const
  });

  // Sample data - in real app this would come from API
  const [reminders, setReminders] = useState<Reminder[]>([
    {
      id: '1',
      title: 'Daily Expense Check',
      description: 'Log your daily expenses to maintain financial awareness',
      frequency: 'daily',
      time: '20:00',
      isActive: true,
      type: 'transaction'
    },
    {
      id: '2',
      title: 'Weekly Budget Review',
      description: 'Review your weekly spending against budget limits',
      frequency: 'weekly',
      time: '10:00',
      isActive: true,
      type: 'budget'
    },
    {
      id: '3',
      title: 'Monthly Goals Assessment',
      description: 'Check progress on your financial goals',
      frequency: 'monthly',
      time: '09:00',
      isActive: false,
      type: 'goal'
    }
  ]);

  const [streaks, setStreaks] = useState<Streak[]>([
    {
      id: '1',
      name: 'Daily Tracker',
      description: 'Log at least one transaction daily',
      currentStreak: 12,
      bestStreak: 45,
      targetDays: 30,
      lastCompleted: '2025-06-13',
      category: 'tracking'
    },
    {
      id: '2',
      name: 'Budget Keeper',
      description: 'Stay within budget for 7 consecutive days',
      currentStreak: 4,
      bestStreak: 21,
      targetDays: 7,
      lastCompleted: '2025-06-12',
      category: 'budgeting'
    },
    {
      id: '3',
      name: 'Savings Champion',
      description: 'Save money for 30 consecutive days',
      currentStreak: 0,
      bestStreak: 15,
      targetDays: 30,
      lastCompleted: '2025-06-01',
      category: 'saving'
    }
  ]);



  const toggleReminder = (id: string) => {
    setReminders(prev => prev.map(reminder => 
      reminder.id === id ? { ...reminder, isActive: !reminder.isActive } : reminder
    ));
  };

  const createReminder = () => {
    const reminder: Reminder = {
      id: Date.now().toString(),
      ...newReminder,
      isActive: true
    };
    setReminders(prev => [...prev, reminder]);
    setNewReminder({
      title: '',
      description: '',
      frequency: 'daily',
      time: '09:00',
      type: 'transaction'
    });
    setIsReminderDialogOpen(false);
  };

  const getStreakStatus = (streak: Streak) => {
    const progress = (streak.currentStreak / streak.targetDays) * 100;
    if (progress >= 100) return { color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/20', status: 'Complete' };
    if (progress >= 70) return { color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/20', status: 'Strong' };
    if (progress >= 30) return { color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/20', status: 'Building' };
    return { color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-900/20', status: 'Starting' };
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'saving': return TrendingUp;
      case 'budgeting': return Target;
      case 'tracking': return CheckCircle;
      case 'goals': return Flame;
      default: return Zap;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Reminders & Streaks
          <Badge className="bg-blue-600 text-white">Standard+</Badge>
        </CardTitle>
        <CardDescription>
          Stay on track with smart reminders and achievement streaks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Tab Selector */}
          <div className="flex items-center gap-4">
            <Button
              variant={activeTab === 'reminders' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('reminders')}
              className="flex items-center gap-2"
            >
              <Bell className="h-4 w-4" />
              Reminders ({reminders.filter(r => r.isActive).length})
            </Button>
            <Button
              variant={activeTab === 'streaks' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('streaks')}
              className="flex items-center gap-2"
            >
              <Flame className="h-4 w-4" />
              Streaks ({streaks.filter(s => s.currentStreak > 0).length})
            </Button>
          </div>

          {/* Reminders Tab */}
          {activeTab === 'reminders' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Active Reminders</h4>
                <Dialog open={isReminderDialogOpen} onOpenChange={setIsReminderDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Add Reminder
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Reminder</DialogTitle>
                      <DialogDescription>
                        Set up automated reminders for your financial tasks
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="title">Title</Label>
                        <Input
                          id="title"
                          value={newReminder.title}
                          onChange={(e) => setNewReminder(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="e.g., Daily expense check"
                        />
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={newReminder.description}
                          onChange={(e) => setNewReminder(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Describe what this reminder is for"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="frequency">Frequency</Label>
                          <Select value={newReminder.frequency} onValueChange={(value: any) => setNewReminder(prev => ({ ...prev, frequency: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="time">Time</Label>
                          <Input
                            id="time"
                            type="time"
                            value={newReminder.time}
                            onChange={(e) => setNewReminder(prev => ({ ...prev, time: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="type">Type</Label>
                        <Select value={newReminder.type} onValueChange={(value: any) => setNewReminder(prev => ({ ...prev, type: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="transaction">Transaction Entry</SelectItem>
                            <SelectItem value="budget">Budget Review</SelectItem>
                            <SelectItem value="goal">Goal Check</SelectItem>
                            <SelectItem value="review">Financial Review</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={createReminder} className="w-full">
                        Create Reminder
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-3">
                {reminders.map((reminder) => (
                  <div key={reminder.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${reminder.isActive ? 'bg-blue-100 dark:bg-blue-900/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
                        <Clock className={`h-4 w-4 ${reminder.isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <h5 className="font-medium text-sm">{reminder.title}</h5>
                        <p className="text-xs text-gray-600 dark:text-gray-300">{reminder.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {reminder.frequency} at {reminder.time}
                          </Badge>
                          <Badge variant="outline" className="text-xs capitalize">
                            {reminder.type}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={reminder.isActive}
                      onCheckedChange={() => toggleReminder(reminder.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Streaks Tab */}
          {activeTab === 'streaks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Achievement Streaks</h4>
                <Badge variant="outline" className="text-xs">
                  {streaks.filter(s => s.currentStreak > 0).length} active
                </Badge>
              </div>

              <div className="grid gap-4">
                {streaks.map((streak) => {
                  const status = getStreakStatus(streak);
                  const IconComponent = getCategoryIcon(streak.category);
                  const progress = (streak.currentStreak / streak.targetDays) * 100;

                  return (
                    <Card key={streak.id} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${status.bg}`}>
                            <IconComponent className={`h-4 w-4 ${status.color}`} />
                          </div>
                          <div>
                            <h5 className="font-medium text-sm">{streak.name}</h5>
                            <p className="text-xs text-gray-600 dark:text-gray-300">{streak.description}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-xs ${status.color}`}>
                          {status.status}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-300">Progress</span>
                          <span className="font-medium">
                            {streak.currentStreak}/{streak.targetDays} days
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                          <span>Current: {streak.currentStreak} days</span>
                          <span>Best: {streak.bestStreak} days</span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}