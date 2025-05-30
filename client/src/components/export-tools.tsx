import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  Calendar,
  Crown,
  Settings,
  Check
} from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ExportToolsProps {
  isPremium?: boolean;
  data?: {
    transactions: any[];
    budgets: any[];
    goals: any[];
    summary: any;
  };
}

interface ExportOptions {
  format: "pdf" | "csv" | "excel";
  dateRange: "all" | "month" | "quarter" | "year" | "custom";
  startDate?: string;
  endDate?: string;
  includeTransactions: boolean;
  includeBudgets: boolean;
  includeGoals: boolean;
  includeSummary: boolean;
  includeCharts: boolean;
}

export default function ExportTools({ isPremium = false, data }: ExportToolsProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: "pdf",
    dateRange: "month",
    includeTransactions: true,
    includeBudgets: true,
    includeGoals: true,
    includeSummary: true,
    includeCharts: true,
  });

  const exportMutation = useMutation({
    mutationFn: async (options: ExportOptions) => {
      const res = await apiRequest("POST", "/api/export", options);
      return await res.blob();
    },
    onSuccess: (blob, variables) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const fileName = `financial-report-${new Date().toISOString().split('T')[0]}.${variables.format}`;
      link.setAttribute('download', fileName);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Export Successful",
        description: `Your financial report has been downloaded as ${fileName}`,
      });
      
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleQuickExport = (format: "pdf" | "csv") => {
    if (!isPremium) {
      setLocation("/subscribe");
      return;
    }

    const quickOptions: ExportOptions = {
      format,
      dateRange: "month",
      includeTransactions: true,
      includeBudgets: true,
      includeGoals: true,
      includeSummary: true,
      includeCharts: format === "pdf",
    };

    exportMutation.mutate(quickOptions);
  };

  const handleCustomExport = () => {
    exportMutation.mutate(exportOptions);
  };

  if (!isPremium) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Data
            </div>
            <Badge variant="secondary">Pro</Badge>
          </CardTitle>
          <CardDescription>
            Export your financial data in multiple formats
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Crown className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Export Features Available with Premium
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Export your financial reports as PDF or CSV files with customizable date ranges and data selections.
            </p>
            <Button 
              onClick={() => setLocation("/subscribe")}
              className="bg-premium hover:bg-premium/90"
            >
              <Crown className="h-4 w-4 mr-2" />
              Upgrade to Premium
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Export Data
          <Badge className="bg-premium text-white">Pro</Badge>
        </CardTitle>
        <CardDescription>
          Export your financial data in multiple formats
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Quick Export Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              onClick={() => handleQuickExport("pdf")}
              disabled={exportMutation.isPending}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              {exportMutation.isPending ? "Exporting..." : "Quick PDF"}
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => handleQuickExport("csv")}
              disabled={exportMutation.isPending}
              className="flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {exportMutation.isPending ? "Exporting..." : "Quick CSV"}
            </Button>
          </div>

          {/* Custom Export Dialog */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <Settings className="h-4 w-4 mr-2" />
                Custom Export Options
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Custom Export Options</DialogTitle>
                <DialogDescription>
                  Customize your export settings for detailed financial reports
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                {/* Format Selection */}
                <div className="grid gap-2">
                  <Label>Export Format</Label>
                  <Select 
                    value={exportOptions.format} 
                    onValueChange={(value: "pdf" | "csv" | "excel") => 
                      setExportOptions({...exportOptions, format: value})
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF Report</SelectItem>
                      <SelectItem value="csv">CSV Spreadsheet</SelectItem>
                      <SelectItem value="excel">Excel Workbook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range */}
                <div className="grid gap-2">
                  <Label>Date Range</Label>
                  <Select 
                    value={exportOptions.dateRange} 
                    onValueChange={(value: any) => 
                      setExportOptions({...exportOptions, dateRange: value})
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">This Month</SelectItem>
                      <SelectItem value="quarter">This Quarter</SelectItem>
                      <SelectItem value="year">This Year</SelectItem>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Date Range */}
                {exportOptions.dateRange === "custom" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={exportOptions.startDate || ""}
                        onChange={(e) => 
                          setExportOptions({...exportOptions, startDate: e.target.value})
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={exportOptions.endDate || ""}
                        onChange={(e) => 
                          setExportOptions({...exportOptions, endDate: e.target.value})
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Data Inclusions */}
                <div className="grid gap-3">
                  <Label>Include in Export</Label>
                  
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="transactions"
                        checked={exportOptions.includeTransactions}
                        onCheckedChange={(checked) => 
                          setExportOptions({...exportOptions, includeTransactions: !!checked})
                        }
                      />
                      <Label htmlFor="transactions" className="text-sm">
                        Transaction History
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="budgets"
                        checked={exportOptions.includeBudgets}
                        onCheckedChange={(checked) => 
                          setExportOptions({...exportOptions, includeBudgets: !!checked})
                        }
                      />
                      <Label htmlFor="budgets" className="text-sm">
                        Budget Analysis
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="goals"
                        checked={exportOptions.includeGoals}
                        onCheckedChange={(checked) => 
                          setExportOptions({...exportOptions, includeGoals: !!checked})
                        }
                      />
                      <Label htmlFor="goals" className="text-sm">
                        Financial Goals
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="summary"
                        checked={exportOptions.includeSummary}
                        onCheckedChange={(checked) => 
                          setExportOptions({...exportOptions, includeSummary: !!checked})
                        }
                      />
                      <Label htmlFor="summary" className="text-sm">
                        Financial Summary
                      </Label>
                    </div>

                    {exportOptions.format === "pdf" && (
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="charts"
                          checked={exportOptions.includeCharts}
                          onCheckedChange={(checked) => 
                            setExportOptions({...exportOptions, includeCharts: !!checked})
                          }
                        />
                        <Label htmlFor="charts" className="text-sm">
                          Charts and Graphs
                        </Label>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCustomExport}
                  disabled={exportMutation.isPending}
                >
                  {exportMutation.isPending ? "Exporting..." : "Export Report"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Export Status */}
          {exportMutation.isPending && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm text-blue-700 dark:text-blue-300">
                Generating your financial report...
              </span>
            </div>
          )}

          {/* Feature List */}
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Export Features:
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300">
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-600" />
                PDF with charts
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-600" />
                CSV for Excel
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-600" />
                Custom date ranges
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-600" />
                Selective data export
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}