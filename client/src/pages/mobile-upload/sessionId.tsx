import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UploadStatus {
  status: 'idle' | 'uploading' | 'success' | 'error';
  message?: string;
}

/**
 * The page a phone opens after scanning the receipt QR code.
 *
 * It is the only screen in the app reached from a link somebody else holds, so it has to work
 * with no session and in the language the person reads. Every word here comes from the
 * `upload.mobile.*` keys — this page used to be hardcoded English, which is what a Spanish
 * customer saw after scanning a code with `/es/` in it.
 */
export default function MobileUpload() {
  const { sessionId } = useParams();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ status: 'idle' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setUploadStatus({
        status: 'error',
        message: t('upload.mobile.invalid_session')
      });
    }
  }, [sessionId, t]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: t('upload.invalid_file_type'),
          description: t('upload.please_select_image'),
          variant: "destructive"
        });
        return;
      }

      setSelectedFile(file);
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !sessionId) {
      toast({
        title: t('upload.mobile.no_file_title'),
        description: t('upload.mobile.no_file_desc'),
        variant: "destructive"
      });
      return;
    }

    setUploadStatus({ status: 'uploading', message: t('upload.mobile.uploading') });

    try {
      const formData = new FormData();
      formData.append('receipt', selectedFile);

      const response = await fetch(`/api/mobile-upload/upload/${sessionId}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      await response.json();
      
      setUploadStatus({
        status: 'success',
        message: t('upload.mobile.success_body')
      });

      // Clean up preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }

      toast({
        title: t('upload.mobile.success_title'),
        description: t('upload.mobile.success_toast')
      });

    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus({
        status: 'error',
        message: t('upload.mobile.error_body')
      });
      
      toast({
        title: t('upload.mobile.error_title'),
        description: t('upload.mobile.error_toast'),
        variant: "destructive"
      });
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setUploadStatus({ status: 'idle' });
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              {t('upload.mobile.error_title')}
            </CardTitle>
            <CardDescription>
              {t('upload.mobile.invalid_session')}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {t('upload.mobile.title')}
          </CardTitle>
          <CardDescription>
            {t('upload.mobile.subtitle')}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {uploadStatus.status === 'idle' && !selectedFile && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">{t('upload.mobile.photo_title')}</p>
                <p className="text-sm text-gray-500 mb-4">
                  {t('upload.mobile.photo_hint')}
                </p>
                
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="receipt-camera"
                />
                <label htmlFor="receipt-camera">
                  <Button className="w-full" asChild>
                    <span className="flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      {t('upload.mobile.take_photo')}
                    </span>
                  </Button>
                </label>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-gray-500">{t('upload.mobile.or')}</p>
              </div>
              
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="receipt-gallery"
                />
                <label htmlFor="receipt-gallery">
                  <Button variant="outline" className="w-full" asChild>
                    <span className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      {t('upload.mobile.gallery')}
                    </span>
                  </Button>
                </label>
              </div>
            </div>
          )}

          {selectedFile && uploadStatus.status === 'idle' && (
            <div className="space-y-4">
              {previewUrl && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t('upload.mobile.preview')}</p>
                  <img 
                    src={previewUrl} 
                    alt={t('upload.mobile.preview')}
                    className="w-full h-auto max-h-64 object-contain rounded-lg border"
                  />
                </div>
              )}
              
              <div className="flex gap-2">
                <Button onClick={handleUpload} className="flex-1">
                  <Upload className="h-4 w-4 mr-2" />
                  {t('upload.mobile.submit')}
                </Button>
                <Button onClick={handleReset} variant="outline">
                  {t('upload.mobile.reset')}
                </Button>
              </div>
            </div>
          )}

          {uploadStatus.status === 'uploading' && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-sm text-gray-600">{uploadStatus.message}</p>
            </div>
          )}

          {uploadStatus.status === 'success' && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
                {t('upload.mobile.success_title')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                {t('upload.mobile.success_body')}
              </p>
              <p className="text-xs text-gray-500">
                {t('upload.mobile.success_close')}
              </p>
            </div>
          )}

          {uploadStatus.status === 'error' && (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                {t('upload.mobile.error_title')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                {uploadStatus.message}
              </p>
              <Button onClick={handleReset} variant="outline">
                {t('upload.try_again')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}