
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Upload, FileText, AlertCircle, CheckCircle, Save } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UploadReceiptProps {
  onReceiptProcessed?: (receiptData: any) => void;
}

interface ExtractedData {
  amount?: number;
  date?: string;
  vendor?: string;
  error?: string;
}

interface UploadState {
  status: 'idle' | 'processing' | 'success' | 'error';
  message?: string;
  recognizedText?: string;
  imageUrl?: string;
  extracted?: ExtractedData;
  category?: string;
}

export default function UploadReceipt({ onReceiptProcessed }: UploadReceiptProps) {
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [location] = useLocation();

  // Form state for transaction data
  const [formData, setFormData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    category: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Update form data when extracted data changes
  useEffect(() => {
    if (uploadState.extracted && !uploadState.extracted.error) {
      setFormData({
        amount: uploadState.extracted.amount?.toString() || '',
        date: uploadState.extracted.date || new Date().toISOString().split('T')[0],
        description: uploadState.extracted.vendor || '',
        category: uploadState.category || ''
      });
      setShowForm(true);
    }
  }, [uploadState.extracted, uploadState.category]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check if file is an image
      if (!file.type.startsWith('image/')) {
        setUploadState({
          status: 'error',
          message: 'Prosím vyberte obrázok účtenky (JPG, PNG, atď.)'
        });
        toast({
          title: "Chyba",
          description: "Môžete nahrať iba obrázky",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      
      // Create preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      
      // Auto-upload the file
      uploadReceipt(file);
    }
  };

  const uploadReceipt = async (file: File) => {
    setUploadState({ status: 'processing', message: 'Processing...' });

    try {
      const formData = new FormData();
      formData.append('receipt', file);

      const response = await apiRequest("POST", "/api/upload-receipt", formData, {
        headers: {
          // Don't set Content-Type - let browser set it with boundary for FormData
        },
      });

      if (response.ok) {
        const result = await response.json();
        
        // Check if we got valid response data
        if (!result || (!result.recognizedText && !result.text)) {
          throw new Error('Backend vrátil neplatnú odpoveď');
        }

        setUploadState({
          status: 'success',
          message: 'Úspešne spracované',
          recognizedText: result.recognizedText || result.text,
          imageUrl: result.imageUrl,
          extracted: result.extracted,
          category: result.category
        });

        // Call callback if provided
        if (onReceiptProcessed) {
          onReceiptProcessed(result);
        }

        toast({
          title: "Účtenka spracovaná",
          description: "Text z účtenky bol úspešne rozpoznaný",
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Chyba ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      console.error("Receipt upload error:", error);
      setUploadState({
        status: 'error',
        message: error.message || 'Chyba pri spracovaní účtenky',
      });

      toast({
        title: "Chyba",
        description: error.message || "Nepodarilo sa spracovať účtenku",
        variant: "destructive",
      });
    }
  };

  const handleCameraClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleReset = () => {
    setUploadState({ status: 'idle' });
    setSelectedFile(null);
    setShowForm(false);
    setFormData({
      amount: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      category: ''
    });
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Determine transaction type from current route
  const getTransactionType = () => {
    const path = location.pathname;
    if (path.includes('/income')) return 'income';
    if (path.includes('/expense')) return 'expense';
    return 'expense'; // default to expense
  };

  const handleFormSubmit = async () => {
    if (!formData.amount || !formData.description) {
      toast({
        title: "Chyba",
        description: "Prosím vyplňte sumu a popis",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const transactionType = getTransactionType();
      const payload = {
        amount: parseFloat(formData.amount),
        date: formData.date,
        description: formData.description,
        type: transactionType,
        categoryId: null // Let the system auto-categorize or use default
      };

      const response = await apiRequest("POST", "/api/transactions", payload);

      if (response.ok) {
        const newTransaction = await response.json();
        
        toast({
          title: "Transakcia uložená",
          description: `${transactionType === 'income' ? 'Príjem' : 'Výdavok'} bol úspešne vytvorený`,
        });

        // Call callback if provided
        if (onReceiptProcessed) {
          onReceiptProcessed(newTransaction);
        }

        // Reset form
        handleReset();
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Chyba pri ukladaní transakcie');
      }
    } catch (error: any) {
      console.error("Transaction save error:", error);
      toast({
        title: "Chyba",
        description: error.message || "Nepodarilo sa uložiť transakciu",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = () => {
    switch (uploadState.status) {
      case 'processing':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (uploadState.status) {
      case 'processing':
        return 'text-blue-600';
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Nahrať účtenku
        </CardTitle>
        <CardDescription>
          Odfotografujte alebo nahrajte obrázok účtenky pre automatické spracovanie
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Upload Buttons */}
        {uploadState.status === 'idle' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button
              onClick={handleCameraClick}
              className="flex items-center gap-2"
              variant="outline"
            >
              <Camera className="h-4 w-4" />
              Odfotiť účtenku
            </Button>
            <Button
              onClick={handleCameraClick}
              className="flex items-center gap-2"
              variant="outline"
            >
              <Upload className="h-4 w-4" />
              Nahrať zo súborov
            </Button>
          </div>
        )}

        {/* Status Display */}
        {uploadState.status !== 'idle' && (
          <div className={`flex items-center gap-2 p-3 rounded-lg border ${
            uploadState.status === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' :
            uploadState.status === 'error' ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' :
            'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
          }`}>
            {getStatusIcon()}
            <span className={`font-medium ${getStatusColor()}`}>
              {uploadState.message}
            </span>
          </div>
        )}

        {/* Image Preview */}
        {previewUrl && uploadState.status !== 'error' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Náhľad obrázka:
            </label>
            <div className="relative">
              <img
                src={previewUrl}
                alt="Receipt preview"
                className="max-w-full h-auto max-h-64 object-contain border rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Receipt Image from Backend */}
        {uploadState.imageUrl && uploadState.status === 'success' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Uložená účtenka:
            </label>
            <div className="relative">
              <img
                src={uploadState.imageUrl}
                alt="Stored receipt"
                className="max-w-full h-auto max-h-64 object-contain border rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Extracted Structured Data Display */}
        {uploadState.extracted && uploadState.status === 'success' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Extrahované údaje:
            </label>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              {uploadState.extracted.error ? (
                <p className="text-red-600 dark:text-red-400 text-sm">
                  Nepodarilo sa extrahovať štruktúrované údaje z tejto účtenky.
                </p>
              ) : (
                <div className="space-y-2 text-sm">
                  {uploadState.extracted.amount !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Suma:</span>
                      <span className="text-blue-600 dark:text-blue-400 font-semibold">
                        ${uploadState.extracted.amount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {uploadState.extracted.date && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Dátum:</span>
                      <span className="text-blue-600 dark:text-blue-400 font-semibold">
                        {uploadState.extracted.date}
                      </span>
                    </div>
                  )}
                  {uploadState.extracted.vendor && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Obchod:</span>
                      <span className="text-blue-600 dark:text-blue-400 font-semibold">
                        {uploadState.extracted.vendor}
                      </span>
                    </div>
                  )}
                  {uploadState.category && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 dark:text-gray-300">AI Kategória:</span>
                      <span className="text-purple-600 dark:text-purple-400 font-semibold">
                        {uploadState.category}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">(môžete upraviť)</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Transaction Form */}
        {showForm && uploadState.status === 'success' && (
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-green-700 dark:text-green-300">
                Vytvoriť transakciu
              </CardTitle>
              <CardDescription>
                Skontrolujte a upravte údaje pred uložením
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount">Suma</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <Label htmlFor="date">Dátum</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">Popis</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Popis transakcie"
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleFormSubmit}
                  disabled={isSubmitting || !formData.amount || !formData.description}
                  className="flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isSubmitting ? 'Ukladá sa...' : 'Uložiť transakciu'}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  disabled={isSubmitting}
                >
                  Zrušiť
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recognized Text Display */}
        {uploadState.recognizedText && uploadState.status === 'success' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Rozpoznaný text:
            </label>
            <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap border max-h-64 overflow-y-auto">
{uploadState.recognizedText}
            </pre>
          </div>
        )}</pre>

        {/* Reset Button */}
        {uploadState.status !== 'idle' && uploadState.status !== 'processing' && (
          <Button
            onClick={handleReset}
            variant="outline"
            className="w-full"
          >
            Nahrať ďalšiu účtenku
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
