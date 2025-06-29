import { useGeolocation } from '../hooks/useGeolocation';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, Shield, Globe } from 'lucide-react';

/**
 * Compliance Notice Component
 * Shows appropriate legal notices based on user location
 */
export function ComplianceNotice() {
  const { location, loading, requiresGDPR, requiresCCPA, isEU, isUS } = useGeolocation();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Globe className="h-4 w-4 animate-spin" />
        {t('compliance.detecting_location', 'Detecting location...')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Debug info (development only) */}
      {process.env.NODE_ENV === 'development' && location && (
        <Alert>
          <MapPin className="h-4 w-4" />
          <AlertDescription className="text-xs">
            DEBUG: Location detected - {location.country} ({location.countryCode}) 
            | GDPR: {requiresGDPR ? 'Yes' : 'No'} 
            | CCPA: {requiresCCPA ? 'Yes' : 'No'}
          </AlertDescription>
        </Alert>
      )}

      {/* GDPR Notice for EU users */}
      {requiresGDPR && (
        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950">
          <Shield className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm">
            <strong>{t('compliance.gdpr.title', 'European Privacy Rights')}</strong><br />
            {t('compliance.gdpr.notice', 'As an EU resident, you have enhanced privacy rights under GDPR. See our Privacy Policy for details about your rights to access, rectify, and delete your data.')}
          </AlertDescription>
        </Alert>
      )}

      {/* CCPA Notice for California/US users */}
      {requiresCCPA && (
        <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950">
          <Shield className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-sm">
            <strong>{t('compliance.ccpa.title', 'California Privacy Rights')}</strong><br />
            {t('compliance.ccpa.notice', 'California residents have specific privacy rights under CCPA. You can request information about data collection and opt-out of data sales.')}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}