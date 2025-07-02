import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calculator as CalculatorIcon, TrendingUp, TrendingDown, DollarSign, Trash2, Plus, Target, Zap } from 'lucide-react';
import { Calculator as CalculatorType } from '@/data/courseContent';

interface CalculatorProps {
  calculator?: CalculatorType;
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
      setResults({ message: 'Please enter valid amounts for income and desired purchase.' });
      return;
    }

    const availableCash = monthlyIncome - monthlyExpenses;
    const canAfford = availableCash >= purchaseAmount;
    const monthsToSave = canAfford ? 0 : Math.ceil(purchaseAmount / Math.max(availableCash, 1));
    const affordabilityScore = Math.min(100, Math.max(0, (availableCash / purchaseAmount) * 100));
    const suggestedSavings = Math.max(0, purchaseAmount - availableCash);

    let message = '';
    if (canAfford) {
      message = `✅ Great news! You can afford this purchase. You'll have $${(availableCash - purchaseAmount).toFixed(2)} left over this month.`;
    } else if (availableCash > 0) {
      message = `💡 You'll need to save for ${monthsToSave} months. Consider setting aside $${(purchaseAmount / monthsToSave).toFixed(2)} monthly to reach your goal.`;
    } else {
      message = `⚠️ Your expenses exceed your income. Focus on reducing expenses or increasing income before making this purchase.`;
    }

    setResults({ canAfford, monthsToSave, suggestedSavings, affordabilityScore, message });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalculatorIcon className="h-5 w-5 text-green-600" />
          <CardTitle className="text-lg">Expense Estimation Calculator</CardTitle>
        </div>
        <CardDescription>Quick "Can I afford this?" analysis - no account required!</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="monthly-income">
              Monthly Income
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
              Monthly Expenses
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
              Desired Purchase
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
          Can I Afford This?
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
                <h4 className="font-semibold">Affordability Analysis:</h4>
              </div>
              
              {results.affordabilityScore !== undefined && (
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Affordability Score</span>
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
                    💡 <strong>Pro tip:</strong> Want to track your actual spending and optimize your budget? 
                    <span className="underline cursor-pointer text-blue-600">Sign up for free</span> to see where your money really goes!
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

export function Calculator({ calculator }: CalculatorProps) {
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
          message: `Your total monthly income is $${total.toLocaleString()}. ${
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
          message: `Total monthly expenses: $${total.toLocaleString()}. Essentials: $${essentials.toLocaleString()} (${Math.round((essentials/total)*100)}%), Non-essentials: $${nonEssentials.toLocaleString()} (${Math.round((nonEssentials/total)*100)}%)`
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
          message = `Excellent! You have $${cashFlow.toLocaleString()} positive cash flow monthly. That's $${(cashFlow * 12).toLocaleString()} per year for savings and goals!`;
        } else if (cashFlow === 0) {
          status = 'neutral';
          message = 'You\'re breaking even. Consider reducing variable expenses to create positive cash flow for savings.';
        } else {
          status = 'negative';
          message = `Warning: Negative cash flow of $${Math.abs(cashFlow).toLocaleString()} monthly. Focus on increasing income or reducing expenses.`;
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
          {calculator?.fields?.map((field) => (
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