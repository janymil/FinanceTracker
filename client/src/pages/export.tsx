import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

interface BackupStatus {
  lastBackup: string;
  nextBackup: string;
  totalSize: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  autoBackup: boolean;
  encrypted: boolean;
  status: 'synced' | 'syncing' | 'error' | 'pending';
  info?: {
    totalSize?: number;
    totalBackups?: number;
  };
  realUsage?: {
    size: number;
    formattedSize: string;
  };
}

interface ImportOptions {
  source: 'csv' | 'excel' | 'json' | 'mint' | 'quickbooks' | 'ynab' | 'personal-capital' | 'bank-export';
  file?: File;
  mapColumns: boolean;
  skipFirstRow: boolean;
  dateFormat: string;
  mergeStrategy: 'replace' | 'merge' | 'append';
  categoryMapping: 'auto' | 'manual';
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;
  preview?: Array<{
    date: string;
    description: string;
    amount: number;
    category: string;
    type: string;
  }>;
}

interface ColumnMapping {
  date: string;
  description: string;
  amount: string;
  category?: string;
  type?: string;
  account?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function ExportPage() {
  const { user } = useUser();
  const isReady = useClerkUserReady();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export options state
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: "csv",
    dateRange: "all",
    includeTransactions: true,
    includeBudgets: true,
    includeGoals: true,
    includeSummary: true,
    includeCharts: false,
  });

  // Import state
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    source: 'csv',
    mapColumns: true,
    skipFirstRow: true,
    dateFormat: 'MM/dd/yyyy',
    mergeStrategy: 'append',
    categoryMapping: 'auto',
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    date: '',
    description: '',
    amount: '',
  });

  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [importStep, setImportStep] = useState<'upload' | 'mapping' | 'preview' | 'complete'>('upload');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isUpdatingBackupSettings, setIsUpdatingBackupSettings] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showBackupSelection, setShowBackupSelection] = useState(false);
  const [availableBackups, setAvailableBackups] = useState<any[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);

  // State for all data
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [goals, setGoals] = useState([]);
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [backupStatusData, setBackupStatusData] = useState<any>(null);
  const [isLoadingBackupStatus, setIsLoadingBackupStatus] = useState(false);

  // Get auth headers for Clerk authentication
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    try {
      if (typeof window !== 'undefined' && window.Clerk?.session) {
        const token = await window.Clerk.session.getToken();
        if (token) {
          return { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}` 
          };
        }
      }
    } catch (error) {
      console.warn('Failed to get Clerk token:', error);
    }
    return { "Content-Type": "application/json" };
  };

  // Fetch all data when component mounts
  useEffect(() => {
    if (!isReady) return;

    const fetchAllData = async () => {
      try {
        const headers = await getAuthHeaders();

        // Fetch all data concurrently
        const [transactionsRes, budgetsRes, goalsRes, summaryRes, categoriesRes] = await Promise.all([
          fetch("/api/transactions", { headers }),
          fetch("/api/budgets", { headers }),
          fetch("/api/goals", { headers }),
          fetch("/api/financial-summary", { headers }),
          fetch("/api/categories", { headers })
        ]);

        if (transactionsRes.ok) {
          const transactionsData = await transactionsRes.json();
          setTransactions(transactionsData);
        }

        if (budgetsRes.ok) {
          const budgetsData = await budgetsRes.json();
          setBudgets(budgetsData);
        }

        if (goalsRes.ok) {
          const goalsData = await goalsRes.json();
          setGoals(goalsData);
        }

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setSummary(summaryData);
        }

        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          setCategories(categoriesData);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };

    fetchAllData();
  }, [isReady]);

  // Fetch backup status
  const fetchBackupStatus = async () => {
    if (!isReady) return;
    
    setIsLoadingBackupStatus(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/backup/status", { headers });
      if (response.ok) {
        const data = await response.json();
        setBackupStatusData(data);
      }
    } catch (error) {
      console.error('Failed to fetch backup status:', error);
    } finally {
      setIsLoadingBackupStatus(false);
    }
  };

  useEffect(() => {
    fetchBackupStatus();
  }, [isReady]);

  const backupStatus: BackupStatus = {
    lastBackup: backupStatusData?.lastBackup || "Never",
    nextBackup: backupStatusData?.nextBackup || "Not scheduled",
    totalSize: backupStatusData?.realUsage?.formattedSize || "0 KB",
    frequency: backupStatusData?.settings?.frequency || 'weekly',
    autoBackup: backupStatusData?.settings?.autoBackup || false,
    encrypted: backupStatusData?.settings?.encrypted || true,
    status: backupStatusData?.lastBackup ? 'synced' : 'pending',
    info: {
      totalSize: backupStatusData?.info?.totalSize || 0,
      totalBackups: backupStatusData?.info?.totalBackups || 0,
    },
    realUsage: {
      size: backupStatusData?.realUsage?.size || 0,
      formattedSize: backupStatusData?.realUsage?.formattedSize || "0 KB",
    }
  };

  // Export data function
  const exportData = async (options: ExportOptions) => {
    setIsExporting(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/export", {
        method: "POST",
        headers,
        body: JSON.stringify(options),
      });
      
      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      const extension = options.format === 'excel' ? 'xlsx' : options.format;
      a.download = `financial-data-${format(new Date(), 'yyyy-MM-dd')}.${extension}`;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: `Your financial data has been exported as ${options.format.toUpperCase()}.`,
      });
    } catch (error: any) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Quick export functions
  const handleQuickExport = async (format: "csv" | "pdf" | "excel") => {
    const quickOptions: ExportOptions = {
      format,
      dateRange: "all",
      includeTransactions: true,
      includeBudgets: true,
      includeGoals: true,
      includeSummary: true,
      includeCharts: format === "pdf",
    };
    await exportData(quickOptions);
  };

  // Backup functions
  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
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
      await fetchBackupStatus();
    } catch (error: any) {
      console.error('BACKUP FRONTEND: Backup failed', error);
      toast({
        title: "Backup Failed",
        description: error.message || "Failed to backup data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  // Update backup settings
  const handleUpdateBackupSettings = async (settings: any) => {
    setIsUpdatingBackupSettings(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/backup-settings", {
        method: "POST",
        headers,
        body: JSON.stringify(settings),
      });
      
      if (!response.ok) {
        throw new Error("Settings update failed");
      }
      
      await response.json();
      await fetchBackupStatus();
      
      toast({
        title: "Settings Updated",
        description: "Backup settings have been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingBackupSettings(false);
    }
  };

  // Restore from backup
  const handleRestore = async (backupFilename: string) => {
    setIsRestoring(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/backup/restore", {
        method: "POST",
        headers,
        body: JSON.stringify({ filename: backupFilename }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || "Restore failed");
      }
      
      const result = await response.json();
      
      toast({
        title: "Restore Successful",
        description: `Your financial data has been restored from backup.`,
      });
      
      // Refresh all data after restore
      window.location.reload();
    } catch (error: any) {
      console.error('RESTORE FRONTEND: Restore failed', error);
      toast({
        title: "Restore Failed",
        description: error.message || "Failed to restore data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRestoring(false);
      setShowBackupSelection(false);
    }
  };

  // Show available backups for restore
  const showRestoreDialog = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/backup/list", { headers });
      
      if (response.ok) {
        const backups = await response.json();
        setAvailableBackups(backups);
        setShowBackupSelection(true);
      }
    } catch (error) {
      console.error('Failed to fetch backups:', error);
      toast({
        title: "Error",
        description: "Failed to fetch available backups.",
        variant: "destructive",
      });
    }
  };

  // File handling
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      parseFileColumns(file);
    }
  };

  const parseFileColumns = async (file: File) => {
    // Parse CSV/Excel file to extract column names
    const text = await file.text();
    const lines = text.split('\n');
    if (lines.length > 0) {
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      setAvailableColumns(headers);
      setImportStep('mapping');
    }
  };

  // Import functions
  const handleImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    setImportProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('options', JSON.stringify({
        ...importOptions,
        columnMapping,
      }));

      const headers = await getAuthHeaders();
      delete headers['Content-Type']; // Let browser set the boundary for FormData

      const response = await fetch("/api/import", {
        method: "POST",
        headers: {
          "Authorization": headers.Authorization || "",
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Import failed");
      }

      const result = await response.json();
      setImportResult(result);
      setImportStep('complete');

      toast({
        title: "Import Successful",
        description: `Imported ${result.imported} transactions successfully.`,
      });

      // Refresh data after import
      const refreshHeaders = await getAuthHeaders();
      const transactionsRes = await fetch("/api/transactions", { headers: refreshHeaders });
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (error: any) {
      console.error('Import failed:', error);
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setImportProgress(100);
    }
  };

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <RequirePlan plan="premium">
      <div className="container mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Data Management</h1>
            <p className="text-muted-foreground mt-2">
              Export your financial data, manage cloud backups, and import data from other sources
            </p>
          </div>
          <Crown className="h-8 w-8 text-yellow-500" />
        </div>

        <Tabs defaultValue="export" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="export">Export Data</TabsTrigger>
            <TabsTrigger value="backup">Cloud Backup</TabsTrigger>
            <TabsTrigger value="import">Import Data</TabsTrigger>
          </TabsList>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Quick Export */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Quick Export
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    <Button
                      onClick={() => handleQuickExport("csv")}
                      disabled={isExporting}
                      className="justify-start"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Export as CSV
                    </Button>
                    <Button
                      onClick={() => handleQuickExport("excel")}
                      disabled={isExporting}
                      className="justify-start"
                    >
                      <Database className="h-4 w-4 mr-2" />
                      Export as Excel
                    </Button>
                    <Button
                      onClick={() => handleQuickExport("pdf")}
                      disabled={isExporting}
                      className="justify-start"
                    >
                      <File className="h-4 w-4 mr-2" />
                      Export as PDF Report
                    </Button>
                  </div>
                  {isExporting && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Preparing export...
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Custom Export */}
              <Card>
                <CardHeader>
                  <CardTitle>Custom Export</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <Label>Format</Label>
                      <Select
                        value={exportOptions.format}
                        onValueChange={(value: any) =>
                          setExportOptions({ ...exportOptions, format: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="csv">CSV</SelectItem>
                          <SelectItem value="excel">Excel</SelectItem>
                          <SelectItem value="pdf">PDF Report</SelectItem>
                          <SelectItem value="json">JSON</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Date Range</Label>
                      <Select
                        value={exportOptions.dateRange}
                        onValueChange={(value: any) =>
                          setExportOptions({ ...exportOptions, dateRange: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Time</SelectItem>
                          <SelectItem value="year">This Year</SelectItem>
                          <SelectItem value="quarter">This Quarter</SelectItem>
                          <SelectItem value="month">This Month</SelectItem>
                          <SelectItem value="custom">Custom Range</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {exportOptions.dateRange === "custom" && (
                      <div className="grid gap-2 grid-cols-2">
                        <div>
                          <Label>Start Date</Label>
                          <Input
                            type="date"
                            value={exportOptions.startDate || ""}
                            onChange={(e) =>
                              setExportOptions({
                                ...exportOptions,
                                startDate: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>End Date</Label>
                          <Input
                            type="date"
                            value={exportOptions.endDate || ""}
                            onChange={(e) =>
                              setExportOptions({
                                ...exportOptions,
                                endDate: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <Label>Include</Label>
                      <div className="space-y-2 mt-2">
                        {[
                          { key: "includeTransactions", label: "Transactions" },
                          { key: "includeBudgets", label: "Budgets" },
                          { key: "includeGoals", label: "Goals" },
                          { key: "includeSummary", label: "Financial Summary" },
                          { key: "includeCharts", label: "Charts (PDF only)" },
                        ].map(({ key, label }) => (
                          <div key={key} className="flex items-center space-x-2">
                            <Checkbox
                              id={key}
                              checked={exportOptions[key as keyof ExportOptions] as boolean}
                              onCheckedChange={(checked) =>
                                setExportOptions({
                                  ...exportOptions,
                                  [key]: checked,
                                })
                              }
                            />
                            <Label htmlFor={key}>{label}</Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      onClick={() => exportData(exportOptions)}
                      disabled={isExporting}
                      className="w-full"
                    >
                      {isExporting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Export Data
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Data Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Data Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Transactions</p>
                      <p className="text-2xl font-bold">{transactions.length}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Database className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Budgets</p>
                      <p className="text-2xl font-bold">{budgets.length}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-8 w-8 text-purple-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Goals</p>
                      <p className="text-2xl font-bold">{goals.length}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Settings className="h-8 w-8 text-orange-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Categories</p>
                      <p className="text-2xl font-bold">{categories.length}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cloud Backup Tab */}
          <TabsContent value="backup" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Backup Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cloud className="h-5 w-5" />
                    Backup Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Last Backup:</span>
                      <span className="text-sm font-medium">{backupStatus.lastBackup}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Next Backup:</span>
                      <span className="text-sm font-medium">{backupStatus.nextBackup}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Total Size:</span>
                      <span className="text-sm font-medium">{backupStatus.totalSize}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <Badge variant={backupStatus.status === 'synced' ? 'default' : 'secondary'}>
                        {backupStatus.status === 'synced' ? 'Up to date' : 'Pending'}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Button
                      onClick={handleBackup}
                      disabled={isBackingUp}
                      className="w-full"
                    >
                      {isBackingUp ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Backing up...
                        </>
                      ) : (
                        <>
                          <Cloud className="h-4 w-4 mr-2" />
                          Backup Now
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={showRestoreDialog}
                      disabled={isRestoring}
                      variant="outline"
                      className="w-full"
                    >
                      {isRestoring ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Restoring...
                        </>
                      ) : (
                        <>
                          <Database className="h-4 w-4 mr-2" />
                          Restore from Backup
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Backup Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Backup Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Automatic Backup</Label>
                        <p className="text-sm text-muted-foreground">
                          Enable scheduled backups
                        </p>
                      </div>
                      <Switch
                        checked={backupStatus.autoBackup}
                        onCheckedChange={(checked) =>
                          handleUpdateBackupSettings({
                            autoBackup: checked,
                            frequency: backupStatus.frequency,
                            encrypted: backupStatus.encrypted,
                          })
                        }
                        disabled={isUpdatingBackupSettings}
                      />
                    </div>

                    <div>
                      <Label>Backup Frequency</Label>
                      <Select
                        value={backupStatus.frequency}
                        onValueChange={(value: any) =>
                          handleUpdateBackupSettings({
                            autoBackup: backupStatus.autoBackup,
                            frequency: value,
                            encrypted: backupStatus.encrypted,
                          })
                        }
                        disabled={isUpdatingBackupSettings}
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
                      <div>
                        <Label>Encryption</Label>
                        <p className="text-sm text-muted-foreground">
                          Encrypt backup files
                        </p>
                      </div>
                      <Switch
                        checked={backupStatus.encrypted}
                        onCheckedChange={(checked) =>
                          handleUpdateBackupSettings({
                            autoBackup: backupStatus.autoBackup,
                            frequency: backupStatus.frequency,
                            encrypted: checked,
                          })
                        }
                        disabled={isUpdatingBackupSettings}
                      />
                    </div>
                  </div>

                  {isUpdatingBackupSettings && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating settings...
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Backup Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Secure Cloud Storage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center gap-3">
                    <Shield className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">Industry-Standard Security</p>
                      <p className="text-sm text-muted-foreground">
                        Your data is encrypted in transit and at rest
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Cloud className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">Global CDN Storage</p>
                      <p className="text-sm text-muted-foreground">
                        Fast and reliable cloud infrastructure
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-8 w-8 text-purple-500" />
                    <div>
                      <p className="text-sm font-medium">Automated Scheduling</p>
                      <p className="text-sm text-muted-foreground">
                        Set and forget with automatic backups
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Import Financial Data
                </CardTitle>

              </CardHeader>
              <CardContent>
                {importStep === 'upload' && (
                  <div className="space-y-6">
                    <div>
                      <Label>Data Source</Label>
                      <Select
                        value={importOptions.source}
                        onValueChange={(value: any) =>
                          setImportOptions({ ...importOptions, source: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="csv">CSV File</SelectItem>
                          <SelectItem value="excel">Excel File</SelectItem>
                          <SelectItem value="json">JSON File</SelectItem>
                          <SelectItem value="mint">Mint Export</SelectItem>
                          <SelectItem value="quickbooks">QuickBooks</SelectItem>
                          <SelectItem value="ynab">YNAB</SelectItem>
                          <SelectItem value="personal-capital">Personal Capital</SelectItem>
                          <SelectItem value="bank-export">Bank Export</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Upload File</Label>
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls,.json"
                        onChange={handleFileSelect}
                        className="mt-2"
                      />
                      {selectedFile && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                        </p>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="skipFirstRow"
                          checked={importOptions.skipFirstRow}
                          onCheckedChange={(checked) =>
                            setImportOptions({
                              ...importOptions,
                              skipFirstRow: checked as boolean,
                            })
                          }
                        />
                        <Label htmlFor="skipFirstRow">Skip first row (headers)</Label>
                      </div>

                      <div>
                        <Label>Date Format</Label>
                        <Select
                          value={importOptions.dateFormat}
                          onValueChange={(value) =>
                            setImportOptions({ ...importOptions, dateFormat: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MM/dd/yyyy">MM/DD/YYYY</SelectItem>
                            <SelectItem value="dd/MM/yyyy">DD/MM/YYYY</SelectItem>
                            <SelectItem value="yyyy-MM-dd">YYYY-MM-DD</SelectItem>
                            <SelectItem value="MM-dd-yyyy">MM-DD-YYYY</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label>Merge Strategy</Label>
                      <Select
                        value={importOptions.mergeStrategy}
                        onValueChange={(value: any) =>
                          setImportOptions({ ...importOptions, mergeStrategy: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="append">Append to existing data</SelectItem>
                          <SelectItem value="merge">Merge with existing data</SelectItem>
                          <SelectItem value="replace">Replace existing data</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedFile && (
                      <Button
                        onClick={() => setImportStep('mapping')}
                        className="w-full"
                      >
                        <ChevronRight className="h-4 w-4 mr-2" />
                        Continue to Column Mapping
                      </Button>
                    )}
                  </div>
                )}

                {importStep === 'mapping' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Map Columns</h3>
                      <Button
                        variant="outline"
                        onClick={() => setImportStep('upload')}
                      >
                        Back
                      </Button>
                    </div>

                    <div className="grid gap-4">
                      {[
                        { key: 'date', label: 'Date', required: true },
                        { key: 'description', label: 'Description', required: true },
                        { key: 'amount', label: 'Amount', required: true },
                        { key: 'category', label: 'Category', required: false },
                        { key: 'type', label: 'Type (income/expense)', required: false },
                        { key: 'account', label: 'Account', required: false },
                      ].map(({ key, label, required }) => (
                        <div key={key}>
                          <Label>
                            {label} {required && <span className="text-red-500">*</span>}
                          </Label>
                          <Select
                            value={columnMapping[key as keyof ColumnMapping] || ''}
                            onValueChange={(value) =>
                              setColumnMapping({
                                ...columnMapping,
                                [key]: value,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select column" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">None</SelectItem>
                              {availableColumns.map((column) => (
                                <SelectItem key={column} value={column}>
                                  {column}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>

                    <Button
                      onClick={handleImport}
                      disabled={
                        !columnMapping.date ||
                        !columnMapping.description ||
                        !columnMapping.amount ||
                        isImporting
                      }
                      className="w-full"
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Import Data
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {importStep === 'complete' && importResult && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium">Import Complete</h3>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {importResult.imported}
                        </p>
                        <p className="text-sm text-muted-foreground">Imported</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-yellow-600">
                          {importResult.skipped}
                        </p>
                        <p className="text-sm text-muted-foreground">Skipped</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-600">
                          {importResult.errors.length}
                        </p>
                        <p className="text-sm text-muted-foreground">Errors</p>
                      </div>
                    </div>

                    {importResult.errors.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Errors:</h4>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {importResult.errors.map((error, index) => (
                            <div
                              key={index}
                              className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm"
                            >
                              Row {error.row}: {error.message}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={() => {
                        setImportStep('upload');
                        setSelectedFile(null);
                        setImportResult(null);
                        setColumnMapping({
                          date: '',
                          description: '',
                          amount: '',
                        });
                      }}
                      className="w-full"
                    >
                      Import Another File
                    </Button>
                  </div>
                )}

                {isImporting && (
                  <div className="space-y-2">
                    <Progress value={importProgress} />
                    <p className="text-sm text-center text-muted-foreground">
                      Processing import... {importProgress}%
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Restore Dialog */}
        <Dialog open={showBackupSelection} onOpenChange={setShowBackupSelection}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Restore from Backup</DialogTitle>
              <DialogDescription>
                Select a backup to restore your financial data from.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 max-h-60 overflow-y-auto">
              {availableBackups.map((backup) => (
                <div
                  key={backup.filename}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedBackup === backup.filename
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedBackup(backup.filename)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{format(new Date(backup.date), 'PPp')}</p>
                      <p className="text-sm text-muted-foreground">
                        Size: {formatFileSize(backup.size)}
                      </p>
                    </div>
                    {selectedBackup === backup.filename && (
                      <CheckCircle className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowBackupSelection(false);
                  setSelectedBackup(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => selectedBackup && handleRestore(selectedBackup)}
                disabled={!selectedBackup || isRestoring}
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Restoring...
                  </>
                ) : (
                  'Restore'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RequirePlan>
  );
}