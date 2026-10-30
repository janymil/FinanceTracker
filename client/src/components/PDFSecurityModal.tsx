import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, CheckCircle, Lock, Eye, FileText, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PDFSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConsent: () => void;
}

export function PDFSecurityModal({ isOpen, onClose, onConsent }: PDFSecurityModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">
                {t('export.pdf_security.modal_title')}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {t('export.pdf_security.modal_description')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Security Architecture Section */}
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <h3 className="font-semibold text-green-800 dark:text-green-200 mb-3 flex items-center gap-2">
                <Lock className="h-5 w-5" />
                {t('export.pdf_security.security_architecture_title')}
              </h3>
              <div className="space-y-2 text-sm text-green-700 dark:text-green-300">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{t('export.pdf_security.aes_encryption')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{t('export.pdf_security.zero_persistence')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{t('export.pdf_security.data_sanitization')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{t('export.pdf_security.memory_management')}</span>
                </div>
              </div>
            </div>

            {/* Processing Flow Section */}
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {t('export.pdf_security.processing_flow_title')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5].map((step) => (
                  <div key={step} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-semibold">
                        {step}
                      </div>
                      <h4 className="font-medium text-sm">
                        {t(`export.pdf_security.step${step}_title`)}
                      </h4>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {t(`export.pdf_security.step${step}_desc`)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Compliance Standards */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-3">
                {t('export.pdf_security.compliance_title')}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['payment_processors', 'tls_encryption', 'data_minimization', 'encryption_at_rest'].map((standard) => (
                  <div key={standard} className="text-center">
                    <div className="bg-blue-100 dark:bg-blue-800 p-2 rounded-lg mb-1">
                      <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400 mx-auto" />
                    </div>
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                      {t(`export.pdf_security.${standard}`)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Processing Transparency */}
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
              <h3 className="font-semibold text-purple-800 dark:text-purple-200 mb-3 flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {t('export.pdf_security.ai_processing_title')}
              </h3>
              <div className="space-y-2 text-sm text-purple-700 dark:text-purple-300">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{t('export.pdf_security.ai_provider')}</span>
                </div>
                <div className="flex items-start gap-2 bg-purple-100 dark:bg-purple-800/30 p-2 rounded border border-purple-300 dark:border-purple-700">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-purple-800 dark:text-purple-200" />
                  <span className="font-semibold text-purple-800 dark:text-purple-200">{t('export.pdf_security.ai_anonymization')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{t('export.pdf_security.ai_retention')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{t('export.pdf_security.ai_purpose')}</span>
                </div>
              </div>
            </div>

            {/* User Rights and Control */}
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
              <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-3 flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                {t('export.pdf_security.user_rights_title')}
              </h3>
              <div className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{t('export.pdf_security.transaction_control')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{t('export.pdf_security.manual_correction')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{t('export.pdf_security.delete_option')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{t('export.pdf_security.import_history')}</span>
                </div>
              </div>
            </div>

            {/* Important Notice */}
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
              <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                {t('export.pdf_security.important_notice')}
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                {t('export.pdf_security.consent_text')}
              </p>
            </div>
          </div>
        </ScrollArea>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            {t('export.pdf_security.cancel')}
          </Button>
          <Button
            onClick={onConsent}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            <Shield className="h-4 w-4 mr-2" />
            {t('export.pdf_security.consent_button')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}