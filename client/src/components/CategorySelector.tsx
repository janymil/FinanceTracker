import React, { useState, useEffect } from 'react';
import { Check, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import { getIconEmoji } from '@/lib/iconUtils';

interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense';
  icon: string;
}

interface CategorySelectorProps {
  selectedCategoryId: number | null;
  suggestedCategory: string;
  transactionType: 'income' | 'expense';
  categories: Category[];
  onCategoryChange: (categoryId: number | null, categoryName: string) => void;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedCategoryId,
  suggestedCategory,
  transactionType,
  categories,
  onCategoryChange
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [newCategoryName, setNewCategoryName] = useState('');

  // Safety check for categories prop
  const safeCategories = categories || [];
  const filteredCategories = safeCategories.filter(cat => cat.type === transactionType);
  const hasExistingMatch = filteredCategories.some(cat => 
    cat.name.toLowerCase() === suggestedCategory.toLowerCase()
  );

  useEffect(() => {
    if (suggestedCategory) {
      if (hasExistingMatch) {
        // AI found existing category - use it
        const matchedCategory = filteredCategories.find(cat => 
          cat.name.toLowerCase() === suggestedCategory.toLowerCase()
        );
        if (matchedCategory) {
          onCategoryChange(matchedCategory.id, matchedCategory.name);
          setMode('existing');
        }
      } else {
        // AI suggested new category - prepare for creation
        setNewCategoryName(suggestedCategory);
        setMode('new');
        onCategoryChange(null, suggestedCategory);
      }
    }
  }, [suggestedCategory, hasExistingMatch, filteredCategories, onCategoryChange]);

  const handleExistingCategoryChange = (value: string) => {
    const categoryId = parseInt(value);
    const category = safeCategories.find(c => c.id === categoryId);
    if (category) {
      onCategoryChange(categoryId, category.name);
      setMode('existing');
    }
  };

  const handleNewCategoryChange = (name: string) => {
    setNewCategoryName(name);
    onCategoryChange(null, name);
  };

  const switchToNewCategory = () => {
    setMode('new');
    setNewCategoryName(suggestedCategory || '');
    onCategoryChange(null, suggestedCategory || '');
  };

  const switchToExistingCategory = () => {
    setMode('existing');
    onCategoryChange(null, '');
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">
        {t('dashboard.category')}
      </Label>

      {/* AI Suggestion Banner */}
      {suggestedCategory && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-blue-900 dark:text-blue-100">
                AI suggests: "{suggestedCategory}"
              </span>
              {hasExistingMatch ? (
                <Badge variant="secondary" className="ml-auto">
                  <Check className="h-3 w-3 mr-1" />
                  Existing Category
                </Badge>
              ) : (
                <Badge variant="outline" className="ml-auto">
                  <Plus className="h-3 w-3 mr-1" />
                  New Category
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mode Toggle Buttons */}
      {filteredCategories.length > 0 && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === 'existing' ? 'default' : 'outline'}
            size="sm"
            onClick={switchToExistingCategory}
            disabled={filteredCategories.length === 0}
          >
            Use Existing
          </Button>
          <Button
            type="button"
            variant={mode === 'new' ? 'default' : 'outline'}
            size="sm"
            onClick={switchToNewCategory}
          >
            Create New
          </Button>
        </div>
      )}
      
      {/* If no existing categories, show create new button only */}
      {filteredCategories.length === 0 && (
        <div className="text-center">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={switchToNewCategory}
            className="w-full"
          >
            Create New Category
          </Button>
        </div>
      )}

      {/* Existing Category Selector */}
      {mode === 'existing' && filteredCategories.length > 0 && (
        <Select
          value={selectedCategoryId ? selectedCategoryId.toString() : ''}
          onValueChange={handleExistingCategoryChange}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('dashboard.select_category')} />
          </SelectTrigger>
          <SelectContent>
            {filteredCategories.map((category) => (
              <SelectItem key={category.id} value={category.id.toString()}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getIconEmoji(category.icon)}</span>
                  {category.name}
                  {category.name.toLowerCase() === suggestedCategory.toLowerCase() && (
                    <Badge variant="secondary" className="ml-2">
                      <Sparkles className="h-3 w-3 mr-1" />
                      AI Match
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* New Category Input */}
      {mode === 'new' && (
        <div className="space-y-2">
          <Input
            type="text"
            value={newCategoryName}
            onChange={(e) => handleNewCategoryChange(e.target.value)}
            placeholder={t('dashboard.enter_category_name')}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            This will create a new category for future transactions
          </p>
        </div>
      )}
    </div>
  );
};