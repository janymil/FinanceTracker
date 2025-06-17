import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import RequirePlan from '@/components/require-plan';
import { useClerkUserReady } from '@/hooks/useClerkUserReady';
import { 
  Download, 
  Upload, 
  FileText, 
  Database,
  Cloud,
  Shield,
  Calendar,
  Check,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

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

interface ImportOptions {
  source: "csv" | "excel" | "json" | "mint" | "quickbooks" | "ynab" | "personalcapital" | "bank";
  mapColumns: boolean;
  skipFirstRow: boolean;
  dateFormat: string;
  mergeStrategy: "replace" | "append" | "merge";
  categoryMapping: "auto" | "manual" | "skip";
  duplicateHandling: "skip" | "overwrite" | "rename";
  validationLevel: "strict" | "flexible" | "permissive";
}

export default function ExportPage() {
  const { isReady, user } = useClerkUserReady();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState("export");
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: "pdf",
    dateRange: "all",
    includeTransactions: true,
    includeBudgets: true,
    includeGoals: true,
    includeSummary: true,
    includeCharts: true
  });

  const [importOptions, setImportOptions] = useState<ImportOptions>({
    source: "csv",
    mapColumns: true,
    skipFirstRow: true,
    dateFormat: "YYYY-MM-DD",
    mergeStrategy: "append",
    categoryMapping: "auto",
    duplicateHandling: "skip",
    validationLevel: "flexible"
  });

  // Backup status state
  const [backupStatusData, setBackupStatusData] = useState<any>(null);
  const [isLoadingBackupStatus, setIsLoadingBackupStatus] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showBackupSelection, setShowBackupSelection] = useState(false);
  const [availableBackups, setAvailableBackups] = useState<any[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);

  // Load backup status when backup tab is accessed
  const loadBackupStatus = async () => {
    if (!isReady || !user?.id || isLoadingBackupStatus) return;
    
    setIsLoadingBackupStatus(true);
    try {
      const token = await window.Clerk?.session?.getToken();
      if (token) {
        const response = await fetch('/api/backup/status', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          setBackupStatusData(await response.json());
        }
      }
    } catch (error) {
      console.error('Error fetching backup status:', error);
    } finally {
      setIsLoadingBackupStatus(false);
    }
  };

  // Function to refetch backup status
  const refetchBackupStatus = async () => {
    if (!isReady || !user?.id) return;

    setIsLoadingBackupStatus(true);
    try {
      const token = await window.Clerk?.session?.getToken();
      if (token) {
        const response = await fetch('/api/backup/status', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          setBackupStatusData(await response.json());
        }
      }
    } catch (error) {
      console.error('Error refetching backup status:', error);
    } finally {
      setIsLoadingBackupStatus(false);
    }
  };

  const hasBackupData = backupStatusData !== null;

  const handleExport = async () => {
    if (!isReady || !user?.id) return;

    try {
      const token = await window.Clerk?.session?.getToken();
      if (!token) return;

      let url = '/api/export';
      const params = new URLSearchParams({
        format: exportOptions.format,
        dateRange: exportOptions.dateRange,
        includeTransactions: exportOptions.includeTransactions.toString(),
        includeBudgets: exportOptions.includeBudgets.toString(),
        includeGoals: exportOptions.includeGoals.toString(),
        includeSummary: exportOptions.includeSummary.toString(),
        includeCharts: exportOptions.includeCharts.toString()
      });

      if (exportOptions.startDate) params.append('startDate', exportOptions.startDate);
      if (exportOptions.endDate) params.append('endDate', exportOptions.endDate);

      url += '?' + params.toString();

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        if (exportOptions.format === 'pdf') {
          const blob = await response.blob();
          const downloadUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = `financial-export-${new Date().toISOString().split('T')[0]}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(downloadUrl);
        } else {
          const data = await response.json();
          const dataStr = JSON.stringify(data, null, 2);
          const dataBlob = new Blob([dataStr], { type: 'application/json' });
          const downloadUrl = window.URL.createObjectURL(dataBlob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = `financial-export-${new Date().toISOString().split('T')[0]}.${exportOptions.format}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(downloadUrl);
        }

        toast({
          title: "Export Successful",
          description: `Your financial data has been exported as ${exportOptions.format.toUpperCase()}.`,
        });
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "There was an error exporting your data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCreateBackup = async () => {
    if (!isReady || !user?.id) return;

    setIsCreatingBackup(true);
    try {
      const token = await window.Clerk?.session?.getToken();
      if (!token) return;

      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('BACKUP FRONTEND: Backup completed successfully', result);
        
        toast({
          title: "Backup Created",
          description: "Your financial data has been backed up to cloud storage.",
        });
        
        // Refresh backup status
        refetchBackupStatus();
      } else {
        throw new Error('Backup failed');
      }
    } catch (error: any) {
      console.error('BACKUP FRONTEND: Backup failed', error);
      toast({
        title: "Backup Failed",
        description: "There was an error creating your backup. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleRestore = async (backupFilename?: string) => {
    if (!isReady || !user?.id) return;

    setIsRestoring(true);
    try {
      const token = await window.Clerk?.session?.getToken();
      if (!token) return;

      const response = await fetch('/api/restore-backup', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ filename: backupFilename })
      });

      if (response.ok) {
        const result = await response.json();
        
        toast({
          title: "Restore Successful",
          description: `Restored ${result.restoredData.transactions} transactions and ${result.restoredData.budgets} budgets from backup file: ${result.filename}`,
        });
        
        // Just refresh backup status after restore
        refetchBackupStatus();
      } else {
        throw new Error('Restore failed');
      }
    } catch (error: any) {
      console.error('RESTORE FRONTEND: Restore failed', error);
      toast({
        title: "Restore Failed",
        description: "There was an error restoring your backup. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <RequirePlan plan="premium" feature="Data Management">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Data Management</h1>
          <p className="text-muted-foreground">
            Export your financial data, manage cloud backups, and import data from other platforms.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value);
          if (value === "backup" && !backupStatusData) {
            loadBackupStatus();
          }
        }} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="export">Export Data</TabsTrigger>
            <TabsTrigger value="import">Import Data</TabsTrigger>
            <TabsTrigger value="backup">Cloud Backup</TabsTrigger>
          </TabsList>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Export Your Financial Data
                </CardTitle>
                <CardDescription>
                  Download your transactions, budgets, and goals in various formats
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Export Format</label>
                      <Select value={exportOptions.format} onValueChange={(value: any) => 
                        setExportOptions(prev => ({ ...prev, format: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pdf">PDF Report</SelectItem>
                          <SelectItem value="csv">CSV Spreadsheet</SelectItem>
                          <SelectItem value="excel">Excel Workbook</SelectItem>
                          <SelectItem value="json">JSON Data</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Date Range</label>
                      <Select value={exportOptions.dateRange} onValueChange={(value: any) => 
                        setExportOptions(prev => ({ ...prev, dateRange: value }))}>
                        <SelectTrigger>
                          <SelectValue />
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

                    {exportOptions.dateRange === "custom" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-sm font-medium">Start Date</label>
                          <input
                            type="date"
                            className="w-full px-3 py-2 border rounded-md"
                            value={exportOptions.startDate || ''}
                            onChange={(e) => setExportOptions(prev => ({ ...prev, startDate: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">End Date</label>
                          <input
                            type="date"
                            className="w-full px-3 py-2 border rounded-md"
                            value={exportOptions.endDate || ''}
                            onChange={(e) => setExportOptions(prev => ({ ...prev, endDate: e.target.value }))}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-3 block">Include in Export</label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="transactions"
                            checked={exportOptions.includeTransactions}
                            onCheckedChange={(checked) => 
                              setExportOptions(prev => ({ ...prev, includeTransactions: !!checked }))}
                          />
                          <label htmlFor="transactions" className="text-sm">Transactions</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="budgets"
                            checked={exportOptions.includeBudgets}
                            onCheckedChange={(checked) => 
                              setExportOptions(prev => ({ ...prev, includeBudgets: !!checked }))}
                          />
                          <label htmlFor="budgets" className="text-sm">Budgets</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="goals"
                            checked={exportOptions.includeGoals}
                            onCheckedChange={(checked) => 
                              setExportOptions(prev => ({ ...prev, includeGoals: !!checked }))}
                          />
                          <label htmlFor="goals" className="text-sm">Goals</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="summary"
                            checked={exportOptions.includeSummary}
                            onCheckedChange={(checked) => 
                              setExportOptions(prev => ({ ...prev, includeSummary: !!checked }))}
                          />
                          <label htmlFor="summary" className="text-sm">Financial Summary</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="charts"
                            checked={exportOptions.includeCharts}
                            onCheckedChange={(checked) => 
                              setExportOptions(prev => ({ ...prev, includeCharts: !!checked }))}
                          />
                          <label htmlFor="charts" className="text-sm">Charts & Visualizations</label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center py-8 text-muted-foreground">
                  <Download className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Export functionality coming soon</p>
                  <p className="text-sm">Support for PDF, CSV, Excel, JSON, and more</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Import Financial Data
                </CardTitle>
                <CardDescription>
                  Import transactions and data from other financial platforms
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Import functionality coming soon</p>
                  <p className="text-sm">Support for CSV, Excel, Mint, QuickBooks, and more</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cloud Backup Tab */}
          <TabsContent value="backup" className="space-y-4">
            {/* Cloud Backup Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-5 w-5" />
                  Cloud Backup Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingBackupStatus ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Loading backup status...</span>
                  </div>
                ) : hasBackupData ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">Last Backup</div>
                      <div className="text-lg font-semibold">
                        {backupStatusData.lastBackup && backupStatusData.lastBackup.date ? 
                          (() => {
                            try {
                              const date = new Date(backupStatusData.lastBackup.date);
                              return isNaN(date.getTime()) ? 'Never' : format(date, 'MMM dd, yyyy');
                            } catch {
                              return 'Never';
                            }
                          })() : 
                          'Never'
                        }
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {backupStatusData.settings?.autoBackup ? (
                          <div>
                            <span className="text-green-600 font-medium">Auto backup enabled</span>
                            <br />
                            Next: {backupStatusData.nextBackup ? 
                              (() => {
                                try {
                                  const date = new Date(backupStatusData.nextBackup);
                                  return isNaN(date.getTime()) ? 'Manual only' : `${format(date, 'MMM dd')} at 2:00 AM`;
                                } catch {
                                  return 'Manual only';
                                }
                              })() : 
                              'Manual only'
                            }
                          </div>
                        ) : (
                          'Next: Manual only'
                        )}
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">Storage Usage</div>
                      <div className="text-lg font-semibold">
                        {backupStatusData.realUsage?.total || '0 KB'}
                      </div>
                      <Progress 
                        value={backupStatusData.settings?.retentionDays ? 
                          Math.min((backupStatusData.settings.retentionDays / 30) * 100, 100) : 0
                        } 
                        className="mt-2" 
                      />
                      <div className="text-sm text-muted-foreground mt-1">
                        {backupStatusData.lastBackup && backupStatusData.lastBackup.date ? 
                          (() => {
                            try {
                              const lastBackupDate = new Date(backupStatusData.lastBackup.date);
                              if (isNaN(lastBackupDate.getTime())) return 'No backups';
                              const daysDiff = Math.round((new Date().getTime() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24));
                              return `${daysDiff} days old`;
                            } catch {
                              return 'No backups';
                            }
                          })() :
                          'No backups'
                        }
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">Backup Info</div>
                      <div className="text-sm space-y-1">
                        <div>Provider: {backupStatusData.info?.provider || 'Bunny.net CDN'}</div>
                        <div>Region: {backupStatusData.info?.region || 'Global'}</div>
                      </div>
                      <div className="flex items-center gap-1 mt-2">
                        <Shield className="h-3 w-3 text-green-500" />
                        <span className="text-xs text-green-600">
                          {backupStatusData.realUsage?.files || 0} files stored
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No backup status available
                  </div>
                )}

                {/* Backup Actions */}
                <div className="flex gap-2">
                  <Button 
                    onClick={handleCreateBackup} 
                    disabled={isCreatingBackup}
                    className="flex-1"
                  >
                    {isCreatingBackup ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Backup...
                      </>
                    ) : (
                      <>
                        <Cloud className="mr-2 h-4 w-4" />
                        Backup Now
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      // Get the latest backup filename from the status data
                      const latestBackupPath = backupStatusData?.lastBackup?.filename;
                      if (latestBackupPath) {
                        // Extract just the filename from the full path
                        const filename = latestBackupPath.split('/').pop();
                        handleRestore(filename);
                      } else {
                        toast({
                          title: "No Backups Available",
                          description: "No backups found to restore.",
                          variant: "destructive",
                        });
                      }
                    }}
                    disabled={isRestoring}
                  >
                    {isRestoring ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Restoring...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Restore
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Backup Selection Dialog */}
        <Dialog open={showBackupSelection} onOpenChange={setShowBackupSelection}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Restore from Backup</DialogTitle>
              <DialogDescription>
                Select a backup to restore your financial data.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {availableBackups.length > 0 ? (
                <div className="space-y-2">
                  {availableBackups.map((backup, index) => (
                    <div
                      key={index}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedBackup === backup.filename ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedBackup(backup.filename)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{backup.formattedDate}</div>
                          <div className="text-sm text-muted-foreground">{backup.formattedSize}</div>
                        </div>
                        {selectedBackup === backup.filename && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No backups available
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBackupSelection(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedBackup) {
                    handleRestore(selectedBackup);
                    setShowBackupSelection(false);
                    setSelectedBackup(null);
                  }
                }}
                disabled={!selectedBackup}
              >
                <Download className="mr-2 h-4 w-4" />
                Restore
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RequirePlan>
  );
}