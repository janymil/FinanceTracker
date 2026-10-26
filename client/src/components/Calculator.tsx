import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { Calculator as CalculatorIcon, TrendingUp, TrendingDown, DollarSign, Trash2, Plus, Target, Zap } from 'lucide-react';
// import { Calculator as CalculatorType } from '@/data/courseContent';

/**
 * The money symbol these calculators print.
 *
 * They were hardcoded to `$` in every sentence, so a Peruvian visitor read dollars next to the
 * soles they actually spend — the same rule the pricing pages already follow (`shared/pricing`):
 * a Spanish page quotes soles, everything else dollars.
 */
function symbolForLanguage(language: string | undefined): string {
  return String(language ?? '').toLowerCase().startsWith('es') ? 'S/' : '$';
}

interface CalculatorProps {
  calculator?: any; // CalculatorType;
}

interface ExpenseEstimationProps {
  isStandalone?: boolean;
}

interface DebtPayoffVisualizerProps {
  isStandalone?: boolean;
}

interface Debt {
  id: string;
  name: string;
  balance: number;
  minPayment: number;
  interestRate: number;
}

export function ExpenseEstimationCalculator({ isStandalone = false }: ExpenseEstimationProps) {
  const { t, i18n } = useTranslation();
  const money = symbolForLanguage(i18n.language);
  const [income, setIncome] = useState('');
  const [expenses, setExpenses] = useState('');
  const [desiredPurchase, setDesiredPurchase] = useState('');
  const [results, setResults] = useState<{
    canAfford?: boolean;
    monthsToSave?: number;
    suggestedSavings?: number;
    affordabilityScore?: number;
    message?: string;
  }>({});

  const calculateAffordability = () => {
    const monthlyIncome = parseFloat(income) || 0;
    const monthlyExpenses = parseFloat(expenses) || 0;
    const purchaseAmount = parseFloat(desiredPurchase) || 0;
    
    if (monthlyIncome <= 0 || purchaseAmount <= 0) {
      setResults({ message: t('calc.expense.needValid', 'Please enter valid amounts for income and desired purchase.') });
      return;
    }

    const availableCash = monthlyIncome - monthlyExpenses;
    const canAfford = availableCash >= purchaseAmount;
    const monthsToSave = canAfford ? 0 : Math.ceil(purchaseAmount / Math.max(availableCash, 1));
    const affordabilityScore = Math.min(100, Math.max(0, (availableCash / purchaseAmount) * 100));
    const suggestedSavings = Math.max(0, purchaseAmount - availableCash);

    let message = '';
    if (canAfford) {
      message = t('calc.expense.canAfford', '✅ Great news! You can afford this purchase. You will have {{left}} left over this month.', {
        left: `${money}${(availableCash - purchaseAmount).toFixed(2)}`,
      });
    } else if (availableCash > 0) {
      message = t('calc.expense.saveMonths', '💡 You need to save for {{months}} months. Setting aside {{monthly}} a month would get you there.', {
        months: monthsToSave,
        monthly: `${money}${(purchaseAmount / monthsToSave).toFixed(2)}`,
      });
    } else {
      message = t('calc.expense.overBudget', '⚠️ Your expenses exceed your income. Reduce expenses or increase income before making this purchase.');
    }

    setResults({ canAfford, monthsToSave, suggestedSavings, affordabilityScore, message });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalculatorIcon className="h-5 w-5 text-green-600" />
          <CardTitle className="text-lg">{t('calc.expense.title', 'Expense Estimation Calculator')}</CardTitle>
        </div>
        <CardDescription>{t('calc.expense.subtitle', 'Quick "Can I afford this?" analysis — no account required.')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="monthly-income">
              {t('calc.expense.income', 'Monthly Income')}
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              id="monthly-income"
              type="number"
              placeholder="3500"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="monthly-expenses">
              {t('calc.expense.expenses', 'Monthly Expenses')}
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              id="monthly-expenses"
              type="number"
              placeholder="2800"
              value={expenses}
              onChange={(e) => setExpenses(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desired-purchase">
              {t('calc.expense.purchase', 'Desired Purchase')}
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              id="desired-purchase"
              type="number"
              placeholder="500"
              value={desiredPurchase}
              onChange={(e) => setDesiredPurchase(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>
        </div>

        {/* Calculate Button */}
        <Button 
          onClick={calculateAffordability} 
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
          disabled={!income || !expenses || !desiredPurchase}
        >
          <CalculatorIcon className="h-4 w-4 mr-2" />
          {t('calc.expense.cta', 'Can I Afford This?')}
        </Button>

        {/* Results */}
        {results.message && (
          <Card className={`mt-4 border-l-4 ${
            results.canAfford ? 'border-l-green-500 bg-green-50' : 
            results.monthsToSave && results.monthsToSave <= 6 ? 'border-l-yellow-500 bg-yellow-50' : 
            'border-l-red-500 bg-red-50'
          }`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                {results.canAfford ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : results.monthsToSave && results.monthsToSave <= 6 ? (
                  <DollarSign className="h-5 w-5 text-yellow-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
                <h4 className="font-semibold">{t('calc.expense.analysis', 'Affordability Analysis')}</h4>
              </div>
              
              {results.affordabilityScore !== undefined && (
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{t('calc.expense.score', 'Affordability Score')}</span>
                    <span className="font-semibold">{Math.round(results.affordabilityScore)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        results.affordabilityScore >= 100 ? 'bg-green-500' :
                        results.affordabilityScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, results.affordabilityScore)}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              <p className="text-sm leading-relaxed">{results.message}</p>
              
              {!results.canAfford && results.monthsToSave && (
                <div className="mt-3 p-3 bg-blue-50 rounded border">
                  <p className="text-sm text-blue-800">
                    💡 <strong>{t('calc.expense.proTip', 'Pro tip')}:</strong>{' '}
                    {t('calc.expense.proTipBody', 'Want to track your actual spending and optimize your budget?')}{' '}
                    <a href="#" onClick={(event) => { event.preventDefault(); window.location.assign('/' + (i18n.language?.slice(0, 2) || 'en') + '/auth#sign-up'); }} className="underline cursor-pointer text-blue-600">
                      {t('calc.expense.signUp', 'Sign up for free')}
                    </a>{' '}
                    {t('calc.expense.proTipTail', 'to see where your money really goes.')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}

export function DebtPayoffVisualizer({ isStandalone = false }: DebtPayoffVisualizerProps) {
  const { t, i18n } = useTranslation();
  const money = symbolForLanguage(i18n.language);
  const [debts, setDebts] = useState<Debt[]>([
    { id: '1', name: 'Credit Card 1', balance: 5000, minPayment: 150, interestRate: 18.5 },
    { id: '2', name: 'Credit Card 2', balance: 3200, minPayment: 95, interestRate: 22.9 },
    { id: '3', name: 'Personal Loan', balance: 8500, minPayment: 280, interestRate: 12.5 }
  ]);
  const [extraPayment, setExtraPayment] = useState('200');
  const [results, setResults] = useState<{
    snowball?: {
      totalTime: number;
      totalInterest: number;
      payoffOrder: { name: string; months: number; }[];
    };
    avalanche?: {
      totalTime: number;
      totalInterest: number;
      payoffOrder: { name: string; months: number; }[];
    };
  }>({});

  const addDebt = () => {
    const newDebt: Debt = {
      id: Date.now().toString(),
      name: `Debt ${debts.length + 1}`,
      balance: 0,
      minPayment: 0,
      interestRate: 0
    };
    setDebts([...debts, newDebt]);
  };

  const removeDebt = (id: string) => {
    setDebts(debts.filter(debt => debt.id !== id));
  };

  const updateDebt = (id: string, field: keyof Debt, value: string | number) => {
    setDebts(debts.map(debt => 
      debt.id === id ? { ...debt, [field]: value } : debt
    ));
  };

  const calculatePayoff = () => {
    const extra = parseFloat(extraPayment) || 0;
    
    // Snowball method: Pay smallest balance first
    const snowballResult = calculateDebtStrategy([...debts], extra, 'snowball');
    
    // Avalanche method: Pay highest interest rate first
    const avalancheResult = calculateDebtStrategy([...debts], extra, 'avalanche');
    
    setResults({ snowball: snowballResult, avalanche: avalancheResult });
  };

  const calculateDebtStrategy = (debtList: Debt[], extraPayment: number, strategy: 'snowball' | 'avalanche') => {
    let totalInterest = 0;
    let month = 0;
    const payoffOrder: { name: string; months: number; }[] = [];
    
    // Sort debts based on strategy
    if (strategy === 'snowball') {
      debtList.sort((a, b) => a.balance - b.balance);
    } else {
      debtList.sort((a, b) => b.interestRate - a.interestRate);
    }
    
    while (debtList.some(debt => debt.balance > 0)) {
      month++;
      let remainingExtra = extraPayment;
      
      // Apply minimum payments and interest
      for (const debt of debtList) {
        if (debt.balance > 0) {
          const monthlyInterest = (debt.balance * (debt.interestRate / 100)) / 12;
          totalInterest += monthlyInterest;
          debt.balance += monthlyInterest;
          
          const payment = Math.min(debt.minPayment, debt.balance);
          debt.balance -= payment;
          
          if (debt.balance <= 0) {
            debt.balance = 0;
            payoffOrder.push({ name: debt.name, months: month });
          }
        }
      }
      
      // Apply extra payment to target debt
      const targetDebt = debtList.find(debt => debt.balance > 0);
      if (targetDebt && remainingExtra > 0) {
        const extraPaymentAmount = Math.min(remainingExtra, targetDebt.balance);
        targetDebt.balance -= extraPaymentAmount;
        
        if (targetDebt.balance <= 0) {
          targetDebt.balance = 0;
          if (!payoffOrder.find(p => p.name === targetDebt.name)) {
            payoffOrder.push({ name: targetDebt.name, months: month });
          }
        }
      }
      
      // Safety check to prevent infinite loops
      if (month > 600) break;
    }
    
    return {
      totalTime: month,
      totalInterest,
      payoffOrder
    };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatTime = (months: number) => {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    
    if (years === 0) {
      return `${months} months`;
    } else if (remainingMonths === 0) {
      return `${years} year${years > 1 ? 's' : ''}`;
    } else {
      return `${years} year${years > 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-red-600" />
          <CardTitle className="text-lg">Debt Payoff Visualizer</CardTitle>
        </div>
        <CardDescription>Compare snowball vs avalanche strategies to crush your debt faster!</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Debt Input Section */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Your Debts</h3>
            <Button onClick={addDebt} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Add Debt
            </Button>
          </div>
          
          <div className="space-y-3">
            {debts.map((debt) => (
              <Card key={debt.id} className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div>
                    <Label htmlFor={`name-${debt.id}`}>Debt Name</Label>
                    <Input
                      id={`name-${debt.id}`}
                      value={debt.name}
                      onChange={(e) => updateDebt(debt.id, 'name', e.target.value)}
                      placeholder="Credit Card"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`balance-${debt.id}`}>Balance (${money})</Label>
                    <Input
                      id={`balance-${debt.id}`}
                      type="number"
                      value={debt.balance || ''}
                      onChange={(e) => updateDebt(debt.id, 'balance', parseFloat(e.target.value) || 0)}
                      placeholder="5000"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`minPayment-${debt.id}`}>Min Payment (${money})</Label>
                    <Input
                      id={`minPayment-${debt.id}`}
                      type="number"
                      value={debt.minPayment || ''}
                      onChange={(e) => updateDebt(debt.id, 'minPayment', parseFloat(e.target.value) || 0)}
                      placeholder="150"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`rate-${debt.id}`}>Interest Rate (%)</Label>
                    <Input
                      id={`rate-${debt.id}`}
                      type="number"
                      value={debt.interestRate || ''}
                      onChange={(e) => updateDebt(debt.id, 'interestRate', parseFloat(e.target.value) || 0)}
                      placeholder="18.5"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <Button
                      onClick={() => removeDebt(debt.id)}
                      size="sm"
                      variant="outline"
                      disabled={debts.length <= 1}
                      className="w-full"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Extra Payment Input */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="extra-payment">
              Extra Monthly Payment ({money})
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              id="extra-payment"
              type="number"
              placeholder="200"
              value={extraPayment}
              onChange={(e) => setExtraPayment(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>
          <div className="flex items-end">
            <Button 
              onClick={calculatePayoff} 
              className="w-full bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700"
              disabled={debts.length === 0 || debts.some(d => d.balance <= 0 || d.minPayment <= 0)}
            >
              <Target className="h-4 w-4 mr-2" />
              Calculate Payoff Strategies
            </Button>
          </div>
        </div>

        {/* Results Comparison */}
        {(results.snowball || results.avalanche) && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold mb-2">Strategy Comparison</h3>
              <p className="text-muted-foreground">Choose the strategy that motivates you most!</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Snowball Method */}
              {results.snowball && (
                <Card className="border-2 border-blue-200 bg-blue-50">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                      <CardTitle className="text-lg text-blue-800">❄️ Snowball Method</CardTitle>
                    </div>
                    <CardDescription className="text-blue-700">Pay smallest balances first for quick wins</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-white rounded border">
                        <div className="text-lg font-bold text-blue-600">{formatTime(results.snowball.totalTime)}</div>
                        <div className="text-sm text-muted-foreground">Total Time</div>
                      </div>
                      <div className="text-center p-3 bg-white rounded border">
                        <div className="text-lg font-bold text-blue-600">{formatCurrency(results.snowball.totalInterest)}</div>
                        <div className="text-sm text-muted-foreground">Total Interest</div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-2">Payoff Order:</h4>
                      <div className="space-y-1">
                        {results.snowball.payoffOrder.map((debt, index) => (
                          <div key={index} className="flex justify-between text-sm p-2 bg-white rounded">
                            <span>{debt.name}</span>
                            <span className="text-muted-foreground">Month {debt.months}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="p-3 bg-blue-100 rounded border border-blue-200">
                      <p className="text-sm text-blue-800">
                        <strong>Best for:</strong> People who need motivation from quick wins and psychological momentum.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Avalanche Method */}
              {results.avalanche && (
                <Card className="border-2 border-green-200 bg-green-50">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                      <CardTitle className="text-lg text-green-800">🏔️ Avalanche Method</CardTitle>
                    </div>
                    <CardDescription className="text-green-700">Pay highest interest rates first to save money</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-white rounded border">
                        <div className="text-lg font-bold text-green-600">{formatTime(results.avalanche.totalTime)}</div>
                        <div className="text-sm text-muted-foreground">Total Time</div>
                      </div>
                      <div className="text-center p-3 bg-white rounded border">
                        <div className="text-lg font-bold text-green-600">{formatCurrency(results.avalanche.totalInterest)}</div>
                        <div className="text-sm text-muted-foreground">Total Interest</div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-2">Payoff Order:</h4>
                      <div className="space-y-1">
                        {results.avalanche.payoffOrder.map((debt, index) => (
                          <div key={index} className="flex justify-between text-sm p-2 bg-white rounded">
                            <span>{debt.name}</span>
                            <span className="text-muted-foreground">Month {debt.months}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="p-3 bg-green-100 rounded border border-green-200">
                      <p className="text-sm text-green-800">
                        <strong>Best for:</strong> People focused on minimizing total interest paid and mathematical optimization.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            
            {/* Savings Comparison */}
            {results.snowball && results.avalanche && (
              <Card className="border-2 border-yellow-200 bg-yellow-50">
                <CardContent className="p-4">
                  <div className="text-center">
                    <h4 className="font-semibold mb-2 text-yellow-800">💡 The Winner</h4>
                    {results.avalanche.totalInterest < results.snowball.totalInterest ? (
                      <p className="text-sm text-yellow-700">
                        <strong>Avalanche method saves you {formatCurrency(results.snowball.totalInterest - results.avalanche.totalInterest)}</strong> in interest compared to snowball!
                      </p>
                    ) : results.snowball.totalInterest < results.avalanche.totalInterest ? (
                      <p className="text-sm text-yellow-700">
                        <strong>Snowball method saves you {formatCurrency(results.avalanche.totalInterest - results.snowball.totalInterest)}</strong> in interest compared to avalanche!
                      </p>
                    ) : (
                      <p className="text-sm text-yellow-700">
                        <strong>Both methods cost the same in interest.</strong> Choose based on your motivation style!
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            
            <div className="p-4 bg-blue-50 rounded border border-blue-200">
              <p className="text-sm text-blue-800">
                💡 <strong>Pro tip:</strong> Want to automate your debt payments and track progress in real-time? 
                <span className="underline cursor-pointer text-blue-600">Sign up for free</span> to set up automatic payments and get motivational reminders!
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function Calculator({ calculator }: CalculatorProps) {
  const { t, i18n } = useTranslation();
  const money = symbolForLanguage(i18n.language);
  const [values, setValues] = useState<Record<string, number>>({});
  const [results, setResults] = useState<{
    total?: number;
    cashFlow?: number;
    status?: string;
    message?: string;
  }>({});

  // If no calculator provided, don't render anything
  if (!calculator) {
    return null;
  }

  const handleInputChange = (fieldId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setValues(prev => ({ ...prev, [fieldId]: numValue }));
  };

  const calculateResults = () => {
    switch (calculator.type) {
      case 'income': {
        const total = Object.values(values).reduce((sum, val) => sum + (val || 0), 0);
        setResults({
          total,
          message: `Your total monthly income is ${money}${total.toLocaleString()}. ${
            total >= 5000 ? 'Great income diversification!' : 
            total >= 3000 ? 'Good foundation - consider adding income sources.' :
            'Consider exploring additional income streams.'
          }`
        });
        break;
      }
      case 'expense': {
        const total = Object.values(values).reduce((sum, val) => sum + (val || 0), 0);
        const essentials = (values.housing || 0) + (values.utilities || 0) + (values.phone || 0) + (values.insurance || 0) + (values.groceries || 0) + (values.transportation || 0);
        const nonEssentials = total - essentials;
        setResults({
          total,
          message: `Total monthly expenses: ${money}${total.toLocaleString()}. Essentials: ${money}${essentials.toLocaleString()} (${Math.round((essentials/total)*100)}%), Non-essentials: ${money}${nonEssentials.toLocaleString()} (${Math.round((nonEssentials/total)*100)}%)`
        });
        break;
      }
      case 'cashflow': {
        const income = values.total_income || 0;
        const fixedExpenses = values.fixed_expenses || 0;
        const variableExpenses = values.variable_expenses || 0;
        const totalExpenses = fixedExpenses + variableExpenses;
        const cashFlow = income - totalExpenses;
        
        let status = '';
        let message = '';
        
        if (cashFlow > 0) {
          status = 'positive';
          message = `Excellent! You have ${money}${cashFlow.toLocaleString()} positive cash flow monthly. That's ${money}${(cashFlow * 12).toLocaleString()} per year for savings and goals!`;
        } else if (cashFlow === 0) {
          status = 'neutral';
          message = 'You\'re breaking even. Consider reducing variable expenses to create positive cash flow for savings.';
        } else {
          status = 'negative';
          message = `Warning: Negative cash flow of ${money}${Math.abs(cashFlow).toLocaleString()} monthly. Focus on increasing income or reducing expenses.`;
        }
        
        setResults({ cashFlow, status, message });
        break;
      }
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'positive': return 'text-green-600';
      case 'negative': return 'text-red-600';
      default: return 'text-yellow-600';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'positive': return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'negative': return <TrendingDown className="h-5 w-5 text-red-600" />;
      default: return <DollarSign className="h-5 w-5 text-yellow-600" />;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalculatorIcon className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-lg">{calculator?.title || 'Calculator'}</CardTitle>
        </div>
        <CardDescription>{calculator?.description || 'Interactive calculator'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {calculator?.fields?.map((field: any) => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.id}>
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Input
                id={field.id}
                type="number"
                placeholder={field.placeholder}
                value={values[field.id] || ''}
                onChange={(e) => handleInputChange(field.id, e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
          ))}
        </div>

        {/* Calculate Button */}
        <Button 
          onClick={calculateResults} 
          className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
          disabled={!Object.values(values).some(val => val > 0)}
        >
          <CalculatorIcon className="h-4 w-4 mr-2" />
          Calculate
        </Button>

        {/* Results */}
        {(results.total !== undefined || results.cashFlow !== undefined) && (
          <Card className="mt-4 border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                {getStatusIcon(results.status)}
                <h4 className="font-semibold">Results:</h4>
              </div>
              
              {results.total !== undefined && (
                <div className="text-2xl font-bold text-blue-600 mb-2">
                  ${results.total.toLocaleString()}
                </div>
              )}
              
              {results.cashFlow !== undefined && (
                <div className={`text-2xl font-bold mb-2 ${getStatusColor(results.status)}`}>
                  {results.cashFlow >= 0 ? '+' : ''}${results.cashFlow.toLocaleString()}
                  <span className="text-sm font-normal ml-2">monthly cash flow</span>
                </div>
              )}
              
              {results.message && (
                <p className="text-muted-foreground text-sm">{results.message}</p>
              )}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}