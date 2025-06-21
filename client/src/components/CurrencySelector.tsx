import { useState } from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Settings, Check, Lock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const PRESET_CURRENCIES = [
  { symbol: '$', label: 'US Dollar ($)', code: 'USD' },
  { symbol: '€', label: 'Euro (€)', code: 'EUR' },
  { symbol: 'S/', label: 'Peruvian Sol (S/)', code: 'PEN' },
  { symbol: 'Kč', label: 'Czech Koruna (Kč)', code: 'CZK' },
];

interface CurrencySelectorProps {
  className?: string;
  variant?: 'default' | 'compact' | 'icon';
}

export function CurrencySelector({ className = '', variant = 'icon' }: CurrencySelectorProps) {
  const { currency, setCurrency, canChangeCurrency, hasTransactions } = useCurrency();
  const [open, setOpen] = useState(false);

  const handleCurrencyChange = (newCurrency: string) => {
    if (canChangeCurrency) {
      setCurrency(newCurrency);
      setOpen(false);
    }
  };

  const getCurrentCurrencyInfo = () => {
    const current = PRESET_CURRENCIES.find(c => c.symbol === currency);
    return current || { symbol: currency, label: `${currency} (Custom)`, code: 'CUSTOM' };
  };

  if (variant === 'icon') {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 w-8 p-0 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 ${className}`}
            title="Change Currency"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Currency Settings
              {!canChangeCurrency && <Lock className="h-4 w-4 text-gray-500" />}
            </DialogTitle>
            <DialogDescription>
              {canChangeCurrency 
                ? "Choose your preferred currency symbol for displaying amounts."
                : "Currency cannot be changed after adding transactions."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Current: <span className="font-medium">{getCurrentCurrencyInfo().symbol} - {getCurrentCurrencyInfo().label}</span>
            </div>
            
            {!canChangeCurrency && (
              <Alert className="mb-4">
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  You have {hasTransactions ? 'transactions' : 'data'} in your account. Currency cannot be changed to maintain data consistency.
                </AlertDescription>
              </Alert>
            )}
            
            <div className={`grid grid-cols-2 gap-2 ${!canChangeCurrency ? 'opacity-50' : ''}`}>
              {PRESET_CURRENCIES.map((curr) => (
                <Button
                  key={curr.code}
                  variant={currency === curr.symbol ? "default" : "outline"}
                  onClick={() => handleCurrencyChange(curr.symbol)}
                  disabled={!canChangeCurrency}
                  className="justify-start h-12 p-3"
                >
                  <div className="flex items-center space-x-3 w-full">
                    <span className="text-lg font-bold">{curr.symbol}</span>
                    <div className="text-left">
                      <div className="text-sm font-medium">{curr.code}</div>
                      <div className="text-xs text-gray-500">{curr.label.split(' (')[0]}</div>
                    </div>
                    {currency === curr.symbol && (
                      <Check className="h-4 w-4 ml-auto text-green-600" />
                    )}
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Legacy variants for backward compatibility
  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <span className="text-sm font-medium">{currency}</span>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <Settings className="h-3 w-3" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Select Currency</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_CURRENCIES.map((curr) => (
                <Button
                  key={curr.code}
                  variant={currency === curr.symbol ? "default" : "outline"}
                  onClick={() => handleCurrencyChange(curr.symbol)}
                  className="justify-start"
                >
                  {curr.symbol} {curr.code}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Currency Symbol
      </label>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span>{getCurrentCurrencyInfo().label}</span>
            <Settings className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Currency</DialogTitle>
            <DialogDescription>
              Choose your preferred currency symbol for displaying amounts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {PRESET_CURRENCIES.map((curr) => (
              <Button
                key={curr.code}
                variant={currency === curr.symbol ? "default" : "outline"}
                onClick={() => handleCurrencyChange(curr.symbol)}
                className="w-full justify-start"
              >
                <div className="flex items-center space-x-3">
                  <span className="font-medium text-lg">{curr.symbol}</span>
                  <span>{curr.label}</span>
                  {currency === curr.symbol && (
                    <Check className="h-4 w-4 ml-auto text-green-600" />
                  )}
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CurrencySelector;