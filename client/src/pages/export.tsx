import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import RequirePlan from "@/components/require-plan";
import { ExportTools } from "@/components/export-tools";
import { useToast } from "@/hooks/use-toast";
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
  CheckCircle,
  Loader2,
  File,
  AlertTriangle,
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

interface ImportProgress {
  total: number;
  processed: number;
  imported: number;
  skipped: number;
  errors: string[];
}

interface ColumnMapping {
  date: string;
  description: string;
  amount: string;
  category?: string;
  type?: string;
  account?: string;
}

// Helper function to format file sizes
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function ExportPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const isAuthenticated = useClerkUserReady();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    frequency: 'daily' as const,
    retentionDays: 7,
    includeAttachments: true,
    encryptBackups: true,
  });

  const [importOptions, setImportOptions] = useState<ImportOptions>({
    source: 'csv',
    mapColumns: true,
    skipFirstRow: true,
    dateFormat: 'MM/dd/yyyy',
    mergeStrategy: 'append',
    categoryMapping: 'auto',
    duplicateHandling: 'skip',
    validationLevel: 'flexible',
  });

  const [activeTab, setActiveTab] = useState("export");
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isUpdatingBackupSettings, setIsUpdatingBackupSettings] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [backupProgress, setBackupProgress] = useState(0);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    date: '',
    description: '',
    amount: '',
    category: '',
    type: '',
    account: '',
  });
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showBackupSelection, setShowBackupSelection] = useState(false);
  const [availableBackups, setAvailableBackups] = useState<any[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);

  // State for export data
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [goals, setGoals] = useState([]);
  const [summary, setSummary] = useState(null);

  // State for categories and backup status
  const [categories, setCategories] = useState([]);
  const [backupStatusData, setBackupStatusData] = useState(null);
  const [isLoadingBackupStatus, setIsLoadingBackupStatus] = useState(false);

  // Get auth headers for Clerk authentication
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    try {
      if (typeof window !== 'undefined' && window.Clerk?.session) {
        const token = await window.Clerk.session.getToken();
        if (token) {
          return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          };
        }
      }
    } catch (error) {
      console.warn('Failed to get Clerk token:', error);
    }
    return { "Content-Type": "application/json" };
  };

  // Export function
  const handleExportData = async (options: any) => {
    try {
      setIsExporting(true);
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });
      if (!response.ok) throw new Error("Export failed");
      return response;
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    } finally {
      setIsExporting(false);
    }
  };

  // Backup function
  const handleBackup = async () => {
    try {
      setIsBackingUp(true);
      const headers = await getAuthHeaders();
      const response = await fetch("/api/backup", {
        method: "POST",
        headers,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || "Backup failed");
      }
      const result = await response.json();
      console.log('BACKUP FRONTEND: Backup completed successfully', result);
      toast({
        title: "Backup Successful",
        description: `Your financial data has been backed up to the cloud.`,
      });
      // Refresh backup status to show the new backup
      refetchBackupStatus();
      setIsBackingUp(false);
    } catch (error: any) {
      console.error('BACKUP FRONTEND: Backup failed', error);
      toast({
        title: "Backup Failed",
        description: error.message || "Failed to backup data. Please try again.",
        variant: "destructive",
      });
      setIsBackingUp(false);
    }
  };

  // Backup settings function
  const handleBackupSettings = async (settings: any) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/backup-settings", {
        method: "POST",
        headers,
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error("Settings update failed");
      return response.json();
    } catch (error) {
      console.error('Settings update failed:', error);
      throw error;
    }
  };

  // Restore backup function
  const handleRestore = async (backupFilename: string) => {
    try {
      console.log('RESTORE FRONTEND: Starting restore process with backup:', backupFilename);
      
      const headers = await getAuthHeaders();
      const response = await fetch("/api/restore-backup", {
        method: "POST",
        headers,
        body: JSON.stringify({ filename: backupFilename }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('RESTORE FRONTEND ERROR:', errorData);
        throw new Error(errorData.message || 'Restore failed');
      }

      const result = await response.json();
      console.log('RESTORE FRONTEND SUCCESS:', result);
      
      console.log('RESTORE FRONTEND: Restore completed successfully', result);
      toast({
        title: "Restore Successful",
        description: `Restored ${result.restoredData.transactions} transactions and ${result.restoredData.budgets} budgets from backup.`,
      });
      
      // Refresh data by re-fetching
      fetchAllData();
    } catch (error: any) {
      console.error('RESTORE FRONTEND: Restore failed', error);
      toast({
        title: "Restore Failed",
        description: error.message || "Failed to restore backup. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Fetch all data function
  const fetchAllData = async () => {
    if (!isAuthenticated || !user?.id) return;

    try {
      const token = await window.Clerk?.session?.getToken();
      if (!token) return;
      
      const headers = { 'Authorization': `Bearer ${token}` };
      
      // Fetch all data in parallel
      const [categoriesRes, backupRes, transactionsRes, budgetsRes, goalsRes, summaryRes] = await Promise.all([
        fetch('/api/categories', { headers }),
        fetch('/api/backup/status', { headers }),
        fetch('/api/transactions', { headers }),
        fetch('/api/budgets', { headers }),
        fetch('/api/goals', { headers }),
        fetch('/api/financial-summary', { headers })
      ]);

      if (categoriesRes.ok) {
        setCategories(await categoriesRes.json());
      }
      if (backupRes.ok) {
        setBackupStatusData(await backupRes.json());
      }
      if (transactionsRes.ok) {
        setTransactions(await transactionsRes.json());
      }
      if (budgetsRes.ok) {
        setBudgets(await budgetsRes.json());
      }
      if (goalsRes.ok) {
        setGoals(await goalsRes.json());
      }
      if (summaryRes.ok) {
        setSummary(await summaryRes.json());
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoadingBackupStatus(false);
    }
  };

  // Fetch all data on mount
  useEffect(() => {
    fetchAllData();
  }, [isAuthenticated, user?.id]);

  // Function to refetch backup status
  const refetchBackupStatus = async () => {
    if (!isAuthenticated || !user?.id) return;
    
    setIsLoadingBackupStatus(true);
    try {
      const token = await window.Clerk?.session?.getToken();
      const response = await fetch('/api/backup/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const backupData = await response.json();
        setBackupStatusData(backupData);
      }
    } catch (error) {
      console.error('Error fetching backup status:', error);
    } finally {
      setIsLoadingBackupStatus(false);
    }
  };

  // Helper function to check if backup status data is available
  const hasBackupData = backupStatusData && typeof backupStatusData === 'object';

  return (
    <RequirePlan plan="premium">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Data Management</h1>
          <p className="text-muted-foreground">
            Export your financial data, manage cloud backups, and import data from other platforms.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
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
                  Export Financial Data
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="format">Export Format</Label>
                      <Select 
                        value={exportOptions.format} 
                        onValueChange={(value: any) => setExportOptions(prev => ({ ...prev, format: value }))}
                      >
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
                      <Label htmlFor="dateRange">Date Range</Label>
                      <Select 
                        value={exportOptions.dateRange} 
                        onValueChange={(value: any) => setExportOptions(prev => ({ ...prev, dateRange: value }))}
                      >
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
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="startDate">Start Date</Label>
                          <Input
                            id="startDate"
                            type="date"
                            value={exportOptions.startDate || ""}
                            onChange={(e) => setExportOptions(prev => ({ ...prev, startDate: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="endDate">End Date</Label>
                          <Input
                            id="endDate"
                            type="date"
                            value={exportOptions.endDate || ""}
                            onChange={(e) => setExportOptions(prev => ({ ...prev, endDate: e.target.value }))}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <Label>Include in Export</Label>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="includeTransactions"
                          checked={exportOptions.includeTransactions}
                          onCheckedChange={(checked) => 
                            setExportOptions(prev => ({ ...prev, includeTransactions: !!checked }))
                          }
                        />
                        <Label htmlFor="includeTransactions">Transactions</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="includeBudgets"
                          checked={exportOptions.includeBudgets}
                          onCheckedChange={(checked) => 
                            setExportOptions(prev => ({ ...prev, includeBudgets: !!checked }))
                          }
                        />
                        <Label htmlFor="includeBudgets">Budgets</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="includeGoals"
                          checked={exportOptions.includeGoals}
                          onCheckedChange={(checked) => 
                            setExportOptions(prev => ({ ...prev, includeGoals: !!checked }))
                          }
                        />
                        <Label htmlFor="includeGoals">Goals</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="includeSummary"
                          checked={exportOptions.includeSummary}
                          onCheckedChange={(checked) => 
                            setExportOptions(prev => ({ ...prev, includeSummary: !!checked }))
                          }
                        />
                        <Label htmlFor="includeSummary">Financial Summary</Label>
                      </div>
                      {exportOptions.format === "pdf" && (
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="includeCharts"
                            checked={exportOptions.includeCharts}
                            onCheckedChange={(checked) => 
                              setExportOptions(prev => ({ ...prev, includeCharts: !!checked }))
                            }
                          />
                          <Label htmlFor="includeCharts">Charts & Graphs</Label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button 
                    onClick={() => handleExportData(exportOptions)}
                    disabled={isExporting}
                    className="w-full"
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Export Data
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <ExportTools />
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
                        {backupStatusData.lastBackup ? 
                          format(new Date(backupStatusData.lastBackup.date), 'MMM dd, yyyy') : 
                          'Never'
                        }
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Next: {backupStatusData.nextBackup ? 
                          format(new Date(backupStatusData.nextBackup), 'MMM dd') : 
                          'Manual only'
                        }
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
                        {backupStatusData.lastBackup ? 
                          `${Math.round((new Date().getTime() - new Date(backupStatusData.lastBackup.date).getTime()) / (1000 * 60 * 60 * 24))} days old` :
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

                <div className="flex gap-2">
                  <Button 
                    onClick={handleBackup}
                    disabled={isBackingUp}
                    className="flex-1"
                  >
                    {isBackingUp ? (
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
                    onClick={() => setShowBackupSelection(true)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Restore
                  </Button>
                </div>

                {isBackingUp && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Backup Progress</span>
                      <span>{backupProgress}%</span>
                    </div>
                    <Progress value={backupProgress} />
                  </div>
                )}
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