import React from 'react';
import { renderToString } from 'react-dom/server';

// Multilingual content data
const multilingualContent: Record<string, Record<string, any>> = {
  'en': {
    '/': {
      title: 'FinanzerPro - Smart Personal Finance Management',
      description: 'Take control of your finances with FinanzerPro. Track expenses, set budgets, achieve goals, and get AI-powered insights for better financial decisions.',
      keywords: 'personal finance, expense tracking, budgeting, financial goals, money management',
      lang: 'en'
    },
    '/pricing': {
      title: 'FinanzerPro Pricing Plans - Free, Standard & Premium',
      description: 'Choose the perfect FinanzerPro plan for your needs. Free plan with basic tracking, Standard with budgets and AI, Premium with unlimited features.',
      keywords: 'pricing, subscription, plans, free, standard, premium, financial software',
      lang: 'en'
    },
    '/help': {
      title: 'FinanzerPro Help & Documentation',
      description: 'Complete guide to using FinanzerPro. Learn about expense tracking, budgeting, goals, AI features, and mobile receipt scanning.',
      keywords: 'help, documentation, guide, tutorial, support, features',
      lang: 'en'
    },
    '/contact': {
      title: 'Contact FinanzerPro Support Team',
      description: 'Get help with FinanzerPro. Contact our support team for questions about features, billing, or technical assistance.',
      keywords: 'contact, support, help, customer service, technical assistance',
      lang: 'en'
    },
    '/auth': {
      title: 'Sign In to FinanzerPro - Personal Finance Management',
      description: 'Sign in to your FinanzerPro account to access expense tracking, budgeting tools, and AI-powered financial insights.',
      keywords: 'sign in, login, account, authentication, finance app',
      lang: 'en'
    },
    '/privacy-policy': {
      title: 'Privacy Policy - FinanzerPro',
      description: 'Learn how FinanzerPro protects your personal and financial data with industry-standard security measures.',
      keywords: 'privacy policy, data protection, security, personal information',
      lang: 'en'
    },
    '/terms-of-service': {
      title: 'Terms of Service - FinanzerPro',
      description: 'Read FinanzerPro terms of service, user agreements, and service conditions for our financial management platform.',
      keywords: 'terms of service, user agreement, legal, conditions',
      lang: 'en'
    },
    '/cookie-policy': {
      title: 'Cookie Policy - FinanzerPro',
      description: 'Learn about how FinanzerPro uses cookies to enhance your experience and protect your privacy.',
      keywords: 'cookie policy, cookies, privacy, website functionality',
      lang: 'en'
    },
    '/features': {
      title: 'AI-Powered Financial Features - FinanzerPro',
      description: 'Discover 9 intelligent AI features that transform your business finances: smart categorization, predictive analytics, financial health scoring, and personalized recommendations.',
      keywords: 'AI features, financial intelligence, smart categorization, predictive analytics, financial health, business finance, automated insights',
      lang: 'en'
    }
  },
  'es': {
    '/': {
      title: 'FinanzerPro - Gestión Inteligente de Finanzas Personales',
      description: 'Toma el control de tus finanzas con FinanzerPro. Rastrea gastos, establece presupuestos, alcanza metas y obtén insights impulsados por IA para mejores decisiones financieras.',
      keywords: 'finanzas personales, seguimiento de gastos, presupuesto, metas financieras, gestión de dinero',
      lang: 'es'
    },
    '/pricing': {
      title: 'Planes de Precios FinanzerPro - Gratis, Estándar y Premium',
      description: 'Elige el plan perfecto de FinanzerPro para tus necesidades. Plan gratuito con seguimiento básico, Estándar con presupuestos e IA, Premium con funciones ilimitadas.',
      keywords: 'precios, suscripción, planes, gratis, estándar, premium, software financiero',
      lang: 'es'
    },
    '/help': {
      title: 'Ayuda y Documentación de FinanzerPro',
      description: 'Guía completa para usar FinanzerPro efectivamente. Aprende sobre seguimiento de gastos, presupuestos, metas, funciones de IA y escaneo móvil de recibos.',
      keywords: 'ayuda, documentación, guía, tutorial, soporte, funciones',
      lang: 'es'
    },
    '/contact': {
      title: 'Contactar Equipo de Soporte FinanzerPro',
      description: 'Obtén ayuda con FinanzerPro. Contacta nuestro equipo de soporte para preguntas sobre funciones, facturación o asistencia técnica.',
      keywords: 'contacto, soporte, ayuda, servicio al cliente, asistencia técnica',
      lang: 'es'
    },
    '/auth': {
      title: 'Iniciar Sesión en FinanzerPro - Gestión de Finanzas Personales',
      description: 'Inicia sesión en tu cuenta de FinanzerPro para acceder al seguimiento de gastos, herramientas de presupuesto e insights financieros impulsados por IA.',
      keywords: 'iniciar sesión, login, cuenta, autenticación, app de finanzas',
      lang: 'es'
    },
    '/privacy-policy': {
      title: 'Política de Privacidad - FinanzerPro',
      description: 'Aprende cómo FinanzerPro protege tus datos personales y financieros con medidas de seguridad estándar de la industria.',
      keywords: 'política de privacidad, protección de datos, seguridad, información personal',
      lang: 'es'
    },
    '/terms-of-service': {
      title: 'Términos de Servicio - FinanzerPro',
      description: 'Lee los términos de servicio de FinanzerPro, acuerdos de usuario y condiciones de servicio para nuestra plataforma de gestión financiera.',
      keywords: 'términos de servicio, acuerdo de usuario, legal, condiciones',
      lang: 'es'
    },
    '/cookie-policy': {
      title: 'Política de Cookies - FinanzerPro',
      description: 'Aprende sobre cómo FinanzerPro utiliza cookies para mejorar tu experiencia y proteger tu privacidad.',
      keywords: 'política de cookies, cookies, privacidad, funcionalidad del sitio web',
      lang: 'es'
    },
    '/features': {
      title: 'Funciones Financieras Impulsadas por IA - FinanzerPro',
      description: 'Descubre 9 funciones inteligentes de IA que transforman las finanzas de tu negocio: categorización inteligente, análisis predictivo, puntuación de salud financiera y recomendaciones personalizadas.',
      keywords: 'funciones IA, inteligencia financiera, categorización inteligente, análisis predictivo, salud financiera, finanzas empresariales, insights automatizados',
      lang: 'es'
    }
  },
  'sk': {
    '/': {
      title: 'FinanzerPro - Inteligentné Riadenie Osobných Financií',
      description: 'Prevezmi kontrolu nad svojimi financiami s FinanzerPro. Sleduj výdavky, nastav rozpočty, dosiahni ciele a získaj AI-poháňané poznatky pre lepšie finančné rozhodnutia.',
      keywords: 'osobné financie, sledovanie výdavkov, rozpočet, finančné ciele, riadenie peňazí',
      lang: 'sk'
    },
    '/pricing': {
      title: 'Cenové Plány FinanzerPro - Bezplatný, Štandardný a Prémiový',
      description: 'Vyber si perfektný plán FinanzerPro pre tvoje potreby. Bezplatný plán so základným sledovaním, Štandardný s rozpočtami a AI, Prémiový s neobmedzenými funkciami.',
      keywords: 'ceny, predplatné, plány, bezplatný, štandardný, prémiový, finančný softvér',
      lang: 'sk'
    },
    '/help': {
      title: 'Pomoc a Dokumentácia FinanzerPro',
      description: 'Kompletný sprievodca používaním FinanzerPro. Nauč sa o sledovaní výdavkov, rozpočtoch, cieľoch, AI funkciách a mobilnom skenovaní účteniek.',
      keywords: 'pomoc, dokumentácia, sprievodca, návod, podpora, funkcie',
      lang: 'sk'
    },
    '/contact': {
      title: 'Kontaktovať Podporný Tím FinanzerPro',
      description: 'Získaj pomoc s FinanzerPro. Kontaktuj náš podporný tím pre otázky o funkciách, fakturácii alebo technickú asistenciu.',
      keywords: 'kontakt, podpora, pomoc, zákaznícky servis, technická asistencia',
      lang: 'sk'
    },
    '/auth': {
      title: 'Prihlásiť sa do FinanzerPro - Riadenie Osobných Financií',
      description: 'Prihlás sa do svojho účtu FinanzerPro pre prístup k sledovaniu výdavkov, nástrojom rozpočtu a AI-poháňaným finančným poznatkom.',
      keywords: 'prihlásiť sa, login, účet, autentifikácia, finančná aplikácia',
      lang: 'sk'
    },
    '/privacy-policy': {
      title: 'Zásady Ochrany Súkromia - FinanzerPro',
      description: 'Dozviete sa, ako FinanzerPro chráni vaše osobné a finančné údaje pomocou štandardných bezpečnostných opatrení.',
      keywords: 'zásady ochrany súkromia, ochrana údajov, bezpečnosť, osobné informácie',
      lang: 'sk'
    },
    '/terms-of-service': {
      title: 'Podmienky Služby - FinanzerPro',
      description: 'Prečítajte si podmienky služby FinanzerPro, používateľské dohody a podmienky služby pre našu platformu finančného riadenia.',
      keywords: 'podmienky služby, používateľská dohoda, právne, podmienky',
      lang: 'sk'
    },
    '/cookie-policy': {
      title: 'Pravidlá Používania Cookies - FinanzerPro',
      description: 'Dozviete sa o tom, ako FinanzerPro používa cookies na zlepšenie vašej skúsenosti a ochranu vášho súkromia.',
      keywords: 'pravidlá cookies, cookies, súkromie, funkcionalita webovej stránky',
      lang: 'sk'
    },
    '/features': {
      title: 'Finančné Funkcie Poháňané AI - FinanzerPro',
      description: 'Objavte 9 inteligentných AI funkcií, ktoré transformujú financie vášho podnikania: inteligentná kategorizácia, prediktívna analytika, hodnotenie finančného zdravia a personalizované odporúčania.',
      keywords: 'AI funkcie, finančná inteligencia, inteligentná kategorizácia, prediktívna analytika, finančné zdravie, podnikové financie, automatizované poznatky',
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
      title: 'FinanzerPro - Smart Personal Finance Management',
      description: 'Professional financial management application for tracking expenses, budgets, and goals.',
      keywords: 'finance, budgeting, expense tracking',
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
    <meta property="og:url" content="https://finanzerpro.com${language === 'en' ? '' : '/' + language}${route}">
    <meta property="og:title" content="${pageData.title}">
    <meta property="og:description" content="${pageData.description}">
    <meta property="og:image" content="https://finanzerpro.com/og-image.png">
    <meta property="og:locale" content="${pageData.lang === 'en' ? 'en_US' : pageData.lang === 'es' ? 'es_ES' : 'sk_SK'}">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="https://finanzerpro.com${language === 'en' ? '' : '/' + language}${route}">
    <meta property="twitter:title" content="${pageData.title}">
    <meta property="twitter:description" content="${pageData.description}">
    <meta property="twitter:image" content="https://finanzerpro.com/og-image.png">

    <!-- Canonical URL with language -->
    <link rel="canonical" href="https://finanzerpro.com${language === 'en' ? '' : '/' + language}${route}">
    
    <!-- Language alternates for SEO -->
    <link rel="alternate" hreflang="en" href="https://finanzerpro.com${route}">
    <link rel="alternate" hreflang="es" href="https://finanzerpro.com/es${route}">
    <link rel="alternate" hreflang="sk" href="https://finanzerpro.com/sk${route}">
    <link rel="alternate" hreflang="x-default" href="https://finanzerpro.com${route}">
    
    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.svg">
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    
    <!-- Structured Data -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "FinanzerPro",
      "description": "${pageData.description}",
      "url": "https://finanzerpro.com",
      "applicationCategory": "FinanceApplication",
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
            <h1>FinanzerPro</h1>
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
  const texts = {
    'en': '© 2025 FinanzerPro. All rights reserved.',
    'es': '© 2025 FinanzerPro. Todos los derechos reservados.',
    'sk': '© 2025 FinanzerPro. Všetky práva vyhradené.'
  };
  
  return texts[lang as keyof typeof texts] || texts['en'];
}

function getPageContent(route: string, lang: string = 'en'): string {
  const content = {
    'en': {
      '/': `
        <section>
            <h1>Smart Personal Finance Management</h1>
            <p>Take control of your finances with FinanzerPro's comprehensive expense tracking, budgeting tools, and AI-powered insights.</p>
            
            <h2>Key Features</h2>
            <ul>
                <li>Expense and Income Tracking</li>
                <li>Budget Management</li>
                <li>Financial Goals</li>
                <li>AI-Powered Categorization</li>
                <li>Receipt OCR Scanning</li>
                <li>Mobile QR Code Upload</li>
                <li>Cloud Backup & Export</li>
                <li>Financial Health Analysis</li>
            </ul>
            
            <h2>Subscription Plans</h2>
            <div>
                <h3>Free Plan</h3>
                <p>Basic expense tracking with up to 100 transactions</p>
                
                <h3>Standard Plan - $4.99/month</h3>
                <p>Enhanced features including budgets, goals, AI categorization, and receipt scanning</p>
                
                <h3>Premium Plan - $9.99/month</h3>
                <p>Unlimited transactions, advanced analytics, AI insights, and cloud backup</p>
            </div>
        </section>
      `,
      '/pricing': `
        <section>
            <h1>Pricing Plans</h1>
            <p>Choose the perfect plan for your financial management needs</p>
            
            <div>
                <h2>Free Plan - $0/month</h2>
                <ul>
                    <li>Up to 100 transactions</li>
                    <li>Basic expense tracking</li>
                    <li>Income management</li>
                    <li>Simple categories</li>
                </ul>
                
                <h2>Standard Plan - $4.99/month</h2>
                <ul>
                    <li>Unlimited transactions</li>
                    <li>Budget management</li>
                    <li>Financial goals</li>
                    <li>AI expense categorization</li>
                    <li>Receipt OCR scanning</li>
                    <li>Mobile QR code upload</li>
                    <li>Transaction reminders</li>
                </ul>
                
                <h2>Premium Plan - $9.99/month</h2>
                <ul>
                    <li>Everything in Standard</li>
                    <li>Advanced AI insights</li>
                    <li>Financial health analysis</li>
                    <li>Predictive forecasting</li>
                    <li>Cloud backup & export</li>
                    <li>Collaborative goals</li>
                    <li>Priority support</li>
                </ul>
            </div>
        </section>
      `,
      '/help': `
        <section>
            <h1>Help & Documentation</h1>
            <p>Complete guide to using FinanzerPro effectively</p>
            
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
            <p>Get help with FinanzerPro</p>
            
            <h2>Support Channels</h2>
            <ul>
                <li>Email: support@finanzerpro.com</li>
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
            <h1>Sign In to FinanzerPro</h1>
            <p>Sign in to your account to access advanced financial tools</p>
            
            <h2>Create New Account</h2>
            <ul>
                <li>Free registration</li>
                <li>Instant access</li>
                <li>Secure data storage</li>
                <li>Mobile synchronization</li>
            </ul>
            
            <h2>Already Have an Account?</h2>
            <p>Simply sign in and continue managing your finances</p>
        </section>
      `,
      '/privacy-policy': `
        <section>
            <h1>Privacy Policy</h1>
            <p>FinanzerPro is committed to protecting your personal and financial data</p>
            
            <h2>Data Collection</h2>
            <ul>
                <li>Account information</li>
                <li>Financial transactions</li>
                <li>Application usage</li>
                <li>Device technical data</li>
            </ul>
            
            <h2>Security Measures</h2>
            <ul>
                <li>256-bit SSL encryption</li>
                <li>Secure cloud storage</li>
                <li>Regular security audits</li>
                <li>GDPR compliance</li>
            </ul>
        </section>
      `,
      '/terms-of-service': `
        <section>
            <h1>Terms of Service</h1>
            <p>Read the terms of use for FinanzerPro service</p>
            
            <h2>Service Usage</h2>
            <ul>
                <li>Responsible use of features</li>
                <li>Compliance with local laws</li>
                <li>Protection of login credentials</li>
                <li>Problem reporting</li>
            </ul>
            
            <h2>Liability Limitations</h2>
            <ul>
                <li>Financial data accuracy</li>
                <li>Service availability</li>
                <li>Use of financial advice</li>
                <li>Data backup</li>
            </ul>
        </section>
      `,
      '/cookie-policy': `
        <section>
            <h1>Cookie Policy</h1>
            <p>Information about how FinanzerPro uses cookies</p>
            
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
            <h1>AI-Powered Financial Intelligence</h1>
            <p>Transform your business finances with 9 intelligent AI features that learn, adapt, and optimize your financial decisions in real-time.</p>
            
            <h2>Core AI Features</h2>
            <ul>
                <li><strong>Smart Expense Categorization</strong> - Automatically categorizes transactions with machine learning</li>
                <li><strong>Predictive Financial Analytics</strong> - Forecasts spending patterns and cash flow trends</li>
                <li><strong>Financial Health Scoring</strong> - Real-time assessment of your financial wellness</li>
                <li><strong>Intelligent Budget Recommendations</strong> - AI-driven budget optimization suggestions</li>
                <li><strong>Expense Prediction Engine</strong> - Anticipates future expenses based on historical data</li>
                <li><strong>Trend Analysis & Insights</strong> - Identifies spending patterns and optimization opportunities</li>
                <li><strong>Daily Financial Recommendations</strong> - Personalized daily tips for financial improvement</li>
                <li><strong>Contextual Financial Tips</strong> - Smart advice based on your current financial situation</li>
                <li><strong>Advanced Spending Analytics</strong> - Deep insights into your financial behavior</li>
            </ul>
            
            <h2>Key Benefits</h2>
            <ul>
                <li>Automate financial decision making</li>
                <li>Reduce manual categorization by 95%</li>
                <li>Improve financial health scores</li>
                <li>Predict and prevent overspending</li>
                <li>Get personalized financial guidance</li>
                <li>Available in 3 languages</li>
                <li>Real-time processing and insights</li>
            </ul>
            
            <h2>Industry-Leading Security</h2>
            <ul>
                <li>AES-256 encryption for sensitive data</li>
                <li>Local OCR processing - no external data transmission</li>
                <li>Privacy-first AI analysis</li>
                <li>GDPR and financial compliance standards</li>
            </ul>
        </section>
      `
    },
    'es': {
      '/': `
        <section>
            <h1>Gestión Inteligente de Finanzas Personales</h1>
            <p>Toma el control de tus finanzas con el seguimiento integral de gastos, herramientas de presupuesto e insights impulsados por IA de FinanzerPro.</p>
            
            <h2>Características Principales</h2>
            <ul>
                <li>Seguimiento de Gastos e Ingresos</li>
                <li>Gestión de Presupuestos</li>
                <li>Metas Financieras</li>
                <li>Categorización Impulsada por IA</li>
                <li>Escaneo OCR de Recibos</li>
                <li>Carga de Códigos QR Móviles</li>
                <li>Respaldo en la Nube y Exportación</li>
                <li>Análisis de Salud Financiera</li>
            </ul>
            
            <h2>Planes de Suscripción</h2>
            <div>
                <h3>Plan Gratuito</h3>
                <p>Seguimiento básico de gastos con hasta 100 transacciones</p>
                
                <h3>Plan Estándar - $4.99/mes</h3>
                <p>Características mejoradas incluyendo presupuestos, metas, categorización IA y escaneo de recibos</p>
                
                <h3>Plan Premium - $9.99/mes</h3>
                <p>Transacciones ilimitadas, análisis avanzados, insights de IA y respaldo en la nube</p>
            </div>
        </section>
      `,
      '/pricing': `
        <section>
            <h1>Planes de Precios</h1>
            <p>Elige el plan perfecto para tus necesidades de gestión financiera</p>
            
            <div>
                <h2>Plan Gratuito - $0/mes</h2>
                <ul>
                    <li>Hasta 100 transacciones</li>
                    <li>Seguimiento básico de gastos</li>
                    <li>Gestión de ingresos</li>
                    <li>Categorías simples</li>
                </ul>
                
                <h2>Plan Estándar - $4.99/mes</h2>
                <ul>
                    <li>Transacciones ilimitadas</li>
                    <li>Gestión de presupuestos</li>
                    <li>Metas financieras</li>
                    <li>Categorización de gastos con IA</li>
                    <li>Escaneo OCR de recibos</li>
                    <li>Carga de códigos QR móviles</li>
                    <li>Recordatorios de transacciones</li>
                </ul>
                
                <h2>Plan Premium - $9.99/mes</h2>
                <ul>
                    <li>Todo en Estándar</li>
                    <li>Insights avanzados de IA</li>
                    <li>Análisis de salud financiera</li>
                    <li>Pronósticos predictivos</li>
                    <li>Respaldo en la nube y exportación</li>
                    <li>Metas colaborativas</li>
                    <li>Soporte prioritario</li>
                </ul>
            </div>
        </section>
      `,
      '/help': `
        <section>
            <h1>Ayuda y Documentación</h1>
            <p>Guía completa para usar FinanzerPro efectivamente</p>
            
            <h2>Primeros Pasos</h2>
            <ul>
                <li>Crear tu cuenta</li>
                <li>Agregar tu primera transacción</li>
                <li>Configurar categorías</li>
                <li>Configuración de la app móvil</li>
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
            <p>Obtén ayuda con FinanzerPro</p>
            
            <h2>Canales de Soporte</h2>
            <ul>
                <li>Email: support@finanzerpro.com</li>
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
            <h1>Iniciar Sesión en FinanzerPro</h1>
            <p>Inicia sesión en tu cuenta para acceder a herramientas financieras avanzadas</p>
            
            <h2>Crear Nueva Cuenta</h2>
            <ul>
                <li>Registro gratuito</li>
                <li>Acceso instantáneo</li>
                <li>Almacenamiento seguro de datos</li>
                <li>Sincronización móvil</li>
            </ul>
            
            <h2>¿Ya Tienes una Cuenta?</h2>
            <p>Simplemente inicia sesión y continúa gestionando tus finanzas</p>
        </section>
      `,
      '/privacy-policy': `
        <section>
            <h1>Política de Privacidad</h1>
            <p>FinanzerPro se compromete a proteger tus datos personales y financieros</p>
            
            <h2>Recopilación de Datos</h2>
            <ul>
                <li>Información de cuenta</li>
                <li>Transacciones financieras</li>
                <li>Uso de la aplicación</li>
                <li>Datos técnicos del dispositivo</li>
            </ul>
            
            <h2>Medidas de Seguridad</h2>
            <ul>
                <li>Cifrado SSL de 256 bits</li>
                <li>Almacenamiento en nube seguro</li>
                <li>Auditorías de seguridad regulares</li>
                <li>Cumplimiento con GDPR</li>
            </ul>
        </section>
      `,
      '/terms-of-service': `
        <section>
            <h1>Términos de Servicio</h1>
            <p>Lee los términos de uso del servicio FinanzerPro</p>
            
            <h2>Uso del Servicio</h2>
            <ul>
                <li>Uso responsable de las funciones</li>
                <li>Cumplimiento de leyes locales</li>
                <li>Protección de credenciales de acceso</li>
                <li>Reporte de problemas</li>
            </ul>
            
            <h2>Limitaciones de Responsabilidad</h2>
            <ul>
                <li>Precisión de datos financieros</li>
                <li>Disponibilidad del servicio</li>
                <li>Uso de consejos financieros</li>
                <li>Respaldo de datos</li>
            </ul>
        </section>
      `,
      '/cookie-policy': `
        <section>
            <h1>Política de Cookies</h1>
            <p>Información sobre cómo FinanzerPro utiliza cookies</p>
            
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
            <h1>Inteligencia Financiera Impulsada por IA</h1>
            <p>Transforma las finanzas de tu negocio con 9 funciones inteligentes de IA que aprenden, se adaptan y optimizan tus decisiones financieras en tiempo real.</p>
            
            <h2>Funciones Core de IA</h2>
            <ul>
                <li><strong>Categorización Inteligente de Gastos</strong> - Categoriza automáticamente transacciones con aprendizaje automático</li>
                <li><strong>Análisis Financiero Predictivo</strong> - Pronostica patrones de gasto y tendencias de flujo de efectivo</li>
                <li><strong>Puntuación de Salud Financiera</strong> - Evaluación en tiempo real de tu bienestar financiero</li>
                <li><strong>Recomendaciones Inteligentes de Presupuesto</strong> - Sugerencias de optimización de presupuesto impulsadas por IA</li>
                <li><strong>Motor de Predicción de Gastos</strong> - Anticipa gastos futuros basado en datos históricos</li>
                <li><strong>Análisis de Tendencias e Insights</strong> - Identifica patrones de gasto y oportunidades de optimización</li>
                <li><strong>Recomendaciones Financieras Diarias</strong> - Consejos personalizados diarios para mejora financiera</li>
                <li><strong>Consejos Financieros Contextuales</strong> - Asesoramiento inteligente basado en tu situación financiera actual</li>
                <li><strong>Análisis Avanzado de Gastos</strong> - Insights profundos sobre tu comportamiento financiero</li>
            </ul>
            
            <h2>Beneficios Clave</h2>
            <ul>
                <li>Automatiza la toma de decisiones financieras</li>
                <li>Reduce la categorización manual en un 95%</li>
                <li>Mejora las puntuaciones de salud financiera</li>
                <li>Predice y previene el gasto excesivo</li>
                <li>Obtén orientación financiera personalizada</li>
                <li>Disponible en 3 idiomas</li>
                <li>Procesamiento e insights en tiempo real</li>
            </ul>
            
            <h2>Seguridad Líder en la Industria</h2>
            <ul>
                <li>Cifrado AES-256 para datos sensibles</li>
                <li>Procesamiento OCR local - sin transmisión externa de datos</li>
                <li>Análisis de IA que prioriza la privacidad</li>
                <li>Estándares de cumplimiento GDPR y financiero</li>
            </ul>
        </section>
      `
    },
    'sk': {
      '/': `
        <section>
            <h1>Inteligentné Riadenie Osobných Financií</h1>
            <p>Prevezmi kontrolu nad svojimi financiami s komplexným sledovaním výdavkov, nástrojmi rozpočtu a AI-poháňanými poznatkami od FinanzerPro.</p>
            
            <h2>Hlavné Funkcie</h2>
            <ul>
                <li>Sledovanie Výdavkov a Príjmov</li>
                <li>Správa Rozpočtu</li>
                <li>Finančné Ciele</li>
                <li>AI-Poháňaná Kategorizácia</li>
                <li>OCR Skenovanie Účteniek</li>
                <li>Mobilné QR Kód Nahrávanie</li>
                <li>Cloudové Zálohovanie a Export</li>
                <li>Analýza Finančného Zdravia</li>
            </ul>
            
            <h2>Predplatné Plány</h2>
            <div>
                <h3>Bezplatný Plán</h3>
                <p>Základné sledovanie výdavkov s až 100 transakciami</p>
                
                <h3>Štandardný Plán - $4.99/mesiac</h3>
                <p>Vylepšené funkcie vrátane rozpočtov, cieľov, AI kategorizácie a skenovania účteniek</p>
                
                <h3>Prémiový Plán - $9.99/mesiac</h3>
                <p>Neobmedzené transakcie, pokročilé analýzy, AI poznatky a cloudové zálohovanie</p>
            </div>
        </section>
      `,
      '/pricing': `
        <section>
            <h1>Cenové Plány</h1>
            <p>Vyber si perfektný plán pre svoje potreby finančného riadenia</p>
            
            <div>
                <h2>Bezplatný Plán - $0/mesiac</h2>
                <ul>
                    <li>Až 100 transakcií</li>
                    <li>Základné sledovanie výdavkov</li>
                    <li>Riadenie príjmov</li>
                    <li>Jednoduché kategórie</li>
                </ul>
                
                <h2>Štandardný Plán - $4.99/mesiac</h2>
                <ul>
                    <li>Neobmedzené transakcie</li>
                    <li>Správa rozpočtu</li>
                    <li>Finančné ciele</li>
                    <li>AI kategorizácia výdavkov</li>
                    <li>OCR skenovanie účteniek</li>
                    <li>Mobilné QR kód nahrávanie</li>
                    <li>Pripomienky transakcií</li>
                </ul>
                
                <h2>Prémiový Plán - $9.99/mesiac</h2>
                <ul>
                    <li>Všetko v Štandardnom</li>
                    <li>Pokročilé AI poznatky</li>
                    <li>Analýza finančného zdravia</li>
                    <li>Prediktívne prognózy</li>
                    <li>Cloudové zálohovanie a export</li>
                    <li>Spolupracujúce ciele</li>
                    <li>Prioritná podpora</li>
                </ul>
            </div>
        </section>
      `,
      '/help': `
        <section>
            <h1>Pomoc a Dokumentácia</h1>
            <p>Kompletný sprievodca efektívnym používaním FinanzerPro</p>
            
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
            <p>Získaj pomoc s FinanzerPro</p>
            
            <h2>Kanály Podpory</h2>
            <ul>
                <li>Email: support@finanzerpro.com</li>
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
            <h1>Prihlásiť sa do FinanzerPro</h1>
            <p>Prihlás sa do svojho účtu pre prístup k pokročilým finančným nástrojom</p>
            
            <h2>Vytvoriť Nový Účet</h2>
            <ul>
                <li>Bezplatná registrácia</li>
                <li>Okamžitý prístup</li>
                <li>Bezpečné uloženie dát</li>
                <li>Mobilná synchronizácia</li>
            </ul>
            
            <h2>Už Máš Účet?</h2>
            <p>Jednoducho sa prihlás a pokračuj v správe svojich financií</p>
        </section>
      `,
      '/privacy-policy': `
        <section>
            <h1>Zásady Ochrany Súkromia</h1>
            <p>FinanzerPro sa zaväzuje chrániť vaše osobné a finančné údaje</p>
            
            <h2>Zhromažďovanie Údajov</h2>
            <ul>
                <li>Informácie o účte</li>
                <li>Finančné transakcie</li>
                <li>Používanie aplikácie</li>
                <li>Technické údaje zariadenia</li>
            </ul>
            
            <h2>Bezpečnostné Opatrenia</h2>
            <ul>
                <li>256-bitové SSL šifrovanie</li>
                <li>Zabezpečené cloudové úložisko</li>
                <li>Pravidelné bezpečnostné audity</li>
                <li>Súlad s GDPR</li>
            </ul>
        </section>
      `,
      '/terms-of-service': `
        <section>
            <h1>Podmienky Služby</h1>
            <p>Prečítajte si podmienky používania služby FinanzerPro</p>
            
            <h2>Používanie Služby</h2>
            <ul>
                <li>Zodpovedné používanie funkcií</li>
                <li>Dodržiavanie miestnych zákonov</li>
                <li>Ochrana prihlasovacích údajov</li>
                <li>Nahlasovania problémov</li>
            </ul>
            
            <h2>Obmedzeniya Zodpovednosti</h2>
            <ul>
                <li>Presnosť finančných údajov</li>
                <li>Dostupnosť služby</li>
                <li>Použitie finančných rád</li>
                <li>Zálohovanie údajov</li>
            </ul>
        </section>
      `,
      '/cookie-policy': `
        <section>
            <h1>Pravidlá Používania Cookies</h1>
            <p>Informácie o tom, ako FinanzerPro používa cookies</p>
            
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
            <h1>Finančná Inteligencia Poháňaná AI</h1>
            <p>Transformujte financie vášho podnikania s 9 inteligentnými AI funkciami, ktoré sa učia, prispôsobujú a optimalizujú vaše finančné rozhodnutia v reálnom čase.</p>
            
            <h2>Základné AI Funkcie</h2>
            <ul>
                <li><strong>Inteligentná Kategorizácia Výdavkov</strong> - Automaticky kategorizuje transakcie pomocou strojového učenia</li>
                <li><strong>Prediktívna Finančná Analytika</strong> - Predpovedá vzorce míňania a trendy peňažných tokov</li>
                <li><strong>Hodnotenie Finančného Zdravia</strong> - Hodnotenie vášho finančného blahobytu v reálnom čase</li>
                <li><strong>Inteligentné Rozpočtové Odporúčania</strong> - Návrhy optimalizácie rozpočtu poháňané AI</li>
                <li><strong>Engine Predikcie Výdavkov</strong> - Predpovedá budúce výdavky na základe historických údajov</li>
                <li><strong>Analýza Trendov a Poznatky</strong> - Identifikuje vzorce míňania a príležitosti na optimalizáciu</li>
                <li><strong>Denné Finančné Odporúčania</strong> - Personalizované denné tipy na zlepšenie financií</li>
                <li><strong>Kontextové Finančné Tipy</strong> - Inteligentné poradenstvo na základe vašej aktuálnej finančnej situácie</li>
                <li><strong>Pokročilá Analytika Míňania</strong> - Hlboké poznatky o vašom finančnom správaní</li>
            </ul>
            
            <h2>Kľúčové Výhody</h2>
            <ul>
                <li>Automatizácia finančného rozhodovania</li>
                <li>Zníženie manuálnej kategorizácie o 95%</li>
                <li>Zlepšenie skóre finančného zdravia</li>
                <li>Predpovedanie a prevencia nadmerného míňania</li>
                <li>Získanie personalizovaného finančného vedenia</li>
                <li>Dostupné v 3 jazykoch</li>
                <li>Spracovanie a poznatky v reálnom čase</li>
            </ul>
            
            <h2>Bezpečnosť na Úrovni Priemyslu</h2>
            <ul>
                <li>AES-256 šifrovanie pre citlivé údaje</li>
                <li>Lokálne OCR spracovanie - žiadny externý prenos údajov</li>
                <li>AI analýza s prioritou súkromia</li>
                <li>GDPR a finančné štandardy compliance</li>
            </ul>
        </section>
      `
    }
  };

  const langContent = content[lang as keyof typeof content];
  if (langContent && langContent[route]) {
    return langContent[route];
  }

  // Fallback to English
  const englishContent = content['en'];
  if (englishContent && englishContent[route]) {
    return englishContent[route];
  }

  return '<p>Page content not found</p>';
}