// Type for translation function
type TFunction = (key: string) => string;

export interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: string;
  userId: string | null;
  translationKey: string | null;
}

/**
 * Get localized category name using translation key approach
 * @param categoryName - The original category name
 * @param categories - Array of all categories from the database
 * @param t - Translation function from react-i18next
 * @returns Localized category name or original name if no translation available
 */
export function getLocalizedCategoryName(
  categoryName: string,
  categories: Category[] | undefined,
  t: TFunction
): string {
  if (!categories) return categoryName;
  
  const category = categories.find((cat) => cat.name === categoryName);
  if (!category || !category.translationKey) {
    // Custom category or no translation key, keep original name
    return categoryName;
  }
  
  // Predefined category with translation key, translate it
  return t(category.translationKey) || categoryName;
}

/**
 * Check if a category is predefined (system category)
 * @param categoryName - The category name to check
 * @param categories - Array of all categories from the database
 * @returns True if category is predefined (has translationKey), false if custom
 */
export function isPredefinedCategory(
  categoryName: string,
  categories: Category[] | undefined
): boolean {
  if (!categories) return false;
  
  const category = categories.find((cat) => cat.name === categoryName);
  return category ? !!category.translationKey : false;
}