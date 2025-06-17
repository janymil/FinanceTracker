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
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle'
  });

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Neplatný typ súboru",
        description: "Prosím vyberte obrázok",
        variant: "destructive"
      });
      return;
    }

    setUploadState({ status: 'processing', message: 'Spracovávam účtenku...' });

    try {
      const formData = new FormData();
      formData.append('receipt', file);

      const response = await fetch('/api/upload-receipt', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      setUploadState({
        status: 'success',
        message: 'Účtenka úspešne spracovaná!',
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
        message: 'Nepodarilo sa spracovať účtenku'
      });
      toast({
        title: "Nahrávanie zlyhalo",
        description: "Prosím skúste znovu",
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveAsTransaction = () => {
    if (uploadState.extracted) {
      const queryParams = new URLSearchParams({
        amount: uploadState.extracted.amount?.toString() || '',
        description: uploadState.extracted.vendor || '',
        date: uploadState.extracted.date || '',
        category: uploadState.category || ''
      });
      setLocation(`/expenses?${queryParams.toString()}`);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Nahrať účtenku
        </CardTitle>
        <CardDescription>
          Nahrajte fotografiu účtenky na automatické extrahovanie údajov o transakcii
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
                <p className="text-lg font-medium">Nahrať obrázok účtenky</p>
                <p className="text-sm text-gray-500">
                  JPG, PNG alebo iné obrazové formáty
                </p>
              </div>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                Vybrať súbor
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
            
            {uploadState.extracted && (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg space-y-2">
                <h4 className="font-medium text-green-800 dark:text-green-200">
                  Extrahované informácie:
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {uploadState.extracted.amount && (
                    <div>
                      <span className="font-medium">Suma:</span> ${uploadState.extracted.amount}
                    </div>
                  )}
                  {uploadState.extracted.vendor && (
                    <div>
                      <span className="font-medium">Predajca:</span> {uploadState.extracted.vendor}
                    </div>
                  )}
                  {uploadState.extracted.date && (
                    <div>
                      <span className="font-medium">Dátum:</span> {uploadState.extracted.date}
                    </div>
                  )}
                  {uploadState.category && (
                    <div>
                      <span className="font-medium">Kategória:</span> {uploadState.category}
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleSaveAsTransaction}
                  className="w-full mt-3"
                  size="sm"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Uložiť ako transakciu
                </Button>
              </div>
            )}

            {uploadState.recognizedText && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Rozpoznaný text:
                </label>
                <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap border max-h-64 overflow-y-auto">
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