/**
 * PDF Anonymization Preview Component
 * Shows users exactly what data is extracted and anonymized before AI processing
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, Eye, EyeOff, Lock, AlertTriangle, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface AnonymizationPreviewData {
  originalText: string;
  anonymizedText: string;
  securityLog: SecurityEvent[];
  detectedSensitiveData: SensitiveDataDetection[];
  processingStats: ProcessingStats;
}

interface SecurityEvent {
  timestamp: Date;
  event: string;
  status: 'success' | 'warning' | 'error';
  details?: string;
}

interface SensitiveDataDetection {
  type: 'name' | 'account' | 'ssn' | 'email' | 'phone' | 'address' | 'balance';
  count: number;
  examples: string[];
  redactionPattern: string;
}

interface ProcessingStats {
  originalLength: number;
  anonymizedLength: number;
  redactionCount: number;
  safetyScore: number; // 0-100
}

interface PDFAnonymizationPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onDeny: () => void;
  previewData: AnonymizationPreviewData | null;
  isLoading?: boolean;
}

export function PDFAnonymizationPreview({
  isOpen,
  onClose,
  onConfirm,
  onDeny,
  previewData,
  isLoading = false
}: PDFAnonymizationPreviewProps) {
  const { t } = useTranslation();
  const [showOriginal, setShowOriginal] = useState(false);

  if (!previewData && !isLoading) return null;

  const getSafetyColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSafetyBadgeVariant = (score: number): "default" | "secondary" | "destructive" | "outline" => {
    if (score >= 90) return 'default';
    if (score >= 70) return 'secondary';
    return 'destructive';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            {t('pdf.anonymization_preview.title', 'Data Anonymization Preview')}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {t('pdf.anonymization_preview.subtitle', 'Review how your PDF data is anonymized before AI processing')}
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">{t('pdf.anonymization_preview.processing', 'Processing and anonymizing PDF...')}</span>
          </div>
        ) : previewData && (
          <div className="space-y-4">
            {/* Safety Score Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    {t('pdf.anonymization_preview.safety_overview', 'Safety Overview')}
                  </span>
                  <Badge variant={getSafetyBadgeVariant(previewData.processingStats.safetyScore)}>
                    {previewData.processingStats.safetyScore}% {t('pdf.anonymization_preview.safe', 'Safe')}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('pdf.anonymization_preview.original_size', 'Original Size')}</span>
                    <div className="font-semibold">{previewData.processingStats.originalLength.toLocaleString()} {t('pdf.anonymization_preview.characters', 'characters')}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('pdf.anonymization_preview.anonymized_size', 'Anonymized Size')}</span>
                    <div className="font-semibold">{previewData.processingStats.anonymizedLength.toLocaleString()} {t('pdf.anonymization_preview.characters', 'characters')}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('pdf.anonymization_preview.redactions', 'Redactions')}</span>
                    <div className="font-semibold">{previewData.processingStats.redactionCount}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('pdf.anonymization_preview.safety_score', 'Safety Score')}</span>
                    <div className={`font-semibold ${getSafetyColor(previewData.processingStats.safetyScore)}`}>
                      {previewData.processingStats.safetyScore}%
                    </div>
                  </div>
                </div>

                {/* Detected Sensitive Data */}
                {previewData.detectedSensitiveData.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">{t('pdf.anonymization_preview.detected_data', 'Detected Sensitive Data')}</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {previewData.detectedSensitiveData.map((detection, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm capitalize">
                            {t(`pdf.anonymization_preview.${detection.type}`, detection.type)}
                          </span>
                          <Badge variant="outline">{detection.count} {t('pdf.anonymization_preview.found', 'found')}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Content Preview Tabs */}
            <Tabs defaultValue="anonymized" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="anonymized" className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {t('pdf.anonymization_preview.anonymized_data', 'Anonymized Data')}
                  <Badge variant="default" className="ml-1">
                    {t('pdf.anonymization_preview.sent_to_ai', 'Sent to AI')}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="original" className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {t('pdf.anonymization_preview.original_data', 'Original Data')}
                  <Badge variant="destructive" className="ml-1">
                    {t('pdf.anonymization_preview.stays_local', 'Stays Local')}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="anonymized" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-600">
                      <Shield className="h-5 w-5" />
                      {t('pdf.anonymization_preview.ai_processing_data', 'Data Sent for AI Processing')}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {t('pdf.anonymization_preview.ai_data_description', 'This anonymized data is sent to OpenAI for transaction parsing. All sensitive information has been removed.')}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64 w-full border rounded p-3">
                      <pre className="text-xs whitespace-pre-wrap font-mono">
                        {previewData.anonymizedText}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="original" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="h-5 w-5" />
                      {t('pdf.anonymization_preview.original_data_title', 'Original PDF Data')}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {t('pdf.anonymization_preview.original_data_description', 'This original data never leaves your device and is NOT sent to any AI service.')}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowOriginal(!showOriginal)}
                        className="flex items-center gap-2"
                      >
                        {showOriginal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {showOriginal 
                          ? t('pdf.anonymization_preview.hide_original', 'Hide Original') 
                          : t('pdf.anonymization_preview.show_original', 'Show Original')
                        }
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {showOriginal ? (
                      <ScrollArea className="h-64 w-full border rounded p-3 bg-red-50">
                        <pre className="text-xs whitespace-pre-wrap font-mono">
                          {previewData.originalText}
                        </pre>
                      </ScrollArea>
                    ) : (
                      <div className="h-64 w-full border rounded p-3 bg-muted flex items-center justify-center">
                        <div className="text-center text-muted-foreground">
                          <Lock className="h-8 w-8 mx-auto mb-2" />
                          <p>{t('pdf.anonymization_preview.hidden_for_privacy', 'Hidden for privacy protection')}</p>
                          <p className="text-xs">{t('pdf.anonymization_preview.click_to_view', 'Click "Show Original" to view')}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Security Log */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t('pdf.anonymization_preview.security_log', 'Security Processing Log')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-32">
                  <div className="space-y-1">
                    {previewData.securityLog.map((event, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">
                          {event.timestamp.toLocaleTimeString()}
                        </span>
                        <Badge 
                          variant={event.status === 'success' ? 'default' : event.status === 'warning' ? 'secondary' : 'destructive'}
                          className="text-xs"
                        >
                          {event.status}
                        </Badge>
                        <span>{event.event}</span>
                        {event.details && <span className="text-muted-foreground">- {event.details}</span>}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>{t('pdf.anonymization_preview.privacy_first', 'Privacy-first AI processing')}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onDeny}>
              {t('pdf.anonymization_preview.cancel', 'Cancel')}
            </Button>
            <Button onClick={onConfirm} disabled={isLoading}>
              {t('pdf.anonymization_preview.proceed', 'Proceed with AI Processing')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}