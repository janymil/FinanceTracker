import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useClerkUserReady } from '@/hooks/useClerkUserReady';
import { apiRequest } from '@/lib/queryClient';

interface CurrencyContextType {
  currency: string;
  setCurrency: (currency: string) => void;
  canChangeCurrency: boolean;
  hasTransactions: boolean;
  showSetupModal: boolean;
  setShowSetupModal: (show: boolean) => void;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

interface CurrencyProviderProps {
  children: ReactNode;
}

export function CurrencyProvider({ children }: CurrencyProviderProps) {
  const { isReady, user } = useClerkUserReady();
  const [currency, setCurrencyState] = useState<string>('$');
  const [canChangeCurrency, setCanChangeCurrency] = useState<boolean>(true);
  const [hasTransactions, setHasTransactions] = useState<boolean>(false);
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Load user currency and check transaction status
  useEffect(() => {
    if (!isReady || !user?.id || isInitialized) return;

    const initializeCurrency = async () => {
      try {
        // Get user data including currency preference first
        const userResponse = await apiRequest('GET', '/api/auth/user');
        
        if (!userResponse.ok) {
          if (userResponse.status === 401) {
            // User account doesn't exist, force cleanup and redirect
            const { forceSignOutAndRedirect } = await import('../utils/sessionCleanup');
            await forceSignOutAndRedirect();
            return;
          }
          throw new Error('Failed to fetch user data');
        }
        
        const userData = await userResponse.json();
        
        // Check if user has any transactions
        const transactionsResponse = await apiRequest('GET', '/api/transactions');
        const transactions = await transactionsResponse.json();
        const userHasTransactions = Array.isArray(transactions) && transactions.length > 0;
        
        setHasTransactions(userHasTransactions);
        setCanChangeCurrency(!userHasTransactions);
        
        if (userData.currency) {
          // User has set currency preference
          setCurrencyState(userData.currency);
          setIsInitialized(true);
        } else {
          // New user - show setup modal
          setShowSetupModal(true);
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('Failed to initialize currency:', error);
        // For auth errors, don't retry - fallback to default
        setCurrencyState('$');
        setIsInitialized(true);
      }
    };

    initializeCurrency();
  }, [isReady, user?.id, isInitialized]);

  const setCurrency = async (newCurrency: string) => {
    if (!canChangeCurrency) {
      console.warn('Cannot change currency after adding transactions');
      return;
    }

    try {
      await apiRequest('PUT', '/api/auth/user', {
        currency: newCurrency
      });
      setCurrencyState(newCurrency);
    } catch (error) {
      console.error('Failed to update currency:', error);
    }
  };

  const handleSetupComplete = (selectedCurrency: string) => {
    setCurrencyState(selectedCurrency);
    setShowSetupModal(false);
  };

  const value = {
    currency,
    setCurrency,
    canChangeCurrency,
    hasTransactions,
    showSetupModal,
    setShowSetupModal: handleSetupComplete,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}

// Common currency symbols for easy reference
export const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CHF: 'CHF',
  CAD: 'C$',
  AUD: 'A$',
  CNY: '¥',
  INR: '₹',
  BRL: 'R$',
  KRW: '₩',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'zł',
  CZK: 'Kč',
  HUF: 'Ft',
  RUB: '₽',
  TRY: '₺',
  ZAR: 'R',
  MXN: '$',
  SGD: 'S$',
  HKD: 'HK$',
  NZD: 'NZ$',
  PEN: 'S/',
} as const;

export type CurrencyCode = keyof typeof CURRENCY_SYMBOLS;