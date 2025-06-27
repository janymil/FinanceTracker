import { useState, useEffect } from 'react';
import i18n from '../i18n/i18n';

interface ResourceLoaderProps {
  children: React.ReactNode;
}

export default function ResourceLoader({ children }: ResourceLoaderProps) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadResources = async () => {
      try {
        // Fetch all translation files with cache busting
        const timestamp = Date.now();
        const [enRes, esRes, skRes] = await Promise.all([
          fetch(`/locales/en-us/translation.json?v=${timestamp}`),
          fetch(`/locales/es-pe/translation.json?v=${timestamp}`),
          fetch(`/locales/sk-sk/translation.json?v=${timestamp}`)
        ]);

        const [enData, esData, skData] = await Promise.all([
          enRes.json(),
          esRes.json(),
          skRes.json()
        ]);

        // Add resources to i18n store
        i18n.addResourceBundle('en-us', 'translation', enData);
        i18n.addResourceBundle('es-pe', 'translation', esData);
        i18n.addResourceBundle('sk-sk', 'translation', skData);

        setLoaded(true);
      } catch (error) {
        console.error('Failed to load translation resources:', error);
        setLoaded(true); // Allow app to render even if translations fail
      }
    };

    loadResources();
  }, []);

  if (!loaded) {
    return <div>Loading...</div>;
  }

  return <>{children}</>;
}