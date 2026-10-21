import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UploadStatus {
  status: 'idle' | 'uploading' | 'success' | 'error';
  message?: string;
}

export default function MobileUpload() {
  const { sessionId } = useParams();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { toast } = useToast();
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ status: 'idle' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setUploadStatus({
        status: 'error',
        message: 'Invalid session ID'
      });
    }
  }, [sessionId]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file",
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
        title: "No file selected",
        description: "Please select an image first",
        variant: "destructive"
      });
      return;
    }

    setUploadStatus({ status: 'uploading', message: 'Uploading receipt...' });

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

      const result = await response.json();
      
      setUploadStatus({
        status: 'success',
        message: 'Upload successful! You can now close this page.'
      });

      // Clean up preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }

      toast({
        title: "Upload successful",
        description: "Your receipt has been processed successfully"
      });

    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus({
        status: 'error',
        message: 'Upload failed. Please try again.'
      });
      
      toast({
        title: "Upload failed",
        description: "Please try again or use the desktop version",
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
              Error
            </CardTitle>
            <CardDescription>
              Invalid session ID
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
            Upload Receipt
          </CardTitle>
          <CardDescription>
            Scan your receipt to add it to Kaptia
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {uploadStatus.status === 'idle' && !selectedFile && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Take a photo of your receipt</p>
                <p className="text-sm text-gray-500 mb-4">
                  Capture a clear image for best results
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
                      Take Photo
                    </span>
                  </Button>
                </label>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-gray-500">or</p>
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
                      Choose from Gallery
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
                  <p className="text-sm font-medium">Preview:</p>
                  <img 
                    src={previewUrl} 
                    alt="Receipt preview" 
                    className="w-full h-auto max-h-64 object-contain rounded-lg border"
                  />
                </div>
              )}
              
              <div className="flex gap-2">
                <Button onClick={handleUpload} className="flex-1">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Receipt
                </Button>
                <Button onClick={handleReset} variant="outline">
                  Reset
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
                Upload Successful!
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Your receipt has been processed and added to your account.
              </p>
              <p className="text-xs text-gray-500">
                You can now close this page and return to the main application.
              </p>
            </div>
          )}

          {uploadStatus.status === 'error' && (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                Upload Failed
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                {uploadStatus.message}
              </p>
              <Button onClick={handleReset} variant="outline">
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}