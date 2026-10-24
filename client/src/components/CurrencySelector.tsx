import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '@/context/CurrencyContext';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Settings, Check, Lock } from 'lucide-react';
import { CURRENCIES, currencyByCode } from '@shared/currencies';
import { useCurrencyNames } from '@/hooks/useCurrencyNames';

interface CurrencySelectorProps {
  className?: string;
  variant?: 'default' | 'compact' | 'icon';
}

export function CurrencySelector({ className = '', variant = 'icon' }: CurrencySelectorProps) {
  const { t } = useTranslation();
  const { currency, currencyCode, setCurrency, canChangeCurrency } = useCurrency();
  const nameOf = useCurrencyNames();
  const [open, setOpen] = useState(false);

  const handleCurrencyChange = (code: string) => {
    if (canChangeCurrency) {
      setCurrency(code);
      setOpen(false);
    }
  };

  const current = currencyByCode(currencyCode);
  const currentLabel = `${currencyCode} · ${nameOf(currencyCode)}`;

  if (variant === 'icon') {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 w-8 p-0 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 ${className}`}
            title={t('currency.change')}
            aria-label={t('currency.change')}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80 max-h-96 overflow-y-auto" align="end">
          <div className="px-3 py-2 text-sm font-medium border-b">
            {t('currency.settings')}
            {!canChangeCurrency && <Lock className="h-4 w-4 inline ml-2 text-gray-500" />}
          </div>

          <div className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 border-b">
            {t('currency.current')} <span className="font-medium">{current?.symbol ?? currency} - {currentLabel}</span>
          </div>

          {!canChangeCurrency && (
            <div className="px-3 py-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-b">
              <Lock className="h-3 w-3 inline mr-1" />
              {t('currency.locked')}
            </div>
          )}

          <div className="py-1">
            {CURRENCIES.map((curr) => (
              <DropdownMenuItem
                key={curr.code}
                onClick={() => handleCurrencyChange(curr.code)}
                disabled={!canChangeCurrency}
                className="flex items-center space-x-3 px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <span className="font-medium text-base min-w-[2.5rem]">{curr.symbol}</span>
                <span className="flex-1 text-sm">{curr.code} · {nameOf(curr.code)}</span>
                {currencyCode === curr.code && <Check className="h-4 w-4 text-green-600" />}
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <span className="text-sm font-medium">{currency}</span>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label={t('currency.change')}>
              <Settings className="h-3 w-3" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('currency.select')}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2">
              {CURRENCIES.map((curr) => (
                <Button
                  key={curr.code}
                  variant={currencyCode === curr.code ? 'default' : 'outline'}
                  onClick={() => handleCurrencyChange(curr.code)}
                  disabled={!canChangeCurrency}
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
        {t('currency.label')}
      </label>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span>{current?.symbol} {currentLabel}</span>
            <Settings className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('currency.select')}</DialogTitle>
            <DialogDescription>{t('currency.select_description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {CURRENCIES.map((curr) => (
              <Button
                key={curr.code}
                variant={currencyCode === curr.code ? 'default' : 'outline'}
                onClick={() => handleCurrencyChange(curr.code)}
                disabled={!canChangeCurrency}
                className="w-full justify-start"
              >
                <div className="flex items-center space-x-3 w-full">
                  <span className="font-medium text-lg">{curr.symbol}</span>
                  <span>{curr.code} · {nameOf(curr.code)}</span>
                  {currencyCode === curr.code && <Check className="h-4 w-4 ml-auto text-green-600" />}
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
