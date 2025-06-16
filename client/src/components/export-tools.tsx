import { useState } from 'react';
import { saveAs } from 'file-saver';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useClerkUserReady } from '@/hooks/useClerkUserReady';

interface Transaction {
  id: number;
  amount: string;
  description: string;
  date: string;
  type: 'income' | 'expense';
  categoryId: string | null;
}

export function ExportTools() {
  const [isExporting, setIsExporting] = useState(false);
  const isReady = useClerkUserReady();

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions'],
    enabled: isReady,
  });

  const exportToCSV = async () => {
    if (!isReady) return;
    
    setIsExporting(true);
    try {
      // Create CSV content
      const headers = ['Date', 'Description', 'Type', 'Amount'];
      const csvContent = [
        headers.join(','),
        ...transactions.map(transaction => [
          new Date(transaction.date).toLocaleDateString(),
          `"${transaction.description.replace(/"/g, '""')}"`,
          transaction.type,
          transaction.amount
        ].join(','))
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const fileName = `finanzerpro-transactions-${new Date().toISOString().split('T')[0]}.csv`;
      saveAs(blob, fileName);
      
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Export Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Export your transaction data to CSV format for use in spreadsheet applications.
        </p>
        
        <Button 
          onClick={exportToCSV} 
          disabled={isExporting || !isReady}
          className="w-full"
        >
          {isExporting ? 'Exporting...' : 'Export to CSV'}
        </Button>
      </CardContent>
    </Card>
  );
}