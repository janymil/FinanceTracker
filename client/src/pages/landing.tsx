import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Sparkles, Mic, ScanLine, FileText, Target, ShieldCheck, Check, X, Crown, Sun, Moon,
  ArrowRight, ReceiptText, Play, BarChart3, BrainCircuit, Menu, TrendingUp
} from "lucide-react";
import { useLocation } from "wouter";
import { SEO } from "@/components/SEO";
import { useTheme } from "@/context/ThemeContext";
import { useTranslation } from "react-i18next";
import { Footer } from "@/components/footer";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

function SectionHeading({ kicker, title, accent, sub }: { kicker: string; title: string; accent?: string; sub?: string }) {
  const { t } = useTranslation();
  return (
    <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className="text-center mb-14">
      <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 dark:border-white/10 bg-indigo-50/70 dark:bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
        {t(kicker)}
      </span>
      <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white mt-5">
        {t(title)}{accent ? <> <span className="text-gradient">{t(accent)}</span></> : null}
      </h2>
      {sub ? <p className="text-lg text-gray-600 dark:text-gray-300 mt-4 max-w-2xl mx-auto">{t(sub)}</p> : null}
    </motion.div>
  );
}

const planData = [
  {
    id: "free",
    name: "Free",
    monthly: "$0",
    yearly: "$0",
    yearlyNote: null as string | null,
    yearlyBadge: null as string | null,
    desc: "Perfect for getting started with expense tracking",
    features: [
      "Basic expense and income tracking",
      "Manual categorization",
      "Up to 100 transactions view",
      "Simple spending overview",
      "Personalized smart tips",
    ],
    cta: "Get Started Free",
    popular: false,
  },
  {
    id: "standard",
    name: "Standard",
    monthly: "$4.99",
    yearly: "$49.90",
    yearlyNote: "$4.16/month • Save 2 months",
    yearlyBadge: "Save $9.98",
    desc: "For people ready to understand their spending",
    features: [
      "Everything in Free plan",
      "Goals and budget management",
      "Interactive charts and reports",
      "AI expense categorization",
      "Calendar view and reminders",
      "Unlimited transaction history",
    ],
    cta: "Subscribe Now",
    popular: false,
  },
  {
    id: "premium",
    name: "Premium",
    monthly: "$9.99",
    yearly: "$99.90",
    yearlyNote: "$8.33/month • Save 2 months",
    yearlyBadge: "Save $19.98",
    desc: "The full intelligent tracking experience",
    features: [
      "Everything in Standard plan",
      "AI tips and insights",
      "Advanced trends analysis",
      "Expense prediction",
      "Daily personalized recommendations",
      "Cloud data backup",
      "Data management (CSV, PDF)",
      "Priority email support",
    ],
    cta: "Subscribe Now",
    popular: true,
  },
];

function PricingCards({ billing, onSelect }: { billing: "monthly" | "yearly"; onSelect: (plan: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
      {planData.map((plan, i) => {
        const price = billing === "monthly" ? plan.monthly : plan.yearly;
        const selectId = billing === "monthly" ? plan.id : `${plan.id}-yearly`;
        const card = (
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            custom={i}
            className={`relative flex flex-col h-full rounded-[calc(1.5rem-1.5px)] p-8 ${
              plan.popular
                ? "bg-white dark:bg-[#0b0d16]"
                : "glass-card"
            }`}
          >
            {billing === "yearly" && plan.yearlyBadge && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white border-0 px-4 py-1">
                {t(plan.yearlyBadge)}
              </Badge>
            )}
            {plan.popular && (
              <Badge className={`absolute -top-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0 px-4 py-1 ${billing === "yearly" && plan.yearlyBadge ? "right-4 left-auto translate-x-0" : "left-1/2 -translate-x-1/2"}`}>
                <Crown className="h-3 w-3 mr-1" />
                {t("Most Popular")}
              </Badge>
            )}
            <div className="text-center pb-6 border-b border-gray-200/70 dark:border-white/10">
              <h3 className="font-display text-2xl font-bold mb-4">{t(plan.name)}</h3>
              <div className="font-display text-5xl font-bold tracking-tight">
                {price}
                <span className="text-base font-normal text-gray-500 dark:text-gray-400">/{billing === "monthly" ? t("month") : t("year")}</span>
              </div>
              {billing === "yearly" && plan.yearlyNote && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mt-1.5">{t(plan.yearlyNote)}</p>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">{t(plan.desc)}</p>
            </div>
            <ul className="space-y-3.5 py-6 flex-1">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 h-5 w-5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-emerald-500" />
                  </span>
                  <span className="text-gray-700 dark:text-gray-200">{t(feature)}</span>
                </li>
              ))}
            </ul>
            <Button
              onClick={() => onSelect(selectId)}
              size="lg"
              variant={plan.popular ? "default" : "outline"}
              className={`w-full rounded-xl h-11 ${
                plan.popular
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-indigo-500/25"
                  : "border-gray-300 dark:border-white/15"
              }`}
            >
              {plan.popular && <Crown className="h-4 w-4 mr-2" />}
              {t(plan.cta)}
            </Button>
          </motion.div>
        );
        return plan.popular ? (
          <div key={plan.id} className="rounded-3xl p-[1.5px] bg-gradient-to-b from-blue-500 via-indigo-500 to-purple-500 shadow-xl shadow-indigo-500/15 lg:-my-4">
            {card}
          </div>
        ) : (
          <div key={plan.id} className="h-full">{card}</div>
        );
      })}
    </div>
  );
}

