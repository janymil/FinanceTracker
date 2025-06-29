import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useAuth } from '@clerk/clerk-react';
import { 
  Download, 
  Upload, 
  FileText, 
  Database,
  Cloud,
  Shield,
  Calendar,
  RefreshCw,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle,
  Code
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
  const { t } = useTranslation();
  const { isReady, user } = useClerkUserReady();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  // Import state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    percentage: number;
    message: string;
  } | null>(null);
  const [importResults, setImportResults] = useState<{
    categories: number;
    incomes: number;
    expenses: number;
    budgets: number;
    goals: number;
    collaborativeGoals: number;
    errors: string[];
  } | null>(null);
  const [importLogs, setImportLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Import functionality
  const handleDownloadExample = () => {
    const exampleCSV = `dataType,transactionType,amount,description,date,category,isRecurring,recurringFrequency,budgetAmount,budgetPeriod,goalTargetAmount,goalCurrentAmount,goalTargetDate,goalCategory
transaction,income,5000,Monthly Salary,2025-01-01,Salary,true,monthly,,,,,
transaction,income,500,Freelance Project,2025-01-15,Freelance,false,,,,,,
transaction,expense,1200,Monthly Rent,2025-01-01,Housing,true,monthly,,,,,
transaction,expense,300,Groceries,2025-01-05,Food & Dining,false,,,,,,
transaction,expense,80,Electric Bill,2025-01-10,Utilities,true,monthly,,,,,
budget,,,,,Food & Dining,,,500,monthly,,,
budget,,,,,Utilities,,,150,monthly,,,
goal,,,,,,,,,,30000,5000,2025-12-31,Emergency Fund
goal,,,,,,,,,,8000,1000,2025-06-01,Vacation`;

    // Note: The system supports both comma (,) and semicolon (;) delimited CSV files
    // Supported periods: daily, weekly, monthly, quarterly, yearly
    // - Budget periods: budgetPeriod column
    // - Recurring transactions: recurringFrequency column

    const blob = new Blob([exampleCSV], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'financerpro-import-example.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast({
      title: t('export.example_downloaded'),
      description: t('export.example_downloaded_desc'),
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportResults(null);
    }
  };

  const handleFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && (file.type === 'text/csv' || file.type === 'application/json')) {
      setSelectedFile(file);
      setImportResults(null);
    } else {
      toast({
        title: t('export.invalid_file'),
        description: t('export.invalid_file_desc'),
        variant: "destructive",
      });
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const loadImportLogs = async () => {
    if (!isReady || !user?.id) return;
    
    setIsLoadingLogs(true);
    try {
      const token = await getToken();
      if (!token) {
        console.error("No authentication token available");
        return;
      }
      
      const response = await fetch('/api/import-logs?limit=5', {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      
      if (response.ok) {
        const logs = await response.json();
        setImportLogs(logs);
      }
    } catch (error) {
      console.error("Error loading import logs:", error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleImportData = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    setImportProgress({ percentage: 0, message: t('export.reading_file') });

    try {
      const token = await getToken();
      if (!token) {
        throw new Error(t('export.auth_required'));
      }
      
      const fileContent = await selectedFile.text();
      
      setImportProgress({ percentage: 30, message: t('export.validating_data') });

      const response = await fetch('/api/import-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: fileContent,
          format: importOptions.source,
          options: importOptions
        })
      });

      setImportProgress({ percentage: 70, message: t('export.processing_import') });

      if (response.ok) {
        const result = await response.json();
        setImportProgress({ percentage: 100, message: t('export.import_completed') });
        
        // Set cache invalidation flag for AI components
        if (result.cacheCleared) {
          localStorage.setItem('invalidate-ai-cache', 'true');
        }
        
        setTimeout(() => {
          setImportProgress(null);
          setImportResults(result.summary);
          loadImportLogs(); // Refresh logs after successful import
        }, 500);

        toast({
          title: t('export.import_successful'),
          description: t('export.import_successful_desc', { 
            count: Object.values(result.summary).reduce((sum: number, val: any) => 
              typeof val === 'number' ? sum + val : sum, 0) 
          }),
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Import failed');
      }
    } catch (error) {
      console.error("Error importing data:", error);
      setImportProgress(null);
      loadImportLogs(); // Refresh logs even after failed import
      toast({
        title: t('export.import_failed'),
        description: error instanceof Error ? error.message : t('export.import_failed_desc'),
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

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
      const token = await getToken();
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
      const token = await getToken();
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
      const token = await getToken();
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
          title: t('export.export_successful'),
          description: t('export.export_successful_desc', { format: exportOptions.format.toUpperCase() }),
        });
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      toast({
        title: t('export.export_failed'),
        description: t('export.export_failed_desc'),
        variant: "destructive",
      });
    }
  };

  const handleCreateBackup = async () => {
    if (!isReady || !user?.id) return;

    setIsCreatingBackup(true);
    try {
      const token = await getToken();
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
          title: t('export.backup_created'),
          description: t('export.backup_created_desc'),
        });
        
        // Refresh backup status
        refetchBackupStatus();
      } else {
        throw new Error('Backup failed');
      }
    } catch (error: any) {
      console.error('BACKUP FRONTEND: Backup failed', error);
      toast({
        title: t('export.backup_failed'),
        description: t('export.backup_failed_desc'),
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
      const token = await getToken();
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
          title: t('export.restore_successful'),
          description: t('export.restore_successful_desc', { 
            transactions: result.restoredData.transactions,
            budgets: result.restoredData.budgets,
            filename: result.filename
          }),
        });
        
        // Just refresh backup status after restore
        refetchBackupStatus();
      } else {
        throw new Error('Restore failed');
      }
    } catch (error: any) {
      console.error('RESTORE FRONTEND: Restore failed', error);
      toast({
        title: t('export.restore_failed'),
        description: t('export.restore_failed_desc'),
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
          <h1 className="text-3xl font-bold">{t('export.page_title')}</h1>
          <p className="text-muted-foreground">
            {t('export.page_description')}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value);
          if (value === "backup") {
            loadBackupStatus(); // Always refresh backup status when tab is accessed
          }
        }} className="space-y-4">
          <TabsList className="grid w-full grid-cols-1 md:grid-cols-3">
            <TabsTrigger value="export" className="text-xs md:text-sm">Export Data</TabsTrigger>
            <TabsTrigger value="import" className="text-xs md:text-sm">Import Data</TabsTrigger>
            <TabsTrigger value="backup" className="text-xs md:text-sm">Cloud Backup</TabsTrigger>
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
                  Import transactions, budgets, goals, and categories from CSV or JSON files
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Step 1: Download Example */}
                <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950/20">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                      1
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                        Download Example Template
                      </h3>
                      <p className="text-sm text-blue-700 dark:text-blue-200 mb-3">
                        Download a simple CSV template with examples. System automatically creates category icons and colors.
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleDownloadExample}
                        className="border-blue-200 hover:bg-blue-100 dark:border-blue-800 dark:hover:bg-blue-900"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Example CSV
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Step 2: Choose Format */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-gray-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                      2
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium mb-3">Choose Import Format</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div 
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            importOptions.source === 'csv' 
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setImportOptions(prev => ({ ...prev, source: 'csv' }))}
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-gray-600" />
                            <div>
                              <div className="font-medium">CSV File</div>
                              <div className="text-sm text-muted-foreground">
                                Comma-separated values format
                              </div>
                            </div>
                          </div>
                        </div>
                        <div 
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            importOptions.source === 'json' 
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setImportOptions(prev => ({ ...prev, source: 'json' }))}
                        >
                          <div className="flex items-center gap-2">
                            <Code className="h-5 w-5 text-gray-600" />
                            <div>
                              <div className="font-medium">JSON File</div>
                              <div className="text-sm text-muted-foreground">
                                Structured data format
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 3: Upload File */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-gray-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                      3
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium mb-3">Upload Your Data File</h3>
                      <div 
                        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                        onDrop={handleFileDrop}
                        onDragOver={handleDragOver}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv,.json"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {selectedFile ? (
                            <>
                              <span className="font-medium text-green-600">{selectedFile.name}</span>
                              <br />
                              <span className="text-xs">Click to change file</span>
                            </>
                          ) : (
                            <>
                              Drop your {importOptions.source.toUpperCase()} file here or click to browse
                              <br />
                              <span className="text-xs">Supports .csv and .json files</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 4: Import Options */}
                {selectedFile && (
                  <div className="border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-gray-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                        4
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium mb-3">Import Options</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium mb-2 block">Merge Strategy</label>
                            <Select 
                              value={importOptions.mergeStrategy} 
                              onValueChange={(value: any) => 
                                setImportOptions(prev => ({ ...prev, mergeStrategy: value }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="append">Add to existing data</SelectItem>
                                <SelectItem value="replace">Replace existing data</SelectItem>
                                <SelectItem value="merge">Merge with existing</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-2 block">Duplicate Handling</label>
                            <Select 
                              value={importOptions.duplicateHandling} 
                              onValueChange={(value: any) => 
                                setImportOptions(prev => ({ ...prev, duplicateHandling: value }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="skip">Skip duplicates</SelectItem>
                                <SelectItem value="overwrite">Overwrite duplicates</SelectItem>
                                <SelectItem value="rename">Rename duplicates</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="skipFirstRow"
                              checked={importOptions.skipFirstRow}
                              onCheckedChange={(checked) => 
                                setImportOptions(prev => ({ ...prev, skipFirstRow: !!checked }))
                              }
                            />
                            <label htmlFor="skipFirstRow" className="text-sm">
                              Skip first row (if it contains headers)
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="autoCategory"
                              checked={importOptions.categoryMapping === 'auto'}
                              onCheckedChange={(checked) => 
                                setImportOptions(prev => ({ 
                                  ...prev, 
                                  categoryMapping: checked ? 'auto' : 'manual' 
                                }))
                              }
                            />
                            <label htmlFor="autoCategory" className="text-sm">
                              Automatically create missing categories
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Import Progress */}
                {importProgress && (
                  <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      <span className="font-medium">Importing Data...</span>
                    </div>
                    <Progress value={importProgress.percentage} className="mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {importProgress.message}
                    </p>
                  </div>
                )}

                {/* Import Results */}
                {importResults && (
                  <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950/20">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="font-medium text-green-900 dark:text-green-100">
                        Import Completed Successfully
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="font-medium">Categories</div>
                        <div className="text-green-600">{importResults.categories} created</div>
                      </div>
                      <div>
                        <div className="font-medium">Income</div>
                        <div className="text-green-600">{importResults.incomes} imported</div>
                      </div>
                      <div>
                        <div className="font-medium">Expenses</div>
                        <div className="text-green-600">{importResults.expenses} imported</div>
                      </div>
                      <div>
                        <div className="font-medium">Budgets</div>
                        <div className="text-green-600">{importResults.budgets} imported</div>
                      </div>
                      <div>
                        <div className="font-medium">Goals</div>
                        <div className="text-green-600">{importResults.goals} imported</div>
                      </div>
                      <div>
                        <div className="font-medium">Collaborative</div>
                        <div className="text-green-600">{importResults.collaborativeGoals} imported</div>
                      </div>
                    </div>
                    {importResults.errors && importResults.errors.length > 0 && (
                      <div className="mt-3 p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded">
                        <div className="font-medium text-yellow-800 dark:text-yellow-200 text-sm">
                          Warnings ({importResults.errors.length}):
                        </div>
                        <ul className="text-xs text-yellow-700 dark:text-yellow-300 mt-1 space-y-1">
                          {importResults.errors.slice(0, 3).map((error, index) => (
                            <li key={index}>• {error}</li>
                          ))}
                          {importResults.errors.length > 3 && (
                            <li>• ... and {importResults.errors.length - 3} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Import History */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">Recent Imports</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadImportLogs}
                      disabled={isLoadingLogs}
                    >
                      {isLoadingLogs ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  
                  {importLogs.length > 0 ? (
                    <div className="space-y-2">
                      {importLogs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant={log.status === 'success' ? 'default' : log.status === 'failed' ? 'destructive' : 'secondary'}>
                              {log.status}
                            </Badge>
                            <span className="font-medium">{log.type?.toUpperCase()}</span>
                            <span className="text-muted-foreground">
                              {new Date(log.importedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="text-muted-foreground">
                            {log.summary?.totalRecords || 0} records
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No import history yet
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <div className="flex justify-end">
                  <Button 
                    onClick={handleImportData}
                    disabled={!selectedFile || isImporting}
                    className="min-w-32"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Import Data
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cloud Backup Tab */}
          <TabsContent value="backup" className="space-y-4">
            {/* Cloud Backup Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud className="h-5 w-5" />
                    Cloud Backup Status
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadBackupStatus}
                    disabled={isLoadingBackupStatus}
                  >
                    {isLoadingBackupStatus ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Automatic Backup Schedule Notification */}
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-600" />
                    <div>
                      <h4 className="font-medium text-green-800 dark:text-green-200">Automatic Backup Enabled</h4>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Your data is automatically backed up daily at 2:00 AM
                      </p>
                    </div>
                  </div>
                </div>

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
                        Next scheduled: {backupStatusData.nextBackup ? 
                          (() => {
                            try {
                              const date = new Date(backupStatusData.nextBackup);
                              return isNaN(date.getTime()) ? 'Tonight at 2:00 AM' : `${format(date, 'MMM dd')} at 2:00 AM`;
                            } catch {
                              return 'Tonight at 2:00 AM';
                            }
                          })() : 
                          'Tonight at 2:00 AM'
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
                          title: t('export.no_backups_available'),
                          description: t('export.no_backups_found'),
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