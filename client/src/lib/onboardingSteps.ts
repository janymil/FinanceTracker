/**
 * First steps for a new account. They depend on the plan: budgets and goals are Standard/Premium
 * features and statement import is Premium-only, so a free account must not be asked to do things
 * that answer "upgrade". Every step is ticked from the person's real data.
 */

export type OnboardingStepKey = 'transaction' | 'income' | 'budget' | 'goal' | 'import' | 'upgrade';

export interface OnboardingStep {
  key: OnboardingStepKey;
  done: boolean;
  href: string;
}

export interface OnboardingInput {
  plan: string | null | undefined;
  lang: string;
  transactionsCount: number;
  incomeCount: number;
  budgetsCount: number;
  goalsCount: number;
  importsCount: number;
}

export function onboardingSteps(input: OnboardingInput): { steps: OnboardingStep[]; coreCount: number } {
  const { lang } = input;
  const plan = input.plan === 'standard' || input.plan === 'premium' ? input.plan : 'free';

  if (plan === 'free') {
    return {
      coreCount: 2,
      steps: [
        { key: 'transaction', done: input.transactionsCount > 0, href: `/${lang}/expenses` },
        { key: 'income', done: input.incomeCount > 0, href: `/${lang}/income` },
        { key: 'upgrade', done: false, href: `/${lang}/pricing` },
      ],
    };
  }

  const steps: OnboardingStep[] = [
    { key: 'transaction', done: input.transactionsCount > 0, href: `/${lang}/expenses` },
    { key: 'budget', done: input.budgetsCount > 0, href: `/${lang}/budget` },
    { key: 'goal', done: input.goalsCount > 0, href: `/${lang}/goals` },
  ];
  if (plan === 'premium') {
    steps.push({ key: 'import', done: input.importsCount > 0, href: `/${lang}/export` });
  }
  return { steps, coreCount: 3 };
}
