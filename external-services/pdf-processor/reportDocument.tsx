import React from 'react';
import path from 'node:path';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
  Svg,
  Path,
  Rect,
  Line,
} from '@react-pdf/renderer';

/**
 * The financial report.
 *
 * Two rules this file follows, both learned from a real report a customer could not use:
 *
 * 1. ONE language, the reader's. Every word here comes from `LABELS`. The report used to print
 *    "Financial Report / Finančný report" in the header and English everywhere else, whatever
 *    `/es/` said — a Spanish customer had to guess what "Spending by Category" meant, and the
 *    Slovak half said the template had been through too many hands.
 * 2. The report is the data, not a sample of it. The charts are built from every row in the
 *    period and the table lists all of them; it used to draw the trend from ten rows with the
 *    same balance copied onto every month (a flat line), show eight categories and drop the
 *    rest, and stop the table at twelve rows.
 *
 * Category *names* are the person's own words and are never translated: a category called
 * "Bodega" stays "Bodega".
 */

const ASSETS_DIR = process.env.PDF_ASSETS_DIR || path.resolve(process.cwd(), 'assets');

/**
 * Bundled Unicode font. The standard PDF fonts (Helvetica) only cover WinAnsiEncoding, which
 * silently drops characters such as `č`, `ł` or the accents a Peruvian receipt is full of.
 */
Font.register({
  family: 'DejaVu',
  fonts: [
    { src: path.join(ASSETS_DIR, 'DejaVuSans.ttf') },
    { src: path.join(ASSETS_DIR, 'DejaVuSans-Bold.ttf'), fontWeight: 'bold' },
  ],
});

const PALETTE = [
  '#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#3B82F6',
  '#8B5CF6', '#EF4444', '#14B8A6', '#F97316', '#64748B',
];

type Lang = 'en' | 'es' | 'sk';

const LOCALES: Record<Lang, string> = { en: 'en-US', es: 'es-PE', sk: 'sk-SK' };

