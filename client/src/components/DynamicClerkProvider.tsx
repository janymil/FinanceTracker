import React, { ReactNode, useEffect, useState } from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
import { esES, skSK } from '@clerk/localizations';
import { useTranslation } from 'react-i18next';

interface DynamicClerkProviderProps {
  children: ReactNode;
  publishableKey: string;
  afterSignInUrl?: string;
  afterSignUpUrl?: string;
}

// Custom Slovak localization with missing terms
const customSlovak = {
  ...skSK,
  signUp: {
    ...(skSK.signUp || {}),
    legalConsent: {
      ...(skSK.signUp?.legalConsent || {}),
      checkbox: {
        label__onlyPrivacyPolicy: 'Súhlasím so {{ privacyPolicyLink || link("zásadami ochrany osobných údajov") }}',
        label__onlyTermsOfService: 'Súhlasím s {{ termsOfServiceLink || link("obchodnými podmienkami") }}',
        label__termsOfServiceAndPrivacyPolicy: 'Súhlasím s {{ termsOfServiceLink || link("obchodnými podmienkami") }} a {{ privacyPolicyLink || link("zásadami ochrany osobných údajov") }}'
      },
      continue: {
        subtitle: 'Pokračovaním súhlasíte s našimi zásadami.',
        title: 'Zákonné súhlasy'
      }
    }
  }
};

export default function DynamicClerkProvider({ 
  children, 
  publishableKey, 
  afterSignInUrl, 
  afterSignUpUrl 
}: DynamicClerkProviderProps) {
  const { i18n } = useTranslation();
  const [localization, setLocalization] = useState<any>(undefined);

  useEffect(() => {
    // Get current language from localStorage (set by LanguageGuard)
    const preferredLang = localStorage.getItem('preferredLanguage') || 'en';
    
    console.log('DynamicClerkProvider: Current i18n language:', i18n.language);
    console.log('DynamicClerkProvider: Preferred language from localStorage:', preferredLang);
    
    // Map language codes to Clerk localizations
    let newLocalization = undefined;
    
    if (preferredLang === 'es' || preferredLang.startsWith('es') || i18n.language.startsWith('es')) {
      newLocalization = esES;
      console.log('DynamicClerkProvider: Setting Spanish localization');
    } else if (preferredLang === 'sk' || preferredLang.startsWith('sk') || i18n.language.startsWith('sk')) {
      newLocalization = customSlovak;
      console.log('DynamicClerkProvider: Setting Slovak localization');
    } else {
      newLocalization = undefined; // English default
      console.log('DynamicClerkProvider: Setting English localization (default)');
    }
    
    setLocalization(newLocalization);
  }, [i18n.language]);

  return (
    <ClerkProvider 
      publishableKey={publishableKey}
      afterSignInUrl={afterSignInUrl}
      afterSignUpUrl={afterSignUpUrl}
      localization={localization}
    >
      {children}
    </ClerkProvider>
  );
}