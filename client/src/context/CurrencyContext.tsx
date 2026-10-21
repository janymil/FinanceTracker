import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useClerkUserReady } from '@/hooks/useClerkUserReady';
import { apiRequest } from '@/lib/queryClient';
import { CurrencySetupModal } from '@/components/CurrencySetupModal';

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

  // Load user currency and check transaction status ONLY for logged-in users
  useEffect(() => {
    // If user is not logged in, don't show setup modal
    if (!isReady || !user?.id) {
      setShowSetupModal(false);
      return;
    }

    if (isInitialized) return;

    const initializeCurrency = async () => {
      try {
        // Get user data including currency preference first
        const userResponse = await apiRequest('GET', '/api/auth/user');
        
        if (!userResponse.ok) {
          if (userResponse.status === 401) {
            // User not authenticated or account deleted
            setShowSetupModal(false);
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
        
        if (userData.currency && userData.currency.trim() !== '') {
          // User has set currency preference  
          setCurrencyState(userData.currency);
          setShowSetupModal(false);
          setIsInitialized(true);
        } else {
          // User has no currency set - show setup modal only for new authenticated users
          setCurrencyState('$');
          setShowSetupModal(true);
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('Failed to initialize currency:', error);
        // Never show setup modal on error or unauthenticated state
        setShowSetupModal(false);
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
      setShowSetupModal(false); // Close modal after successful update
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
    setShowSetupModal,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
      {showSetupModal && isInitialized && (
        <CurrencySetupModal
          isOpen={showSetupModal}
          onClose={() => setShowSetupModal(false)}
          onSelectCurrency={setCurrency}
        />
      )}
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