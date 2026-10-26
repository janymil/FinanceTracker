import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Camera, Upload, FileText, AlertCircle, CheckCircle, Save, Edit, ImageIcon, QrCode, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import { queryClient } from "@/lib/queryClient";
import { useAiAccess } from "@/hooks/useAiAccess";
import QRCode from "qrcode";
import { todayLocalISO } from '@/lib/dateUtils';

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

interface QRUploadState {
  sessionId: string | null;
  qrCodeUrl: string | null;
  isPolling: boolean;
  status: 'idle' | 'waiting' | 'success' | 'error';
}

interface FormData {
  amount: string;
  description: string;
  date: string;
  categoryId: string;
}

// UUID generator function
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function UploadReceiptModal({ onReceiptProcessed, buttonText }: UploadReceiptModalProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { getToken } = useAuth();
  const aiAccess = useAiAccess();
  const currentLocale = (i18n.language || 'en').split('-')[0];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'direct' | 'qr'>('direct');
  
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle'
  });

  const [qrUploadState, setQrUploadState] = useState<QRUploadState>({
    sessionId: null,
    qrCodeUrl: null,
    isPolling: false,
    status: 'idle'
  });

  const [categories, setCategories] = useState<any[]>([]);
  const [formData, setFormData] = useState<FormData>({
    amount: '',
    description: '',
    date: todayLocalISO(),
    categoryId: ''
  });

  // Fetch categories on component mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const token = await getToken();
        const response = await fetch('/api/categories', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const data = await response.json();
        setCategories(data);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };
    fetchCategories();
  }, [getToken]);

  // Handle QR upload button click
  const handleQRUpload = () => {
    generateQRCode();
  };

  // Generate QR code when QR method is selected
  const generateQRCode = async () => {
    try {
      // First create a backend session
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const response = await fetch('/api/mobile-upload/create-session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to create upload session');
      }
      
      const { sessionId } = await response.json();
      const qrUrl = `${window.location.origin}/mobile-upload/${sessionId}`;
      
      const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      setQrUploadState({
        sessionId,
        qrCodeUrl: qrCodeDataUrl,
        isPolling: true,
        status: 'waiting'
      });
      
      // Start polling for upload status
      startPolling(sessionId);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      toast({
        title: t("upload.qr_code_error"),
        description: t("upload.failed_to_generate_qr"),
        variant: "destructive"
      });
    }
  };

  // Polling function to check upload status
  const startPolling = (sessionId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const token = await getToken();
        // The server now requires the signed-in owner to read a session; "Bearer null" is
        // just a 401 every five seconds until the next token arrives.
        if (!token) return;
        const response = await fetch(`/api/mobile-upload/status/${sessionId}?t=${Date.now()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache',
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('Polling result:', result);
          
          if (result.status === 'completed') {
            // Clear polling
            clearInterval(pollInterval);
            setQrUploadState(prev => ({ ...prev, isPolling: false, status: 'success' }));
            
            // Process the uploaded receipt data
            processQRUploadResult(result);
          } else if (result.status === 'error') {
            clearInterval(pollInterval);
            setQrUploadState(prev => ({ ...prev, isPolling: false, status: 'error' }));
            toast({
              title: t("upload.upload_error"),
              description: result.error || t("upload.failed_to_process_mobile"),
              variant: "destructive"
            });
          }
        } else if (response.status === 404) {
          // Session not found yet, continue polling
          console.log(`Session ${sessionId} not found yet, continuing to poll...`);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000); // Poll every 5 seconds

    // Clean up polling after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      if (qrUploadState.isPolling) {
        setQrUploadState(prev => ({ ...prev, isPolling: false, status: 'error' }));
        toast({
          title: t("upload.timeout"),
          description: "QR scan session expired. Please try again.",
          variant: "destructive"
        });
      }
    }, 300000); // 5 minutes timeout
  };

  // Process QR upload result using the same logic as desktop OCR
  const processQRUploadResult = (result: any) => {
    // Auto-populate form with extracted data from mobile upload
    if (result.data && result.data.extracted) {
      
      // Find best matching category using the same logic as desktop OCR
      let matchedCategoryId = '';
      if (result.data.category && categories.length > 0) {
        const suggestedCategory = result.data.category.toLowerCase();

        
        // Try exact match first
        let matchedCategory = categories.find(cat => 
          cat.name.toLowerCase() === suggestedCategory
        );
        
        // If no exact match, try partial matching
        if (!matchedCategory) {
          // Check if suggested category contains any existing category name
          matchedCategory = categories.find(cat => 
            suggestedCategory.includes(cat.name.toLowerCase()) || 
            cat.name.toLowerCase().includes(suggestedCategory.split(' ')[0])
          );
        }
        
        // If still no match, try common category mappings with more comprehensive keyword matching
        if (!matchedCategory) {
          const categoryMappings = {
            'food': ['food', 'groceries', 'dining', 'restaurant', 'meal', 'eat', 'cafe', 'aldi', 'supermarket', 'grocery'],
            'transportation': ['transport', 'travel', 'fuel', 'gas', 'car', 'uber', 'taxi', 'bus', 'train'],
            'entertainment': ['entertainment', 'leisure', 'fun', 'movie', 'cinema', 'game', 'sport'],
            'healthcare': ['health', 'medical', 'doctor', 'pharmacy', 'hospital', 'medicine'],
            'shopping': ['shopping', 'retail', 'clothes', 'clothing', 'store', 'mall'],
            'utilities': ['utilities', 'electric', 'water', 'internet', 'phone', 'cable']
          };
          
          for (const [key, keywords] of Object.entries(categoryMappings)) {
            if (keywords.some(keyword => 
              suggestedCategory.includes(keyword) || 
              keyword.includes(suggestedCategory.split(' ')[0]) ||
              keyword.includes(suggestedCategory.split(' ').pop() || '')
            )) {
              matchedCategory = categories.find(cat => 
                cat.name.toLowerCase().includes(key) ||
                cat.name.toLowerCase() === 'groceries' && key === 'food' ||
                cat.name.toLowerCase() === 'food & dining' && key === 'food'
              );
              if (matchedCategory) break;
            }
          }
        }
        
        if (matchedCategory) {
          matchedCategoryId = matchedCategory.id.toString();
        }
      }

      const newFormData = {
        amount: result.data.extracted.amount?.toString() || '',
        description: result.data.extracted.vendor || '',
        date: result.data.extracted.date || todayLocalISO(),
        categoryId: matchedCategoryId
      };

      setFormData(newFormData);
    }
    
    // Set upload state with the mobile upload data structure
    setUploadState({
      status: 'success',
      message: 'Receipt processed successfully via mobile!',
      recognizedText: result.data.text,
      imageUrl: result.data.imageUrl || '',
      extracted: result.data.extracted,
      category: result.data.category
    });

    if (onReceiptProcessed) {
      onReceiptProcessed(result);
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: t("upload.invalid_file_type"),
        description: t("upload.please_select_image"),
        variant: "destructive"
      });
      return;
    }

    setUploadState({ status: 'processing', message: 'Processing receipt...' });

    try {
      const formDataObj = new FormData();
      formDataObj.append('receipt', file);

      const token = await getToken();
      const response = await fetch('/api/upload-receipt', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formDataObj,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      // Auto-populate form with extracted data
      if (result.extracted) {
        // Find best matching category
        let matchedCategoryId = '';
        if (result.category && categories.length > 0) {
          const suggestedCategory = result.category.toLowerCase();
          
          // Try exact match first
          let matchedCategory = categories.find(cat => 
            cat.name.toLowerCase() === suggestedCategory
          );
          
          // If no exact match, try partial matching
          if (!matchedCategory) {
            // Check if suggested category contains any existing category name
            matchedCategory = categories.find(cat => 
              suggestedCategory.includes(cat.name.toLowerCase()) || 
              cat.name.toLowerCase().includes(suggestedCategory.split(' ')[0])
            );
          }
          
          // If still no match, try common category mappings with more comprehensive keyword matching
          if (!matchedCategory) {
            const categoryMappings = {
              'food': ['food', 'groceries', 'dining', 'restaurant', 'meal', 'eat', 'cafe', 'aldi', 'supermarket', 'grocery'],
              'transportation': ['transport', 'travel', 'fuel', 'gas', 'car', 'uber', 'taxi', 'bus', 'train'],
              'entertainment': ['entertainment', 'leisure', 'fun', 'movie', 'cinema', 'game', 'sport'],
              'healthcare': ['health', 'medical', 'doctor', 'pharmacy', 'hospital', 'medicine'],
              'shopping': ['shopping', 'retail', 'clothes', 'clothing', 'store', 'mall'],
              'utilities': ['utilities', 'electric', 'water', 'internet', 'phone', 'cable']
            };
            
            for (const [key, keywords] of Object.entries(categoryMappings)) {
              if (keywords.some(keyword => 
                suggestedCategory.includes(keyword) || 
                keyword.includes(suggestedCategory.split(' ')[0]) ||
                keyword.includes(suggestedCategory.split(' ').pop() || '')
              )) {
                matchedCategory = categories.find(cat => 
                  cat.name.toLowerCase().includes(key) ||
                  cat.name.toLowerCase() === 'groceries' && key === 'food' ||
                  cat.name.toLowerCase() === 'food & dining' && key === 'food'
                );
                if (matchedCategory) break;
              }
            }
          }
          
          if (matchedCategory) {
            matchedCategoryId = matchedCategory.id.toString();
          }
        }

        const newFormData = {
          amount: result.extracted.amount?.toString() || '',
          description: result.extracted.vendor || '',
          date: result.extracted.date || todayLocalISO(),
          categoryId: matchedCategoryId
        };

        setFormData(newFormData);
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
        title: t("upload.upload_failed"),
        description: t("upload.please_try_again"),
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
      date: todayLocalISO(),
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
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

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
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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

      // Invalidate cache to refresh transaction lists
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });

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
        <Button variant="outline" className="flex items-center gap-2" data-testid="receipt-upload-trigger">
          <ImageIcon className="h-4 w-4" />
          {buttonText || t("upload.button_text")}
        </Button>
      </DialogTrigger>
      {!aiAccess.allowed && (
        <DialogContent className="max-w-md" data-testid="receipt-ai-blocked">
          <DialogHeader>
            <DialogTitle>{aiAccess.reason === 'ai_disabled' ? t('upload.AI is turned off') : t('upload.AI scanning needs a paid plan')}</DialogTitle>
            <DialogDescription>
              {aiAccess.reason === 'ai_disabled'
                ? t('upload.Turn AI back on in Profile to scan receipts.')
                : t('upload.Receipt scanning is available on the Standard and Premium plans.')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsOpen(false)}>{t('upload.Close')}</Button>
            <Button asChild>
              <a href={`/${currentLocale}/profile`}>{t('upload.Go to Profile')}</a>
            </Button>
          </div>
        </DialogContent>
      )}
      {aiAccess.allowed && (
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {t("upload.modal_title")}
          </DialogTitle>
          <DialogDescription>
            {t("upload.modal_subtitle")}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {uploadState.status === 'idle' && (
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
              {/* Hidden file inputs for different sources */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
              
              <div className="space-y-4">
                <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                <div>
                  <p className="text-lg font-medium">{t("upload.upload_receipt")}</p>
                  <p className="text-sm text-gray-500">
                    {t("upload.drag_drop")}
                  </p>
                </div>
                
                {/* Mobile: Show both camera and gallery options */}
                <div className="block md:hidden space-y-2">
                  <Button
                    onClick={() => cameraInputRef.current?.click()}
                    className="w-full flex items-center gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    {t("Take Photo")}
                  </Button>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    className="w-full flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {t("Choose from Gallery")}
                  </Button>
                </div>
                
                {/* Desktop: Show both options */}
                <div className="hidden md:flex md:space-x-2">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {t("upload.select_file")}
                  </Button>
                  <Button
                    onClick={handleQRUpload}
                    variant="outline"
                    className="flex-1 flex items-center gap-2"
                  >
                    <QrCode className="h-4 w-4" />
                    {t("upload.scan_phone")}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* QR Code Upload Interface */}
          {qrUploadState.status === 'waiting' && qrUploadState.qrCodeUrl && (
            <div className="text-center space-y-4 py-6">
              <div className="flex items-center gap-2 justify-center text-blue-600">
                <Smartphone className="h-5 w-5" />
                <span className="font-medium">{t("upload.scan_qr")}</span>
              </div>
              
              <div className="bg-white p-4 rounded-lg border shadow-sm mx-auto w-fit">
                <img 
                  src={qrUploadState.qrCodeUrl} 
                  alt="QR Code for mobile upload" 
                  className="w-64 h-64 mx-auto"
                />
              </div>
              
              <div className="text-sm text-gray-600 space-y-1">
                <p>{t("upload.qr_step_1")}</p>
                <p>{t("upload.qr_step_2")}</p>
                <p>{t("upload.qr_step_3")}</p>
              </div>
              
              {qrUploadState.isPolling && (
                <div className="flex items-center gap-2 justify-center text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                  <span className="text-sm">{t("upload.waiting_upload")}</span>
                </div>
              )}
              
              <Button 
                onClick={() => setQrUploadState({ sessionId: '', qrCodeUrl: '', isPolling: false, status: 'idle' })}
                variant="outline"
                className="text-sm"
              >
                {t("upload.cancel_qr")}
              </Button>
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
                    {t("upload.edit_details")}
                  </h4>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="amount">{t("upload.amount_required")}</Label>
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
                    {t("upload.save_transaction")}
                  </Button>
                </div>
              )}

              {/* OCR Text (Collapsible) */}
              {uploadState.recognizedText && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("upload.recognized_text")}
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
                {t("upload.upload_another")}
              </Button>
              <Button
                onClick={handleModalClose}
                variant="secondary"
                className="flex-1"
              >
                {t("upload.close")}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
      )}
    </Dialog>
  );
}