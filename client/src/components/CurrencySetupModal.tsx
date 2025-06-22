import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const CURRENCY_OPTIONS = [
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
  { symbol: '₽', label: 'Russian Ruble (₽)', code: 'RUB' },
];

interface CurrencySetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCurrency: (currency: string) => void;
}

export function CurrencySetupModal({ isOpen, onClose, onSelectCurrency }: CurrencySetupModalProps) {
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  


  const handleSave = async () => {
    setSaving(true);
    try {
      await apiRequest('PUT', '/api/auth/user', {
        currency: selectedCurrency
      });
      
      toast({
        title: "Currency set successfully",
        description: `Your preferred currency is now ${selectedCurrency}`,
      });
      
      onSelectCurrency(selectedCurrency);
      onClose();
    } catch (error) {
      console.error('Failed to save currency:', error);
      toast({
        title: "Error saving currency",
        description: "Please try again or contact support if the issue persists.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

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
            🌎 Choose from 20+ currencies including Latin American options:
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {CURRENCY_OPTIONS.map((currency) => (
              <Button
                key={currency.code}
                variant={selectedCurrency === currency.symbol ? "default" : "outline"}
                onClick={async () => {
                  setSelectedCurrency(currency.symbol);
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
                  } finally {
                    setSaving(false);
                  }
                }}
                className="h-16 p-3 flex flex-col items-center justify-center space-y-1 relative hover:scale-105 transition-transform"
              >
                <span className="text-xl font-bold">{currency.symbol}</span>
                <span className="text-xs text-center leading-tight">{currency.label}</span>
                {selectedCurrency === currency.symbol && (
                  <Check className="h-4 w-4 text-green-600 absolute top-2 right-2" />
                )}
              </Button>
            ))}
          </div>
          
          <div className="flex justify-end pt-4 border-t">
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="w-full"
            >
              {saving ? "Setting up..." : "Complete Setup"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}