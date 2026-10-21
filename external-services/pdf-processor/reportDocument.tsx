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
  Circle,
  Line,
  Polygon,
  Polyline,
} from '@react-pdf/renderer';

/**
 * Bundled Unicode font. The standard PDF fonts (Helvetica) only cover
 * WinAnsiEncoding, which silently drops characters such as `č`, `ł` or `₽`
 * (that broke both `Finančný report` and currencies like `Kč` / `zł`).
 */
const ASSETS_DIR = process.env.PDF_ASSETS_DIR || path.resolve(process.cwd(), 'assets');

Font.register({
  family: 'DejaVu',
  fonts: [
    { src: path.join(ASSETS_DIR, 'DejaVuSans.ttf') },
    { src: path.join(ASSETS_DIR, 'DejaVuSans-Bold.ttf'), fontWeight: 'bold' },
  ],
});

const PALETTE = [
  '#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#3B82F6',
  '#8B5CF6', '#EF4444', '#14B8A6', '#F97316', '#64748B'
];

/**
 * Currency is a symbol (the app stores `$`, `€`, `C$`, `Kč`, …), not an ISO code.
 * Keep it short so it cannot break the layout.
 */
export function normalizeCurrency(currency?: string | null): string {
  return (currency || '').trim().slice(0, 5) || '$';
}