const LABELS: Record<Lang, Record<string, string>> = {
  en: {
    title: 'Financial report',
    brand: 'Kaptia',
    brandSubtitle: 'Financial management',
    overview: 'Report overview',
    holder: 'Account holder',
    email: 'Email',
    generated: 'Generated',
    period: 'Period',
    allTime: 'All time',
    income: 'Income',
    expenses: 'Expenses',
    net: 'Balance',
    byCategory: 'Spending by category',
    monthly: 'Income and expenses by month',
    noCategories: 'No spending by category in this period',
    noMonths: 'Not enough months in this period for a chart',
    moreMonths: 'Showing the last 12 months; the table lists every transaction.',
    other: 'Other categories',
    uncategorized: 'Without category',
    budgets: 'Budgets',
    goals: 'Goals',
    transactions: 'Transactions',
    date: 'Date',
    description: 'Description',
    category: 'Category',
    amount: 'Amount',
    page: 'Page',
    savingsRate: 'Savings rate',
    topCategory: 'Largest category',
    qrTitle: 'Open your Kaptia dashboard',
    qrBody: 'Scan this code with your phone to add transactions, see live reports and follow your budgets.',
    footer: 'Kaptia · Smart financial management',
    noTransactions: 'No transactions in this period',
  },
  es: {
    title: 'Reporte financiero',
    brand: 'Kaptia',
    brandSubtitle: 'Gestión financiera',
    overview: 'Resumen del reporte',
    holder: 'Titular de la cuenta',
    email: 'Correo',
    generated: 'Generado',
    period: 'Periodo',
    allTime: 'Todo el periodo',
    income: 'Ingresos',
    expenses: 'Gastos',
    net: 'Balance',
    byCategory: 'Gastos por categoría',
    monthly: 'Ingresos y gastos por mes',
    noCategories: 'No hay gastos por categoría en este periodo',
    noMonths: 'No hay suficientes meses en este periodo para un gráfico',
    moreMonths: 'Se muestran los últimos 12 meses; la tabla incluye todas las transacciones.',
    other: 'Otras categorías',
    uncategorized: 'Sin categoría',
    budgets: 'Presupuestos',
    goals: 'Metas',
    transactions: 'Transacciones',
    date: 'Fecha',
    description: 'Descripción',
    category: 'Categoría',
    amount: 'Monto',
    page: 'Página',
    savingsRate: 'Tasa de ahorro',
    topCategory: 'Categoría con más gasto',
    qrTitle: 'Abre tu panel de Kaptia',
    qrBody: 'Escanea este código con tu teléfono para registrar gastos, ver reportes en vivo y seguir tus presupuestos.',
    footer: 'Kaptia · Gestión financiera inteligente',
    noTransactions: 'No hay transacciones en este periodo',
  },
  sk: {
    title: 'Finančný prehľad',
    brand: 'Kaptia',
    brandSubtitle: 'Správa financií',
    overview: 'Prehľad správy',
    holder: 'Majiteľ účtu',
    email: 'E-mail',
    generated: 'Vytvorené',
    period: 'Obdobie',
    allTime: 'Celé obdobie',
    income: 'Príjmy',
    expenses: 'Výdavky',
    net: 'Zostatok',
    byCategory: 'Výdavky podľa kategórie',
    monthly: 'Príjmy a výdavky po mesiacoch',
    noCategories: 'V tomto období nie sú výdavky podľa kategórií',
    noMonths: 'V tomto období nie je dosť mesiacov na graf',
    moreMonths: 'Zobrazených je posledných 12 mesiacov; tabuľka obsahuje všetky transakcie.',
    other: 'Ostatné kategórie',
    uncategorized: 'Bez kategórie',
    budgets: 'Rozpočty',
    goals: 'Ciele',
    transactions: 'Transakcie',
    date: 'Dátum',
    description: 'Popis',
    category: 'Kategória',
    amount: 'Suma',
    page: 'Strana',
    savingsRate: 'Miera úspor',
    topCategory: 'Najväčšia kategória',
    qrTitle: 'Otvorte si panel Kaptia',
    qrBody: 'Naskenujte tento kód telefónom a pridávajte transakcie, sledujte prehľady a rozpočty.',
    footer: 'Kaptia · Inteligentná správa financií',
    noTransactions: 'V tomto období nie sú žiadne transakcie',
  },
};

function pickLanguage(language?: string): Lang {
  const code = (language || 'en').toLowerCase().slice(0, 2);
  return code === 'es' || code === 'sk' ? code : 'en';
}

/* @@HELPERS@@ */

/** Currency is a symbol (`$`, `€`, `S/`, `Kč`), not an ISO code. */
export function normalizeCurrency(currency?: string | null): string {
  return (currency || '').trim().slice(0, 5) || '$';
}

