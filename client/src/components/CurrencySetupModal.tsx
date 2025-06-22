import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Currency list with unique symbols only - no duplicates
const CURRENCY_OPTIONS = [
  // Major global currencies
  { symbol: '$', label: 'US Dollar ($)', code: 'USD' },
  { symbol: '€', label: 'Euro (€)', code: 'EUR' },
  { symbol: '£', label: 'British Pound (£)', code: 'GBP' },
  { symbol: 'C$', label: 'Canadian Dollar (C$)', code: 'CAD' },
  { symbol: 'A$', label: 'Australian Dollar (A$)', code: 'AUD' },
  { symbol: 'CHF', label: 'Swiss Franc (CHF)', code: 'CHF' },
  { symbol: 'kr', label: 'Swedish Krona (kr)', code: 'SEK' },
  
  // Latin American currencies  
  { symbol: 'R$', label: 'Brazilian Real (R$)', code: 'BRL' },
  { symbol: 'S/', label: 'Peruvian Sol (S/)', code: 'PEN' },
  { symbol: '$U', label: 'Uruguayan Peso ($U)', code: 'UYU' },
  { symbol: 'Bs', label: 'Bolivian Boliviano (Bs)', code: 'BOB' },
  
  // European currencies
  { symbol: 'zł', label: 'Polish Złoty (zł)', code: 'PLN' },
  { symbol: 'Kč', label: 'Czech Koruna (Kč)', code: 'CZK' },
  { symbol: 'Ft', label: 'Hungarian Forint (Ft)', code: 'HUF' },
  { symbol: '₽', label: 'Russian Ruble (₽)', code: 'RUB' },
];

interface CurrencySetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCurrency: (currency: string) => void;
}

export function CurrencySetupModal({ isOpen, onClose, onSelectCurrency }: CurrencySetupModalProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  




  return (
    <Dialog open={isOpen} onOpenChange={() => {}} modal={true}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-xl">Welcome to FinanzerPro! 🌎</DialogTitle>
          <DialogDescription className="text-base">
            Please choose your preferred currency to get started. You can change this later until you add your first transaction.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            🌎 Choose from 15 currencies including Latin American options:
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {CURRENCY_OPTIONS.map((currency) => (
              <Button
                key={currency.code}
                variant="outline"
                onClick={async () => {
                  setSaving(true);
                  try {
                    await apiRequest('PUT', '/api/auth/user', {
                      currency: currency.symbol
                    });
                    
                    toast({
                      title: "Currency Set Successfully", 
                      description: `Your currency has been set to ${currency.symbol}. Use the gear icon in the header to change it before adding transactions.`,
                    });
                    
                    onSelectCurrency(currency.symbol);
                    onClose();
                  } catch (error) {
                    console.error('Failed to update currency:', error);
                    toast({
                      title: "Error",
                      description: "Failed to set currency. Please try again.",
                      variant: "destructive",
                    });
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="h-16 p-3 flex flex-col items-center justify-center space-y-1 relative hover:scale-105 transition-transform disabled:opacity-50"
              >
                <span className="text-xl font-bold">{currency.symbol}</span>
                <span className="text-xs text-center leading-tight">{currency.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}