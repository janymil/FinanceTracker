import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExpenseEstimationCalculator, DebtPayoffVisualizer } from '@/components/Calculator';
import { useTranslation } from 'react-i18next';

interface ExpenseCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DebtCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExpenseCalculatorModal({ isOpen, onClose }: ExpenseCalculatorModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {t('features.calculators.expense.modal_title', 'Expense Estimation Calculator')}
          </DialogTitle>
          <DialogDescription className="text-base">
            {t('features.calculators.expense.modal_description', 'Quick "Can I afford this?" analysis - no account required!')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <ExpenseEstimationCalculator isStandalone={true} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DebtCalculatorModal({ isOpen, onClose }: DebtCalculatorModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {t('features.calculators.debt.modal_title', 'Debt Payoff Visualizer')}
          </DialogTitle>
          <DialogDescription className="text-base">
            {t('features.calculators.debt.modal_description', 'Compare snowball vs avalanche strategies to crush your debt faster!')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <DebtPayoffVisualizer isStandalone={true} />
        </div>
      </DialogContent>
    </Dialog>
  );
}