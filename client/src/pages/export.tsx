import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import RequirePlan from "@/components/require-plan";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Download,
  Upload,
  FileText,
  Database,
  Cloud,
  Shield,
  Calendar,
  Settings,
  Check,
  AlertCircle,
  Crown,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";

interface ExportOptions {
  format: "pdf" | "csv" | "excel" | "json";
  dateRange: "all" | "month" | "quarter" | "year" | "custom";
  startDate?: string;
  endDate?: string;
  includeTransactions: boolean;
  includeBudgets: boolean;
  includeGoals: boolean;
  includeSummary: boolean;
  includeCharts: boolean;
}

interface BackupStatus {
  lastBackup: string;
  nextBackup: string;
  totalSize: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  autoBackup: boolean;
  encrypted: boolean;
  status: 'synced' | 'syncing' | 'error' | 'pending';
}

export default function ExportPage() {
  const { toast } = useToast();
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: "pdf",
    dateRange: "month",
    includeTransactions: true,
    includeBudgets: true,
    includeGoals: true,
    includeSummary: true,
    includeCharts: false,
  });

  const [backupSettings, setBackupSettings] = useState({
    autoBackup: true,
    frequency: 'weekly' as const,
    includeAttachments: true,
    encryptBackups: true,
  });

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);

  // Fetch data for export
  const { data: transactions = [] } = useQuery({
    queryKey: ["/api/transactions"],
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ["/api/budgets"],
  });

  const { data: goals = [] } = useQuery({
    queryKey: ["/api/goals"],
  });

  const { data: summary } = useQuery({
    queryKey: ["/api/financial-summary"],
  });

  // Mock backup status - in real app this would come from API
  const backupStatus: BackupStatus = {
    lastBackup: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    nextBackup: new Date(Date.now() + 86400000 * 6).toISOString(), // 6 days from now
    totalSize: "12.4 MB",
    frequency: backupSettings.frequency,
    autoBackup: backupSettings.autoBackup,
    encrypted: backupSettings.encryptBackups,
    status: 'synced',
  };

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async (options: ExportOptions) => {
      const data = {
        ...options,
        transactions: exportOptions.includeTransactions ? transactions : [],
        budgets: exportOptions.includeBudgets ? budgets : [],
        goals: exportOptions.includeGoals ? goals : [],
        summary: exportOptions.includeSummary ? summary : null,
      };

      return apiRequest("/api/export", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Export Successful",
        description: "Your data has been exported successfully.",
      });
      
      // Trigger download
      if (data.downloadUrl) {
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export data. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Backup mutation
  const backupMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/backup", {
        method: "POST",
        body: JSON.stringify(backupSettings),
      });
    },
    onSuccess: () => {
      toast({
        title: "Backup Initiated",
        description: "Your data backup has been started.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Backup Failed",
        description: error.message || "Failed to start backup. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleExport = () => {
    exportMutation.mutate(exportOptions);
  };

  const handleBackupNow = async () => {
    setIsBackingUp(true);
    setBackupProgress(0);
    
    // Simulate backup progress
    const interval = setInterval(() => {
      setBackupProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsBackingUp(false);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    // Also trigger the actual backup
    backupMutation.mutate();
  };

  const handleRestoreData = () => {
    toast({
      title: "Restore Initiated",
      description: "Your data restore has been started from the latest backup.",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <Check className="h-4 w-4 text-green-600" />;
      case 'syncing':
        return <Upload className="h-4 w-4 text-blue-600 animate-pulse" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Cloud className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'synced':
        return 'Up to date';
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return 'Sync error';
      default:
        return 'Pending';
    }
  };

  return (
    <RequirePlan plan="premium">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Export & Backup</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Export your financial data and manage cloud backups
            </p>
          </div>
          
          <Badge variant="outline" className="text-purple-600 border-purple-600">
            <Crown className="h-3 w-3 mr-1" />
            Premium Feature
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Data Export Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Download className="h-5 w-5" />
                <span>Data Export</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Export Format */}
              <div className="space-y-2">
                <Label htmlFor="format">Export Format</Label>
                <Select
                  value={exportOptions.format}
                  onValueChange={(value: any) => 
                    setExportOptions({ ...exportOptions, format: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF Report</SelectItem>
                    <SelectItem value="csv">CSV Spreadsheet</SelectItem>
                    <SelectItem value="excel">Excel Workbook</SelectItem>
                    <SelectItem value="json">JSON Data</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <Label htmlFor="dateRange">Date Range</Label>
                <Select
                  value={exportOptions.dateRange}
                  onValueChange={(value: any) => 
                    setExportOptions({ ...exportOptions, dateRange: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select date range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="quarter">This Quarter</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Date Range */}
              {exportOptions.dateRange === "custom" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={exportOptions.startDate || ""}
                      onChange={(e) =>
                        setExportOptions({ ...exportOptions, startDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={exportOptions.endDate || ""}
                      onChange={(e) =>
                        setExportOptions({ ...exportOptions, endDate: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}

              {/* Data Inclusions */}
              <div className="space-y-3">
                <Label>Include in Export</Label>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeTransactions"
                      checked={exportOptions.includeTransactions}
                      onCheckedChange={(checked) =>
                        setExportOptions({ ...exportOptions, includeTransactions: checked as boolean })
                      }
                    />
                    <Label htmlFor="includeTransactions" className="flex items-center text-sm">
                      <FileText className="h-4 w-4 mr-2" />
                      Transactions
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeBudgets"
                      checked={exportOptions.includeBudgets}
                      onCheckedChange={(checked) =>
                        setExportOptions({ ...exportOptions, includeBudgets: checked as boolean })
                      }
                    />
                    <Label htmlFor="includeBudgets" className="flex items-center text-sm">
                      <Database className="h-4 w-4 mr-2" />
                      Budgets
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeGoals"
                      checked={exportOptions.includeGoals}
                      onCheckedChange={(checked) =>
                        setExportOptions({ ...exportOptions, includeGoals: checked as boolean })
                      }
                    />
                    <Label htmlFor="includeGoals" className="flex items-center text-sm">
                      <Calendar className="h-4 w-4 mr-2" />
                      Goals
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeSummary"
                      checked={exportOptions.includeSummary}
                      onCheckedChange={(checked) =>
                        setExportOptions({ ...exportOptions, includeSummary: checked as boolean })
                      }
                    />
                    <Label htmlFor="includeSummary" className="flex items-center text-sm">
                      <Settings className="h-4 w-4 mr-2" />
                      Financial Summary
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeCharts"
                      checked={exportOptions.includeCharts}
                      onCheckedChange={(checked) =>
                        setExportOptions({ ...exportOptions, includeCharts: checked as boolean })
                      }
                    />
                    <Label htmlFor="includeCharts" className="flex items-center text-sm">
                      <FileText className="h-4 w-4 mr-2" />
                      Charts & Graphs
                    </Label>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleExport} 
                disabled={exportMutation.isPending}
                className="w-full"
              >
                {exportMutation.isPending ? (
                  <>
                    <Upload className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export Data
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Cloud Backup Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Cloud className="h-5 w-5" />
                <span>Cloud Backup</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Backup Status */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(backupStatus.status)}
                    <div>
                      <p className="font-medium text-sm">
                        {getStatusText(backupStatus.status)}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Last backup: {format(new Date(backupStatus.lastBackup), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{backupStatus.totalSize}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Total size</p>
                  </div>
                </div>

                {(backupStatus.status === 'syncing' || isBackingUp) && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{isBackingUp ? 'Backing up data...' : 'Syncing data...'}</span>
                      <span>{isBackingUp ? `${backupProgress}%` : '67%'}</span>
                    </div>
                    <Progress value={isBackingUp ? backupProgress : 67} className="h-2" />
                  </div>
                )}
              </div>

              <Separator />

              {/* Backup Settings */}
              <div className="space-y-4">
                <h4 className="font-medium">Backup Settings</h4>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Automatic Backup</Label>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Automatically backup your data
                    </p>
                  </div>
                  <Switch
                    checked={backupSettings.autoBackup}
                    onCheckedChange={(checked) =>
                      setBackupSettings({ ...backupSettings, autoBackup: checked })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="frequency">Backup Frequency</Label>
                  <Select
                    value={backupSettings.frequency}
                    onValueChange={(value: any) =>
                      setBackupSettings({ ...backupSettings, frequency: value })
                    }
                    disabled={!backupSettings.autoBackup}
                  >
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

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium flex items-center">
                      <Shield className="h-4 w-4 mr-2" />
                      Encrypt Backups
                    </Label>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      End-to-end encryption for your data
                    </p>
                  </div>
                  <Switch
                    checked={backupSettings.encryptBackups}
                    onCheckedChange={(checked) =>
                      setBackupSettings({ ...backupSettings, encryptBackups: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Include Attachments</Label>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Backup transaction receipts and documents
                    </p>
                  </div>
                  <Switch
                    checked={backupSettings.includeAttachments}
                    onCheckedChange={(checked) =>
                      setBackupSettings({ ...backupSettings, includeAttachments: checked })
                    }
                  />
                </div>
              </div>

              <Separator />

              {/* Backup Actions */}
              <div className="space-y-3">
                <Button 
                  onClick={handleBackupNow} 
                  disabled={backupMutation.isPending || backupStatus.status === 'syncing' || isBackingUp}
                  variant="outline"
                  className="w-full"
                >
                  {(backupMutation.isPending || isBackingUp) ? (
                    <>
                      <Upload className="h-4 w-4 mr-2 animate-spin" />
                      {isBackingUp ? 'Backing up...' : 'Starting Backup...'}
                    </>
                  ) : (
                    <>
                      <Cloud className="h-4 w-4 mr-2" />
                      Backup Now
                    </>
                  )}
                </Button>

                <div className="text-center">
                  <Button variant="ghost" size="sm" className="text-gray-600 dark:text-gray-400">
                    <Settings className="h-4 w-4 mr-2" />
                    Advanced Settings
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>

                {backupStatus.status === 'synced' && !isBackingUp && (
                  <div className="text-center text-xs text-gray-600 dark:text-gray-400">
                    Next backup scheduled for {format(new Date(backupStatus.nextBackup), 'MMM d, h:mm a')}
                  </div>
                )}
              </div>

              <Separator />

              {/* Data Restore Options */}
              <div className="space-y-4">
                <h4 className="font-medium">Data Restore</h4>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Restore from Backup</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
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

              <Separator />

              {/* Storage Usage */}
              <div className="space-y-4">
                <h4 className="font-medium">Storage Usage</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Used Storage</span>
                    <span>12.4 MB of 1 GB</span>
                  </div>
                  <Progress value={1.24} className="h-2" />
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Plenty of space remaining for your financial data
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Export Options */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Export Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                className="h-auto p-4 flex flex-col items-start space-y-2"
                onClick={() => {
                  const quickOptions: ExportOptions = {
                    format: "pdf",
                    dateRange: "month",
                    includeTransactions: true,
                    includeBudgets: false,
                    includeGoals: false,
                    includeSummary: true,
                    includeCharts: true,
                  };
                  setExportOptions(quickOptions);
                  exportMutation.mutate(quickOptions);
                }}
              >
                <FileText className="h-8 w-8 text-blue-600" />
                <div className="text-left">
                  <p className="font-medium">Monthly Report</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    PDF with transactions and summary
                  </p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto p-4 flex flex-col items-start space-y-2"
                onClick={() => {
                  const quickOptions: ExportOptions = {
                    format: "csv",
                    dateRange: "all",
                    includeTransactions: true,
                    includeBudgets: true,
                    includeGoals: true,
                    includeSummary: false,
                    includeCharts: false,
                  };
                  setExportOptions(quickOptions);
                  exportMutation.mutate(quickOptions);
                }}
              >
                <Database className="h-8 w-8 text-green-600" />
                <div className="text-left">
                  <p className="font-medium">Complete Data</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    CSV with all transactions and budgets
                  </p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto p-4 flex flex-col items-start space-y-2"
                onClick={() => {
                  const quickOptions: ExportOptions = {
                    format: "excel",
                    dateRange: "year",
                    includeTransactions: true,
                    includeBudgets: true,
                    includeGoals: true,
                    includeSummary: true,
                    includeCharts: false,
                  };
                  setExportOptions(quickOptions);
                  exportMutation.mutate(quickOptions);
                }}
              >
                <Calendar className="h-8 w-8 text-purple-600" />
                <div className="text-left">
                  <p className="font-medium">Annual Summary</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Excel workbook with yearly data
                  </p>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </RequirePlan>
  );
}