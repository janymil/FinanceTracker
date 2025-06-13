import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  Cloud, 
  Shield,
  Download,
  Upload,
  Check,
  Clock,
  HardDrive,
  Wifi,
  Lock,
  AlertCircle
} from 'lucide-react';

interface CloudBackupProps {}

interface BackupStatus {
  lastBackup: string;
  nextBackup: string;
  totalSize: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  autoBackup: boolean;
  encrypted: boolean;
  status: 'synced' | 'syncing' | 'error' | 'pending';
}

export default function CloudBackup({}: CloudBackupProps) {
  const [backupStatus, setBackupStatus] = useState<BackupStatus>({
    lastBackup: '2025-06-13 18:30:00',
    nextBackup: '2025-06-14 18:30:00',
    totalSize: '2.4 MB',
    frequency: 'daily',
    autoBackup: true,
    encrypted: true,
    status: 'synced'
  });

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);

  const handleManualBackup = async () => {
    setIsBackingUp(true);
    setBackupProgress(0);
    
    // Simulate backup progress
    const interval = setInterval(() => {
      setBackupProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsBackingUp(false);
          setBackupStatus(prev => ({
            ...prev,
            lastBackup: new Date().toISOString().replace('T', ' ').slice(0, 19),
            status: 'synced'
          }));
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const handleRestoreData = () => {
    // In real implementation, this would trigger a restore process
    console.log('Restore initiated');
  };

  const updateAutoBackup = (enabled: boolean) => {
    setBackupStatus(prev => ({ ...prev, autoBackup: enabled }));
  };

  const updateFrequency = (frequency: 'daily' | 'weekly' | 'monthly') => {
    setBackupStatus(prev => ({ ...prev, frequency }));
  };

  const getStatusIcon = () => {
    switch (backupStatus.status) {
      case 'synced':
        return <Check className="h-4 w-4 text-green-600" />;
      case 'syncing':
        return <Upload className="h-4 w-4 text-blue-600 animate-pulse" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Cloud className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusText = () => {
    switch (backupStatus.status) {
      case 'synced':
        return 'All data backed up';
      case 'syncing':
        return 'Backing up data...';
      case 'error':
        return 'Backup failed';
      case 'pending':
        return 'Backup pending';
      default:
        return 'Unknown status';
    }
  };

  const getStatusColor = () => {
    switch (backupStatus.status) {
      case 'synced':
        return 'text-green-600';
      case 'syncing':
        return 'text-blue-600';
      case 'error':
        return 'text-red-600';
      case 'pending':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Cloud Data Backup
          <Badge className="bg-premium text-white">Premium</Badge>
        </CardTitle>
        <CardDescription>
          Automatic cloud backup and restore for your financial data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Backup Status */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <p className={`font-medium text-sm ${getStatusColor()}`}>
                {getStatusText()}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Last backup: {new Date(backupStatus.lastBackup).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{backupStatus.totalSize}</p>
            <p className="text-xs text-gray-600 dark:text-gray-300">total size</p>
          </div>
        </div>

        {/* Manual Backup */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-sm">Manual Backup</h4>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Create an immediate backup of all your data
              </p>
            </div>
            <Button 
              onClick={handleManualBackup}
              disabled={isBackingUp}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {isBackingUp ? 'Backing Up...' : 'Backup Now'}
            </Button>
          </div>

          {isBackingUp && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Backup Progress</span>
                <span>{backupProgress}%</span>
              </div>
              <Progress value={backupProgress} className="h-2" />
            </div>
          )}
        </div>

        {/* Auto Backup Settings */}
        <div className="space-y-4 pt-4 border-t">
          <h4 className="font-medium text-sm">Automatic Backup Settings</h4>
          
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-backup">Enable Auto Backup</Label>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Automatically backup your data based on schedule
              </p>
            </div>
            <Switch
              id="auto-backup"
              checked={backupStatus.autoBackup}
              onCheckedChange={updateAutoBackup}
            />
          </div>

          {backupStatus.autoBackup && (
            <div className="space-y-2">
              <Label htmlFor="frequency">Backup Frequency</Label>
              <Select value={backupStatus.frequency} onValueChange={updateFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Next backup: {new Date(backupStatus.nextBackup).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Data Types */}
        <div className="space-y-4 pt-4 border-t">
          <h4 className="font-medium text-sm">Backed Up Data</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
              <Check className="h-3 w-3 text-green-600" />
              <span className="text-xs">Transactions</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
              <Check className="h-3 w-3 text-green-600" />
              <span className="text-xs">Budgets</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
              <Check className="h-3 w-3 text-green-600" />
              <span className="text-xs">Goals</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
              <Check className="h-3 w-3 text-green-600" />
              <span className="text-xs">Categories</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
              <Check className="h-3 w-3 text-green-600" />
              <span className="text-xs">Settings</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
              <Check className="h-3 w-3 text-green-600" />
              <span className="text-xs">Reports</span>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="space-y-4 pt-4 border-t">
          <h4 className="font-medium text-sm">Security Features</h4>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Lock className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium">End-to-End Encryption</p>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Your data is encrypted before upload and only you can decrypt it
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Shield className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium">Secure Cloud Storage</p>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Data stored in enterprise-grade secure cloud infrastructure
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <HardDrive className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-sm font-medium">Multiple Redundancy</p>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Your backups are stored in multiple locations for reliability
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Restore Options */}
        <div className="space-y-4 pt-4 border-t">
          <h4 className="font-medium text-sm">Data Restore</h4>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Restore from Backup</p>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Restore your data from the latest cloud backup
              </p>
            </div>
            <Button 
              variant="outline"
              onClick={handleRestoreData}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Restore
            </Button>
          </div>
        </div>

        {/* Storage Usage */}
        <div className="space-y-4 pt-4 border-t">
          <h4 className="font-medium text-sm">Storage Usage</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Used Storage</span>
              <span>2.4 MB of 1 GB</span>
            </div>
            <Progress value={0.24} className="h-2" />
            <p className="text-xs text-gray-600 dark:text-gray-300">
              Plenty of space remaining for your financial data
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}