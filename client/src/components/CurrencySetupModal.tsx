import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const CURRENCY_OPTIONS = [
  { symbol: '$', label: 'US Dollar ($)', code: 'USD' },
  { symbol: '€', label: 'Euro (€)', code: 'EUR' },
  { symbol: '£', label: 'British Pound (£)', code: 'GBP' },
  { symbol: '¥', label: 'Japanese Yen (¥)', code: 'JPY' },
  { symbol: '₹', label: 'Indian Rupee (₹)', code: 'INR' },
  { symbol: 'C$', label: 'Canadian Dollar (C$)', code: 'CAD' },
  { symbol: 'A$', label: 'Australian Dollar (A$)', code: 'AUD' },
  { symbol: 'CHF', label: 'Swiss Franc (CHF)', code: 'CHF' },
  { symbol: '₩', label: 'South Korean Won (₩)', code: 'KRW' },
  { symbol: 'R$', label: 'Brazilian Real (R$)', code: 'BRL' },
  { symbol: 'S/', label: 'Peruvian Sol (S/)', code: 'PEN' },
  { symbol: 'Kč', label: 'Czech Koruna (Kč)', code: 'CZK' },
];

interface CurrencySetupModalProps {
  open: boolean;
  onComplete: (currency: string) => void;
}

export function CurrencySetupModal({ open, onComplete }: CurrencySetupModalProps) {
  const [selectedCurrency, setSelectedCurrency] = useState('$');
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
      
      onComplete(selectedCurrency);
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
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle>Choose Your Currency</DialogTitle>
          <DialogDescription>
            Select your preferred currency for displaying financial amounts. This cannot be changed after you add your first transaction.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {CURRENCY_OPTIONS.map((currency) => (
              <Button
                key={currency.code}
                variant={selectedCurrency === currency.symbol ? "default" : "outline"}
                onClick={() => setSelectedCurrency(currency.symbol)}
                className="justify-start h-12 p-3"
              >
                <div className="flex items-center space-x-3 w-full">
                  <span className="text-lg font-bold">{currency.symbol}</span>
                  <div className="text-left">
                    <div className="text-sm font-medium">{currency.code}</div>
                    <div className="text-xs text-gray-500">{currency.label.split(' (')[0]}</div>
                  </div>
                  {selectedCurrency === currency.symbol && (
                    <Check className="h-4 w-4 ml-auto text-green-600" />
                  )}
                </div>
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