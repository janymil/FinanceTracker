import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Camera, Upload, FileText, AlertCircle, CheckCircle, Save, Edit, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UploadReceiptModalProps {
  onReceiptProcessed?: (receiptData: any) => void;
  buttonText?: string;
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

interface FormData {
  amount: string;
  description: string;
  date: string;
  categoryId: string;
}

export default function UploadReceiptModal({ onReceiptProcessed, buttonText = "Upload Image" }: UploadReceiptModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle'
  });

  const [categories, setCategories] = useState<any[]>([]);
  const [formData, setFormData] = useState<FormData>({
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    categoryId: ''
  });

  // Fetch categories on component mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        const data = await response.json();
        setCategories(data);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };
    fetchCategories();
  }, []);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image",
        variant: "destructive"
      });
      return;
    }

    setUploadState({ status: 'processing', message: 'Processing receipt...' });

    try {
      const formDataObj = new FormData();
      formDataObj.append('receipt', file);

      const response = await fetch('/api/upload-receipt', {
        method: 'POST',
        body: formDataObj,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      // Auto-populate form with extracted data
      if (result.extracted) {
        setFormData({
          amount: result.extracted.amount?.toString() || '',
          description: result.extracted.vendor || '',
          date: result.extracted.date || new Date().toISOString().split('T')[0],
          categoryId: result.category ? categories.find(cat => cat.name.toLowerCase() === result.category.toLowerCase())?.id?.toString() || '' : ''
        });
      }
      
      setUploadState({
        status: 'success',
        message: 'Receipt processed successfully!',
        recognizedText: result.recognizedText,
        imageUrl: result.imageUrl,
        extracted: result.extracted,
        category: result.category
      });

      if (onReceiptProcessed) {
        onReceiptProcessed(result);
      }

    } catch (error) {
      setUploadState({
        status: 'error',
        message: 'Failed to process receipt'
      });
      toast({
        title: "Upload failed",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleReset = () => {
    setUploadState({ status: 'idle' });
    setFormData({
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      categoryId: ''
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFormChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveTransaction = async () => {
    if (!formData.amount || !formData.description || !formData.categoryId) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    try {
      const transactionData = {
        amount: parseFloat(formData.amount),
        description: formData.description,
        date: formData.date,
        categoryId: parseInt(formData.categoryId),
        type: 'expense',
        imageUrl: uploadState.imageUrl,
        ocrText: uploadState.recognizedText,
        ocrVendor: uploadState.extracted?.vendor,
        ocrDetectedAmount: uploadState.extracted?.amount,
        ocrDetectedDate: uploadState.extracted?.date
      };

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(transactionData)
      });

      if (!response.ok) {
        throw new Error('Failed to save transaction');
      }

      toast({
        title: "Transaction saved",
        description: "Receipt data has been saved as a transaction",
      });

      // Reset and close modal
      handleReset();
      setIsOpen(false);

      if (onReceiptProcessed) {
        onReceiptProcessed(transactionData);
      }

    } catch (error) {
      console.error('Error saving transaction:', error);
      toast({
        title: "Save failed",
        description: "Failed to save transaction. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleModalClose = () => {
    setIsOpen(false);
    handleReset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          {buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Upload Receipt
          </DialogTitle>
          <DialogDescription>
            Upload a receipt photo to automatically extract transaction data
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {uploadState.status === 'idle' && (
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="space-y-4">
                <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                <div>
                  <p className="text-lg font-medium">Upload receipt image</p>
                  <p className="text-sm text-gray-500">
                    JPG, PNG or other image formats
                  </p>
                </div>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  Select file
                </Button>
              </div>
            </div>
          )}

          {uploadState.status === 'processing' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm text-gray-600">{uploadState.message}</p>
            </div>
          )}

          {uploadState.status === 'success' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">{uploadState.message}</span>
              </div>

              {/* Image Preview */}
              {uploadState.imageUrl && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Receipt Image:
                  </label>
                  <div className="relative">
                    <img 
                      src={uploadState.imageUrl} 
                      alt="Receipt" 
                      className="w-full max-w-md h-auto rounded-lg border shadow-sm mx-auto"
                    />
                  </div>
                </div>
              )}

              {/* Editable Transaction Form */}
              {uploadState.extracted && (
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Edit className="h-4 w-4" />
                    Edit Transaction Details
                  </h4>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="amount">Amount *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => handleFormChange('amount', e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="description">Description *</Label>
                      <Input
                        id="description"
                        value={formData.description}
                        onChange={(e) => handleFormChange('description', e.target.value)}
                        placeholder="Transaction description"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="date">Date *</Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => handleFormChange('date', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="category">Category *</Label>
                      <Select value={formData.categoryId} onValueChange={(value) => handleFormChange('categoryId', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {uploadState.category && (
                      <div className="text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                        💡 AI suggested category: {uploadState.category}
                      </div>
                    )}
                  </div>
                  
                  <Button
                    onClick={handleSaveTransaction}
                    className="w-full"
                    disabled={!formData.amount || !formData.description || !formData.categoryId}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Transaction
                  </Button>
                </div>
              )}

              {/* OCR Text (Collapsible) */}
              {uploadState.recognizedText && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Recognized Text:
                  </label>
                  <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap border max-h-32 overflow-y-auto">
{uploadState.recognizedText}
                  </pre>
                </div>
              )}
            </div>
          )}

          {uploadState.status === 'error' && (
            <div className="text-center py-8">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
              <p className="text-sm text-red-600">{uploadState.message}</p>
            </div>
          )}

          {uploadState.status !== 'idle' && uploadState.status !== 'processing' && (
            <div className="flex gap-2">
              <Button
                onClick={handleReset}
                variant="outline"
                className="flex-1"
              >
                Upload another receipt
              </Button>
              <Button
                onClick={handleModalClose}
                variant="secondary"
                className="flex-1"
              >
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}