/** Formats an amount as `1,234.50` prefixed with the user's currency symbol. */
export function formatCurrency(value: number, currency?: string | null): string {
  const amount = Number.isFinite(value) ? Math.abs(value) : 0;
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${normalizeCurrency(currency)}${formatted}`;
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
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    backgroundColor: '#FFFFFF',
    fontFamily: 'DejaVu',
    fontSize: 9,
    color: '#334155',
  },
  header: {
    backgroundColor: '#4338CA',
    borderRadius: 8,
    padding: 18,
    marginBottom: 16,
    color: '#FFFFFF',
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 9,
    color: '#E0E7FF',
  },
  headerMeta: {
    fontSize: 9,
    color: '#C7D2FE',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    padding: 12,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 4,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  col: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
    marginTop: 4,
  },
  chartContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  legendColor: {
    width: 8,
    height: 8,
    borderRadius: 2,
    marginRight: 5,
  },
  legendText: {
    width: '62%',
    fontSize: 7.5,
    color: '#475569',
  },
  legendAmount: {
    width: '30%',
    textAlign: 'right',
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  // Table
  table: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: '#F8FAFC',
  },
  colDate: { width: '20%' },
  colDesc: { width: '45%' },
  colCategory: { width: '20%' },
  colAmount: { width: '15%', textAlign: 'right' },
  incomeAmount: {
    color: '#059669',
    fontWeight: 'bold',
    fontSize: 8,
  },
  expenseAmount: {
    color: '#DC2626',
    fontWeight: 'bold',
    fontSize: 8,
  },
  // Progress bar
  progressContainer: {
    marginBottom: 8,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  progressBarFillDanger: {
    backgroundColor: '#EF4444',
  },
  // Insights
  insightItem: {
    backgroundColor: '#EEF2FF',
    borderLeftWidth: 3,
    borderLeftColor: '#4F46E5',
    padding: 8,
    borderRadius: 4,
    marginBottom: 6,
  },
  insightTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#312E81',
    marginBottom: 2,
  },
  insightText: {
    fontSize: 8,
    color: '#3730A3',
  },
  // QR & Footer
  qrBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    padding: 10,
    marginTop: 10,
    gap: 12,
  },
  qrImage: {
    width: 60,
    height: 60,
    borderRadius: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
    color: '#94A3B8',
    fontSize: 7,
  },
});

/**
 * Pure SVG Pie/Doughnut Chart
 */
function CategoryDoughnutChart({
  categories,
  currency,
}: {
  categories: ReportCategory[];
  currency?: string;
}) {
  const total = categories.reduce((sum, c) => sum + Math.max(0, Number(c.amount) || 0), 0);
  const cx = 70;
  const cy = 70;
  const rOuter = 58;
  const rInner = 34;

  if (total <= 0) {
    return (
      <View style={{ alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 8, color: '#94A3B8' }}>No category spending data available</Text>
      </View>
    );
  }

  let currentAngle = -Math.PI / 2;
  const slices: Array<{ path: string; color: string; cat: ReportCategory }> = [];

  categories.slice(0, 8).forEach((cat, index) => {
    const val = Math.max(0, Number(cat.amount) || 0);
    if (val <= 0) return;
    const fraction = val / total;
    const angleDelta = fraction * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angleDelta;
    currentAngle = endAngle;

    const color = cat.color || PALETTE[index % PALETTE.length];

    // SVG arc coordinates
    const x1 = cx + rOuter * Math.cos(startAngle);
    const y1 = cy + rOuter * Math.sin(startAngle);
    const x2 = cx + rOuter * Math.cos(endAngle);
    const y2 = cy + rOuter * Math.sin(endAngle);

    const x3 = cx + rInner * Math.cos(endAngle);
    const y3 = cy + rInner * Math.sin(endAngle);
    const x4 = cx + rInner * Math.cos(startAngle);
    const y4 = cy + rInner * Math.sin(startAngle);

    const largeArc = angleDelta > Math.PI ? 1 : 0;
    const path = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;

    slices.push({ path, color, cat });
  });

  return (
    <View>
      <View style={{ alignItems: 'center' }}>
        <Svg width={120} height={120} viewBox="0 0 140 140">
          {slices.map((s, idx) => (
            <Path key={idx} d={s.path} fill={s.color} />
          ))}
        </Svg>
      </View>
      <View style={{ marginTop: 6, alignSelf: 'stretch', width: '100%' }}>
        {slices.map((s, idx) => (
          <View key={idx} style={styles.legendRow}>
            <View style={[styles.legendColor, { backgroundColor: s.color }]} />
            <Text style={styles.legendText}>
              {s.cat.name.length > 26 ? `${s.cat.name.slice(0, 26)}…` : s.cat.name}
            </Text>
            <Text style={styles.legendAmount}>{formatCurrency(Number(s.cat.amount), currency)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Pure SVG Financial Trend Line Chart
 */
function TrendLineChart({ transactions }: { transactions: ReportTransaction[] }) {
  // Aggregate balance points from transactions with month/balance or date
  const dataPoints: Array<{ label: string; value: number }> = [];

  const monthMap = new Map<string, number>();
  transactions.forEach((t) => {
    if (t.month && typeof t.balance === 'number') {
      monthMap.set(t.month, t.balance);
    }
  });

  if (monthMap.size >= 2) {
    monthMap.forEach((bal, month) => {
      dataPoints.push({ label: month, value: bal });
    });
  } else {
    // Group transactions by month/date for fallback
    let running = 0;
    const sorted = [...transactions].slice(0, 10).reverse();
    sorted.forEach((t, i) => {
      const amt = parseFloat(String(t.amount)) || 0;
      running += t.type === 'expense' ? -amt : amt;
      dataPoints.push({
        label: t.month || (t.date ? t.date.slice(5, 10) : `P${i + 1}`),
        value: running,
      });
    });
  }

  if (dataPoints.length < 2) {
    return (
      <View style={{ alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 8, color: '#94A3B8' }}>Insufficient data for trend chart</Text>
      </View>
    );
  }

  const svgW = 500;
  const svgH = 110;
  const padL = 40;
  const padR = 20;
  const padT = 15;
  const padB = 25;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const values = dataPoints.map((d) => d.value);
  let minVal = Math.min(...values);
  let maxVal = Math.max(...values);
  if (minVal === maxVal) {
    minVal -= 10;
    maxVal += 10;
  }
  const valRange = maxVal - minVal;

  const points = dataPoints.map((d, i) => {
    const x = padL + (i / (dataPoints.length - 1)) * plotW;
    const y = padT + plotH - ((d.value - minVal) / valRange) * plotH;
    return { x, y, label: d.label, value: d.value };
  });

  const pointsString = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaString = `${points[0].x},${padT + plotH} ${pointsString} ${points[points.length - 1].x},${padT + plotH}`;

  return (
    <Svg width="100%" height={110} viewBox={`0 0 ${svgW} ${svgH}`}>
      {/* Grid lines */}
      {[0, 0.5, 1].map((pct, idx) => {
        const y = padT + plotH * pct;
        return (
          <Line
            key={idx}
            x1={padL}
            y1={y}
            x2={padL + plotW}
            y2={y}
            stroke="#E2E8F0"
            strokeWidth={1}
          />
        );
      })}

      {/* Shaded Area */}
      <Polygon points={areaString} fill="#EEF2FF" />

      {/* Trend Line */}
      <Polyline
        points={pointsString}
        fill="none"
        stroke="#4F46E5"
        strokeWidth={2.5}
      />

      {/* Data points */}
      {points.map((p, idx) => (
        <Circle
          key={idx}
          cx={p.x}
          cy={p.y}
          r={3}
          fill="#4F46E5"
          stroke="#FFFFFF"
          strokeWidth={1.5}
        />
      ))}
    </Svg>
  );
}

export function FinancialReportDocument({
  userData,
  transactions = [],
  categories = [],
  budgets = [],
  goals = [],
  insights = [],
  qrCodeDataUrl,
  language = 'en',
  period = 'Monthly',
  currency = '$',
}: ReportDocumentProps) {
  const fullName = `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || 'Valued User';
  const currencySymbol = normalizeCurrency(currency);
  const genDate = new Date().toLocaleDateString(language.startsWith('sk') ? 'sk-SK' : 'en-US');
  const genTime = new Date().toLocaleTimeString(language.startsWith('sk') ? 'sk-SK' : 'en-US');

  return (
    <Document title={`Kaptia Financial Report - ${fullName}`} author="Kaptia">
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Text style={styles.brandTitle}>Kaptia</Text>
            <Text style={styles.brandSubtitle}>Financial Management</Text>
          </View>
          <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#FFFFFF' }}>
            Financial Report / Finančný report
          </Text>
          <Text style={styles.headerMeta}>
            Client: {fullName} | Email: {userData?.email || 'N/A'} | Period: {period} | Currency: {currencySymbol}
          </Text>
        </View>

        {/* User & Report Summary Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Report Overview</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 8, color: '#64748B' }}>Account Holder</Text>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#1E293B', marginTop: 1 }}>{fullName}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 8, color: '#64748B' }}>Email</Text>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#1E293B', marginTop: 1 }}>{userData?.email || 'N/A'}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 8, color: '#64748B' }}>Generated On</Text>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#1E293B', marginTop: 1 }}>{genDate}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 8, color: '#64748B' }}>Period</Text>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#1E293B', marginTop: 1 }}>{period}</Text>
            </View>
          </View>
        </View>

        {/* Charts in 2 columns */}
        <View style={styles.twoCol}>
          {/* Category Doughnut Chart */}
          <View style={[styles.col, styles.chartContainer]}>
            <Text style={styles.cardTitle}>Spending by Category</Text>
            <CategoryDoughnutChart categories={categories} currency={currencySymbol} />
          </View>

          {/* Trend Line Chart */}
          <View style={[styles.col, styles.chartContainer]}>
            <Text style={styles.cardTitle}>Financial Balance Trend</Text>
            <TrendLineChart transactions={transactions} />
          </View>
        </View>

        {/* Budgets & Goals Section */}
        {((budgets && budgets.length > 0) || (goals && goals.length > 0)) && (
          <View style={styles.twoCol}>
            {budgets && budgets.length > 0 && (
              <View style={[styles.col, styles.card]}>
                <Text style={styles.cardTitle}>Budgets Overview</Text>
                {budgets.slice(0, 4).map((b, idx) => {
                  const spent = Number(b.spent) || 0;
                  const total = Number(b.amount) || 1;
                  const pct = Math.min(Math.round((spent / total) * 100), 100);
                  const isOver = spent > total;
                  return (
                    <View key={idx} style={styles.progressContainer}>
                      <View style={styles.progressLabelRow}>
                        <Text style={{ fontSize: 8, fontWeight: 'bold' }}>{b.categoryName}</Text>
                        <Text style={{ fontSize: 8, color: isOver ? '#DC2626' : '#64748B' }}>
                          {formatCurrency(spent, currencySymbol)} / {formatCurrency(total, currencySymbol)} ({pct}%)
                        </Text>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            { width: `${pct}%` },
                            isOver ? styles.progressBarFillDanger : {},
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {goals && goals.length > 0 && (
              <View style={[styles.col, styles.card]}>
                <Text style={styles.cardTitle}>Financial Goals</Text>
                {goals.slice(0, 4).map((g, idx) => {
                  const current = Number(g.currentAmount) || 0;
                  const target = Number(g.targetAmount) || 1;
                  const pct = Math.min(Math.round((current / target) * 100), 100);
                  return (
                    <View key={idx} style={styles.progressContainer}>
                      <View style={styles.progressLabelRow}>
                        <Text style={{ fontSize: 8, fontWeight: 'bold' }}>{g.name}</Text>
                        <Text style={{ fontSize: 8, color: '#64748B' }}>
                          {formatCurrency(current, currencySymbol)} / {formatCurrency(target, currencySymbol)} ({pct}%)
                        </Text>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: '#3B82F6' }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* AI Insights */}
        {insights && insights.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <Text style={styles.sectionTitle}>AI Financial Insights</Text>
            {insights.slice(0, 3).map((ins, idx) => (
              <View key={idx} style={styles.insightItem}>
                <Text style={styles.insightTitle}>{ins.title || 'Key Financial Insight'}</Text>
                <Text style={styles.insightText}>{ins.description || ins.insight || ''}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recent Transactions Table */}
        {transactions && transactions.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.colDate]}>Date</Text>
                <Text style={[styles.tableHeaderCell, styles.colDesc]}>Description</Text>
                <Text style={[styles.tableHeaderCell, styles.colCategory]}>Category</Text>
                <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
              </View>
              {transactions.slice(0, 12).map((t, idx) => {
                const amt = parseFloat(String(t.amount)) || 0;
                const isIncome = t.type === 'income' || amt > 0;
                const formattedDate = t.date ? new Date(t.date).toLocaleDateString() : 'N/A';
                const desc = t.description || 'Transaction';
                const catName = t.categoryName || 'General';
                return (
                  <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                    <Text style={styles.colDate}>{formattedDate}</Text>
                    <Text style={styles.colDesc}>{desc.length > 36 ? `${desc.slice(0, 36)}...` : desc}</Text>
                    <Text style={styles.colCategory}>{catName.length > 18 ? `${catName.slice(0, 18)}...` : catName}</Text>
                    <Text style={[styles.colAmount, isIncome ? styles.incomeAmount : styles.expenseAmount]}>
                      {isIncome ? '+' : '-'}{formatCurrency(amt, currencySymbol)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* QR Code Banner */}
        {qrCodeDataUrl && (
          <View style={styles.qrBox}>
            <Image src={qrCodeDataUrl} style={styles.qrImage} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1E293B', marginBottom: 2 }}>
                Access Your Live Kaptia Dashboard
              </Text>
              <Text style={{ fontSize: 8, color: '#64748B', lineHeight: 1.3 }}>
                Scan this QR code with your mobile camera to quickly manage transactions, view interactive reports, and track your budgets on Kaptia.
              </Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>© {new Date().getFullYear()} Kaptia • Smart Financial Management</Text>
          <Text>Generated on {genDate} {genTime}</Text>
        </View>
      </Page>
    </Document>
  );
}
