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
