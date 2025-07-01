// Define the gtag function globally
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

// Initialize Google Analytics and Google Ads - Production Only
export const initGA = () => {
  // Only initialize in production
  if (window.location.hostname !== 'finanzerpro.com') {
    return;
  }

  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  const googleAdsId = 'AW-17290659470'; // Google Ads conversion tracking

  // Add single gtag script (handles both GA and Google Ads)
  const script1 = document.createElement('script');
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`;
  document.head.appendChild(script1);

  // Initialize gtag with both GA and Google Ads
  const script2 = document.createElement('script');
  script2.textContent = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '` + measurementId.replace(/['"\\]/g, '') + `');
    gtag('config', '` + googleAdsId + `');
  `;
  document.head.appendChild(script2);
};

// Track page views - useful for single-page applications
export const trackPageView = (url: string) => {
  // Only track in production
  if (typeof window === 'undefined' || !window.gtag || window.location.hostname !== 'finanzerpro.com') return;
  
  const measurementId = 'G-PRRBGDT20Q';
  
  // Track page view for Google Analytics
  window.gtag('config', measurementId, {
    page_path: url
  });
};

// Track Google Ads conversions
export const trackConversion = (conversionLabel?: string, value?: number, currency?: string) => {
  // Only track in production
  if (typeof window === 'undefined' || !window.gtag || window.location.hostname !== 'finanzerpro.com') return;
  
  const googleAdsId = 'AW-17290659470';
  
  // Basic conversion tracking
  const conversionData: any = {
    send_to: conversionLabel ? `${googleAdsId}/${conversionLabel}` : googleAdsId
  };
  
  // Add value and currency if provided
  if (value !== undefined) {
    conversionData.value = value;
  }
  if (currency) {
    conversionData.currency = currency;
  }
  
  window.gtag('event', 'conversion', conversionData);
};

// Track events
export const trackEvent = (
  action: string, 
  category?: string, 
  label?: string, 
  value?: number
) => {
  // Only track in production
  if (typeof window === 'undefined' || !window.gtag || window.location.hostname !== 'finanzerpro.com') return;
  
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};