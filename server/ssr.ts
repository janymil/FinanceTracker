import React from 'react';
import { renderToString } from 'react-dom/server';
import { amountFor, currencyForLanguage, formatMoney } from '../shared/pricing';

// Multilingual content data
const multilingualContent: Record<string, Record<string, any>> = {
  'en': {
    '/': {
      title: 'Kaptia - Smart Spending Tracker with AI Insights',
      description: 'Kaptia turns your everyday expenses into a clear picture of your spending. Track expenses, set budgets, reach goals, and let AI organize the rest.',
      keywords: 'spending tracker, expense tracking, budget planner, savings goals, expense scanner',
      lang: 'en'
    },
    '/pricing': {
      title: 'Kaptia Pricing Plans - Free, Standard & Premium',
      description: 'Choose the Kaptia plan that fits you. Free plan with basic tracking, Standard with budgets and AI, Premium with unlimited smart features.',
      keywords: 'pricing, subscription, plans, free, standard, premium, tracker app',
      lang: 'en'
    },
    '/help': {
      title: 'Kaptia Help & Documentation',
      description: 'Complete guide to using Kaptia. Learn about expense tracking, budgeting, goals, AI features, and mobile receipt scanning.',
      keywords: 'help, documentation, guide, tutorial, support, features',
      lang: 'en'
    },
    '/contact': {
      title: 'Contact Kaptia Support Team',
      description: 'Get help with Kaptia. Contact our support team for questions about features, billing, or technical assistance.',
      keywords: 'contact, support, help, customer service, technical assistance',
      lang: 'en'
    },
    '/auth': {
      title: 'Sign In to Kaptia - Smart Spending Tracker',
      description: 'Sign in to your Kaptia account to access expense tracking, budgets, and AI-powered insights.',
      keywords: 'sign in, login, account, authentication, tracker app',
      lang: 'en'
    },
    '/privacy-policy': {
      title: 'Privacy Policy - Kaptia',
      description: 'Learn how Kaptia protects your personal data with industry-standard security measures.',
      keywords: 'privacy policy, data protection, security, personal information',
      lang: 'en'
    },
    '/terms-of-service': {
      title: 'Terms of Service - Kaptia',
      description: 'Read Kaptia terms of service, user agreements, and service conditions for our smart tracking platform.',
      keywords: 'terms of service, user agreement, legal, conditions',
      lang: 'en'
    },
    '/cookie-policy': {
      title: 'Cookie Policy - Kaptia',
      description: 'Learn about how Kaptia uses cookies to enhance your experience and protect your privacy.',
      keywords: 'cookie policy, cookies, privacy, website functionality',
      lang: 'en'
    },
    '/features': {
      title: 'AI-Powered Smart Features - Kaptia',
      description: 'Discover 9 intelligent AI features that transform how you track spending: smart categorization, spending predictions, health scoring, and personalized recommendations.',
      keywords: 'AI features, smart categorization, predictive analytics, spending insights, automated recommendations',
      lang: 'en'
    }
  },
  'es': {
    '/': {
      title: 'Kaptia - Rastreador Inteligente de Gastos con IA',
      description: 'Kaptia convierte tus gastos diarios en una imagen clara de tus finanzas. Rastrea gastos, crea presupuestos, alcanza metas y deja que la IA organice el resto.',
      keywords: 'rastreador de gastos, seguimiento de gastos, presupuesto, metas de ahorro, control de finanzas',
      lang: 'es'
    },
    '/pricing': {
      title: 'Planes de Precios Kaptia - Gratis, Estándar y Premium',
      description: 'Elige el plan de Kaptia que se adapta a ti. Plan gratuito con seguimiento básico, Estándar con presupuestos e IA, Premium con funciones inteligentes ilimitadas.',
      keywords: 'precios, suscripción, planes, gratis, estándar, premium, app de seguimiento',
      lang: 'es'
    },
    '/help': {
      title: 'Ayuda y Documentación de Kaptia',
      description: 'Guía completa para usar Kaptia efectivamente. Aprende sobre seguimiento de gastos, presupuestos, metas, funciones de IA y escaneo celular de recibos.',
      keywords: 'ayuda, documentación, guía, tutorial, soporte, funciones',
      lang: 'es'
    },
    '/contact': {
      title: 'Contactar Equipo de Soporte Kaptia',
      description: 'Obtén ayuda con Kaptia. Contacta nuestro equipo de soporte para preguntas sobre funciones, facturación o asistencia técnica.',
      keywords: 'contacto, soporte, ayuda, servicio al cliente, asistencia técnica',
      lang: 'es'
    },
    '/auth': {
      title: 'Iniciar Sesión en Kaptia - Rastreador de Gastos',
      description: 'Inicia sesión en tu cuenta de Kaptia para acceder al seguimiento de gastos, presupuestos e insights impulsados por IA.',
      keywords: 'iniciar sesión, login, cuenta, autenticación, app de seguimiento',
      lang: 'es'
    },
    '/privacy-policy': {
      title: 'Política de Privacidad - Kaptia',
      description: 'Aprende cómo Kaptia protege tus datos personales con medidas de seguridad estándar de la industria.',
      keywords: 'política de privacidad, protección de datos, seguridad, información personal',
      lang: 'es'
    },
    '/terms-of-service': {
      title: 'Términos de Servicio - Kaptia',
      description: 'Lee los términos de servicio de Kaptia, acuerdos de usuario y condiciones para nuestra plataforma de seguimiento inteligente.',
      keywords: 'términos de servicio, acuerdo de usuario, legal, condiciones',
      lang: 'es'
    },
    '/cookie-policy': {
      title: 'Política de Cookies - Kaptia',
      description: 'Aprende sobre cómo Kaptia utiliza cookies para mejorar tu experiencia y proteger tu privacidad.',
      keywords: 'política de cookies, cookies, privacidad, funcionalidad del sitio web',
      lang: 'es'
    },
    '/features': {
      title: 'Funciones Inteligentes con IA - Kaptia',
      description: 'Descubre 9 funciones inteligentes de IA que transforman tu forma de registrar gastos: categorización automática, predicciones de gasto, puntuación de salud y recomendaciones personalizadas.',
      keywords: 'funciones IA, categorización inteligente, análisis predictivo, insights de gasto, recomendaciones automatizadas',
      lang: 'es'
    }
  },
  'sk': {
    '/': {
      title: 'Kaptia - Inteligentný Sledovač Výdavkov s AI',
      description: 'Kaptia mení vaše každodenné výdavky na jasný obraz o vašich financiách. Sledujte výdavky, tvorte rozpočty, dosahujte ciele a zvyšok nechajte na AI.',
      keywords: 'sledovač výdavkov, sledovanie výdavkov, rozpočet, sporiteľské ciele, správa výdavkov',
      lang: 'sk'
    },
    '/pricing': {
      title: 'Cenové Plány Kaptia - Bezplatný, Štandardný a Prémiový',
      description: 'Vyberte si plán Kaptia, ktorý vám vyhovuje. Bezplatný plán so základným sledovaním, Štandardný s rozpočtami a AI, Prémiový s neobmedzenými inteligentnými funkciami.',
      keywords: 'ceny, predplatné, plány, bezplatný, štandardný, prémiový, sledovacia aplikácia',
      lang: 'sk'
    },
    '/help': {
      title: 'Pomoc a Dokumentácia Kaptia',
      description: 'Kompletný sprievodca používaním Kaptia. Nauč sa o sledovaní výdavkov, rozpočtoch, cieľoch, AI funkciách a mobilnom skenovaní účteniek.',
      keywords: 'pomoc, dokumentácia, sprievodca, návod, podpora, funkcie',
      lang: 'sk'
    },
    '/contact': {
      title: 'Kontaktovať Podporný Tím Kaptia',
      description: 'Získaj pomoc s Kaptia. Kontaktuj náš podporný tím pre otázky o funkciách, fakturácii alebo technickú asistenciu.',
      keywords: 'kontakt, podpora, pomoc, zákaznícky servis, technická asistencia',
      lang: 'sk'
    },
    '/auth': {
      title: 'Prihlásiť sa do Kaptia - Sledovač Výdavkov',
      description: 'Prihlás sa do svojho účtu Kaptia pre prístup k sledovaniu výdavkov, rozpočtom a AI-poháňaným prehľadom.',
      keywords: 'prihlásiť sa, login, účet, autentifikácia, sledovacia aplikácia',
      lang: 'sk'
    },
    '/privacy-policy': {
      title: 'Zásady Ochrany Súkromia - Kaptia',
      description: 'Dozviete sa, ako Kaptia chráni vaše osobné údaje pomocou štandardných bezpečnostných opatrení.',
      keywords: 'zásady ochrany súkromia, ochrana údajov, bezpečnosť, osobné informácie',
      lang: 'sk'
    },
    '/terms-of-service': {
      title: 'Podmienky Služby - Kaptia',
      description: 'Prečítajte si podmienky služby Kaptia, používateľské dohody a podmienky pre našu inteligentnú sledovaciu platformu.',
      keywords: 'podmienky služby, používateľská dohoda, právne, podmienky',
      lang: 'sk'
    },
    '/cookie-policy': {
      title: 'Pravidlá Používania Cookies - Kaptia',
      description: 'Dozviete sa o tom, ako Kaptia používa cookies na zlepšenie vašej skúsenosti a ochranu vášho súkromia.',
      keywords: 'pravidlá cookies, cookies, súkromie, funkcionalita webovej stránky',
      lang: 'sk'
    },
    '/features': {
      title: 'Inteligentné Funkcie s AI - Kaptia',
      description: 'Objavte 9 inteligentných AI funkcií, ktoré menia spôsob sledovania výdavkov: automatická kategorizácia, predikcie výdavkov, skóre zdravia a personalizované odporúčania.',
      keywords: 'AI funkcie, inteligentná kategorizácia, prediktívna analytika, prehľady výdavkov, automatizované odporúčania',
      lang: 'sk'
    }
  }
};

