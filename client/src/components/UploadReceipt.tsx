
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UploadReceiptProps {
  onReceiptProcessed?: (receiptData: any) => void;
}

interface UploadState {
  status: 'idle' | 'processing' | 'success' | 'error';
  message?: string;
  recognizedText?: string;
  imageUrl?: string;
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
          imageUrl: result.imageUrl
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
        )}

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
