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
  const userReady = useClerkUserReady();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export options state
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: "pdf",
    dateRange: "all",
    includeTransactions: true,
    includeBudgets: true,
    includeGoals: true,
    includeSummary: true,
    includeCharts: true,
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

  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    date: 'Date',
    description: 'Description',
    amount: 'Amount',
    category: 'Category',
    type: 'Type',
    account: 'Account'
  });

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
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

  // Export function
  const handleExport = async (options: ExportOptions) => {
    try {
      setIsExporting(true);
      const headers = await getAuthHeaders();
      const response = await fetch("/api/export", {
        method: "POST",
        headers,
        body: JSON.stringify(options),
      });
      if (!response.ok) throw new Error("Export failed");
      
      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financial-data.${options.format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Successful",
        description: `Your data has been exported as ${options.format.toUpperCase()}.`,
      });
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // State for all data
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [goals, setGoals] = useState([]);
  const [summary, setSummary] = useState(null);

  // State for categories and backup status
  const [categories, setCategories] = useState([]);
  const [backupStatusData, setBackupStatusData] = useState<any>(null);
  const [isLoadingBackupStatus, setIsLoadingBackupStatus] = useState(false);

  // Fetch ALL data once when component mounts
  useEffect(() => {
    if (userReady) {
      fetchAllData();
      fetchBackupStatus();
    }
  }, [userReady]);

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

  const fetchBackupStatus = async () => {
    if (!userReady) return;
    
    try {
      setIsLoadingBackupStatus(true);
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

  const backupStatus: BackupStatus = {
    lastBackup: backupStatusData?.lastBackup || "Never",
    nextBackup: backupStatusData?.nextBackup || "Not scheduled",
    realUsage: backupStatusData?.realUsage || { size: 0, formattedSize: "0 KB" },
    frequency: backupStatusData?.settings?.frequency || 'weekly',
    autoBackup: backupStatusData?.settings?.autoBackup || false,
    encrypted: backupStatusData?.settings?.encrypted || true,
    status: backupStatusData?.lastBackup ? 'synced' : 'pending',
    info: {
      totalSize: backupStatusData?.info?.totalSize || 0,
      totalBackups: backupStatusData?.info?.totalBackups || 0,
    },
    totalSize: backupStatusData?.realUsage?.formattedSize || "0 KB",
  };

  // Backup function
  const performBackup = async () => {
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

  // Update backup settings function
  const updateBackupSettings = async (settings: any) => {
    try {
      setIsUpdatingBackupSettings(true);
      const headers = await getAuthHeaders();
      const response = await fetch("/api/backup-settings", {
        method: "POST",
        headers,
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error("Settings update failed");
      const result = await response.json();
      await fetchBackupStatus();
      return result;
    } catch (error) {
      console.error('Failed to update backup settings:', error);
      throw error;
    } finally {
      setIsUpdatingBackupSettings(false);
    }
  };

  const exportData = async (options: ExportOptions) => {
    await handleExport(options);
  };

  // Import function
  const handleImport = async (file: File, options: ImportOptions) => {
    try {
      setIsImporting(true);
      setImportProgress(0);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('options', JSON.stringify(options));
      formData.append('columnMapping', JSON.stringify(columnMapping));
      
      const headers = await getAuthHeaders();
      delete headers['Content-Type']; // Let browser set content type for FormData
      
      const response = await fetch("/api/import", {
        method: "POST",
        headers,
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Import failed' }));
        throw new Error(errorData.message || "Import failed");
      }
      
      const result = await response.json();
      setImportResult(result);
      setImportStep('complete');
      
      // Refresh data after successful import
      await fetchAllData();
      
      toast({
        title: "Import Successful",
        description: `Imported ${result.imported} transactions successfully.`,
      });
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
      // Reset import state
      setImportStep('mapping');
      setImportPreview([]);
      setImportResult(null);
    }
  };

  const processImport = async () => {
    if (!importFile) return;
    await handleImport(importFile, importOptions);
  };

  // Restore function
  const handleRestore = async (backupFilename: string) => {
    try {
      setIsRestoring(true);
      const headers = await getAuthHeaders();
      const response = await fetch("/api/backup/restore", {
        method: "POST",
        headers,
        body: JSON.stringify({ filename: backupFilename }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Restore failed' }));
        throw new Error(errorData.message || "Restore failed");
      }
      
      const result = await response.json();
      toast({
        title: "Restore Successful",
        description: "Your data has been restored from the backup.",
      });
      
      // Refresh all data after restore
      await fetchAllData();
      setShowBackupSelection(false);
    } catch (error: any) {
      toast({
        title: "Restore Failed",
        description: error.message || "Failed to restore data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const fetchAvailableBackups = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/backup/list", { headers });
      if (response.ok) {
        const backups = await response.json();
        setAvailableBackups(backups);
      }
    } catch (error) {
      console.error('Failed to fetch available backups:', error);
    }
  };

  useEffect(() => {
    if (showBackupSelection) {
      fetchAvailableBackups();
    }
  }, [showBackupSelection]);

  // Quick export functions
  const quickExportPDF = () => {
    const quickOptions: ExportOptions = {
      format: "pdf",
      dateRange: "all",
      includeTransactions: true,
      includeBudgets: true,
      includeGoals: true,
      includeSummary: true,
      includeCharts: true,
    };
    exportData(quickOptions);
  };

  const quickExportCSV = () => {
    const quickOptions: ExportOptions = {
      format: "csv",
      dateRange: "all",
      includeTransactions: true,
      includeBudgets: false,
      includeGoals: false,
      includeSummary: false,
      includeCharts: false,
    };
    exportData(quickOptions);
  };

  const quickExportExcel = () => {
    const quickOptions: ExportOptions = {
      format: "excel",
      dateRange: "all",
      includeTransactions: true,
      includeBudgets: true,
      includeGoals: true,
      includeSummary: true,
      includeCharts: false,
    };
    exportData(quickOptions);
  };

  if (!userReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <RequirePlan requiredPlan="premium" feature="Data Management">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Data Management</h1>
            <p className="text-muted-foreground">Export, import, and manage your financial data with cloud backup</p>
          </div>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Crown className="h-3 w-3" />
            Premium Feature
          </Badge>
        </div>

        <Tabs defaultValue="export" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="export">Export Data</TabsTrigger>
            <TabsTrigger value="import">Import Data</TabsTrigger>
            <TabsTrigger value="backup">Cloud Backup</TabsTrigger>
          </TabsList>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Quick Export Options */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Quick Export
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    onClick={quickExportPDF}
                    disabled={isExporting}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {isExporting ? "Exporting..." : "Export as PDF"}
                  </Button>
                  <Button 
                    onClick={quickExportCSV}
                    disabled={isExporting}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <Database className="h-4 w-4 mr-2" />
                    {isExporting ? "Exporting..." : "Export as CSV"}
                  </Button>
                  <Button 
                    onClick={quickExportExcel}
                    disabled={isExporting}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <File className="h-4 w-4 mr-2" />
                    {isExporting ? "Exporting..." : "Export as Excel"}
                  </Button>
                </CardContent>
              </Card>

              {/* Advanced Export Options */}
              <Card>
                <CardHeader>
                  <CardTitle>Advanced Export</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Format</Label>
                    <Select 
                      value={exportOptions.format} 
                      onValueChange={(value: any) => setExportOptions(prev => ({ ...prev, format: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF Report</SelectItem>
                        <SelectItem value="csv">CSV Data</SelectItem>
                        <SelectItem value="excel">Excel Workbook</SelectItem>
                        <SelectItem value="json">JSON Data</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Date Range</Label>
                    <Select 
                      value={exportOptions.dateRange} 
                      onValueChange={(value: any) => setExportOptions(prev => ({ ...prev, dateRange: value }))}
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

                  <div className="space-y-3">
                    <Label>Include Data</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="transactions"
                          checked={exportOptions.includeTransactions}
                          onCheckedChange={(checked) => 
                            setExportOptions(prev => ({ ...prev, includeTransactions: checked as boolean }))
                          }
                        />
                        <Label htmlFor="transactions">Transactions</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="budgets"
                          checked={exportOptions.includeBudgets}
                          onCheckedChange={(checked) => 
                            setExportOptions(prev => ({ ...prev, includeBudgets: checked as boolean }))
                          }
                        />
                        <Label htmlFor="budgets">Budgets</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="goals"
                          checked={exportOptions.includeGoals}
                          onCheckedChange={(checked) => 
                            setExportOptions(prev => ({ ...prev, includeGoals: checked as boolean }))
                          }
                        />
                        <Label htmlFor="goals">Goals</Label>
                      </div>
                    </div>
                  </div>

                  <Button 
                    onClick={() => exportData(exportOptions)}
                    disabled={isExporting}
                    className="w-full"
                  >
                    {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                    {isExporting ? "Exporting..." : "Export Data"}
                  </Button>
                </CardContent>
              </Card>
            </div>
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
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Data Source</Label>
                      <Select 
                        value={importOptions.source} 
                        onValueChange={(value: any) => setImportOptions(prev => ({ ...prev, source: value }))}
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
                          <SelectItem value="ynab">YNAB Export</SelectItem>
                          <SelectItem value="personal-capital">Personal Capital</SelectItem>
                          <SelectItem value="bank-export">Bank Export</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="file-upload">Upload File</Label>
                      <Input
                        id="file-upload"
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".csv,.xlsx,.xls,.json"
                        className="cursor-pointer"
                      />
                    </div>

                    {importFile && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <File className="h-4 w-4" />
                        {importFile.name} ({formatFileSize(importFile.size)})
                      </div>
                    )}
                  </div>
                )}

                {importStep === 'mapping' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span>File uploaded successfully</span>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-medium">Map Your Columns</h3>
                      
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Date Column</Label>
                          <Input
                            value={columnMapping.date}
                            onChange={(e) => setColumnMapping(prev => ({ ...prev, date: e.target.value }))}
                            placeholder="Date"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Description Column</Label>
                          <Input
                            value={columnMapping.description}
                            onChange={(e) => setColumnMapping(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Description"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Amount Column</Label>
                          <Input
                            value={columnMapping.amount}
                            onChange={(e) => setColumnMapping(prev => ({ ...prev, amount: e.target.value }))}
                            placeholder="Amount"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Category Column (Optional)</Label>
                          <Input
                            value={columnMapping.category || ''}
                            onChange={(e) => setColumnMapping(prev => ({ ...prev, category: e.target.value }))}
                            placeholder="Category"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="skip-first-row"
                            checked={importOptions.skipFirstRow}
                            onCheckedChange={(checked) => 
                              setImportOptions(prev => ({ ...prev, skipFirstRow: checked as boolean }))
                            }
                          />
                          <Label htmlFor="skip-first-row">Skip first row (headers)</Label>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setImportStep('upload')}>
                          Back
                        </Button>
                        <Button onClick={processImport} disabled={isImporting}>
                          {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : "Import Data"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {importStep === 'complete' && importResult && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="font-medium">Import Complete</span>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{importResult.imported}</div>
                        <div className="text-sm text-muted-foreground">Imported</div>
                      </div>
                      <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">{importResult.skipped}</div>
                        <div className="text-sm text-muted-foreground">Skipped</div>
                      </div>
                      <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">{importResult.errors.length}</div>
                        <div className="text-sm text-muted-foreground">Errors</div>
                      </div>
                    </div>

                    <Button onClick={() => {
                      setImportStep('upload');
                      setImportFile(null);
                      setImportResult(null);
                    }}>
                      Import Another File
                    </Button>
                  </div>
                )}

                {isImporting && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Importing data...</span>
                    </div>
                    <Progress value={importProgress} className="w-full" />
                  </div>
                )}
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
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={backupStatus.status === 'synced' ? 'default' : 'secondary'}>
                      {backupStatus.status === 'synced' ? 'Up to date' : 'Pending'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Last Backup</span>
                    <span className="text-sm">{backupStatus.lastBackup}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Storage Used</span>
                    <span className="text-sm">{backupStatus.totalSize}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Auto Backup</span>
                    <Badge variant={backupStatus.autoBackup ? 'default' : 'secondary'}>
                      {backupStatus.autoBackup ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Button 
                      onClick={performBackup}
                      disabled={isBackingUp}
                      className="w-full"
                    >
                      {isBackingUp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Cloud className="h-4 w-4 mr-2" />}
                      {isBackingUp ? "Backing up..." : "Backup Now"}
                    </Button>

                    <Button 
                      variant="outline"
                      onClick={() => setShowBackupSelection(true)}
                      className="w-full"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Restore from Backup
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
                      <div className="space-y-1">
                        <Label>Auto Backup</Label>
                        <p className="text-sm text-muted-foreground">Automatically backup your data</p>
                      </div>
                      <Switch 
                        checked={backupStatus.autoBackup}
                        onCheckedChange={async (checked) => {
                          await updateBackupSettings({ autoBackup: checked });
                        }}
                        disabled={isUpdatingBackupSettings}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Backup Frequency</Label>
                      <Select 
                        value={backupStatus.frequency} 
                        onValueChange={async (value) => {
                          await updateBackupSettings({ frequency: value });
                        }}
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
                      <div className="space-y-1">
                        <Label>Encryption</Label>
                        <p className="text-sm text-muted-foreground">Encrypt backups for security</p>
                      </div>
                      <Switch 
                        checked={backupStatus.encrypted}
                        onCheckedChange={async (checked) => {
                          await updateBackupSettings({ encrypted: checked });
                        }}
                        disabled={isUpdatingBackupSettings}
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Shield className="h-4 w-4" />
                      <span>Your data is secured with industry-standard encryption</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Restore Dialog */}
        <Dialog open={showBackupSelection} onOpenChange={setShowBackupSelection}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Select Backup to Restore</DialogTitle>
              <DialogDescription>
                Choose a backup to restore your financial data. This will replace your current data.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {availableBackups.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No backups available
                </div>
              ) : (
                availableBackups.map((backup) => (
                  <div
                    key={backup.filename}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedBackup === backup.filename 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedBackup(backup.filename)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">
                          {format(new Date(backup.created), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(backup.created), 'h:mm a')}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(backup.size)}
                      </div>
                    </div>
                  </div>
                ))
              )}
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
                {isRestoring ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {isRestoring ? "Restoring..." : "Restore"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RequirePlan>
  );
}