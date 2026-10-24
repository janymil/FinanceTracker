/**
 * Background auto-categorisation of a just-saved expense (Premium).
 *
 * Kept out of the route so the rules can be tested without a server:
 *  - the same gate as every AI feature (`checkAiAccess`): the account off-switch stops it,
 *  - the model is shown the person's own categories and may only pick one of them,
 *  - low confidence or a failed answer changes nothing.
 */
import { checkAiAccess, type AiAccess } from './aiAccess';
import { storage } from './storage';
import { categorizeExpenseWithUserCategories, type UserCategoryChoice } from './openai';

/** Below this the suggestion is left for the person to confirm instead of being applied. */
export const AUTO_APPLY_CONFIDENCE = 0.7;

export interface AutoCategorizeTransaction {
  id: number;
  description: string;
  amount: string;
  type: string;
  categoryId?: number | null;
}

export interface AutoCategorizeDeps {
  checkAccess(userId: string): Promise<AiAccess | null>;
  getCategories(userId: string): Promise<Array<{ id: number; name: string; type: string }>>;
  categorize(
    description: string,
    amount: number,
    categories: Array<{ id: number; name: string; type: string }>,
    language: string,
  ): Promise<UserCategoryChoice>;
  applyCategory(transactionId: number, userId: string, categoryId: number): Promise<void>;
}

const defaultDeps: AutoCategorizeDeps = {
  checkAccess: (userId) => checkAiAccess(userId),
  getCategories: (userId) => storage.getCategories(userId) as any,
  categorize: categorizeExpenseWithUserCategories,
  // userId is required by storage.updateTransaction's ownership guard
  applyCategory: async (transactionId, userId, categoryId) => {
    await storage.updateTransaction(transactionId, { categoryId, userId } as any);
  },
};

export type AutoCategorizeOutcome =
  | { applied: true; categoryId: number; confidence: number }
  | { applied: false; reason: 'not-eligible' | 'ai-denied' | 'no-categories' | 'no-answer' | 'low-confidence' };

export async function autoCategorizeTransaction(
  transaction: AutoCategorizeTransaction,
  userId: string,
  language: string,
  deps: AutoCategorizeDeps = defaultDeps,
): Promise<AutoCategorizeOutcome> {
  if (transaction.type !== 'expense' || transaction.categoryId) {
    return { applied: false, reason: 'not-eligible' };
  }

  // Premium only, and only while the account's AI switch is on.
  const access = await deps.checkAccess(userId);
  if (!access || !access.allowed || access.plan !== 'premium') {
    return { applied: false, reason: access && !access.allowed ? 'ai-denied' : 'not-eligible' };
  }

  const categories = (await deps.getCategories(userId)).filter((category) => category.type !== 'income');
  if (categories.length === 0) return { applied: false, reason: 'no-categories' };

  const choice = await deps.categorize(
    transaction.description,
    parseFloat(transaction.amount),
    categories.map(({ id, name, type }) => ({ id, name, type })),
    language,
  );

  if (choice.failed || choice.categoryId === undefined) {
    return { applied: false, reason: 'no-answer' };
  }
  if (choice.confidence < AUTO_APPLY_CONFIDENCE) {
    return { applied: false, reason: 'low-confidence' };
  }

  await deps.applyCategory(transaction.id, userId, choice.categoryId);
  return { applied: true, categoryId: choice.categoryId, confidence: choice.confidence };
}
