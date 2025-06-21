import { useState } from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Settings, Check, Lock } from 'lucide-react';

const PRESET_CURRENCIES = [
  // Major global currencies
  { symbol: '$', label: 'US Dollar ($)', code: 'USD' },
  { symbol: '€', label: 'Euro (€)', code: 'EUR' },
  { symbol: '£', label: 'British Pound (£)', code: 'GBP' },
  { symbol: 'C$', label: 'Canadian Dollar (C$)', code: 'CAD' },
  { symbol: 'A$', label: 'Australian Dollar (A$)', code: 'AUD' },
  { symbol: 'CHF', label: 'Swiss Franc (CHF)', code: 'CHF' },
  { symbol: 'kr', label: 'Swedish Krona (kr)', code: 'SEK' },
  { symbol: 'kr', label: 'Norwegian Krone (kr)', code: 'NOK' },
  
  // Latin American currencies
  { symbol: 'R$', label: 'Brazilian Real (R$)', code: 'BRL' },
  { symbol: '$', label: 'Mexican Peso ($)', code: 'MXN' },
  { symbol: '$', label: 'Argentine Peso ($)', code: 'ARS' },
  { symbol: '$', label: 'Chilean Peso ($)', code: 'CLP' },
  { symbol: '$', label: 'Colombian Peso ($)', code: 'COP' },
  { symbol: 'S/', label: 'Peruvian Sol (S/)', code: 'PEN' },
  { symbol: '$U', label: 'Uruguayan Peso ($U)', code: 'UYU' },
  { symbol: 'Bs', label: 'Bolivian Boliviano (Bs)', code: 'BOB' },
  
  // European currencies
  { symbol: 'zł', label: 'Polish Złoty (zł)', code: 'PLN' },
  { symbol: 'Kč', label: 'Czech Koruna (Kč)', code: 'CZK' },
  { symbol: 'Ft', label: 'Hungarian Forint (Ft)', code: 'HUF' },
  { symbol: 'lei', label: 'Romanian Leu (lei)', code: 'RON' },
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
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 w-8 p-0 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 ${className}`}
            title="Change Currency"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80 max-h-96 overflow-y-auto" align="end">
          <div className="px-3 py-2 text-sm font-medium border-b">
            Currency Settings
            {!canChangeCurrency && <Lock className="h-4 w-4 inline ml-2 text-gray-500" />}
          </div>
          
          <div className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 border-b">
            Current: <span className="font-medium">{getCurrentCurrencyInfo().symbol} - {getCurrentCurrencyInfo().label}</span>
          </div>
          
          {!canChangeCurrency && (
            <div className="px-3 py-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-b">
              <Lock className="h-3 w-3 inline mr-1" />
              Currency locked - you have existing transactions
            </div>
          )}
          
          <div className="py-1">
            {PRESET_CURRENCIES.map((curr) => (
              <DropdownMenuItem
                key={curr.code}
                onClick={() => handleCurrencyChange(curr.symbol)}
                disabled={!canChangeCurrency}
                className="flex items-center space-x-3 px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <span className="font-medium text-base min-w-[2.5rem]">{curr.symbol}</span>
                <span className="flex-1 text-sm">{curr.label}</span>
                {currency === curr.symbol && (
                  <Check className="h-4 w-4 text-green-600" />
                )}
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
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