// Simple SSR for crawlers - generates static HTML with proper meta tags
export function renderPageForCrawler(route: string, language: string = 'en'): string {
  const getPageData = (path: string, lang: string) => {
    const langContent = multilingualContent[lang];
    if (langContent && langContent[path]) {
      return langContent[path];
    }
    
    // Fallback to English if language not found
    const englishContent = multilingualContent['en'];
    if (englishContent && englishContent[path]) {
      return { ...englishContent[path], lang: 'en' };
    }
    
    // Ultimate fallback
    return {
      title: 'Kaptia - Smart Spending Tracker',
      description: 'Smart tracking application for expenses, budgets, and goals with AI-powered insights.',
      keywords: 'expense tracking, budgeting, goals',
      lang: 'en'
    };
  };

  const pageData = getPageData(route, language);

  return `<!DOCTYPE html>
<html lang="${pageData.lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageData.title}</title>
    <meta name="description" content="${pageData.description}">
    <meta name="keywords" content="${pageData.keywords}">
    <meta name="robots" content="index, follow">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://kaptia.app${language === 'en' ? '' : '/' + language}${route}">
    <meta property="og:title" content="${pageData.title}">
    <meta property="og:description" content="${pageData.description}">
    <meta property="og:image" content="https://kaptia.app/og-image.png">
    <meta property="og:locale" content="${pageData.lang === 'en' ? 'en_US' : pageData.lang === 'es' ? 'es_ES' : 'sk_SK'}">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="https://kaptia.app${language === 'en' ? '' : '/' + language}${route}">
    <meta property="twitter:title" content="${pageData.title}">
    <meta property="twitter:description" content="${pageData.description}">
    <meta property="twitter:image" content="https://kaptia.app/og-image.png">

    <!-- Canonical URL with language -->
    <link rel="canonical" href="https://kaptia.app${language === 'en' ? '' : '/' + language}${route}">
    
    <!-- Language alternates for SEO -->
    <link rel="alternate" hreflang="en" href="https://kaptia.app${route}">
    <link rel="alternate" hreflang="es" href="https://kaptia.app/es${route}">
    <link rel="alternate" hreflang="sk" href="https://kaptia.app/sk${route}">
    <link rel="alternate" hreflang="x-default" href="https://kaptia.app${route}">
    
    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.svg">
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    
    <!-- Structured Data -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "Kaptia",
      "description": "${pageData.description}",
      "url": "https://kaptia.app",
      "applicationCategory": "LifestyleApplication",
      "operatingSystem": "Web",
      "inLanguage": "${pageData.lang}",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      }
    }
    </script>
</head>
<body>
    <div id="root">
        <header>
            <h1>Kaptia</h1>
            <nav>
                ${getNavContent(pageData.lang)}
            </nav>
        </header>
        <main>
            ${getPageContent(route, pageData.lang)}
        </main>
        <footer>
            <p>${getCopyrightText(pageData.lang)}</p>
        </footer>
    </div>
</body>
</html>`;
}

