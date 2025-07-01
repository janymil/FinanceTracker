import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calculator as CalculatorIcon, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { Calculator as CalculatorType } from '@/data/courseContent';

interface CalculatorProps {
  calculator?: CalculatorType;
}

export function Calculator({ calculator }: CalculatorProps) {
  const [values, setValues] = useState<Record<string, number>>({});
  const [results, setResults] = useState<{
    total?: number;
    cashFlow?: number;
    status?: string;
    message?: string;
  }>({});

  // If no calculator provided, render a placeholder
  if (!calculator) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalculatorIcon className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">Calculator</CardTitle>
          </div>
          <CardDescription>Interactive tools will appear here as you progress through the lesson.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <CalculatorIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">Complete the lesson content to unlock interactive calculators!</p>
          </div>
        </CardContent>
      </Card>
    );
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