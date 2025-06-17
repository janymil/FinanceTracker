
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Camera, Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UploadReceiptProps {
  onReceiptProcessed?: (receiptData: any) => void;
}

interface UploadState {
  status: 'idle' | 'uploading' | 'success' | 'error';
  message?: string;
  recognizedText?: string;
  extractedData?: any;
}

export default function UploadReceipt({ onReceiptProcessed }: UploadReceiptProps) {
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      
      // Auto-upload the file
      uploadReceipt(file);
    }
  };

  const uploadReceipt = async (file: File) => {
    setUploadState({ status: 'uploading', message: 'Nahrávam...' });

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
        
        setUploadState({
          status: 'success',
          message: 'Úspešne nahrané',
          recognizedText: result.recognizedText,
          extractedData: result.extractedData
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
        throw new Error(`Upload failed: ${response.statusText}`);
      }
    } catch (error: any) {
      console.error("Receipt upload error:", error);
      setUploadState({
        status: 'error',
        message: 'Chyba pri nahrávaní',
      });

      toast({
        title: "Chyba",
        description: error.message || "Nepodarilo sa nahrať účtenku",
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
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getStatusIcon = () => {
    switch (uploadState.status) {
      case 'uploading':
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
      case 'uploading':
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
            uploadState.status === 'success' ? 'bg-green-50 border-green-200' :
            uploadState.status === 'error' ? 'bg-red-50 border-red-200' :
            'bg-blue-50 border-blue-200'
          }`}>
            {getStatusIcon()}
            <span className={`font-medium ${getStatusColor()}`}>
              {uploadState.message}
            </span>
          </div>
        )}

        {/* Image Preview */}
        {previewUrl && (
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

        {/* Recognized Text Display */}
        {uploadState.recognizedText && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Rozpoznaný text:
            </label>
            <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap border">
{uploadState.recognizedText}
            </pre>
          </div>
        )}

        {/* Extracted Data Display */}
        {uploadState.extractedData && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Extrahované údaje:
            </label>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border">
              {uploadState.extractedData.amount && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Suma:</span>
                  <span className="font-medium">{uploadState.extractedData.amount}</span>
                </div>
              )}
              {uploadState.extractedData.merchant && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Obchodník:</span>
                  <span className="font-medium">{uploadState.extractedData.merchant}</span>
                </div>
              )}
              {uploadState.extractedData.date && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Dátum:</span>
                  <span className="font-medium">{uploadState.extractedData.date}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reset Button */}
        {uploadState.status !== 'idle' && uploadState.status !== 'uploading' && (
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
