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
import { PDFSecurityModal } from '@/components/PDFSecurityModal';
import { DuplicateWarningModal } from '@/components/DuplicateWarningModal';
import { PDFProcessingProgress } from '@/components/PDFProcessingProgress';
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
  source: "csv" | "excel" | "json" | "mint" | "quickbooks" | "ynab" | "personalcapital" | "bank" | "pdf-statement";
  mapColumns: boolean;
  skipFirstRow: boolean;
  dateFormat: string;
  mergeStrategy: "replace" | "append" | "merge";
  categoryMapping: "auto" | "manual" | "skip";
  duplicateHandling: "skip" | "overwrite" | "rename";
  validationLevel: "strict" | "flexible" | "permissive";
}

interface PDFProcessingResult {
  success: boolean;
  processingMethod: 'text' | 'ocr' | 'hybrid';
  totalPages: number;
  extractedTransactions: number;
  invalidTransactions: number;
  overallConfidence: number;
  errors: string[];
  transactions: any[];
  invalidData: any[];
  duplicates?: DuplicateDetection[];
  preview: boolean;
}

interface DuplicateDetection {
  extractedTransaction: {
    date: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    confidence: number;
  };
  existingTransactions: {
    id: number;
    date: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
  }[];
  similarityScore: number;
  matchReasons: string[];
}

