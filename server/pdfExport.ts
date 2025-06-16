import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

// Styles for PDF document
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
    fontFamily: 'Helvetica',
  },
  header: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
    color: '#2563eb',
  },
  section: {
    margin: 10,
    padding: 10,
    flexGrow: 1,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 10,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    padding: 5,
    backgroundColor: '#f9fafb',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#374151',
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
    padding: 3,
    borderBottom: '1 solid #e5e7eb',
  },
  transactionDate: {
    fontSize: 10,
    color: '#6b7280',
    width: '20%',
  },
  transactionDesc: {
    fontSize: 10,
    color: '#1f2937',
    width: '50%',
  },
  transactionAmount: {
    fontSize: 10,
    color: '#1f2937',
    width: '20%',
    textAlign: 'right',
  },
  expenseAmount: {
    color: '#dc2626',
  },
  incomeAmount: {
    color: '#059669',
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
    padding: 3,
  },
  categoryName: {
    fontSize: 11,
    color: '#1f2937',
    width: '70%',
  },
  categoryAmount: {
    fontSize: 11,
    color: '#1f2937',
    width: '30%',
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 8,
    color: '#6b7280',
  },
});

interface TransactionData {
  id: number;
  amount: string;
  description: string;
  date: string;
  type: 'income' | 'expense';
  categoryName?: string;
}

interface PdfData {
  user: {
    name?: string;
    email?: string;
  };
  period: string;
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netIncome: number;
    transactionCount: number;
  };
  transactions: TransactionData[];
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    type: 'income' | 'expense';
  }>;
}

// PDF Document Component
const FinancialReportDocument: React.FC<{ data: PdfData }> = ({ data }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <Text style={styles.header}>Financial Report</Text>
      
      {/* User Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Report Details</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Period:</Text>
          <Text style={styles.summaryValue}>{data.period}</Text>
        </View>
        {data.user.name && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>User:</Text>
            <Text style={styles.summaryValue}>{data.user.name}</Text>
          </View>
        )}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Generated:</Text>
          <Text style={styles.summaryValue}>{new Date().toLocaleDateString()}</Text>
        </View>
      </View>

      {/* Financial Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Financial Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Income:</Text>
          <Text style={[styles.summaryValue, styles.incomeAmount]}>
            ${data.summary.totalIncome.toFixed(2)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Expenses:</Text>
          <Text style={[styles.summaryValue, styles.expenseAmount]}>
            ${data.summary.totalExpenses.toFixed(2)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Net Income:</Text>
          <Text style={[
            styles.summaryValue,
            data.summary.netIncome >= 0 ? styles.incomeAmount : styles.expenseAmount
          ]}>
            ${data.summary.netIncome.toFixed(2)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Transactions:</Text>
          <Text style={styles.summaryValue}>{data.summary.transactionCount}</Text>
        </View>
      </View>

      {/* Category Breakdown */}
      {data.categoryBreakdown.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category Breakdown</Text>
          {data.categoryBreakdown.map((category, index) => (
            <View key={index} style={styles.categoryRow}>
              <Text style={styles.categoryName}>
                {category.category} ({category.type})
              </Text>
              <Text style={[
                styles.categoryAmount,
                category.type === 'expense' ? styles.expenseAmount : styles.incomeAmount
              ]}>
                ${category.amount.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Recent Transactions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <View style={styles.transactionRow}>
          <Text style={[styles.transactionDate, { fontWeight: 'bold' }]}>Date</Text>
          <Text style={[styles.transactionDesc, { fontWeight: 'bold' }]}>Description</Text>
          <Text style={[styles.transactionAmount, { fontWeight: 'bold' }]}>Amount</Text>
        </View>
        {data.transactions.slice(0, 20).map((transaction, index) => (
          <View key={index} style={styles.transactionRow}>
            <Text style={styles.transactionDate}>
              {new Date(transaction.date).toLocaleDateString()}
            </Text>
            <Text style={styles.transactionDesc}>
              {transaction.description}
              {transaction.categoryName && ` (${transaction.categoryName})`}
            </Text>
            <Text style={[
              styles.transactionAmount,
              transaction.type === 'expense' ? styles.expenseAmount : styles.incomeAmount
            ]}>
              {transaction.type === 'expense' ? '-' : '+'}${parseFloat(transaction.amount).toFixed(2)}
            </Text>
          </View>
        ))}
        {data.transactions.length > 20 && (
          <Text style={{ fontSize: 10, fontStyle: 'italic', marginTop: 10, textAlign: 'center' }}>
            Showing first 20 transactions of {data.transactions.length} total
          </Text>
        )}
      </View>

      {/* Footer */}
      <Text style={styles.footer}>
        Generated by FinanzerPro - Personal Finance Management
      </Text>
    </Page>
  </Document>
);

// Generate PDF Buffer
export async function generatePdfReport(data: PdfData): Promise<Buffer> {
  try {
    const doc = React.createElement(FinancialReportDocument, { data });
    const pdfBuffer = await pdf(doc).toBuffer();
    return pdfBuffer;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF report');
  }
}