// Helper functions for multilingual content
function getNavContent(lang: string): string {
  const navItems = {
    'en': { home: 'Home', features: 'Features', pricing: 'Pricing', help: 'Help', contact: 'Contact' },
    'es': { home: 'Inicio', features: 'Funciones', pricing: 'Precios', help: 'Ayuda', contact: 'Contacto' },
    'sk': { home: 'Domov', features: 'Funkcie', pricing: 'Ceny', help: 'Pomoc', contact: 'Kontakt' }
  };
  
  const items = navItems[lang as keyof typeof navItems] || navItems['en'];
  const langPrefix = lang === 'en' ? '' : `/${lang}`;
  
  return `
    <a href="${langPrefix}/">${items.home}</a>
    <a href="${langPrefix}/features">${items.features}</a>
    <a href="${langPrefix}/pricing">${items.pricing}</a>
    <a href="${langPrefix}/help">${items.help}</a>
    <a href="${langPrefix}/contact">${items.contact}</a>
  `;
}

function getCopyrightText(lang: string): string {
  const year = new Date().getFullYear();
  const texts = {
    'en': `© ${year} Kaptia. All rights reserved.`,
    'es': `© ${year} Kaptia. Todos los derechos reservados.`,
    'sk': `© ${year} Kaptia. Všetky práva vyhradené.`
  };
  
  return texts[lang as keyof typeof texts] || texts['en'];
}

