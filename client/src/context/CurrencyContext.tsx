import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useClerkUserReady } from '@/hooks/useClerkUserReady';
import { apiRequest } from '@/lib/queryClient';
import { CurrencySetupModal } from '@/components/CurrencySetupModal';
import { useTranslation } from 'react-i18next';
import { DEFAULT_CURRENCY_CODE, currencyByCode, formatCurrencyAmount, resolveStoredCurrency } from '@shared/currencies';

interface CurrencyContextType {
  /** Display symbol ("S/", "$"), kept for the many places that print `${currency}${amount}`. */
  currency: string;
  /** ISO 4217 code ("PEN", "MXN"): what is stored, and what tells the pesos apart. */
  currencyCode: string;
  /** Locale-aware amount with the right decimals for this currency. */
  formatMoney: (amount: number) => string;
  /** Accepts an ISO code (preferred) or a legacy symbol. */
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
  const { i18n } = useTranslation();
  const [currencyCode, setCurrencyCode] = useState<string>(DEFAULT_CURRENCY_CODE);
  const currency = currencyByCode(currencyCode)?.symbol ?? '$';
  const setCurrencyState = (value: string) => {
    setCurrencyCode(resolveStoredCurrency(value)?.code ?? DEFAULT_CURRENCY_CODE);
  };
  const [canChangeCurrency, setCanChangeCurrency] = useState<boolean>(true);
  const [hasTransactions, setHasTransactions] = useState<boolean>(false);
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  // A failed load must not look like "no currency chosen": say so and let the person retry.
  const [loadFailed, setLoadFailed] = useState<boolean>(false);
  const [reloadCount, setReloadCount] = useState<number>(0);
  const { t } = useTranslation();

  // Load user currency and check transaction status ONLY for logged-in users
  useEffect(() => {
    // If user is not logged in, don't show setup modal
    if (!isReady || !user?.id) {
      setShowSetupModal(false);
      setIsInitialized(false);
      setCurrencyCode(DEFAULT_CURRENCY_CODE);
      return;
    }

    if (isInitialized) return;
    setLoadFailed(false);

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
        
        // Check if user has any transactions. If this call fails the currency prompt must still
        // work (the server refuses a currency change once transactions exist anyway).
        // One row answers the question; the unfiltered request returned the whole history.
        try {
          const transactionsResponse = await apiRequest('GET', '/api/transactions?limit=1');
          const transactions = await transactionsResponse.json();
          const userHasTransactions = Array.isArray(transactions) && transactions.length > 0;
          setHasTransactions(userHasTransactions);
          setCanChangeCurrency(!userHasTransactions);
        } catch (transactionsError) {
          console.warn('Could not check existing transactions:', transactionsError);
        }

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
        // Never show the setup modal on an error (it would save over a currency we could not read),
        // and do not pretend the load finished: offer a retry.
        setShowSetupModal(false);
        setLoadFailed(true);
      }
    };

    initializeCurrency();
  }, [isReady, user?.id, isInitialized, reloadCount]);

  const setCurrency = async (newCurrency: string) => {
    if (!canChangeCurrency) {
      console.warn('Cannot change currency after adding transactions');
      return;
    }

    try {
      await apiRequest('PUT', '/api/auth/user', {
        currency: resolveStoredCurrency(newCurrency)?.code ?? newCurrency
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
    currencyCode,
    formatMoney: (amount: number) => formatCurrencyAmount(amount, currencyCode, i18n.language || 'en'),
    setCurrency,
    canChangeCurrency,
    hasTransactions,
    showSetupModal,
    setShowSetupModal,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
      {loadFailed && (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg border bg-white p-3 text-sm shadow-lg dark:bg-gray-800"
          data-testid="account-load-failed"
        >
          <span>{t('currency.load_failed')}</span>
          <button
            type="button"
            className="shrink-0 rounded-md border px-3 py-1 font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
            onClick={() => setReloadCount((count) => count + 1)}
          >
            {t('currency.retry')}
          </button>
        </div>
      )}
      {showSetupModal && isInitialized && (
        <CurrencySetupModal
          isOpen={showSetupModal}
          onClose={() => setShowSetupModal(false)}
          onSelectCurrency={(code) => setCurrencyState(code)}
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