interface PreviewTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  confidence: number;
  category?: string;
  rawText?: string;
  detectedFormat?: string;
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

  // PDF processing state
  const [pdfProcessingResult, setPdfProcessingResult] = useState<PDFProcessingResult | null>(null);
  const [previewTransactions, setPreviewTransactions] = useState<PreviewTransaction[]>([]);
  const [isProcessingPDF, setIsProcessingPDF] = useState(false);
  const [processingSessionId, setProcessingSessionId] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const [isImportingFromPreview, setIsImportingFromPreview] = useState(false);
  
  // Security disclosure state
  const [showSecurityDisclosure, setShowSecurityDisclosure] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [hasConsentedToSecurity, setHasConsentedToSecurity] = useState(false);
  
  // Duplicate warning state
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateDetections, setDuplicateDetections] = useState<DuplicateDetection[]>([]);

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

  // Security disclosure handlers
  const handlePDFUploadClick = () => {
    if (!hasConsentedToSecurity) {
      setShowSecurityDisclosure(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleSecurityConsent = () => {
    setHasConsentedToSecurity(true);
    setShowSecurityDisclosure(false);
    // Trigger file selection after consent
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 100);
  };

  // PDF Bank Statement Processing Functions
  const handlePDFUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast({
        title: t('export.invalid_file'),
        description: 'Please select a PDF file.',
        variant: "destructive",
      });
      return;
    }

    // Generate unique session ID for progress tracking
    const sessionId = `pdf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setProcessingSessionId(sessionId);
    setIsProcessingPDF(true);
    setPdfProcessingResult(null);
    setPreviewTransactions([]);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error(t('export.auth_required'));
      }

      const formData = new FormData();
      formData.append('pdf', file);

      const response = await fetch('/api/import/pdf-statement', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-user-language': localStorage.getItem('language') || 'en-us',
          'x-session-id': sessionId
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process PDF');
      }

      const result: PDFProcessingResult = await response.json();
      setPdfProcessingResult(result);
      setPreviewTransactions(result.transactions);
      
      // Check for duplicates
      if (result.duplicates && result.duplicates.length > 0) {
        setDuplicateDetections(result.duplicates);
        setShowDuplicateWarning(true);
        
        toast({
          title: t('export.duplicate_warning.found_title', 'Duplicate Transactions Found'),
          description: t('export.duplicate_warning.found_description', 'Found {{count}} potential duplicate(s). Please review before importing.', { count: result.duplicates.length }),
          variant: "default",
        });
      } else {
        // No duplicates, show preview modal directly
        const allIndices = new Set(result.transactions.map((_, index) => index));
        setSelectedTransactions(allIndices);
        setShowPreviewModal(true);
        
        toast({
          title: 'PDF Processing Complete',
          description: `Extracted ${result.extractedTransactions} transactions with ${(result.overallConfidence * 100).toFixed(0)}% confidence.`,
        });
      }

    } catch (error) {
      console.error('PDF processing error:', error);
      toast({
        title: 'PDF Processing Failed',
        description: error instanceof Error ? error.message : 'Failed to process PDF',
        variant: "destructive",
      });
    } finally {
      setIsProcessingPDF(false);
    }
  };

  // Duplicate warning handlers
  const handleDuplicateWarningProceed = (selectedTransactions: any[]) => {
    setShowDuplicateWarning(false);
    setPreviewTransactions(selectedTransactions);
    
    // Select all remaining transactions
    const allIndices = new Set(selectedTransactions.map((_, index) => index));
    setSelectedTransactions(allIndices);
    
    setShowPreviewModal(true);
    
    toast({
      title: t('export.duplicate_warning.proceeding_title', 'Proceeding with Import'),
      description: t('export.duplicate_warning.proceeding_description', 'Importing {{count}} selected transactions', { count: selectedTransactions.length }),
    });
  };

  const handleDuplicateWarningClose = () => {
    setShowDuplicateWarning(false);
    setDuplicateDetections([]);
    setPdfProcessingResult(null);
    setPreviewTransactions([]);
  };

  const handleImportSelectedTransactions = async () => {
    if (!pdfProcessingResult || selectedTransactions.size === 0) return;

    setIsImportingFromPreview(true);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error(t('export.auth_required'));
      }

      const transactionsToImport = previewTransactions.filter((_, index) => 
        selectedTransactions.has(index)
      );

      // Convert to import format
      const importData = transactionsToImport.map(tx => ({
        dataType: 'transaction',
        transactionType: tx.type,
        amount: Math.abs(tx.amount),
        description: tx.description,
        date: tx.date,
        category: tx.category || '',
        isRecurring: false,
        recurringFrequency: ''
      }));

      const response = await fetch('/api/import-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: importData.map(row => 
            Object.values(row).join(',')
          ).join('\n'),
          format: 'csv',
          options: {
            ...importOptions,
            skipFirstRow: false
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Import failed');
      }

      const result = await response.json();
      
      setShowPreviewModal(false);
      setImportResults(result.summary);
      loadImportLogs();

      toast({
        title: 'Transactions Imported Successfully',
        description: `Imported ${selectedTransactions.size} transactions from your bank statement.`,
      });

    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to import transactions',
        variant: "destructive",
      });
    } finally {
      setIsImportingFromPreview(false);
    }
  };

  const toggleTransactionSelection = (index: number) => {
    const newSelection = new Set(selectedTransactions);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedTransactions(newSelection);
  };

  const selectAllTransactions = () => {
    const allIndices = new Set(previewTransactions.map((_, index) => index));
    setSelectedTransactions(allIndices);
  };

  const deselectAllTransactions = () => {
    setSelectedTransactions(new Set());
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
            <TabsTrigger value="export" className="text-xs md:text-sm">{t('export.tab_export')}</TabsTrigger>
            <TabsTrigger value="import" className="text-xs md:text-sm">{t('export.tab_import')}</TabsTrigger>
            <TabsTrigger value="backup" className="text-xs md:text-sm">{t('export.tab_backup')}</TabsTrigger>
          </TabsList>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  {t('export.export_title')}
                </CardTitle>
                <CardDescription>
                  {t('export.export_description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">{t('export.format_label')}</label>
                      <Select value={exportOptions.format} onValueChange={(value: any) => 
                        setExportOptions(prev => ({ ...prev, format: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pdf">{t('export.format_pdf')}</SelectItem>
                          <SelectItem value="csv">{t('export.format_csv')}</SelectItem>
                          <SelectItem value="excel">{t('export.format_excel')}</SelectItem>
                          <SelectItem value="json">{t('export.format_json')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium">{t('export.date_range_label')}</label>
                      <Select value={exportOptions.dateRange} onValueChange={(value: any) => 
                        setExportOptions(prev => ({ ...prev, dateRange: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('export.range_all')}</SelectItem>
                          <SelectItem value="month">{t('export.range_month')}</SelectItem>
                          <SelectItem value="quarter">{t('export.range_quarter')}</SelectItem>
                          <SelectItem value="year">{t('export.range_year')}</SelectItem>
                          <SelectItem value="custom">{t('export.range_custom')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {exportOptions.dateRange === "custom" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-sm font-medium">{t('export.start_date')}</label>
                          <input
                            type="date"
                            className="w-full px-3 py-2 border rounded-md"
                            value={exportOptions.startDate || ''}
                            onChange={(e) => setExportOptions(prev => ({ ...prev, startDate: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">{t('export.end_date')}</label>
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
                      <label className="text-sm font-medium mb-3 block">{t('export.include_label')}</label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="transactions"
                            checked={exportOptions.includeTransactions}
                            onCheckedChange={(checked) => 
                              setExportOptions(prev => ({ ...prev, includeTransactions: !!checked }))}
                          />
                          <label htmlFor="transactions" className="text-sm">{t('export.include_transactions')}</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="budgets"
                            checked={exportOptions.includeBudgets}
                            onCheckedChange={(checked) => 
                              setExportOptions(prev => ({ ...prev, includeBudgets: !!checked }))}
                          />
                          <label htmlFor="budgets" className="text-sm">{t('export.include_budgets')}</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="goals"
                            checked={exportOptions.includeGoals}
                            onCheckedChange={(checked) => 
                              setExportOptions(prev => ({ ...prev, includeGoals: !!checked }))}
                          />
                          <label htmlFor="goals" className="text-sm">{t('export.include_goals')}</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="summary"
                            checked={exportOptions.includeSummary}
                            onCheckedChange={(checked) => 
                              setExportOptions(prev => ({ ...prev, includeSummary: !!checked }))}
                          />
                          <label htmlFor="summary" className="text-sm">{t('export.include_summary')}</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="charts"
                            checked={exportOptions.includeCharts}
                            onCheckedChange={(checked) => 
                              setExportOptions(prev => ({ ...prev, includeCharts: !!checked }))}
                          />
                          <label htmlFor="charts" className="text-sm">{t('export.include_charts')}</label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center py-8 text-muted-foreground">
                  <Download className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('export.coming_soon')}</p>
                  <p className="text-sm">{t('export.coming_soon_desc')}</p>
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
                  {t('export.import_title')}
                </CardTitle>
                <CardDescription>
                  {t('export.import_description')}
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
                        {t('export.step1_title')}
                      </h3>
                      <p className="text-sm text-blue-700 dark:text-blue-200 mb-3">
                        {t('export.step1_description')}
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleDownloadExample}
                        className="border-blue-200 hover:bg-blue-100 dark:border-blue-800 dark:hover:bg-blue-900"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {t('export.download_example_csv')}
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
                      <h3 className="font-medium mb-3">{t('export.step2_title')}</h3>
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
                              <div className="font-medium">{t('export.csv_file')}</div>
                              <div className="text-sm text-muted-foreground">
                                {t('export.csv_description')}
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
                              <div className="font-medium">{t('export.json_file')}</div>
                              <div className="text-sm text-muted-foreground">
                                {t('export.json_description')}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div 
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            importOptions.source === 'pdf-statement' 
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => {
                            setImportOptions(prev => ({ ...prev, source: 'pdf-statement' }));
                            if (!hasConsentedToSecurity) {
                              setShowSecurityDisclosure(true);
                            }
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                            <div>
                              <div className="font-medium">PDF Bank Statement</div>
                              <div className="text-sm text-muted-foreground">
                                Extract transactions from bank statement PDF
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
                      <h3 className="font-medium mb-3">{t('export.step3_title')}</h3>
                      {isProcessingPDF && processingSessionId ? (
                        <PDFProcessingProgress 
                          sessionId={processingSessionId}
                          onComplete={(success) => {
                            setIsProcessingPDF(false);
                            setProcessingSessionId(null);
                            if (success) {
                              console.log('PDF processing completed successfully');
                            }
                          }}
                          onError={(error) => {
                            setIsProcessingPDF(false);
                            setProcessingSessionId(null);
                            toast({
                              title: t('export.processing_error'),
                              description: error,
                              variant: "destructive",
                            });
                          }}
                        />
                      ) : (
                        <div 
                          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
                          onClick={importOptions.source === 'pdf-statement' ? handlePDFUploadClick : () => fileInputRef.current?.click()}
                          onDrop={handleFileDrop}
                          onDragOver={handleDragOver}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept={importOptions.source === 'pdf-statement' ? '.pdf' : '.csv,.json'}
                            onChange={importOptions.source === 'pdf-statement' ? handlePDFUpload : handleFileSelect}
                            className="hidden"
                          />
                          <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            {selectedFile ? (
                              <>
                                <span className="font-medium text-green-600">{selectedFile.name}</span>
                                <br />
                                <span className="text-xs">{t('export.click_to_change_file')}</span>
                              </>
                            ) : importOptions.source === 'pdf-statement' ? (
                              <>
                                Drop your bank statement PDF here or click to browse
                                <br />
                                <span className="text-xs">Supports PDF files with transaction data</span>
                              </>
                            ) : (
                              <>
                                {t('export.drop_file_text', { format: importOptions.source.toUpperCase() })}
                                <br />
                                <span className="text-xs">{t('export.supports_files')}</span>
                              </>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 4: Import Options (skip for PDF since they show preview modal) */}
                {selectedFile && importOptions.source !== 'pdf-statement' && (
                  <div className="border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-gray-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                        4
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium mb-3">{t('export.step4_title')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium mb-2 block">{t('export.merge_strategy')}</label>
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
                                <SelectItem value="append">{t('export.add_to_existing')}</SelectItem>
                                <SelectItem value="replace">{t('export.replace_existing')}</SelectItem>
                                <SelectItem value="merge">{t('export.merge_existing')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-2 block">{t('export.duplicate_handling')}</label>
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
                                <SelectItem value="skip">{t('export.skip_duplicates')}</SelectItem>
                                <SelectItem value="overwrite">{t('export.overwrite_duplicates')}</SelectItem>
                                <SelectItem value="rename">{t('export.rename_duplicates')}</SelectItem>
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
{t('export.skip_first_row')}
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
{t('export.auto_create_categories')}
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
                      <span className="font-medium">{t('export.importing_data')}</span>
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
{t('export.import_completed_successfully')}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="font-medium">{t('export.categories')}</div>
                        <div className="text-green-600">{t('export.created_count', { count: importResults.categories })}</div>
                      </div>
                      <div>
                        <div className="font-medium">{t('types.income')}</div>
                        <div className="text-green-600">{t('export.imported_count', { count: importResults.incomes })}</div>
                      </div>
                      <div>
                        <div className="font-medium">{t('types.expense')}</div>
                        <div className="text-green-600">{t('export.imported_count', { count: importResults.expenses })}</div>
                      </div>
                      <div>
                        <div className="font-medium">{t('nav.budgets')}</div>
                        <div className="text-green-600">{t('export.imported_count', { count: importResults.budgets })}</div>
                      </div>
                      <div>
                        <div className="font-medium">{t('nav.goals')}</div>
                        <div className="text-green-600">{t('export.imported_count', { count: importResults.goals })}</div>
                      </div>
                      <div>
                        <div className="font-medium">{t('export.collaborative')}</div>
                        <div className="text-green-600">{t('export.imported_count', { count: importResults.collaborativeGoals })}</div>
                      </div>
                    </div>
                    {importResults.errors && importResults.errors.length > 0 && (
                      <div className="mt-3 p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded">
                        <div className="font-medium text-yellow-800 dark:text-yellow-200 text-sm">
{t('export.warnings_count', { count: importResults.errors.length })}:
                        </div>
                        <ul className="text-xs text-yellow-700 dark:text-yellow-300 mt-1 space-y-1">
                          {importResults.errors.slice(0, 3).map((error, index) => (
                            <li key={index}>• {error}</li>
                          ))}
                          {importResults.errors.length > 3 && (
                            <li>• {t('export.and_more_errors', { count: importResults.errors.length - 3 })}</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Import History */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">{t('export.recent_imports')}</h3>
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
{t('export.records_count', { count: log.summary?.totalRecords || 0 })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">
{t('export.no_import_history')}
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
{t('export.cloud_backup_status')}
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
                      <h4 className="font-medium text-green-800 dark:text-green-200">{t('export.automatic_backup_enabled')}</h4>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {t('export.backup_schedule_description')}
                      </p>
                    </div>
                  </div>
                </div>

                {isLoadingBackupStatus ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2">{t('export.loading_backup_status')}</span>
                  </div>
                ) : hasBackupData ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">{t('export.last_backup')}</div>
                      <div className="text-lg font-semibold">
                        {backupStatusData.lastBackup && backupStatusData.lastBackup.date ? 
                          (() => {
                            try {
                              const date = new Date(backupStatusData.lastBackup.date);
                              return isNaN(date.getTime()) ? t('export.never') : format(date, 'MMM dd, yyyy');
                            } catch {
                              return t('export.never');
                            }
                          })() : 
                          t('export.never')
                        }
                      </div>
                      <div className="text-sm text-muted-foreground">
{t('export.next_scheduled')}: {backupStatusData.nextBackup ? 
                          (() => {
                            try {
                              const date = new Date(backupStatusData.nextBackup);
                              return isNaN(date.getTime()) ? t('export.tonight_2am') : `${format(date, 'MMM dd')} ${t('export.at_2am')}`;
                            } catch {
                              return t('export.tonight_2am');
                            }
                          })() : 
                          t('export.tonight_2am')
                        }
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">{t('export.storage_usage')}</div>
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
                              if (isNaN(lastBackupDate.getTime())) return t('export.no_backups');
                              const daysDiff = Math.round((new Date().getTime() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24));
                              return `${daysDiff} ${t('export.days_old')}`;
                            } catch {
                              return t('export.no_backups');
                            }
                          })() :
                          t('export.no_backups')
                        }
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">{t('export.backup_info')}</div>
                      <div className="text-sm space-y-1">
                        <div>{t('export.provider')}: {backupStatusData.info?.provider || 'Bunny.net CDN'}</div>
                        <div>{t('export.region')}: {backupStatusData.info?.region || t('export.global')}</div>
                      </div>
                      <div className="flex items-center gap-1 mt-2">
                        <Shield className="h-3 w-3 text-green-500" />
                        <span className="text-xs text-green-600">
                          {backupStatusData.realUsage?.files || 0} {t('export.files_stored')}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
{t('export.no_backup_status')}
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
{t('export.creating_backup')}
                      </>
                    ) : (
                      <>
                        <Cloud className="mr-2 h-4 w-4" />
{t('export.backup_now')}
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
{t('export.restoring')}
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
{t('export.restore')}
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

        {/* PDF Transaction Preview Modal */}
        <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Review Extracted Transactions</DialogTitle>
              <DialogDescription>
                {pdfProcessingResult && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Method:</span> {pdfProcessingResult.processingMethod}
                      </div>
                      <div>
                        <span className="font-medium">Pages:</span> {pdfProcessingResult.totalPages}
                      </div>
                      <div>
                        <span className="font-medium">Extracted:</span> {pdfProcessingResult.extractedTransactions}
                      </div>
                      <div>
                        <span className="font-medium">Confidence:</span> {(pdfProcessingResult.overallConfidence * 100).toFixed(0)}%
                      </div>
                    </div>
                    {pdfProcessingResult.errors.length > 0 && (
                      <div className="text-amber-600 text-xs">
                        <span className="font-medium">Warnings:</span> {pdfProcessingResult.errors.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-hidden">
              <div className="space-y-4">
                {/* Selection Controls */}
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={selectAllTransactions}>
                      Select All ({previewTransactions.length})
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAllTransactions}>
                      Deselect All
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {selectedTransactions.size} of {previewTransactions.length} selected
                    </span>
                  </div>
                </div>

                {/* Transactions List */}
                <div className="overflow-y-auto max-h-96 space-y-2">
                  {previewTransactions.map((transaction, index) => (
                    <div
                      key={index}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedTransactions.has(index)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleTransactionSelection(index)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={selectedTransactions.has(index)}
                              onChange={() => toggleTransactionSelection(index)}
                            />
                            <span className="font-medium">{transaction.description}</span>
                            <Badge
                              variant={transaction.type === 'income' ? 'default' : 'secondary'}
                              className={
                                transaction.type === 'income'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              }
                            >
                              {transaction.type}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Date: {transaction.date} | Amount: ${Math.abs(transaction.amount).toFixed(2)}
                          </div>
                          {transaction.category && (
                            <div className="text-xs text-blue-600">
                              Suggested Category: {transaction.category}
                            </div>
                          )}
                          {transaction.rawText && (
                            <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                              Raw Text: {transaction.rawText.substring(0, 100)}...
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold">
                            {transaction.type === 'income' ? '+' : '-'}${Math.abs(transaction.amount).toFixed(2)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(transaction.confidence * 100).toFixed(0)}% confidence
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPreviewModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleImportSelectedTransactions}
                disabled={selectedTransactions.size === 0 || isImportingFromPreview}
              >
                {isImportingFromPreview ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    Import {selectedTransactions.size} Transaction{selectedTransactions.size !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Security Disclosure Modal */}
        <PDFSecurityModal
          isOpen={showSecurityDisclosure}
          onClose={() => setShowSecurityDisclosure(false)}
          onConsent={handleSecurityConsent}
        />

        {/* Duplicate Warning Modal */}
        <DuplicateWarningModal
          isOpen={showDuplicateWarning}
          onClose={handleDuplicateWarningClose}
          onProceed={handleDuplicateWarningProceed}
          duplicates={duplicateDetections}
          allTransactions={previewTransactions}
        />
      </div>
    </RequirePlan>
  );
}
