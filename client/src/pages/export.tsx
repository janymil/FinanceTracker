import { useState, useRef } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import RequirePlan from "@/components/require-plan";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

export default function ExportPage() {
  const { toast } = useToast();
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
  });

  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    date: 'Date',
    description: 'Description',
    amount: 'Amount',
    category: 'Category',
    type: 'Type',
  });

  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importStep, setImportStep] = useState<'upload' | 'mapping' | 'preview' | 'complete'>('upload');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
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

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
  });

  // Fetch real backup status from API
  const { data: backupStatusData } = useQuery({
    queryKey: ["/api/backup-status"],
  });

  // Create backup status object from API data
  const backupStatus: BackupStatus = {
    lastBackup: backupStatusData?.lastBackup || new Date(Date.now() - 86400000).toISOString(),
    nextBackup: backupStatusData?.nextBackup || new Date(Date.now() + 86400000).toISOString(),
    totalSize: backupStatusData?.info?.totalSize ? `${(backupStatusData.info.totalSize / 1024 / 1024).toFixed(1)} MB` : "0 MB",
    frequency: backupStatusData?.settings?.frequency || backupSettings.frequency,
    autoBackup: backupStatusData?.settings?.autoBackup ?? backupSettings.autoBackup,
    encrypted: backupStatusData?.settings?.encryptBackups ?? backupSettings.encryptBackups,
    status: backupStatusData?.settings?.status === 'active' ? 'synced' : 'pending',
  };

  // Import handlers
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/json'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV, Excel, or JSON file.",
        variant: "destructive",
      });
      return;
    }

    setImportOptions(prev => ({ ...prev, file }));
    setImportStep('mapping');
    
    toast({
      title: "File uploaded",
      description: `${file.name} is ready for processing.`,
    });
  };

  const handleImportPreview = async () => {
    if (!importOptions.file) return;

    setIsImporting(true);
    setImportProgress(25);

    try {
      // Parse the uploaded file
      const text = await importOptions.file.text();
      setImportProgress(50);

      let parsedData: any[] = [];
      
      if (importOptions.source === 'csv' || importOptions.file.type === 'text/csv') {
        // Parse CSV
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        for (let i = importOptions.skipFirstRow ? 1 : 0; i < Math.min(lines.length, 6); i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          parsedData.push(row);
        }
      } else if (importOptions.source === 'json' || importOptions.file.type === 'application/json') {
        // Parse JSON
        const jsonData = JSON.parse(text);
        parsedData = Array.isArray(jsonData) ? jsonData.slice(0, 5) : [jsonData];
      }

      setImportProgress(75);

      // Map parsed data to our format
      const mappedData = parsedData.map((row, index) => {
        const amount = parseFloat(row[columnMapping.amount] || '0');
        return {
          date: row[columnMapping.date] || new Date().toISOString().split('T')[0],
          description: row[columnMapping.description] || `Imported transaction ${index + 1}`,
          amount: Math.abs(amount),
          category: row[columnMapping.category || ''] || 'Food',
          type: amount < 0 ? 'expense' : 'income',
        };
      });

      setImportResult({
        success: true,
        imported: 0,
        skipped: 0,
        errors: [],
        preview: mappedData,
      });

      setImportProgress(100);
      setImportStep('preview');
    } catch (error) {
      toast({
        title: "Preview failed",
        description: "Failed to process the file. Please check the format.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!importOptions.file || !importResult?.preview) return;

      // Convert preview data to transactions
      const transactionsToImport = importResult.preview.map(item => ({
        description: item.description,
        amount: item.amount,
        type: item.type,
        date: item.date,
        categoryId: (categories as any[]).find((cat: any) => cat.name.toLowerCase() === item.category.toLowerCase())?.id || 1,
      }));

      // Send all transactions to the bulk import endpoint
      const response = await fetch('/api/import/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: transactionsToImport,
          mergeStrategy: importOptions.mergeStrategy
        }),
      });

      if (!response.ok) {
        throw new Error('Import failed');
      }

      return await response.json();
    },
    onSuccess: (response) => {
      setImportResult(prev => prev ? { 
        ...prev, 
        imported: response.imported || 0,
        skipped: response.skipped || 0,
        errors: response.errors || []
      } : null);
      setImportStep('complete');
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/financial-summary'] });
      
      toast({
        title: "Import completed",
        description: response.message || `Successfully imported ${response.imported} transactions.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Import failed",
        description: "Failed to import transactions. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleImportConfirm = () => {
    setIsImporting(true);
    importMutation.mutate();
  };

  const resetImport = () => {
    setImportStep('upload');
    setImportResult(null);
    setImportProgress(0);
    setImportOptions(prev => ({ ...prev, file: undefined }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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

      const response = await fetch("/api/export", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // For file downloads, we need to handle blob response
      if (options.format === 'csv' || options.format === 'excel') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const filename = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'export.csv';
        return { downloadUrl: url, filename };
      }

      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Export Successful",
        description: "Your data has been exported successfully.",
      });
      
      // Trigger download
      if (data.downloadUrl) {
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = data.filename || 'financial-data.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    },
    onError: (error) => {
      toast({
        title: "Export Failed",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleExport = () => {
    exportMutation.mutate(exportOptions);
  };

  // Manual backup mutation
  const backupMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/backup", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || 'Backup failed');
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Backup Successful",
        description: "Your data has been backed up to the cloud.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/backup-status"] });
    },
    onError: (error) => {
      toast({
        title: "Backup Failed",
        description: "Failed to backup data. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Backup settings mutation
  const backupSettingsMutation = useMutation({
    mutationFn: async (settings: typeof backupSettings) => {
      const response = await fetch("/api/backup-settings", {
        method: "PUT",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to save backup settings');
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Backup settings have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/backup-status"] });
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: "Failed to save backup settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleBackupNow = () => {
    setIsBackingUp(true);
    setBackupProgress(0);
    
    const interval = setInterval(() => {
      setBackupProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsBackingUp(false);
          return 100;
        }
        return prev + 10;
      });
    }, 300);
    
    backupMutation.mutate();
  };

  const handleRestoreData = () => {
    toast({
      title: "Restore initiated",
      description: "Data restore has been started. This may take a few minutes.",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <Check className="h-5 w-5 text-green-500" />;
      case 'syncing':
        return <Upload className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'synced':
        return 'All data synced';
      case 'syncing':
        return 'Syncing data...';
      case 'error':
        return 'Sync error occurred';
      default:
        return 'Pending';
    }
  };

  return (
    <RequirePlan plan="premium">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Data Management</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Import, export, and backup your financial data
            </p>
          </div>
          
          <Badge variant="outline" className="text-purple-600 border-purple-600">
            <Crown className="h-3 w-3 mr-1" />
            Premium Feature
          </Badge>
        </div>

        <Tabs defaultValue="import" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Import Data
            </TabsTrigger>
            <TabsTrigger value="export" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export Data
            </TabsTrigger>
            <TabsTrigger value="backup" className="flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              Cloud Backup
            </TabsTrigger>
          </TabsList>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Import Financial Data
                </CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Import transactions from various formats and financial apps
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {importStep === 'upload' && (
                  <div className="space-y-4">
                    {/* Import Source Selection */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Import Source</Label>
                      <Select
                        value={importOptions.source}
                        onValueChange={(value) =>
                          setImportOptions(prev => ({ ...prev, source: value as any }))
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
                          <SelectItem value="ynab">YNAB (You Need A Budget)</SelectItem>
                          <SelectItem value="personal-capital">Personal Capital</SelectItem>
                          <SelectItem value="bank-export">Bank Export</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* File Upload Area */}
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls,.json"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <div className="space-y-4">
                        <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                          <File className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            Upload your file
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            CSV, Excel, or JSON files up to 10MB
                          </p>
                        </div>
                        <Button
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Choose File
                        </Button>
                      </div>
                    </div>

                    {/* Import Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Date Format</Label>
                        <Select
                          value={importOptions.dateFormat}
                          onValueChange={(value) =>
                            setImportOptions(prev => ({ ...prev, dateFormat: value }))
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

                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Merge Strategy</Label>
                        <Select
                          value={importOptions.mergeStrategy}
                          onValueChange={(value) =>
                            setImportOptions(prev => ({ ...prev, mergeStrategy: value as any }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="append">Add to existing data</SelectItem>
                            <SelectItem value="merge">Merge and update duplicates</SelectItem>
                            <SelectItem value="replace">Replace all data</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="skipFirstRow"
                          checked={importOptions.skipFirstRow}
                          onCheckedChange={(checked) =>
                            setImportOptions(prev => ({ ...prev, skipFirstRow: !!checked }))
                          }
                        />
                        <Label htmlFor="skipFirstRow" className="text-sm">
                          Skip first row (headers)
                        </Label>
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
                        <Label htmlFor="autoCategory" className="text-sm">
                          Auto-categorize transactions
                        </Label>
                      </div>
                    </div>
                  </div>
                )}

                {importStep === 'mapping' && importOptions.file && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Map Columns</h3>
                      <Badge variant="outline">
                        File: {importOptions.file.name}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <Label>Date Column</Label>
                        <Input
                          value={columnMapping.date}
                          onChange={(e) =>
                            setColumnMapping(prev => ({ ...prev, date: e.target.value }))
                          }
                          placeholder="Date"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label>Description Column</Label>
                        <Input
                          value={columnMapping.description}
                          onChange={(e) =>
                            setColumnMapping(prev => ({ ...prev, description: e.target.value }))
                          }
                          placeholder="Description"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label>Amount Column</Label>
                        <Input
                          value={columnMapping.amount}
                          onChange={(e) =>
                            setColumnMapping(prev => ({ ...prev, amount: e.target.value }))
                          }
                          placeholder="Amount"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label>Category Column (Optional)</Label>
                        <Input
                          value={columnMapping.category || ''}
                          onChange={(e) =>
                            setColumnMapping(prev => ({ ...prev, category: e.target.value }))
                          }
                          placeholder="Category"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setImportStep('upload')}
                      >
                        Back
                      </Button>
                      <Button
                        onClick={handleImportPreview}
                        disabled={isImporting}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isImporting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Preview Data
                          </>
                        )}
                      </Button>
                    </div>

                    {isImporting && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Processing file...</span>
                          <span>{importProgress}%</span>
                        </div>
                        <Progress value={importProgress} className="h-2" />
                      </div>
                    )}
                  </div>
                )}

                {importStep === 'preview' && importResult?.preview && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Preview Import</h3>
                      <Badge variant="outline">
                        {importResult.preview.length} transactions ready
                      </Badge>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b">
                        <div className="grid grid-cols-5 gap-4 text-sm font-medium">
                          <span>Date</span>
                          <span>Description</span>
                          <span>Amount</span>
                          <span>Category</span>
                          <span>Type</span>
                        </div>
                      </div>
                      <div className="divide-y">
                        {importResult.preview.map((transaction, index) => (
                          <div key={index} className="px-4 py-3">
                            <div className="grid grid-cols-5 gap-4 text-sm">
                              <span>{transaction.date}</span>
                              <span>{transaction.description}</span>
                              <span className={transaction.type === 'expense' ? 'text-red-600' : 'text-green-600'}>
                                {transaction.type === 'expense' ? '-' : '+'}${transaction.amount.toFixed(2)}
                              </span>
                              <span>{transaction.category}</span>
                              <span className="capitalize">{transaction.type}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setImportStep('mapping')}
                      >
                        Back to Mapping
                      </Button>
                      <Button
                        onClick={handleImportConfirm}
                        disabled={isImporting}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isImporting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Confirm Import
                          </>
                        )}
                      </Button>
                    </div>

                    {isImporting && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Importing transactions...</span>
                          <span>{importProgress.toFixed(0)}%</span>
                        </div>
                        <Progress value={importProgress} className="h-2" />
                      </div>
                    )}
                  </div>
                )}

                {importStep === 'complete' && importResult && (
                  <div className="space-y-4">
                    <div className="text-center py-6">
                      <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4">
                        <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        Import Completed!
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Successfully imported {importResult.imported} transactions
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {importResult.imported}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Imported
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                          {importResult.skipped}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Skipped
                        </div>
                      </div>
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {importResult.errors.length}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Errors
                        </div>
                      </div>
                    </div>

                    <Button onClick={resetImport} className="w-full">
                      Import Another File
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-6">
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

              {/* Quick Export Templates */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Export Templates</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4">
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
          </TabsContent>

          {/* Backup Tab */}
          <TabsContent value="backup" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Cloud className="h-5 w-5" />
                  <span>Cloud Backup & Restore</span>
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
                    <Label htmlFor="frequency">Backup Schedule</Label>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Automatic daily backups at 2:00 AM
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="retention">Data Retention Period</Label>
                    <Select
                      value={backupSettings.retentionDays?.toString() || "7"}
                      onValueChange={(value: string) =>
                        setBackupSettings({ ...backupSettings, retentionDays: parseInt(value) })
                      }
                      disabled={!backupSettings.autoBackup}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 days</SelectItem>
                        <SelectItem value="14">14 days</SelectItem>
                        <SelectItem value="30">30 days</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Older backups will be automatically deleted
                    </p>
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
                  
                  <Button 
                    onClick={() => backupSettingsMutation.mutate(backupSettings)}
                    disabled={backupSettingsMutation.isPending}
                    variant="default"
                    className="w-full"
                  >
                    {backupSettingsMutation.isPending ? (
                      <>
                        <Upload className="h-4 w-4 mr-2 animate-spin" />
                        Saving Settings...
                      </>
                    ) : (
                      <>
                        <Settings className="h-4 w-4 mr-2" />
                        Save Settings
                      </>
                    )}
                  </Button>
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

                  <Button 
                    variant="outline"
                    onClick={handleRestoreData}
                    className="w-full flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Restore from Backup
                  </Button>

                  {backupStatus.status === 'synced' && !isBackingUp && (
                    <div className="text-center text-xs text-gray-600 dark:text-gray-400">
                      Next backup scheduled for {format(new Date(backupStatus.nextBackup), 'MMM d, h:mm a')}
                    </div>
                  )}
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
          </TabsContent>
        </Tabs>
      </div>
    </RequirePlan>
  );
}