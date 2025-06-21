import { useCurrency } from '@/context/CurrencyContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign } from 'lucide-react';

const PRESET_CURRENCIES = [
  { symbol: '$', label: 'US Dollar ($)', code: 'USD' },
  { symbol: '€', label: 'Euro (€)', code: 'EUR' },
  { symbol: 'S/', label: 'Peruvian Sol (S/)', code: 'PEN' },
  { symbol: 'Kč', label: 'Czech Koruna (Kč)', code: 'CZK' },
];

interface CurrencySelectorProps {
  className?: string;
  variant?: 'default' | 'compact';
}

export function CurrencySelector({ className = '', variant = 'default' }: CurrencySelectorProps) {
  const { currency, setCurrency } = useCurrency();

  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency);
  };

  const getCurrentCurrencyLabel = () => {
    const current = PRESET_CURRENCIES.find(c => c.symbol === currency);
    return current ? current.label : `${currency} (Custom)`;
  };

  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <DollarSign className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <Select value={currency} onValueChange={handleCurrencyChange}>
          <SelectTrigger className="w-20 h-8 text-sm">
            <SelectValue placeholder="Currency" />
          </SelectTrigger>
          <SelectContent>
            {PRESET_CURRENCIES.map((curr) => (
              <SelectItem key={curr.code} value={curr.symbol}>
                {curr.symbol}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Currency Symbol
      </label>
      <Select value={currency} onValueChange={handleCurrencyChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select currency">
            {getCurrentCurrencyLabel()}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PRESET_CURRENCIES.map((curr) => (
            <SelectItem key={curr.code} value={curr.symbol}>
              <div className="flex items-center space-x-2">
                <span className="font-medium">{curr.symbol}</span>
                <span className="text-gray-500 dark:text-gray-400">{curr.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default CurrencySelector;