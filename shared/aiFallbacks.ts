/**
 * Language safety for AI output.
 *
 * The prompts already say "respond only in Slovak/Spanish", and the model normally obeys.
 * What it cannot obey is a *hardcoded* fallback: when generation failed, the app used to
 * answer with English text ("Track Your Expenses") inside a Slovak screen. Those fallbacks
 * now exist in all three languages, and anything the model returns in the wrong language is
 * replaced instead of shown.
 */
export type SimpleLanguage = 'sk' | 'en' | 'es';

const MARKERS: Record<SimpleLanguage, string[]> = {
  sk: [' a ', ' je ', ' sa ', ' na ', ' že ', ' pre ', ' vaše', ' tvoje', 'výdav', 'príjm', 'ktor', 'môž', 'peniaz', 'úspor', 'mesiac', 'rozpoč', 'sleduj'],
  es: [' el ', ' la ', ' los ', ' las ', ' de ', ' que ', ' para ', ' tus ', ' gastos', ' puedes', ' dinero', ' progres', ' presupuesto', ' ahorr'],
  en: [' the ', ' your ', ' and ', ' to ', ' of ', ' you ', ' with ', ' this ', ' that ', ' expenses', ' money', ' track', ' budget', ' spending'],
};

/** Very small heuristic: enough to catch "English text in a Slovak card", not a detector. */
export function detectLanguage(text: string | undefined | null): SimpleLanguage | null {
  if (!text) return null;
  const padded = ` ${String(text).toLowerCase().replace(/\s+/g, ' ')} `;

  let best: SimpleLanguage | null = null;
  let bestScore = 0;

  (Object.keys(MARKERS) as SimpleLanguage[]).forEach((language) => {
    const score = MARKERS[language].reduce(
      (total, marker) => total + (padded.includes(marker) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      best = language;
      bestScore = score;
    }
  });

  return bestScore > 0 ? best : null;
}

/** Normalises `sk-sk`, `es-PE`, `en-us` … to the three languages the app ships. */
export function simpleLanguage(language: string | undefined | null): SimpleLanguage {
  const value = String(language ?? '').toLowerCase();
  if (value.startsWith('sk')) return 'sk';
  if (value.startsWith('es')) return 'es';
  return 'en';
}

/**
 * True when the text is in the requested language (or too short/neutral to tell).
 * Used as an acceptance gate for AI output, not to translate anything.
 */
export function isTextInLanguage(text: string, language: string): boolean {
  const target = simpleLanguage(language);
  const detected = detectLanguage(text);
  if (!detected) return true;
  return detected === target;
}

export interface FallbackTip {
  title: string;
  description: string;
  category: 'budgeting' | 'spending';
  priority: 'high' | 'medium';
  actionable: boolean;
}

const TIPS_FALLBACK: Record<SimpleLanguage, FallbackTip> = {
  en: {
    title: 'Track Your Expenses',
    description: 'Start by categorizing all your expenses to understand where your money goes each month.',
    category: 'budgeting',
    priority: 'high',
    actionable: true,
  },
  sk: {
    title: 'Sledujte svoje výdavky',
    description: 'Začnite kategorizovaním všetkých výdavkov, aby ste videli, kam každý mesiac idú vaše peniaze.',
    category: 'budgeting',
    priority: 'high',
    actionable: true,
  },
  es: {
    title: 'Registra tus gastos',
    description: 'Empieza categorizando todos tus gastos para entender a dónde va tu dinero cada mes.',
    category: 'budgeting',
    priority: 'high',
    actionable: true,
  },
};

const PROGRESS_FALLBACK: Record<SimpleLanguage, FallbackTip> = {
  en: {
    title: 'Track Your Progress',
    description: 'Continue monitoring your transactions to identify spending patterns and opportunities to save.',
    category: 'budgeting',
    priority: 'medium',
    actionable: true,
  },
  sk: {
    title: 'Sledujte svoj pokrok',
    description: 'Pokračujte v sledovaní transakcií, aby ste odhalili vzorce výdavkov a možnosti, kde ušetriť.',
    category: 'budgeting',
    priority: 'medium',
    actionable: true,
  },
  es: {
    title: 'Sigue tu progreso',
    description: 'Continúa registrando tus movimientos para identificar patrones de gasto y oportunidades de ahorro.',
    category: 'budgeting',
    priority: 'medium',
    actionable: true,
  },
};

export function financialTipsFallback(language: string): FallbackTip {
  return { ...TIPS_FALLBACK[simpleLanguage(language)] };
}

export function progressTipFallback(language: string): FallbackTip {
  return { ...PROGRESS_FALLBACK[simpleLanguage(language)] };
}

/** Shown when there is no data yet (not when generation failed): trend forecast and first tip. */
export interface EmptyStateCopy {
  forecastInsight: string;
  forecastTitle: string;
  forecastDescription: string;
  firstTipTitle: string;
  firstTipDescription: string;
}

const EMPTY_STATE: Record<SimpleLanguage, EmptyStateCopy> = {
  en: {
    forecastInsight: 'Add transactions to generate AI-powered financial forecasts',
    forecastTitle: 'Start tracking your expenses',
    forecastDescription: 'Add transactions to receive personalized predictions',
    firstTipTitle: 'Start Your Financial Journey',
    firstTipDescription: 'Begin by tracking your income and expenses to get personalized financial insights.',
  },
  es: {
    forecastInsight: 'Agrega movimientos para generar previsiones financieras con IA',
    forecastTitle: 'Empieza a registrar tus gastos',
    forecastDescription: 'Agrega movimientos para recibir predicciones personalizadas',
    firstTipTitle: 'Empieza tu camino financiero',
    firstTipDescription: 'Empieza registrando tus ingresos y gastos para recibir información financiera personalizada.',
  },
  sk: {
    forecastInsight: 'Pridajte transakcie, aby sa mohli vytvoriť finančné predpovede s AI',
    forecastTitle: 'Začnite sledovať svoje výdavky',
    forecastDescription: 'Pridajte transakcie a získate personalizované predpovede',
    firstTipTitle: 'Začnite svoju finančnú cestu',
    firstTipDescription: 'Začnite sledovaním príjmov a výdavkov, aby ste dostali personalizované finančné poznatky.',
  },
};

export function emptyStateCopy(language: string): EmptyStateCopy {
  return { ...EMPTY_STATE[simpleLanguage(language)] };
}

/** Words for the computed health score when the model could not be reached. */
export interface HealthFallbackCopy {
  unavailable: string;
  positiveBalance: string;
  expensesExceedIncome: string;
}

const HEALTH_FALLBACK: Record<SimpleLanguage, HealthFallbackCopy> = {
  en: {
    unavailable: 'Detailed analysis is temporarily unavailable',
    positiveBalance: 'Positive net balance',
    expensesExceedIncome: 'Expenses exceed income',
  },
  es: {
    unavailable: 'El análisis detallado no está disponible por ahora',
    positiveBalance: 'Balance neto positivo',
    expensesExceedIncome: 'Los gastos superan los ingresos',
  },
  sk: {
    unavailable: 'Podrobná analýza momentálne nie je dostupná',
    positiveBalance: 'Kladný čistý zostatok',
    expensesExceedIncome: 'Výdavky prevyšujú príjmy',
  },
};

export function healthFallbackCopy(language: string): HealthFallbackCopy {
  return { ...HEALTH_FALLBACK[simpleLanguage(language)] };
}

/**
 * Rule-based tips for when the model could not be reached. They only depend on three numbers,
 * so they are written out in all three languages instead of being translated by a model.
 */
export interface ContextualFallbackTip {
  id: string;
  title: string;
  description: string;
  category: 'spending' | 'saving' | 'budgeting' | 'income';
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
}

type FallbackKey = 'budget' | 'savings' | 'spending' | 'tracking' | 'general';

const CONTEXTUAL_FALLBACK: Record<SimpleLanguage, Record<FallbackKey, { title: string; description: string }>> = {
  en: {
    budget: { title: 'Create Your First Budget', description: 'Set spending limits for your expense categories to better control your finances.' },
    savings: { title: 'Great Job on Positive Cash Flow!', description: 'You have a positive balance this month. Consider setting aside some money for savings or an emergency fund.' },
    spending: { title: 'Review Your Spending', description: 'Your expenses exceed your income this month. Look for areas where you can reduce costs.' },
    tracking: { title: 'Start Tracking Your Expenses', description: 'Begin by recording your daily expenses to get a clear picture of your spending habits.' },
    general: { title: 'Keep Track of Your Finances', description: 'Regular monitoring of your income and expenses helps maintain financial health.' },
  },
  es: {
    budget: { title: 'Crea tu primer presupuesto', description: 'Define límites de gasto para tus categorías y controla mejor tus finanzas.' },
    savings: { title: '¡Buen trabajo con tu flujo de caja positivo!', description: 'Tienes un saldo positivo este mes. Considera apartar algo de dinero para ahorrar o para un fondo de emergencia.' },
    spending: { title: 'Revisa tus gastos', description: 'Tus gastos superan tus ingresos este mes. Busca dónde puedes reducir costos.' },
    tracking: { title: 'Empieza a registrar tus gastos', description: 'Comienza anotando tus gastos diarios para ver con claridad tus hábitos de gasto.' },
    general: { title: 'Mantén el control de tus finanzas', description: 'Revisar con regularidad tus ingresos y gastos ayuda a mantener unas finanzas sanas.' },
  },
  sk: {
    budget: { title: 'Vytvorte svoj prvý rozpočet', description: 'Nastavte limity výdavkov pre svoje kategórie a lepšie ovládajte svoje financie.' },
    savings: { title: 'Skvelá práca s kladným cash flow!', description: 'Tento mesiac máte kladný zostatok. Zvážte odloženie časti peňazí na úspory alebo núdzovú rezervu.' },
    spending: { title: 'Skontrolujte svoje výdavky', description: 'Vaše výdavky tento mesiac prevyšujú príjmy. Poobzerajte sa, kde môžete znížiť náklady.' },
    tracking: { title: 'Začnite sledovať svoje výdavky', description: 'Začnite zapisovaním denných výdavkov, aby ste jasne videli svoje výdavkové návyky.' },
    general: { title: 'Majte svoje financie pod kontrolou', description: 'Pravidelné sledovanie príjmov a výdavkov pomáha udržať zdravé financie.' },
  },
};

export function contextualFallbackTips(
  language: string,
  facts: { totalIncome?: number; totalExpenses?: number; transactionCount?: number; budgetCount?: number },
): ContextualFallbackTip[] {
  const copy = CONTEXTUAL_FALLBACK[simpleLanguage(language)];
  const income = Number(facts.totalIncome) || 0;
  const expenses = Number(facts.totalExpenses) || 0;
  const net = income - expenses;
  const tips: ContextualFallbackTip[] = [];
  const add = (key: FallbackKey, category: ContextualFallbackTip['category'], priority: ContextualFallbackTip['priority']) =>
    tips.push({ id: `fallback_${key}`, ...copy[key], category, priority, actionable: true });

  if (expenses > 0 && !facts.budgetCount) add('budget', 'budgeting', 'high');
  if (net > 0) add('savings', 'saving', 'medium');
  else if (net < 0) add('spending', 'spending', 'high');
  if (!facts.transactionCount) add('tracking', 'budgeting', 'high');
  if (tips.length === 0) add('general', 'budgeting', 'medium');
  return tips;
}
