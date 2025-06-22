// Define the gtag function globally
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

// Initialize Google Analytics - Production Only
export const initGA = () => {
  // Only initialize in production
  if (window.location.hostname !== 'finanzerpro.com') {
    return;
  }

  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;

  // Add Google Analytics script to the head
  const script1 = document.createElement('script');
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script1);

  // Initialize gtag
  const script2 = document.createElement('script');
  script2.textContent = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '` + measurementId.replace(/['"\\]/g, '') + `');
  `;
  document.head.appendChild(script2);
};

// Track page views - useful for single-page applications
export const trackPageView = (url: string) => {
  // Only track in production
  if (typeof window === 'undefined' || !window.gtag || window.location.hostname !== 'finanzerpro.com') return;
  
  const measurementId = 'G-PRRBGDT20Q';
  
  window.gtag('config', measurementId, {
    page_path: url
  });
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