export default function Landing() {
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();

  // Extract current language from URL to build language-aware links
  const currentLang = location.match(/^\/([a-z]{2})\//)?.[1] || 'en';

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Smooth-scroll to a front-page section (nav is fixed, sections have scroll-mt)
  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      setLocation(`/${currentLang}#${id}`);
    }
  };

  const handleLogin = () => {
    setLocation(`/${currentLang}/auth#sign-in`);
  };

  const handleGetStarted = (plan: string) => {
    // Store the desired plan for after authentication
    if (plan !== 'free') {
      localStorage.setItem('selectedPlan', plan);
    }
    setLocation(`/${currentLang}/auth#sign-up`);
  };

  // Hero parallax (disabled when user prefers reduced motion)
  const heroRef = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [5, -5]), { stiffness: 60, damping: 18 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-7, 7]), { stiffness: 60, damping: 18 });

  const handleHeroMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion || !heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const marqueeItems = [
    { icon: BrainCircuit, label: "AI categorization" },
    { icon: Mic, label: "Voice input" },
    { icon: ScanLine, label: "Receipt scanning" },
    { icon: FileText, label: "Statement import" },
    { icon: Target, label: "Budgets & goals" },
    { icon: ArrowRight, label: "Shared goals" },
    { icon: Sparkles, label: "Smart reminders" },
    { icon: BarChart3, label: "Spending predictions" },
    { icon: ShieldCheck, label: "AES-256 encryption" },
  ];

  return (
    <>
      <SEO
        title="Kaptia - Smart Spending Tracker with AI Insights | Receipts, Voice & Budgets"
        description="Kaptia turns receipts, voice notes and statements into a clear picture of your spending. Snap a photo, speak a note, or import a file - AI organizes the rest. Start free today!"
        keywords="spending tracker, expense tracker, budget planner, receipt scanner, voice expense input, AI categorization, savings goals, smart budgeting, expense tracking"
        canonical="https://kaptia.app"
      />
      <div className="min-h-screen bg-[#f7f8fc] dark:bg-[#07080f] text-gray-900 dark:text-white overflow-hidden">
      {/* ============ NAVIGATION ============ */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-gray-200/60 dark:border-white/[0.06] bg-white/70 dark:bg-[#07080f]/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button onClick={() => setLocation(`/${currentLang}`)} className="flex items-center gap-2.5 group">
              <TrendingUp className="h-8 w-8 text-primary transition-transform group-hover:scale-105" />
              <span className="font-display text-xl font-bold tracking-tight text-gray-900 dark:text-white">Kaptia</span>
            </button>
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Front-page sections */}
              <button onClick={() => scrollToSection('how-it-works')} className="hidden lg:block text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                {t("How it works")}
              </button>
              <button onClick={() => scrollToSection('features')} className="hidden lg:block text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                {t("Features")}
              </button>
              <button onClick={() => scrollToSection('pricing')} className="hidden lg:block text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                {t("Pricing")}
              </button>
              <button onClick={() => scrollToSection('faq')} className="hidden lg:block text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                {t("FAQ")}
              </button>
              <button onClick={() => setLocation('/help')} className="hidden xl:block text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                {t("Help")}
              </button>
              <button onClick={() => setLocation('/contact')} className="hidden xl:block text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                {t("Contact")}
              </button>
              <button onClick={toggleTheme} className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors" aria-label="Toggle theme">
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <Button onClick={handleLogin} variant="ghost" className="hidden sm:inline-flex font-medium">
                {t("Sign In")}
              </Button>
              <Button onClick={handleLogin} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-indigo-500/25">
                {t("Get Started Free")}
              </Button>
              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="lg:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                aria-label={mobileMenuOpen ? t("Close menu") : t("Menu")}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
          {/* Mobile section menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden pb-4">
              <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/95 dark:bg-[#0b0d16]/95 backdrop-blur-xl p-2 shadow-xl">
                {[
                  ['how-it-works', 'How it works'],
                  ['features', 'Features'],
                  ['pricing', 'Pricing'],
                  ['faq', 'FAQ'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => scrollToSection(id)}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                  >
                    {t(label)}
                  </button>
                ))}
                <div className="h-px bg-gray-200 dark:bg-white/10 my-1" />
                <button
                  onClick={() => { setMobileMenuOpen(false); setLocation('/help'); }}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                >
                  {t("Help")}
                </button>
                <button
                  onClick={() => { setMobileMenuOpen(false); setLocation('/contact'); }}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                >
                  {t("Contact")}
                </button>
                <button
                  onClick={() => { setMobileMenuOpen(false); handleLogin(); }}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-white/5 transition-colors"
                >
                  {t("Sign In")}
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-24" ref={heroRef} onMouseMove={handleHeroMouse}>
        {/* Aurora background */}
        <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_75%_65%_at_50%_35%,black,transparent)]" />
          <div className="aurora-blob absolute -top-32 left-1/2 -translate-x-1/2 h-[480px] w-[820px] rounded-full bg-gradient-to-r from-blue-500/25 via-indigo-500/25 to-purple-500/25 blur-3xl dark:from-blue-500/20 dark:via-indigo-500/20 dark:to-purple-500/20" />
          <div className="aurora-blob absolute top-40 -left-40 h-96 w-96 rounded-full bg-blue-400/20 dark:bg-blue-600/10 blur-3xl [animation-delay:-8s]" />
          <div className="aurora-blob absolute top-24 -right-40 h-96 w-96 rounded-full bg-purple-400/20 dark:bg-purple-600/10 blur-3xl [animation-delay:-14s]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}>
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm">
              <Sparkles className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
              {t("AI that does the tracking for you")}
            </span>
          </motion.div>

          <motion.h1 variants={fadeUp} initial="hidden" animate="show" custom={1} className="font-display text-5xl md:text-7xl lg:text-[5.25rem] font-bold tracking-tight leading-[1.05] text-gray-900 dark:text-white mt-8">
            {t("Your spending,")}
            <span className="text-gradient block pb-2">{t("finally decoded.")}</span>
          </motion.h1>

          <motion.p variants={fadeUp} initial="hidden" animate="show" custom={2} className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mt-6 max-w-3xl mx-auto leading-relaxed">
            {t("Kaptia is the intelligent tracker that captures receipts with a photo, understands expenses you say out loud, imports your statements, and turns it all into clear insights and budgets that actually stick.")}
          </motion.p>
          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={3} className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
            <Button onClick={handleLogin} size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-0 text-base px-8 h-12 rounded-xl shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/40 transition-shadow w-full sm:w-auto">
              {t("Start Free - No Card Required")}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button onClick={() => scrollToSection('how-it-works')} size="lg" variant="outline" className="text-base px-8 h-12 rounded-xl border-gray-300 dark:border-white/15 bg-white/60 dark:bg-white/5 backdrop-blur w-full sm:w-auto">
              <Play className="h-4 w-4 mr-2" />
              {t("See How It Works")}
            </Button>
          </motion.div>

          <motion.dl variants={fadeUp} initial="hidden" animate="show" custom={4} className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto mt-14">
            {[
              ["9", "AI features"],
              ["3", "Languages"],
              ["AES-256", "Encryption"],
              ["$0", "Free forever plan"],
            ].map(([value, label]) => (
              <div key={label} className="text-center">
                <dt className="sr-only">{t(label)}</dt>
                <dd className="font-display text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{value}</dd>
                <dd className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t(label)}</dd>
              </div>
            ))}
          </motion.dl>
          {/* Hero product mockup */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative max-w-4xl mx-auto mt-16 [perspective:1400px]"
          >
            <motion.div style={reduceMotion ? undefined : { rotateX, rotateY }} className="relative rounded-2xl glass-card shadow-2xl shadow-indigo-500/10 dark:shadow-black/40 overflow-hidden">
              {/* window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200/70 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.03]">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-3 text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-md px-3 py-1">kaptia.app/dashboard</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 text-left">
                {/* Balance + chart */}
                <div className="md:col-span-2 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] p-5">
                  <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">{t("Total tracked this month")}</p>
                  <p className="font-display text-3xl font-bold mt-1">$1,284.50</p>
                  <svg viewBox="0 0 300 80" className="w-full h-20 mt-3" aria-hidden>
                    <defs>
                      <linearGradient id="heroChartFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="heroChartLine" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#2563eb" />
                        <stop offset="100%" stopColor="#9333ea" />
                      </linearGradient>
                    </defs>
                    <path d="M0,62 C30,58 45,40 70,44 C95,48 110,28 140,30 C170,32 185,50 215,38 C245,26 270,18 300,22 L300,80 L0,80 Z" fill="url(#heroChartFill)" />
                    <path d="M0,62 C30,58 45,40 70,44 C95,48 110,28 140,30 C170,32 185,50 215,38 C245,26 270,18 300,22" fill="none" stroke="url(#heroChartLine)" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
                {/* Budget bars */}
                <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] p-5 space-y-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">{t("Budgets & goals")}</p>
                  {[
                    ["Groceries", "w-[68%]", "68%"],
                    ["Dining out", "w-[45%]", "45%"],
                    ["Transport", "w-[30%]", "30%"],
                  ].map(([label, width, pct]) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-gray-600 dark:text-gray-300">{t(label)}</span>
                        <span className="text-gray-400">{pct}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-200/80 dark:bg-white/10 overflow-hidden">
                        <div className={`h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 ${width}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
            {/* Floating: receipt scanned */}
            <div className="animate-float hidden md:flex absolute -left-16 top-10 items-center gap-3 rounded-2xl glass-card shadow-xl shadow-indigo-500/10 px-4 py-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <ReceiptText className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold">{t("Receipt scanned")}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("Groceries")} · $42.10</p>
              </div>
            </div>

            {/* Floating: voice entry */}
            <div className="animate-float-slow hidden md:flex absolute -right-14 top-1/3 items-center gap-3 rounded-2xl glass-card shadow-xl shadow-indigo-500/10 px-4 py-3 [animation-delay:-3s]">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                <Mic className="h-5 w-5 text-indigo-500" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold">"{t("Coffee")} · $4.50"</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("Added by voice")}</p>
              </div>
            </div>

            {/* Floating: AI insight */}
            <div className="animate-float hidden md:flex absolute -left-10 bottom-6 items-center gap-3 rounded-2xl glass-card shadow-xl shadow-indigo-500/10 px-4 py-3 [animation-delay:-5s]">
              <div className="h-10 w-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-purple-500" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold">{t("AI insight")}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("Dining out is up 18% this month")}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============ CAPABILITIES MARQUEE ============ */}
      <section className="relative py-6 border-y border-gray-200/70 dark:border-white/[0.06] bg-white/50 dark:bg-white/[0.02] overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#f7f8fc] dark:from-[#07080f] to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#f7f8fc] dark:from-[#07080f] to-transparent z-10" />
        <div className="marquee-track items-center gap-10 px-6">
          {[...marqueeItems, ...marqueeItems].map((item, i) => (
            <span key={i} className="inline-flex items-center gap-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
              <item.icon className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
              {t(item.label)}
            </span>
          ))}
        </div>
      </section>
      {/* ============ HOW IT WORKS ============ */}
      <section id="how-it-works" className="py-24 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            kicker="How Kaptia works"
            title="From chaos to clarity"
            accent="in three steps"
            sub="No spreadsheets, no manual entry marathons. Kaptia meets your spending where it happens."
          />
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* connecting gradient line */}
            <div className="hidden md:block absolute top-12 left-[16.66%] right-[16.66%] h-px bg-gradient-to-r from-blue-500/40 via-indigo-500/40 to-purple-500/40" aria-hidden />
            {[
              {
                step: "01",
                icon: ScanLine,
                title: "Capture anything",
                desc: "Snap a receipt, say it out loud, or drop in a statement PDF. Kaptia accepts spending in any form.",
                tint: "text-blue-500 bg-blue-500/10",
              },
              {
                step: "02",
                icon: BrainCircuit,
                title: "AI organizes it",
                desc: "Every entry is categorized, matched and double-checked automatically - getting sharper every week you use it.",
                tint: "text-indigo-500 bg-indigo-500/10",
              },
              {
                step: "03",
                icon: BarChart3,
                title: "See it clearly",
                desc: "Dashboards, trends and predictions show exactly where your money goes - and what to adjust next.",
                tint: "text-purple-500 bg-purple-500/10",
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-60px" }}
                custom={i}
                className="relative rounded-2xl glass-card p-8 text-center hover:-translate-y-1.5 transition-transform duration-300"
              >
                <div className={`relative mx-auto h-16 w-16 rounded-2xl ${item.tint} flex items-center justify-center mb-6`}>
                  <item.icon className="h-8 w-8" />
                  <span className="absolute -top-2 -right-2 h-6 min-w-6 px-1 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-[11px] font-bold flex items-center justify-center font-display">
                    {item.step}
                  </span>
                </div>
                <h3 className="font-display text-xl font-bold mb-3">{t(item.title)}</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{t(item.desc)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      {/* ============ FEATURES BENTO ============ */}
      <section id="features" className="py-24 relative scroll-mt-24">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-indigo-50/60 dark:via-indigo-950/20 to-transparent" aria-hidden />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            kicker="Everything inside"
            title="One tracker."
            accent="Every superpower."
            sub="Six intelligent systems working together so you never have to type an expense again."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* AI categorization - wide */}
            <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="md:col-span-2 rounded-3xl glass-card p-8 overflow-hidden group">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-5">
                <BrainCircuit className="h-6 w-6 text-indigo-500" />
              </div>
              <h3 className="font-display text-2xl font-bold mb-2">{t("AI that understands your spending")}</h3>
              <p className="text-gray-600 dark:text-gray-300 max-w-md">{t("Transactions are categorized the moment they arrive, learning your habits to get sharper every week.")}</p>
              <div className="flex flex-wrap gap-2 mt-6">
                {["Groceries", "Dining out", "Transport", "Subscriptions", "Travel", "Health"].map((chip, i) => (
                  <span key={chip} className="animate-chip rounded-full border border-indigo-200/70 dark:border-indigo-400/20 bg-indigo-50/80 dark:bg-indigo-500/10 px-3.5 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-300" style={{ animationDelay: `${i * 0.55}s` }}>
                    {t(chip)}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Voice input */}
            <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} custom={1} className="rounded-3xl glass-card p-8">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-5">
                <Mic className="h-6 w-6 text-blue-500" />
              </div>
              <h3 className="font-display text-xl font-bold mb-2">{t("Say it, track it")}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">{t("Speak an expense in seconds - Kaptia turns your words into structured, categorized entries.")}</p>
              <div className="flex items-end gap-1 h-12 mt-6" aria-hidden>
                {[0.5, 0.9, 0.65, 1, 0.45, 0.8, 0.6, 0.95, 0.5, 0.7, 0.4, 0.85].map((h, i) => (
                  <span key={i} className="wave-bar w-1.5 rounded-full bg-gradient-to-t from-blue-500 to-indigo-500" style={{ height: `${h * 100}%`, animationDelay: `${i * 0.09}s` }} />
                ))}
              </div>
            </motion.div>

            {/* Receipt scanning */}
            <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} custom={2} className="rounded-3xl glass-card p-8">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-5">
                <ScanLine className="h-6 w-6 text-emerald-500" />
              </div>
              <h3 className="font-display text-xl font-bold mb-2">{t("Snap. Scanned. Sorted.")}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">{t("Point your camera at any receipt. OCR reads every line and files it instantly.")}</p>
              <div className="relative mt-6 h-24 rounded-xl border border-dashed border-emerald-400/40 bg-emerald-50/50 dark:bg-emerald-500/5 overflow-hidden" aria-hidden>
                <div className="scan-beam absolute left-3 right-3 h-0.5 rounded-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
                <div className="absolute inset-x-4 top-4 space-y-2">
                  <div className="h-1.5 rounded bg-emerald-300/50 dark:bg-emerald-400/20 w-2/3" />
                  <div className="h-1.5 rounded bg-emerald-300/50 dark:bg-emerald-400/20 w-1/2" />
                  <div className="h-1.5 rounded bg-emerald-300/50 dark:bg-emerald-400/20 w-3/4" />
                </div>
              </div>
            </motion.div>
            {/* Statement import - wide */}
            <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="md:col-span-2 rounded-3xl glass-card p-8">
              <div className="grid md:grid-cols-2 gap-6 items-center">
                <div>
                  <div className="h-12 w-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-5">
                    <FileText className="h-6 w-6 text-purple-500" />
                  </div>
                  <h3 className="font-display text-2xl font-bold mb-2">{t("Statements, imported in seconds")}</h3>
                  <p className="text-gray-600 dark:text-gray-300">{t("Drop a PDF statement and watch pages of history become clean, searchable transactions - processed privately on your own device.")}</p>
                </div>
                <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] p-4 space-y-2.5" aria-hidden>
                  {[
                    ["Coffee House", "-$4.50", "text-rose-500"],
                    ["Salary", "+$2,900.00", "text-emerald-500"],
                    ["Grocery Market", "-$42.10", "text-rose-500"],
                  ].map(([name, amount, tone]) => (
                    <div key={name} className="flex items-center justify-between rounded-lg border border-gray-200/60 dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] px-3.5 py-2.5">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{name}</span>
                      <span className={`text-xs font-bold ${tone}`}>{amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Goals */}
            <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} custom={1} className="rounded-3xl glass-card p-8">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-5">
                <Target className="h-6 w-6 text-amber-500" />
              </div>
              <h3 className="font-display text-xl font-bold mb-2">{t("Goals that keep you honest")}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">{t("Budgets and shared goals with gentle nudges before you overspend - not after.")}</p>
              <div className="mt-6 flex items-center justify-center" aria-hidden>
                <div className="relative h-20 w-20">
                  <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
                    <circle cx="40" cy="40" r="34" fill="none" strokeWidth="8" className="stroke-gray-200 dark:stroke-white/10" />
                    <circle cx="40" cy="40" r="34" fill="none" strokeWidth="8" strokeLinecap="round" stroke="url(#goalRing)" strokeDasharray="213.6" strokeDashoffset="70" />
                    <defs>
                      <linearGradient id="goalRing" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-bold">67%</span>
                </div>
              </div>
            </motion.div>

            {/* Privacy */}
            <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} custom={2} className="rounded-3xl glass-card p-8 md:col-span-1">
              <div className="h-12 w-12 rounded-2xl bg-sky-500/10 flex items-center justify-center mb-5">
                <ShieldCheck className="h-6 w-6 text-sky-500" />
              </div>
              <h3 className="font-display text-xl font-bold mb-2">{t("Private by design")}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">{t("Your data is encrypted with AES-256 in transit and at rest. You own it - always.")}</p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-sky-300/40 dark:border-sky-400/20 bg-sky-50 dark:bg-sky-500/10 px-3.5 py-1.5 text-xs font-semibold text-sky-600 dark:text-sky-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                AES-256
              </div>
            </motion.div>
          </div>
          <div className="text-center mt-10">
            <Button onClick={() => setLocation(`/${currentLang}/features`)} variant="outline" className="rounded-xl border-gray-300 dark:border-white/15 bg-white/60 dark:bg-white/5 backdrop-blur">
              {t("Explore all features")}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>
      {/* ============ PRICING ============ */}
      <section className="py-24 relative scroll-mt-24" id="pricing">
        <div className="absolute inset-0 -z-10" aria-hidden>
          <div className="aurora-blob absolute top-20 left-1/2 -translate-x-1/2 h-[420px] w-[720px] rounded-full bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            kicker="Pricing"
            title="Simple pricing,"
            accent="serious value."
            sub="Start free and upgrade when you want more AI horsepower. Cancel anytime."
          />
          <Tabs defaultValue="monthly" className="w-full">
            <div className="flex justify-center mb-12">
              <TabsList className="grid w-full max-w-xs grid-cols-2 rounded-xl h-11 glass-card">
                <TabsTrigger value="monthly" className="rounded-lg">{t("Monthly")}</TabsTrigger>
                <TabsTrigger value="yearly" className="rounded-lg">{t("Yearly")}</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="monthly">
              <PricingCards billing="monthly" onSelect={handleGetStarted} />
            </TabsContent>
            <TabsContent value="yearly">
              <PricingCards billing="yearly" onSelect={handleGetStarted} />
            </TabsContent>
          </Tabs>
        </div>
      </section>
      {/* ============ FEATURE COMPARISON ============ */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            kicker="Compare plans"
            title="Compare All Features"
            sub="See exactly what's included in each plan"
          />
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="rounded-3xl glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200/70 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.03]">
                    <th className="text-left px-6 py-4 font-display font-bold">{t("Features")}</th>
                    <th className="px-6 py-4 text-center font-display font-bold">{t("Free")}</th>
                    <th className="px-6 py-4 text-center font-display font-bold text-blue-600 dark:text-blue-400">{t("Standard")}</th>
                    <th className="px-6 py-4 text-center font-display font-bold text-purple-600 dark:text-purple-400">{t("Premium")}</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ["Basic expense tracking", true, true, true],
                    ["Manual categorization", true, true, true],
                    ["Simple spending overview", true, true, true],
                    ["Personalized smart tips", true, true, true],
                    ["Transaction history", "Up to 100", "Unlimited", "Unlimited"],
                    ["Goals and budget management", false, true, true],
                    ["Interactive charts and reports", false, true, true],
                    ["AI expense categorization", false, true, true],
                    ["Calendar view and reminders", false, true, true],
                    ["AI tips and insights", false, false, true],
                    ["Advanced trends analysis", false, false, true],
                    ["Expense prediction", false, false, true],
                    ["Daily personalized recommendations", false, false, true],
                    ["Cloud data backup", false, false, true],
                    ["Data management (CSV, PDF)", false, false, true],
                    ["Priority email support", false, false, true],
                  ] as Array<[string, boolean | string, boolean | string, boolean | string]>).map(([label, free, standard, premium]) => (
                    <tr key={label} className="border-b border-gray-100/80 dark:border-white/[0.05] last:border-0 hover:bg-indigo-50/40 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3.5 font-medium text-gray-800 dark:text-gray-100">{t(label)}</td>
                      {[free, standard, premium].map((cell, ci) => (
                        <td key={ci} className="px-6 py-3.5 text-center">
                          {typeof cell === "string" ? (
                            <span className="text-gray-500 dark:text-gray-400">{t(cell)}</span>
                          ) : cell ? (
                            <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-gray-300 dark:text-gray-600 mx-auto" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </section>
      {/* ============ FAQ ============ */}
      <section id="faq" className="py-24 scroll-mt-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading kicker="FAQ" title="Frequently Asked Questions" />
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }}>
            <Accordion type="single" collapsible className="space-y-4">
              {[
                {
                  q: "What can Kaptia actually capture?",
                  a: "Receipts via your camera, expenses spoken out loud, PDF statements, and classic manual entries - all organized automatically by AI.",
                },
                {
                  q: "Can I cancel my subscription anytime?",
                  a: "Yes, you can cancel your subscription at any time. Your access will continue until the end of your current billing period.",
                },
                {
                  q: "Is there a free trial for paid plans?",
                  a: "No, there is no free trial for paid plans. However, you can start with our free plan to explore basic features before upgrading to Standard or Premium.",
                },
                {
                  q: "How secure is my data?",
                  a: "Your information is protected with industry-standard AES-256 encryption, both in transit and at rest. We never sell your data.",
                },
              ].map((item, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="rounded-2xl glass-card px-6 border-0 overflow-hidden">
                  <AccordionTrigger className="text-left font-display font-semibold text-base hover:no-underline py-5">
                    {t(item.q)}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600 dark:text-gray-300 pb-5">
                    {t(item.a)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="pb-24 px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="relative max-w-5xl mx-auto rounded-[2rem] overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" aria-hidden />
          <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
          <div className="relative px-8 py-16 md:py-20 text-center text-white">
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-4">
              {t("Ready to see your spending clearly?")}
            </h2>
            <p className="text-lg text-white/85 max-w-2xl mx-auto mb-10">
              {t("Join Kaptia today and let intelligent tracking do the heavy lifting. Free forever plan, no card required.")}
            </p>
            <Button
              onClick={handleLogin}
              size="lg"
              className="bg-white text-indigo-700 hover:bg-white/90 text-base px-8 h-12 rounded-xl font-semibold shadow-xl shadow-black/10"
            >
              {t("Get Started Free")}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
    </>
  );
}