function getPageContent(route: string, lang: string = 'en'): string {
  // Prices on these pages are read by search engines and by people who then reach checkout,
  // so they come from the one price list, in the currency that language is charged in:
  // Spanish pages quote soles (the Peru market), everything else US dollars.
  const currency = currencyForLanguage(lang);
  const price = (plan: 'standard' | 'premium', per: string) =>
    `${formatMoney(amountFor(plan, 'monthly', currency), currency)}/${per}`;
  const freePrice = (per: string) => `${formatMoney(0, currency)}/${per}`;

  const content = {
    'en': {
      '/': `
        <section>
            <h1>Smart Spending Tracker with AI Insights</h1>
            <p>Kaptia turns your everyday expenses into a clear picture of your spending, with budgets and AI-powered insights.</p>
            
            <h2>Key Features</h2>
            <ul>
                <li>Expense and Income Tracking</li>
                <li>Budget Management</li>
                <li>Savings Goals</li>
                <li>AI-Powered Categorization</li>
                <li>Receipt OCR Scanning</li>
                <li>Mobile QR Code Upload</li>
                <li>Cloud Backup & Export</li>
                <li>Spending Health Analysis</li>
            </ul>
            
            <h2>Subscription Plans</h2>
            <div>
                <h3>Free Plan</h3>
                <p>Basic expense tracking with up to 100 transactions</p>
                
                <h3>Standard Plan - ${price('standard', 'month')}</h3>
                <p>Enhanced features including budgets, goals, AI categorization, and receipt scanning</p>
                
                <h3>Premium Plan - ${price('premium', 'month')}</h3>
                <p>Unlimited transactions, advanced analytics, AI insights, and cloud backup</p>
            </div>
        </section>
      `,
      '/pricing': `
        <section>
            <h1>Pricing Plans</h1>
            <p>Choose the plan that fits your tracking needs</p>
            
            <div>
                <h2>Free Plan - ${freePrice('month')}</h2>
                <ul>
                    <li>Up to 100 transactions</li>
                    <li>Basic expense tracking</li>
                    <li>Income management</li>
                    <li>Simple categories</li>
                </ul>
                
                <h2>Standard Plan - ${price('standard', 'month')}</h2>
                <ul>
                    <li>Unlimited transactions</li>
                    <li>Budget management</li>
                    <li>Savings goals</li>
                    <li>AI expense categorization</li>
                    <li>Receipt OCR scanning</li>
                    <li>Mobile QR code upload</li>
                    <li>Transaction reminders</li>
                    <li>Collaborative goals</li>
                </ul>
                
                <h2>Premium Plan - ${price('premium', 'month')}</h2>
                <ul>
                    <li>Everything in Standard</li>
                    <li>Advanced AI insights</li>
                    <li>Spending health analysis</li>
                    <li>Predictive forecasting</li>
                    <li>Cloud backup & export</li>
                    <li>Priority support</li>
                </ul>
            </div>
        </section>
      `,
      '/help': `
        <section>
            <h1>Help & Documentation</h1>
            <p>Complete guide to using Kaptia effectively</p>
            
            <h2>Getting Started</h2>
            <ul>
                <li>Creating your account</li>
                <li>Adding your first transaction</li>
                <li>Setting up categories</li>
                <li>Mobile app setup</li>
            </ul>
            
            <h2>Features</h2>
            <ul>
                <li>Expense tracking</li>
                <li>Budget management</li>
                <li>Goal setting</li>
                <li>Receipt scanning</li>
                <li>AI categorization</li>
                <li>Data export</li>
            </ul>
        </section>
      `,
      '/contact': `
        <section>
            <h1>Contact Support</h1>
            <p>Get help with Kaptia</p>
            
            <h2>Support Channels</h2>
            <ul>
                <li>Email: support@kaptia.app</li>
                <li>Live chat (available 9 AM - 5 PM EST)</li>
                <li>Help documentation</li>
                <li>Community forum</li>
            </ul>
            
            <h2>Common Topics</h2>
            <ul>
                <li>Account setup</li>
                <li>Billing questions</li>
                <li>Feature requests</li>
                <li>Technical issues</li>
            </ul>
        </section>
      `,
      '/auth': `
        <section>
            <h1>Sign In to Kaptia</h1>
            <p>Sign in to your account to access your smart tracking tools</p>
            
            <h2>Create New Account</h2>
            <ul>
                <li>Free registration</li>
                <li>Instant access</li>
                <li>Secure data storage</li>
                <li>Mobile synchronization</li>
            </ul>
            
            <h2>Already Have an Account?</h2>
            <p>Simply sign in and continue tracking your spending</p>
        </section>
      `,
      '/privacy-policy': `
        <section>
            <h1>Privacy Policy</h1>
            <p>Kaptia is committed to protecting your personal data</p>
            
            <h2>Data Collection</h2>
            <ul>
                <li>Account information</li>
                <li>Tracked transactions</li>
                <li>Application usage</li>
                <li>Device technical data</li>
            </ul>
            
            <h2>Security Measures</h2>
            <ul>
                <li>256-bit SSL encryption</li>
                <li>Secure cloud storage</li>
                <li>Regular security audits</li>
            </ul>
        </section>
      `,
      '/terms-of-service': `
        <section>
            <h1>Terms of Service</h1>
            <p>Read the terms of use for Kaptia service</p>
            
            <h2>Service Usage</h2>
            <ul>
                <li>Responsible use of features</li>
                <li>Compliance with local laws</li>
                <li>Protection of login credentials</li>
                <li>Problem reporting</li>
            </ul>
            
            <h2>Liability Limitations</h2>
            <ul>
                <li>Tracked data accuracy</li>
                <li>Service availability</li>
                <li>Use of AI-generated suggestions</li>
                <li>Data backup</li>
            </ul>
        </section>
      `,
      '/cookie-policy': `
        <section>
            <h1>Cookie Policy</h1>
            <p>Information about how Kaptia uses cookies</p>
            
            <h2>Types of Cookies</h2>
            <ul>
                <li>Essential cookies</li>
                <li>Functional cookies</li>
                <li>Analytics cookies</li>
                <li>Marketing cookies</li>
            </ul>
            
            <h2>Cookie Management</h2>
            <ul>
                <li>Browser settings</li>
                <li>Cookie consent</li>
                <li>Cookie deletion</li>
                <li>Privacy control</li>
            </ul>
        </section>
      `,
      '/features': `
        <section>
            <h1>AI-Powered Spending Intelligence</h1>
            <p>Nine intelligent AI features that learn, adapt, and organize your spending in real-time.</p>
            
            <h2>Core AI Features</h2>
            <ul>
                <li><strong>Smart Expense Categorization</strong> - Automatically categorizes transactions with machine learning</li>
                <li><strong>Predictive Spending Analytics</strong> - Forecasts spending patterns and upcoming trends</li>
                <li><strong>Spending Health Scoring</strong> - Real-time assessment of your tracking habits</li>
                <li><strong>Intelligent Budget Recommendations</strong> - AI-driven budget optimization suggestions</li>
                <li><strong>Expense Prediction Engine</strong> - Anticipates future expenses based on historical data</li>
                <li><strong>Trend Analysis & Insights</strong> - Identifies spending patterns and optimization opportunities</li>
                <li><strong>Daily Smart Recommendations</strong> - Automated daily tips based on your spending patterns</li>
                <li><strong>Interactive AI Assistant</strong> - On-demand AI guidance for questions about your spending</li>
                <li><strong>Advanced Spending Analytics</strong> - Deep insights into your everyday habits</li>
            </ul>
            
            <h2>Key Benefits</h2>
            <ul>
                <li>Automate everyday money decisions</li>
                <li>Reduce manual categorization by 95%</li>
                <li>Improve your spending health score</li>
                <li>Predict and prevent overspending</li>
                <li>Get personalized spending guidance</li>
                <li>Available in 3 languages</li>
                <li>Real-time processing and insights</li>
            </ul>
            
            <h2>Industry-Leading Security</h2>
            <ul>
                <li>AES-256 encryption for sensitive data</li>
                <li>Local OCR processing - no external data transmission</li>
                <li>Privacy-first AI analysis</li>
            </ul>
        </section>
      `
    },
    'es': {
      '/': `
        <section>
            <h1>Rastreador Inteligente de Gastos con IA</h1>
            <p>Kaptia convierte tus gastos diarios en una imagen clara de tus finanzas, con presupuestos e insights impulsados por IA.</p>
            
            <h2>Características Principales</h2>
            <ul>
                <li>Seguimiento de Gastos e Ingresos</li>
                <li>Gestión de Presupuestos</li>
                <li>Metas de Ahorro</li>
                <li>Categorización Impulsada por IA</li>
                <li>Escaneo OCR de Recibos</li>
                <li>Carga de Códigos QR Móviles</li>
                <li>Respaldo en la Nube y Exportación</li>
                <li>Análisis de Hábitos de Gasto</li>
            </ul>
            
            <h2>Planes de Suscripción</h2>
            <div>
                <h3>Plan Gratuito</h3>
                <p>Seguimiento básico de gastos con hasta 100 transacciones</p>
                
                <h3>Plan Estándar - ${price('standard', 'mes')}</h3>
                <p>Características mejoradas incluyendo presupuestos, metas, categorización IA y escaneo de recibos</p>
                
                <h3>Plan Premium - ${price('premium', 'mes')}</h3>
                <p>Transacciones ilimitadas, análisis avanzados, insights de IA y respaldo en la nube</p>
            </div>
        </section>
      `,
      '/pricing': `
        <section>
            <h1>Planes de Precios</h1>
            <p>Elige el plan perfecto para tus necesidades de seguimiento</p>
            
            <div>
                <h2>Plan Gratuito - ${freePrice('mes')}</h2>
                <ul>
                    <li>Hasta 100 transacciones</li>
                    <li>Seguimiento básico de gastos</li>
                    <li>Gestión de ingresos</li>
                    <li>Categorías simples</li>
                </ul>
                
                <h2>Plan Estándar - ${price('standard', 'mes')}</h2>
                <ul>
                    <li>Transacciones ilimitadas</li>
                    <li>Gestión de presupuestos</li>
                    <li>Metas de ahorro</li>
                    <li>Categorización de gastos con IA</li>
                    <li>Escaneo OCR de recibos</li>
                    <li>Carga de códigos QR desde el celular</li>
                    <li>Recordatorios de transacciones</li>
                    <li>Metas colaborativas</li>
                </ul>
                
                <h2>Plan Premium - ${price('premium', 'mes')}</h2>
                <ul>
                    <li>Todo en Estándar</li>
                    <li>Insights avanzados de IA</li>
                    <li>Análisis de hábitos de gasto</li>
                    <li>Pronósticos predictivos</li>
                    <li>Respaldo en la nube y exportación</li>
                    <li>Soporte prioritario</li>
                </ul>
            </div>
        </section>
      `,
      '/help': `
        <section>
            <h1>Ayuda y Documentación</h1>
            <p>Guía completa para usar Kaptia efectivamente</p>
            
            <h2>Primeros Pasos</h2>
            <ul>
                <li>Crear tu cuenta</li>
                <li>Agregar tu primera transacción</li>
                <li>Configurar categorías</li>
                <li>Configuración de la app en el celular</li>
            </ul>
            
            <h2>Características</h2>
            <ul>
                <li>Seguimiento de gastos</li>
                <li>Gestión de presupuestos</li>
                <li>Establecimiento de metas</li>
                <li>Escaneo de recibos</li>
                <li>Categorización IA</li>
                <li>Exportación de datos</li>
            </ul>
        </section>
      `,
      '/contact': `
        <section>
            <h1>Contactar Soporte</h1>
            <p>Obtén ayuda con Kaptia</p>
            
            <h2>Canales de Soporte</h2>
            <ul>
                <li>Email: support@kaptia.app</li>
                <li>Chat en vivo (disponible 9 AM - 5 PM EST)</li>
                <li>Documentación de ayuda</li>
                <li>Foro de la comunidad</li>
            </ul>
            
            <h2>Temas Comunes</h2>
            <ul>
                <li>Configuración de cuenta</li>
                <li>Preguntas de facturación</li>
                <li>Solicitudes de características</li>
                <li>Problemas técnicos</li>
            </ul>
        </section>
      `,
      '/auth': `
        <section>
            <h1>Iniciar Sesión en Kaptia</h1>
            <p>Inicia sesión en tu cuenta para acceder a tus herramientas inteligentes de seguimiento</p>
            
            <h2>Crear Nueva Cuenta</h2>
            <ul>
                <li>Registro gratuito</li>
                <li>Acceso instantáneo</li>
                <li>Almacenamiento seguro de datos</li>
                <li>Sincronización con el celular</li>
            </ul>
            
            <h2>¿Ya Tienes una Cuenta?</h2>
            <p>Simplemente inicia sesión y continúa registrando tus gastos</p>
        </section>
      `,
      '/privacy-policy': `
        <section>
            <h1>Política de Privacidad</h1>
            <p>Kaptia se compromete a proteger tus datos personales</p>
            
            <h2>Recopilación de Datos</h2>
            <ul>
                <li>Información de cuenta</li>
                <li>Transacciones registradas</li>
                <li>Uso de la aplicación</li>
                <li>Datos técnicos del dispositivo</li>
            </ul>
            
            <h2>Medidas de Seguridad</h2>
            <ul>
                <li>Cifrado SSL de 256 bits</li>
                <li>Almacenamiento en nube seguro</li>
                <li>Auditorías de seguridad regulares</li>
            </ul>
        </section>
      `,
      '/terms-of-service': `
        <section>
            <h1>Términos de Servicio</h1>
            <p>Lee los términos de uso del servicio Kaptia</p>
            
            <h2>Uso del Servicio</h2>
            <ul>
                <li>Uso responsable de las funciones</li>
                <li>Cumplimiento de leyes locales</li>
                <li>Protección de credenciales de acceso</li>
                <li>Reporte de problemas</li>
            </ul>
            
            <h2>Limitaciones de Responsabilidad</h2>
            <ul>
                <li>Precisión de los datos registrados</li>
                <li>Disponibilidad del servicio</li>
                <li>Uso de sugerencias generadas por IA</li>
                <li>Respaldo de datos</li>
            </ul>
        </section>
      `,
      '/cookie-policy': `
        <section>
            <h1>Política de Cookies</h1>
            <p>Información sobre cómo Kaptia utiliza cookies</p>
            
            <h2>Tipos de Cookies</h2>
            <ul>
                <li>Cookies esenciales</li>
                <li>Cookies funcionales</li>
                <li>Cookies analíticas</li>
                <li>Cookies de marketing</li>
            </ul>
            
            <h2>Gestión de Cookies</h2>
            <ul>
                <li>Configuración del navegador</li>
                <li>Consentimiento de cookies</li>
                <li>Eliminación de cookies</li>
                <li>Control de privacidad</li>
            </ul>
        </section>
      `,
      '/features': `
        <section>
            <h1>Inteligencia de Gastos Impulsada por IA</h1>
            <p>9 funciones inteligentes de IA que aprenden, se adaptan y organizan tus gastos en tiempo real.</p>
            
            <h2>Funciones Core de IA</h2>
            <ul>
                <li><strong>Categorización Inteligente de Gastos</strong> - Categoriza automáticamente transacciones con aprendizaje automático</li>
                <li><strong>Análisis Predictivo de Gastos</strong> - Pronostica patrones de gasto y próximas tendencias</li>
                <li><strong>Puntuación de Hábitos de Gasto</strong> - Evaluación en tiempo real de tus hábitos</li>
                <li><strong>Recomendaciones Inteligentes de Presupuesto</strong> - Sugerencias de optimización de presupuesto impulsadas por IA</li>
                <li><strong>Motor de Predicción de Gastos</strong> - Anticipa gastos futuros basado en datos históricos</li>
                <li><strong>Análisis de Tendencias e Insights</strong> - Identifica patrones de gasto y oportunidades de optimización</li>
                <li><strong>Recomendaciones Inteligentes Diarias</strong> - Consejos automáticos diarios basados en tus patrones de gasto</li>
                <li><strong>Asistente de IA Interactivo</strong> - Orientación de IA bajo demanda para preguntas sobre tus gastos</li>
                <li><strong>Análisis Avanzado de Gastos</strong> - Insights profundos sobre tus hábitos diarios</li>
            </ul>
            
            <h2>Beneficios Clave</h2>
            <ul>
                <li>Automatiza las decisiones de gasto diarias</li>
                <li>Reduce la categorización manual en un 95%</li>
                <li>Mejora tu puntuación de hábitos de gasto</li>
                <li>Predice y previene el gasto excesivo</li>
                <li>Obtén orientación personalizada sobre tus gastos</li>
                <li>Disponible en 3 idiomas</li>
                <li>Procesamiento e insights en tiempo real</li>
            </ul>
            
            <h2>Seguridad Líder en la Industria</h2>
            <ul>
                <li>Cifrado AES-256 para datos sensibles</li>
                <li>Procesamiento OCR local - sin transmisión externa de datos</li>
                <li>Análisis de IA que prioriza la privacidad</li>
            </ul>
        </section>
      `
    },
    'sk': {
      '/': `
        <section>
            <h1>Inteligentný Sledovač Výdavkov s AI</h1>
            <p>Kaptia mení vaše každodenné výdavky na jasný obraz o vašich financiách - s rozpočtami a AI-poháňanými prehľadmi.</p>
            
            <h2>Hlavné Funkcie</h2>
            <ul>
                <li>Sledovanie Výdavkov a Príjmov</li>
                <li>Správa Rozpočtu</li>
                <li>Sporiteľské Ciele</li>
                <li>AI-Poháňaná Kategorizácia</li>
                <li>OCR Skenovanie Účteniek</li>
                <li>Mobilné QR Kód Nahrávanie</li>
                <li>Cloudové Zálohovanie a Export</li>
                <li>Analýza Návykov Míňania</li>
            </ul>
            
            <h2>Predplatné Plány</h2>
            <div>
                <h3>Bezplatný Plán</h3>
                <p>Základné sledovanie výdavkov s až 100 transakciami</p>
                
                <h3>Štandardný Plán - ${price('standard', 'mesiac')}</h3>
                <p>Vylepšené funkcie vrátane rozpočtov, cieľov, AI kategorizácie a skenovania účteniek</p>
                
                <h3>Prémiový Plán - ${price('premium', 'mesiac')}</h3>
                <p>Neobmedzené transakcie, pokročilé analýzy, AI poznatky a cloudové zálohovanie</p>
            </div>
        </section>
      `,
      '/pricing': `
        <section>
            <h1>Cenové Plány</h1>
            <p>Vyber si perfektný plán pre svoje potreby sledovania</p>
            
            <div>
                <h2>Bezplatný Plán - ${freePrice('mesiac')}</h2>
                <ul>
                    <li>Až 100 transakcií</li>
                    <li>Základné sledovanie výdavkov</li>
                    <li>Riadenie príjmov</li>
                    <li>Jednoduché kategórie</li>
                </ul>
                
                <h2>Štandardný Plán - ${price('standard', 'mesiac')}</h2>
                <ul>
                    <li>Neobmedzené transakcie</li>
                    <li>Správa rozpočtu</li>
                    <li>Sporiteľské ciele</li>
                    <li>AI kategorizácia výdavkov</li>
                    <li>OCR skenovanie účteniek</li>
                    <li>Mobilné QR kód nahrávanie</li>
                    <li>Pripomienky transakcií</li>
                    <li>Spolupracujúce ciele</li>
                </ul>
                
                <h2>Prémiový Plán - ${price('premium', 'mesiac')}</h2>
                <ul>
                    <li>Všetko v Štandardnom</li>
                    <li>Pokročilé AI poznatky</li>
                    <li>Analýza návykov míňania</li>
                    <li>Prediktívne prognózy</li>
                    <li>Cloudové zálohovanie a export</li>
                    <li>Prioritná podpora</li>
                </ul>
            </div>
        </section>
      `,
      '/help': `
        <section>
            <h1>Pomoc a Dokumentácia</h1>
            <p>Kompletný sprievodca efektívnym používaním Kaptia</p>
            
            <h2>Začíname</h2>
            <ul>
                <li>Vytvorenie účtu</li>
                <li>Pridanie prvej transakcie</li>
                <li>Nastavenie kategórií</li>
                <li>Nastavenie mobilnej aplikácie</li>
            </ul>
            
            <h2>Funkcie</h2>
            <ul>
                <li>Sledovanie výdavkov</li>
                <li>Správa rozpočtu</li>
                <li>Nastavenie cieľov</li>
                <li>Skenovanie účteniek</li>
                <li>AI kategorizácia</li>
                <li>Export dát</li>
            </ul>
        </section>
      `,
      '/contact': `
        <section>
            <h1>Kontaktovať Podporu</h1>
            <p>Získaj pomoc s Kaptia</p>
            
            <h2>Kanály Podpory</h2>
            <ul>
                <li>Email: support@kaptia.app</li>
                <li>Živý chat (dostupný 9:00 - 17:00 EST)</li>
                <li>Dokumentácia pomoci</li>
                <li>Komunitné fórum</li>
            </ul>
            
            <h2>Časté Témy</h2>
            <ul>
                <li>Nastavenie účtu</li>
                <li>Otázky fakturácie</li>
                <li>Požiadavky na funkcie</li>
                <li>Technické problémy</li>
            </ul>
        </section>
      `,
      '/auth': `
        <section>
            <h1>Prihlásiť sa do Kaptia</h1>
            <p>Prihlás sa do svojho účtu pre prístup k inteligentným sledovacím nástrojom</p>
            
            <h2>Vytvoriť Nový Účet</h2>
            <ul>
                <li>Bezplatná registrácia</li>
                <li>Okamžitý prístup</li>
                <li>Bezpečné uloženie dát</li>
                <li>Mobilná synchronizácia</li>
            </ul>
            
            <h2>Už Máš Účet?</h2>
            <p>Jednoducho sa prihlás a pokračuj v sledovaní svojich výdavkov</p>
        </section>
      `,
      '/privacy-policy': `
        <section>
            <h1>Zásady Ochrany Súkromia</h1>
            <p>Kaptia sa zaväzuje chrániť vaše osobné údaje</p>
            
            <h2>Zhromažďovanie Údajov</h2>
            <ul>
                <li>Informácie o účte</li>
                <li>Sledované transakcie</li>
                <li>Používanie aplikácie</li>
                <li>Technické údaje zariadenia</li>
            </ul>
            
            <h2>Bezpečnostné Opatrenia</h2>
            <ul>
                <li>256-bitové SSL šifrovanie</li>
                <li>Zabezpečené cloudové úložisko</li>
                <li>Pravidelné bezpečnostné audity</li>
            </ul>
        </section>
      `,
      '/terms-of-service': `
        <section>
            <h1>Podmienky Služby</h1>
            <p>Prečítajte si podmienky používania služby Kaptia</p>
            
            <h2>Používanie Služby</h2>
            <ul>
                <li>Zodpovedné používanie funkcií</li>
                <li>Dodržiavanie miestnych zákonov</li>
                <li>Ochrana prihlasovacích údajov</li>
                <li>Nahlasovania problémov</li>
            </ul>
            
            <h2>Obmedzeniya Zodpovednosti</h2>
            <ul>
                <li>Presnosť sledovaných údajov</li>
                <li>Dostupnosť služby</li>
                <li>Použitie návrhov generovaných AI</li>
                <li>Zálohovanie údajov</li>
            </ul>
        </section>
      `,
      '/cookie-policy': `
        <section>
            <h1>Pravidlá Používania Cookies</h1>
            <p>Informácie o tom, ako Kaptia používa cookies</p>
            
            <h2>Typy Cookies</h2>
            <ul>
                <li>Nevyhnutné cookies</li>
                <li>Funkčné cookies</li>
                <li>Analytické cookies</li>
                <li>Marketingové cookies</li>
            </ul>
            
            <h2>Správa Cookies</h2>
            <ul>
                <li>Nastavenia prehliadača</li>
                <li>Súhlas s cookies</li>
                <li>Vymazanie cookies</li>
                <li>Kontrola súkromia</li>
            </ul>
        </section>
      `,
      '/features': `
        <section>
            <h1>Inteligencia Míňania Poháňaná AI</h1>
            <p>9 inteligentných AI funkcií, ktoré sa učia, prispôsobujú a organizujú vaše míňanie v reálnom čase.</p>
            
            <h2>Základné AI Funkcie</h2>
            <ul>
                <li><strong>Inteligentná Kategorizácia Výdavkov</strong> - Automaticky kategorizuje transakcie pomocou strojového učenia</li>
                <li><strong>Prediktívna Analytika Míňania</strong> - Predpovedá vzorce míňania a nadchádzajúce trendy</li>
                <li><strong>Hodnotenie Návykov Míňania</strong> - Hodnotenie vašich návykov v reálnom čase</li>
                <li><strong>Inteligentné Rozpočtové Odporúčania</strong> - Návrhy optimalizácie rozpočtu poháňané AI</li>
                <li><strong>Engine Predikcie Výdavkov</strong> - Predpovedá budúce výdavky na základe historických údajov</li>
                <li><strong>Analýza Trendov a Poznatky</strong> - Identifikuje vzorce míňania a príležitosti na optimalizáciu</li>
                <li><strong>Denné Inteligentné Odporúčania</strong> - Personalizované denné tipy založené na vašich vzorcoch míňania</li>
                <li><strong>Kontextové Tipy Míňania</strong> - Inteligentné tipy na základe vašej aktuálnej situácie míňania</li>
                <li><strong>Pokročilá Analytika Míňania</strong> - Hlboké poznatky o vašich každodenných návykoch</li>
            </ul>
            
            <h2>Kľúčové Výhody</h2>
            <ul>
                <li>Automatizácia každodenných rozhodnutí o míňaní</li>
                <li>Zníženie manuálnej kategorizácie o 95%</li>
                <li>Zlepšenie skóre návykov míňania</li>
                <li>Predpovedanie a prevencia nadmerného míňania</li>
                <li>Získanie personalizovaného vedenia míňania</li>
                <li>Dostupné v 3 jazykoch</li>
                <li>Spracovanie a poznatky v reálnom čase</li>
            </ul>
            
            <h2>Bezpečnosť na Úrovni Priemyslu</h2>
            <ul>
                <li>AES-256 šifrovanie pre citlivé údaje</li>
                <li>Lokálne OCR spracovanie - žiadny externý prenos údajov</li>
                <li>AI analýza s prioritou súkromia</li>
            </ul>
        </section>
      `
    }
  };

  const langContent = content[lang as keyof typeof content] as Record<string, string> | undefined;
  if (langContent && langContent[route]) {
    return langContent[route];
  }

  // Fallback to English
  const englishContent = content['en'] as Record<string, string> | undefined;
  if (englishContent && englishContent[route]) {
    return englishContent[route];
  }

  return '<p>Page content not found</p>';
}