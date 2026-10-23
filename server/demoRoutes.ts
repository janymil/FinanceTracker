import { Router } from 'express';
import { normalizeLanguageCode } from '../lib/languageUtils.js';

const router = Router();

// Narration was generated with ElevenLabs (paid per character). It is retired:
// the marketing videos ship with recorded audio, so there is no reason to expose a
// public endpoint that spends money. Kept as an explicit 410 instead of deleting the
// path silently, so an old page/script fails loudly and visibly.
router.post('/generate-narration', (_req, res) => {
  res.status(410).json({
    error: 'Narration is disabled. Demo audio ships as static files.',
  });
});

// Get demo script for a specific feature and language
router.get('/script/:featureId/:language', (req, res) => {
  const { featureId, language: rawLanguage } = req.params;
  const language = normalizeLanguageCode(rawLanguage);

  const scripts = getDemoScripts();
  const featureScript = scripts[featureId as keyof typeof scripts];

  if (!featureScript) {
    return res.status(404).json({ error: 'Feature script not found' });
  }

  const script = featureScript[language];
  if (!script) {
    return res.status(404).json({ error: 'Script not available in this language' });
  }

  res.json({ script, language, featureId });
});

// Get all available demo features
router.get('/features', (req, res) => {
  const features = [
    {
      id: 'categorization',
      title: 'AI Transaction Categorization',
      description: 'Automatic categorization with 95% accuracy',
      duration: 45, // seconds
      steps: 4
    },
    {
      id: 'tips',
      title: 'AI Financial Analysis',
      description: '4-section detailed financial insights',
      duration: 60,
      steps: 3
    },
    {
      id: 'health',
      title: 'Financial Health Score',
      description: 'Comprehensive health analysis (0-100)',
      duration: 30,
      steps: 2
    },
    {
      id: 'statements',
      title: 'AI Bank Statement Parser',
      description: 'Extract transactions from PDFs',
      duration: 40,
      steps: 3
    },
    {
      id: 'insights',
      title: 'Intelligent Spending Insights',
      description: 'Anomaly detection and optimization tips',
      duration: 35,
      steps: 3
    },
    {
      id: 'predictions',
      title: 'Expense Predictions',
      description: 'Forecast future spending patterns',
      duration: 50,
      steps: 4
    }
  ];

  res.json(features);
});

// Serve demo assets (thumbnails, videos, etc.)
router.get('/assets/:filename', (req, res) => {
  const { filename } = req.params;
  
  // For now, return placeholder thumbnails
  // In production, these would be actual screenshot images
  const placeholderSvg = `
    <svg width="400" height="225" viewBox="0 0 400 225" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#3B82F6;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#8B5CF6;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="400" height="225" fill="url(#grad)"/>
      <text x="200" y="112" text-anchor="middle" fill="white" font-family="Arial" font-size="16" font-weight="bold">
        ${filename.replace(/\.[^/.]+$/, "").replace(/-/g, ' ').toUpperCase()}
      </text>
    </svg>
  `;

  res.set('Content-Type', 'image/svg+xml');
  res.send(placeholderSvg);
});

// Get demo analytics data (for realistic examples in demos)
router.get('/sample-data/:type', (req, res) => {
  const { type } = req.params;
  
  const sampleData = {
    transactions: [
      { merchant: 'Starbucks Coffee', amount: 4.85, category: 'Food & Dining', confidence: 0.95 },
      { merchant: 'Office Depot', amount: 127.50, category: 'Business Supplies', confidence: 0.92 },
      { merchant: 'Shell Gas Station', amount: 45.20, category: 'Transportation', confidence: 0.98 },
      { merchant: 'Amazon.com', amount: 89.99, category: 'Shopping', confidence: 0.87 }
    ],
    health_factors: {
      score: 78,
      factors: [
        { name: 'Savings Rate', score: 85, impact: 'positive' },
        { name: 'Expense Consistency', score: 72, impact: 'neutral' },
        { name: 'Budget Adherence', score: 68, impact: 'needs_improvement' },
        { name: 'Income Stability', score: 92, impact: 'positive' }
      ]
    },
    spending_insights: [
      { category: 'Food & Dining', trend: '+15%', alert: 'Higher than usual spending' },
      { category: 'Transportation', trend: '-8%', alert: 'Optimization opportunity detected' },
      { category: 'Utilities', trend: 'stable', alert: 'Consistent with budget' }
    ]
  };

  const data = sampleData[type as keyof typeof sampleData];
  if (!data) {
    return res.status(404).json({ error: 'Sample data type not found' });
  }

  res.json(data);
});