/** `1,234.50` in English, `1,234.50` in Peruvian Spanish, `1 234,50` in Slovak. */
export function formatAmount(value: number, locale = 'en-US'): string {
  const amount = Number.isFinite(value) ? Math.abs(value) : 0;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrency(value: number, currency?: string | null, locale = 'en-US'): string {
  return `${normalizeCurrency(currency)}${formatAmount(value, locale)}`;
}

export function formatDay(value: string | Date | undefined, locale = 'en-US'): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function formatMonth(period: string, locale: string): string {
  const date = new Date(`${period}-15T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return period;
  return new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' }).format(date);
}

export interface ReportTransaction {
  month?: string;
  balance?: number;
  date: string;
  description: string;
  categoryName?: string;
  amount: number | string;
  type?: 'income' | 'expense';
}

export interface ReportCategory {
  name: string;
  amount: number;
  percentage?: number;
  color?: string;
}

export interface ReportBudget {
  categoryName: string;
  amount: number;
  spent: number;
}

export interface ReportGoal {
  name: string;
  targetAmount: number;
  currentAmount: number;
}

export interface ReportInsight {
  title?: string;
  description?: string;
  insight?: string;
}

export interface ReportMonthlyPoint {
  period: string;
  income: number;
  expenses: number;
  net: number;
}

export interface ReportDocumentProps {
  userData: {
    firstName: string;
    lastName: string;
    email: string;
  };
  transactions: ReportTransaction[];
  categories: ReportCategory[];
  budgets?: ReportBudget[];
  goals?: ReportGoal[];
  insights?: ReportInsight[];
  qrCodeDataUrl?: string;
  language?: string;
  period?: string;
  /** Display currency symbol (`$`, `€`, `Kč`, …). Defaults to `$`. */
  currency?: string;
  totals?: { income: number; expenses: number; net: number };
  monthly?: ReportMonthlyPoint[];
  range?: { from?: string; to?: string };
  metrics?: {
    savingsRate?: number;
    topCategory?: { name: string; amount: number; percentage?: number };
  };
}

/* @@STYLES@@ */

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 40,
    paddingHorizontal: 30,
    backgroundColor: '#FFFFFF',
    fontFamily: 'DejaVu',
    fontSize: 9,
    color: '#334155',
  },
  header: {
    backgroundColor: '#4338CA',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  brandTitle: { fontSize: 17, fontWeight: 'bold', color: '#FFFFFF' },
  brandSubtitle: { fontSize: 7, color: '#C7D2FE' },
  headerTitle: { fontSize: 13, fontWeight: 'bold', color: '#FFFFFF', marginTop: 2 },
  headerMeta: { fontSize: 7.5, color: '#E0E7FF', marginTop: 4 },
  card: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 6,
  },
  label: { fontSize: 7, color: '#64748B' },
  value: { fontSize: 9, fontWeight: 'bold', color: '#1E293B', marginTop: 1 },
  totalsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  totalCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    padding: 8,
  },
  totalValue: { fontSize: 12, fontWeight: 'bold', marginTop: 2 },
  twoCol: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  col: { flex: 1 },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  legendColor: { width: 7, height: 7, borderRadius: 2, marginRight: 4 },
  legendText: { fontSize: 7.5, flex: 1, color: '#334155' },
  legendAmount: { fontSize: 7.5, color: '#475569' },
  axisRow: { flexDirection: 'row', marginTop: 2 },
  axisLabel: { fontSize: 6, color: '#94A3B8', textAlign: 'center' },
  chartLegend: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 4 },
  chartLegendItem: { flexDirection: 'row', alignItems: 'center' },
  chartLegendText: { fontSize: 6.5, color: '#64748B' },
  muted: { fontSize: 8, color: '#94A3B8', padding: 12, textAlign: 'center' },
  progressContainer: { marginBottom: 6 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  progressBarBg: { height: 5, backgroundColor: '#E2E8F0', borderRadius: 3 },
  progressBarFill: { height: 5, backgroundColor: '#10B981', borderRadius: 3 },
  progressBarFillDanger: { backgroundColor: '#DC2626' },
  progressBarFillGoal: { backgroundColor: '#3B82F6' },
  table: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 4 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableHeaderCell: { fontSize: 7, fontWeight: 'bold', color: '#475569' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  tableRowAlt: { backgroundColor: '#FAFAFA' },
  cell: { fontSize: 7, color: '#334155' },
  colDate: { width: '14%' },
  colDesc: { width: '46%' },
  colCategory: { width: '22%' },
  colAmount: { width: '18%', textAlign: 'right' },
  incomeAmount: { color: '#047857' },
  expenseAmount: { color: '#B91C1C' },
  qrBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    padding: 10,
    marginTop: 10,
    gap: 12,
  },
  qrImage: { width: 58, height: 58, borderRadius: 4 },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 6,
    color: '#94A3B8',
    fontSize: 7,
  },
});

/* @@CHARTS@@ */

/** Top seven categories plus one "other" slice, so the legend adds up to the total. */
function CategoryDoughnut({
  categories,
  currency,
  labels,
  locale,
}: {
  categories: ReportCategory[];
  currency: string;
  labels: Record<string, string>;
  locale: string;
}) {
  const named = categories.map((c) => ({
    ...c,
    name: c.name.trim() === '' || c.name === 'Uncategorized' ? labels.uncategorized : c.name,
  }));
  const total = named.reduce((sum, c) => sum + Math.max(0, Number(c.amount) || 0), 0);

  if (total <= 0) {
    return <Text style={styles.muted}>{labels.noCategories}</Text>;
  }

  const sorted = [...named].sort((a, b) => b.amount - a.amount);
  const head = sorted.slice(0, 7);
  const tail = sorted.slice(7);
  const slicesInput: ReportCategory[] = tail.length
    ? [...head, { name: labels.other, amount: tail.reduce((sum, c) => sum + c.amount, 0) }]
    : head;

  const cx = 70;
  const cy = 70;
  const rOuter = 58;
  const rInner = 34;

  let currentAngle = -Math.PI / 2;
  const slices: Array<{ path: string; color: string; name: string; amount: number }> = [];

  slicesInput.forEach((cat, index) => {
    const val = Math.max(0, Number(cat.amount) || 0);
    if (val <= 0) return;
    const angleDelta = (val / total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angleDelta;
    currentAngle = endAngle;

    const x1 = cx + rOuter * Math.cos(startAngle);
    const y1 = cy + rOuter * Math.sin(startAngle);
    const x2 = cx + rOuter * Math.cos(endAngle);
    const y2 = cy + rOuter * Math.sin(endAngle);
    const x3 = cx + rInner * Math.cos(endAngle);
    const y3 = cy + rInner * Math.sin(endAngle);
    const x4 = cx + rInner * Math.cos(startAngle);
    const y4 = cy + rInner * Math.sin(startAngle);
    const largeArc = angleDelta > Math.PI ? 1 : 0;

    slices.push({
      path:
        `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} ` +
        `L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`,
      color: cat.color || PALETTE[index % PALETTE.length],
      name: cat.name,
      amount: val,
    });
  });

  return (
    <View>
      <View style={{ alignItems: 'center' }}>
        <Svg width={118} height={118} viewBox="0 0 140 140">
          {slices.map((s, idx) => (
            <Path key={idx} d={s.path} fill={s.color} />
          ))}
        </Svg>
      </View>
      <View style={{ marginTop: 6 }}>
        {slices.map((s, idx) => (
          <View key={idx} style={styles.legendRow}>
            <View style={[styles.legendColor, { backgroundColor: s.color }]} />
            <Text style={styles.legendText}>{s.name.length > 24 ? `${s.name.slice(0, 24)}…` : s.name}</Text>
            <Text style={styles.legendAmount}>
              {`${Math.round((s.amount / total) * 100)}%  ${formatCurrency(s.amount, currency, locale)}`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* @@BARS@@ */

/**
 * Income and expenses per month, one pair of bars per month.
 *
 * Every month in the series is drawn from real totals. The twelve most recent are shown so the
 * bars stay readable, and the table below lists every transaction either way — previously the
 * chart was a running sum of ten rows with the same "balance" on every month, which drew a flat
 * line on a report covering a year.
 */
function MonthlyBars({
  monthly,
  labels,
  locale,
}: {
  monthly: ReportMonthlyPoint[];
  labels: Record<string, string>;
  locale: string;
}) {
  const points = monthly.slice(-12);
  if (points.length === 0) {
    return <Text style={styles.muted}>{labels.noMonths}</Text>;
  }

  const maxValue = Math.max(...points.map((p) => Math.max(p.income, p.expenses)), 1);
  const svgWidth = 500;
  const svgHeight = 110;
  const padL = 6;
  const padR = 6;
  const padT = 8;
  const padB = 18;
  const plotW = svgWidth - padL - padR;
  const plotH = svgHeight - padT - padB;
  const slot = plotW / points.length;
  const barWidth = Math.max(4, Math.min(14, slot / 3));

  return (
    <View>
      <Svg width="100%" height={110} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        {[0, 0.5, 1].map((pct, idx) => {
          const y = padT + plotH * pct;
          return <Line key={idx} x1={padL} y1={y} x2={padL + plotW} y2={y} stroke="#E2E8F0" strokeWidth={1} />;
        })}
        {points.map((p, idx) => {
          const centre = padL + slot * idx + slot / 2;
          const incomeH = (Math.max(0, p.income) / maxValue) * plotH;
          const expenseH = (Math.max(0, p.expenses) / maxValue) * plotH;
          return (
            <React.Fragment key={p.period}>
              <Rect
                x={centre - barWidth - 1}
                y={padT + plotH - incomeH}
                width={barWidth}
                height={Math.max(incomeH, 0.5)}
                fill="#10B981"
              />
              <Rect
                x={centre + 1}
                y={padT + plotH - expenseH}
                width={barWidth}
                height={Math.max(expenseH, 0.5)}
                fill="#EF4444"
              />
            </React.Fragment>
          );
        })}
      </Svg>
      <View style={styles.axisRow}>
        {points.map((p) => (
          <Text key={p.period} style={[styles.axisLabel, { width: `${100 / points.length}%` }]}>
            {formatMonth(p.period, locale)}
          </Text>
        ))}
      </View>
      <View style={styles.chartLegend}>
        <View style={styles.chartLegendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#10B981' }]} />
          <Text style={styles.chartLegendText}>{labels.income}</Text>
        </View>
        <View style={styles.chartLegendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.chartLegendText}>{labels.expenses}</Text>
        </View>
      </View>
      {monthly.length > points.length && <Text style={styles.chartLegendText}>{labels.moreMonths}</Text>}
    </View>
  );
}

/* @@TABLE@@ */

function TableHeader({ labels }: { labels: Record<string, string> }) {
  return (
    <View style={styles.tableHeader}>
      <Text style={[styles.tableHeaderCell, styles.colDate]}>{labels.date}</Text>
      <Text style={[styles.tableHeaderCell, styles.colDesc]}>{labels.description}</Text>
      <Text style={[styles.tableHeaderCell, styles.colCategory]}>{labels.category}</Text>
      <Text style={[styles.tableHeaderCell, styles.colAmount]}>{labels.amount}</Text>
    </View>
  );
}

function TableRows({
  rows,
  currency,
  labels,
  locale,
}: {
  rows: ReportTransaction[];
  currency: string;
  labels: Record<string, string>;
  locale: string;
}) {
  return (
    <>
      {rows.map((t, idx) => {
        const amount = Math.abs(Number.parseFloat(String(t.amount)) || 0);
        const isIncome = t.type === 'income';
        const category = (t.categoryName || '').trim();
        return (
          <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={[styles.cell, styles.colDate]}>{formatDay(t.date, locale)}</Text>
            <Text style={[styles.cell, styles.colDesc]}>
              {t.description.length > 52 ? `${t.description.slice(0, 52)}…` : t.description}
            </Text>
            <Text style={[styles.cell, styles.colCategory]}>
              {category === '' || category === 'Uncategorized'
                ? labels.uncategorized
                : category.length > 20
                  ? `${category.slice(0, 20)}…`
                  : category}
            </Text>
            <Text style={[styles.cell, styles.colAmount, isIncome ? styles.incomeAmount : styles.expenseAmount]}>
              {`${isIncome ? '+' : '-'}${formatCurrency(amount, currency, locale)}`}
            </Text>
          </View>
        );
      })}
    </>
  );
}

/** Rows per continuation page. Chosen so a page never overflows into an unnumbered gap. */
const ROWS_PER_PAGE = 26;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/* @@DOC@@ */

export function FinancialReportDocument({
  userData,
  transactions = [],
  categories = [],
  budgets = [],
  goals = [],
  insights = [],
  qrCodeDataUrl,
  language = 'en',
  period = '',
  currency = '$',
  totals,
  monthly,
  range,
  metrics,
}: ReportDocumentProps) {
  const lang = pickLanguage(language);
  const labels = LABELS[lang];
  const locale = LOCALES[lang];
  const currencySymbol = normalizeCurrency(currency);

  const fullName = `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || labels.holder;
  const generated = formatDay(new Date(), locale);

  // Totals and the month series come from the server. They are recomputed from the rows only
  // when an older caller does not send them, so a version mismatch can never print a blank
  // report.
  const computedTotals = transactions.reduce(
    (acc, t) => {
      const amount = Math.abs(Number.parseFloat(String(t.amount)) || 0);
      if (t.type === 'income') acc.income += amount;
      else acc.expenses += amount;
      return acc;
    },
    { income: 0, expenses: 0 },
  );
  const resolvedTotals = totals ?? {
    income: computedTotals.income,
    expenses: computedTotals.expenses,
    net: computedTotals.income - computedTotals.expenses,
  };

  const resolvedMonthly: ReportMonthlyPoint[] =
    monthly ??
    (() => {
      const byMonth = new Map<string, { income: number; expenses: number }>();
      for (const t of transactions) {
        const key = t.month || String(t.date || '').slice(0, 7);
        if (!key) continue;
        const entry = byMonth.get(key) ?? { income: 0, expenses: 0 };
        const amount = Math.abs(Number.parseFloat(String(t.amount)) || 0);
        if (t.type === 'income') entry.income += amount;
        else entry.expenses += amount;
        byMonth.set(key, entry);
      }
      return Array.from(byMonth.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => ({ period: key, income: v.income, expenses: v.expenses, net: v.income - v.expenses }));
    })();

  const periodLabel =
    range && (range.from || range.to)
      ? `${range.from ? formatDay(range.from, locale) : '…'} – ${range.to ? formatDay(range.to, locale) : '…'}`
      : period || labels.allTime;

  const tablePages = chunk(transactions, ROWS_PER_PAGE);
  const budgetEntries = [
    ...(budgets ?? []).map((b) => ({ kind: 'budget' as const, item: b })),
    ...(goals ?? []).map((g) => ({ kind: 'goal' as const, item: g })),
  ];
  const budgetPages = chunk(budgetEntries, 10);

  let pageNumber = 1;

  const footer = (
    <View style={styles.footer} fixed>
      <Text>{labels.footer}</Text>
      <Text>{`${labels.page} ${pageNumber}`}</Text>
    </View>
  );

  return (
    <Document title={`${labels.title} - ${fullName}`} author={labels.brand}>
      {/* Page 1: who, when, how much, and the two charts */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Text style={styles.brandTitle}>{labels.brand}</Text>
            <Text style={styles.brandSubtitle}>{labels.brandSubtitle}</Text>
          </View>
          <Text style={styles.headerTitle}>{labels.title}</Text>
          <Text style={styles.headerMeta}>
            {`${labels.holder}: ${fullName}  |  ${labels.period}: ${periodLabel}  |  ${labels.generated}: ${generated}`}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{labels.overview}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={styles.label}>{labels.holder}</Text>
              <Text style={styles.value}>{fullName}</Text>
            </View>
            <View>
              <Text style={styles.label}>{labels.email}</Text>
              <Text style={styles.value}>{userData?.email || '—'}</Text>
            </View>
            <View>
              <Text style={styles.label}>{labels.generated}</Text>
              <Text style={styles.value}>{generated}</Text>
            </View>
            <View>
              <Text style={styles.label}>{labels.period}</Text>
              <Text style={styles.value}>{periodLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.totalsRow}>
          <View style={styles.totalCard}>
            <Text style={styles.label}>{labels.income}</Text>
            <Text style={[styles.totalValue, styles.incomeAmount]}>
              {formatCurrency(resolvedTotals.income, currencySymbol, locale)}
            </Text>
          </View>
          <View style={styles.totalCard}>
            <Text style={styles.label}>{labels.expenses}</Text>
            <Text style={[styles.totalValue, styles.expenseAmount]}>
              {formatCurrency(resolvedTotals.expenses, currencySymbol, locale)}
            </Text>
          </View>
          <View style={styles.totalCard}>
            <Text style={styles.label}>{labels.net}</Text>
            <Text style={[styles.totalValue, resolvedTotals.net >= 0 ? styles.incomeAmount : styles.expenseAmount]}>
              {formatCurrency(resolvedTotals.net, currencySymbol, locale)}
            </Text>
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={[styles.col, styles.card]}>
            <Text style={styles.cardTitle}>{labels.byCategory}</Text>
            <CategoryDoughnut categories={categories} currency={currencySymbol} labels={labels} locale={locale} />
          </View>
          <View style={[styles.col, styles.card]}>
            <Text style={styles.cardTitle}>{labels.monthly}</Text>
            <MonthlyBars monthly={resolvedMonthly} labels={labels} locale={locale} />
          </View>
        </View>

        {(metrics?.savingsRate !== undefined || metrics?.topCategory) && (
          <View style={styles.card}>
            {metrics?.savingsRate !== undefined && (
              <Text style={{ fontSize: 8, marginBottom: 2 }}>
                {`${labels.savingsRate}: ${metrics.savingsRate.toFixed(1)}%`}
              </Text>
            )}
            {metrics?.topCategory && (
              <Text style={{ fontSize: 8 }}>
                {`${labels.topCategory}: ${
                  metrics.topCategory.name.trim() === '' ? labels.uncategorized : metrics.topCategory.name
                } — ${formatCurrency(metrics.topCategory.amount, currencySymbol, locale)}${
                  metrics.topCategory.percentage !== undefined
                    ? ` (${metrics.topCategory.percentage.toFixed(1)}%)`
                    : ''
                }`}
              </Text>
            )}
          </View>
        )}

        {/* An older caller may still send pre-worded insights; they are printed as sent. */}
        {insights.length > 0 && (
          <View style={styles.card}>
            {insights.slice(0, 3).map((ins, idx) => (
              <View key={idx} style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 8, fontWeight: 'bold' }}>{ins.title || ''}</Text>
                <Text style={{ fontSize: 8 }}>{ins.description || ins.insight || ''}</Text>
              </View>
            ))}
          </View>
        )}

        {qrCodeDataUrl && (
          <View style={styles.qrBox}>
            <Image src={qrCodeDataUrl} style={styles.qrImage} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#1E293B', marginBottom: 2 }}>{labels.qrTitle}</Text>
              <Text style={{ fontSize: 7.5, color: '#64748B', lineHeight: 1.3 }}>{labels.qrBody}</Text>
            </View>
          </View>
        )}

        {footer}
      </Page>

      {/* Budgets and goals, every one of them, on their own pages */}
      {budgetPages.map((page, pageIdx) => {
        pageNumber += 1;
        return (
          <Page key={`budgets-${pageIdx}`} size="A4" style={styles.page}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{`${labels.budgets} · ${labels.goals}`}</Text>
              {page.map((entry, idx) => {
                const item = entry.item as ReportBudget & ReportGoal;
                const isBudget = entry.kind === 'budget';
                const done = isBudget ? Number(item.spent) || 0 : Number(item.currentAmount) || 0;
                const target = isBudget ? Number(item.amount) || 0 : Number(item.targetAmount) || 0;
                const pct = Math.round((done / (target || 1)) * 100);
                const over = isBudget && done > target;
                return (
                  <View key={`${entry.kind}-${idx}`} style={styles.progressContainer}>
                    <View style={styles.progressLabelRow}>
                      <Text style={{ fontSize: 8, fontWeight: 'bold' }}>
                        {(isBudget ? item.categoryName : item.name) || labels.uncategorized}
                      </Text>
                      <Text style={{ fontSize: 8, color: over ? '#DC2626' : '#64748B' }}>
                        {`${formatCurrency(done, currencySymbol, locale)} / ${formatCurrency(target, currencySymbol, locale)} (${Math.min(pct, 999)}%)`}
                      </Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          isBudget ? {} : styles.progressBarFillGoal,
                          { width: `${Math.min(pct, 100)}%` },
                          over ? styles.progressBarFillDanger : {},
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
            {footer}
          </Page>
        );
      })}

      {/* Every transaction, on as many pages as it takes */}
      {tablePages.map((rows, pageIdx) => {
        pageNumber += 1;
        return (
          <Page key={`table-${pageIdx}`} size="A4" style={styles.page}>
            {pageIdx === 0 && <Text style={styles.cardTitle}>{`${labels.transactions} (${transactions.length})`}</Text>}
            <View style={styles.table}>
              <TableHeader labels={labels} />
              <TableRows rows={rows} currency={currencySymbol} labels={labels} locale={locale} />
            </View>
            {footer}
          </Page>
        );
      })}

      {transactions.length === 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.cardTitle}>{labels.transactions}</Text>
          <Text style={styles.muted}>{labels.noTransactions}</Text>
          {footer}
        </Page>
      )}
    </Document>
  );
}
