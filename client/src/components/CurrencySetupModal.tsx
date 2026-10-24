import { trackEvent } from '@/lib/analytics';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from 'react-i18next';
import { CURRENCIES, currencyByCode, suggestCurrencyCode } from '@shared/currencies';
import { detectTimeZone } from '@shared/timezones';
import { useCurrencyNames } from '@/hooks/useCurrencyNames';

interface CurrencySetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Receives the ISO code of the chosen currency. */
  onSelectCurrency: (currency: string) => void;
}

export function CurrencySetupModal({ isOpen, onClose, onSelectCurrency }: CurrencySetupModalProps) {
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const nameOf = useCurrencyNames();
  const saving = savingCode !== null;

  const suggested = useMemo(
    () => currencyByCode(suggestCurrencyCode(detectTimeZone(), i18n.language)),
    [i18n.language]
  );

  const groups = useMemo(
    () => [
      { key: 'featured', title: null as string | null, items: CURRENCIES.filter((c) => c.group === 'featured') },
      { key: 'latam', title: t('currency.group_latam'), items: CURRENCIES.filter((c) => c.group === 'latam') },
      { key: 'other', title: t('currency.group_other'), items: CURRENCIES.filter((c) => c.group === 'other') },
    ],
    [t]
  );

  const choose = async (code: string, symbol: string) => {
    setSavingCode(code);
    setFailed(false);
    try {
      await apiRequest('PUT', '/api/auth/user', { currency: code });

      toast({
        title: t('currency.success_title'),
        description: t('currency.success_description', { symbol }),
      });

      trackEvent('account_setup_complete', 'activation', code);
      // The welcome step reads the account from this cache.
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      onSelectCurrency(code);
      onClose();
    } catch (error) {
      console.error('Failed to update currency:', error);
      setFailed(true);
      toast({
        title: t('currency.error_title'),
        description: t('currency.error_description'),
        variant: "destructive",
      });
    } finally {
      setSavingCode(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}} modal={true}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-xl">{t('currency.welcome_title')}</DialogTitle>
          <DialogDescription className="text-base">
            {t('currency.welcome_description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {failed && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200" data-testid="currency-error">
              {t('currency.error_inline')}
            </div>
          )}

          {suggested && (
            <div className="space-y-2" data-testid="currency-suggestion">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t('currency.suggested')}</h3>
              <Button
                onClick={() => choose(suggested.code, suggested.symbol)}
                disabled={saving}
                data-testid={`currency-suggested-${suggested.code}`}
                className="h-16 w-full justify-start gap-3 text-left"
              >
                <span className="text-2xl font-bold">{suggested.symbol}</span>
                <span className="text-sm">
                  {suggested.code} · {nameOf(suggested.code)}
                </span>
                {savingCode === suggested.code && <span className="ml-auto text-xs">{t('currency.saving')}</span>}
              </Button>
            </div>
          )}

          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('currency.choose_description')}
          </div>

          {groups.map((group) => (
            <div key={group.key} className="space-y-2">
              {group.title && (
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{group.title}</h3>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {group.items.map((currency) => (
                  <Button
                    key={currency.code}
                    variant="outline"
                    onClick={() => choose(currency.code, currency.symbol)}
                    disabled={saving}
                    data-testid={`currency-${currency.code}`}
                    className="h-16 p-3 flex flex-col items-center justify-center space-y-1 relative hover:scale-105 transition-transform disabled:opacity-50"
                  >
                    <span className="text-xl font-bold">{currency.symbol}</span>
                    <span className="text-xs text-center leading-tight">
                      {currency.code} · {nameOf(currency.code)}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