function getDemoScripts() {
  return {
    categorization: {
      'en-us': {
        intro: 'Watch how Kaptia\'s AI automatically categorizes your expenses with 95% accuracy. No manual sorting required.',
        upload: 'Simply upload any receipt or enter transaction details. Our OCR technology instantly reads the receipt.',
        analysis: 'AI analyzes the merchant name, amount, and your spending patterns to suggest the perfect category.',
        result: 'The transaction is categorized with confidence scoring and saved to your financial records automatically.'
      },
      'es-pe': {
        intro: 'Observa cómo la IA de Kaptia categoriza automáticamente tus gastos con 95% de precisión. No se requiere ordenamiento manual.',
        upload: 'Simplemente sube cualquier recibo o ingresa detalles de transacción. Nuestra tecnología OCR lee instantáneamente el recibo.',
        analysis: 'La IA analiza el nombre del comerciante, cantidad y tus patrones de gasto para sugerir la categoría perfecta.',
        result: 'La transacción se categoriza con puntuación de confianza y se guarda automáticamente en tus registros financieros.'
      },
      'sk-sk': {
        intro: 'Sledujte ako AI Kaptia automaticky kategorizuje vaše výdavky s 95% presnosťou. Nie je potrebné manuálne triedenie.',
        upload: 'Jednoducho nahrajte akýkoľvek účet alebo zadajte detaily transakcie. Naša OCR technológia okamžite prečíta účet.',
        analysis: 'AI analyzuje názov obchodníka, sumu a vaše vzorce výdavkov na navrhnutie perfektnej kategórie.',
        result: 'Transakcia sa kategorizuje s hodnotením spoľahlivosti a automaticky sa uloží do vašich finančných záznamov.'
      }
    },
    tips: {
      'en-us': {
        intro: 'Experience AI Financial Analysis - your personal financial advisor powered by advanced artificial intelligence.',
        analysis: 'AI analyzes your spending patterns, identifies optimization opportunities, and provides actionable recommendations.',
        insights: 'Get detailed insights across four key areas: spending patterns, saving strategies, budget optimization, and advanced forecasting.'
      },
      'es-pe': {
        intro: 'Experimenta el Análisis Financiero IA - tu asesor financiero personal potenciado por inteligencia artificial avanzada.',
        analysis: 'La IA analiza tus patrones de gasto, identifica oportunidades de optimización y proporciona recomendaciones accionables.',
        insights: 'Obtén insights detallados en cuatro áreas clave: patrones de gasto, estrategias de ahorro, optimización de presupuesto y pronósticos avanzados.'
      },
      'sk-sk': {
        intro: 'Zažite AI Finančnú Analýzu - vášho osobného finančného poradcu poháňaného pokročilou umelou inteligenciou.',
        analysis: 'AI analyzuje vaše vzorce výdavkov, identifikuje príležitosti optimalizácie a poskytuje uskutočniteľné odporúčania.',
        insights: 'Získajte detailné poznatky v štyroch kľúčových oblastiach: vzorce výdavkov, stratégie úspor, optimalizácia rozpočtu a pokročilé prognózy.'
      }
    },
    health: {
      'en-us': {
        intro: 'Discover your Financial Health Score - a comprehensive analysis evaluating multiple factors for complete financial wellness insight.',
        calculation: 'AI analyzes savings rate, expense consistency, budget adherence, and income stability to calculate your personalized score.',
        recommendations: 'Receive targeted improvement recommendations based on your specific financial situation and goals.'
      },
      'es-pe': {
        intro: 'Descubre tu Puntuación de Salud Financiera - un análisis integral que evalúa múltiples factores para una visión completa del bienestar financiero.',
        calculation: 'La IA analiza tasa de ahorro, consistencia de gastos, adherencia al presupuesto y estabilidad de ingresos para calcular tu puntuación personalizada.',
        recommendations: 'Recibe recomendaciones de mejora dirigidas basadas en tu situación financiera específica y objetivos.'
      },
      'sk-sk': {
        intro: 'Objavte vaše Skóre Finančného Zdravia - komplexnú analýzu hodnotiacu viaceré faktory pre úplný pohľad na finančné zdravie.',
        calculation: 'AI analyzuje mieru úspor, konzistentnosť výdavkov, dodržiavanie rozpočtu a stabilitu príjmov na výpočet vášho personalizovaného skóre.',
        recommendations: 'Získajte cielené odporúčania na zlepšenie založené na vašej konkrétnej finančnej situácii a cieľoch.'
      }
    }
  };
}

export default router;