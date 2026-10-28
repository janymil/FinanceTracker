/**
 * The CSV this app writes, and the CSV it can read back.
 *
 * Export and import disagreed completely: the export wrote
 * `Date,Description,Amount,Type,Category`, while the importer reads a documented
 * `dataType,...` row (transaction/budget/goal). A file this app produced could therefore never
 * be imported by this app — the person exported, tried to import, and got
 * "Failed to import data" with every row rejected for a missing `dataType`.
 *
 * Both halves live here, pure and framework-free, so the round trip is a test and not an
 * assumption. The importer is deliberately more forgiving than the exporter: header names are
 * compared without case, spaces or underscores, and a plain table with no `dataType` column is
 * read as transactions, which is what a spreadsheet from another app always is.
 */
import { centsToNumber, parseAmountToCents } from './money';
import { cleanDateValue, csvField } from './trackingInput';

export interface ImportTransactionRow {
  amount: string;
  description: string;
  type: 'income' | 'expense';
  date: Date;
  categoryName?: string;
  isRecurring: boolean;
  recurringFrequency?: string;
  recurringEndDate?: Date;
}

export interface ImportBudgetRow {
  categoryName: string;
  amount: string;
  period: string;
  startDate: Date;
  endDate: Date;
}

export interface ImportGoalRow {
  name: string;
  description: string;
  targetAmount: string;
  currentAmount: string;
  targetDate: Date;
  category: string;
}

export interface ImportData {
  incomes: ImportTransactionRow[];
  expenses: ImportTransactionRow[];
  categories: unknown[];
  budgets: ImportBudgetRow[];
  goals: ImportGoalRow[];
  collaborativeGoals: unknown[];
}

/* ------------------------------------------------------------------------- *
 * Writing
 * ------------------------------------------------------------------------- */

/**
 * The transactions CSV.
 *
 * `dataType` names what each row is and `transactionType` says income or expense — the two
 * columns the importer reads. An empty category stays empty instead of the old literal
 * "Uncategorized", which would have created a user category by that name on import.
 */
export function buildTransactionsCsv(
  transactions: Array<{
    date: Date | string;
    description?: string | null;
    amount: unknown;
    type?: string | null;
    categoryName?: string | null;
  }>,
): string {
  const header = ['dataType', 'date', 'description', 'amount', 'transactionType', 'category'];

  const rows = transactions.map((t) => {
    const cents = (() => {
      try {
        return parseAmountToCents(t.amount as string | number);
      } catch {
        return 0;
      }
    })();
    const day = cleanDateValue(t.date instanceof Date ? t.date : String(t.date ?? ''));
    const isoDay = day ? day.toISOString().slice(0, 10) : '';

    return [
      'transaction',
      isoDay,
      csvField(t.description ?? ''),
      centsToNumber(Math.abs(cents)).toFixed(2),
      String(t.type ?? '').toLowerCase() === 'income' ? 'income' : 'expense',
      csvField(t.categoryName ?? ''),
    ].join(',');
  });

  // The BOM keeps accents readable when the file is opened in Excel.
  return `\uFEFF${header.join(',')}\r\n${rows.join('\r\n')}${rows.length ? '\r\n' : ''}`;
}

/* ------------------------------------------------------------------------- *
 * Reading
 * ------------------------------------------------------------------------- */

type Row = Record<string, string>;

/** `Transaction Type`, `transaction_type` and `transactionType` are the same column. */
function canonicalHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Split one line on the delimiter, respecting quoted fields ("1,234.56" stays one value). */
function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      out.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  out.push(current.trim());
  return out;
}

/** Reads the first cell that has a value, whatever the file called that column. */
function pick(row: Row, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = row[name] ?? row[canonicalHeader(name)];
    if (value !== undefined && String(value).trim() !== '') return String(value).trim();
  }
  return undefined;
}

/**
 * CSV text -> rows keyed by both the written header and its canonical form.
 *
 * The BOM is stripped, blank lines are dropped, and a row with fewer cells than the header is
 * padded instead of discarded: the old parser silently lost every row whose description
 * contained an unquoted comma.
 */
export function parseCsvRows(csvContent: string): Row[] {
  const text = csvContent.replace(/^\uFEFF/, '').trim();
  if (!text) return [];

  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';

  const headers = splitCsvLine(headerLine, delimiter).map((h) => h.trim());

  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = splitCsvLine(lines[i], delimiter);
    const row: Row = {};
    headers.forEach((header, index) => {
      if (!header) return;
      const value = values[index] ?? '';
      row[header] = value;
      // Canonical alias, so `Date`, `date` and `DATE` all read as `date`.
      const canonical = canonicalHeader(header);
      if (canonical && row[canonical] === undefined) row[canonical] = value;
    });
    rows.push(row);
  }

  return rows;
}

/**
 * A money cell from a spreadsheet, read with the app's one parser.
 *
 * `parseFloat("1,234.56")` is 1, so a US-formatted row turned every amount above a thousand into
 * a single unit. `/shared/money` understands both conventions ("1,234.56" and "1.234,56").
 * Exported because the bank-file import reads the same kind of cell.
 */
export function readCsvAmount(value: unknown): number | null {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  try {
    return centsToNumber(Math.abs(parseAmountToCents(value as string | number)));
  } catch {
    return null;
  }
}

const INCOME_WORDS = ['income', 'credit', 'ingreso', 'entrada', 'príjem', 'prijem', 'vklad'];
const EXPENSE_WORDS = ['expense', 'debit', 'gasto', 'salida', 'výdavok', 'vydavok', 'nákup', 'nakup'];

function readDirection(value: string | undefined): 'income' | 'expense' | null {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return null;
  if (INCOME_WORDS.includes(text)) return 'income';
  if (EXPENSE_WORDS.includes(text)) return 'expense';
  return null;
}

/** Budget period -> the window the row covers, counted from today (same rule as before). */
function budgetWindow(period: string, now = new Date()): { startDate: Date; endDate: Date } {
  const year = now.getFullYear();
  const month = now.getMonth();
  switch (period) {
    case 'daily':
      return { startDate: new Date(year, month, now.getDate()), endDate: new Date(year, month, now.getDate()) };
    case 'weekly': {
      const daysFromMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - daysFromMonday);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      return { startDate, endDate };
    }
    case 'quarterly': {
      const quarter = Math.floor(month / 3);
      return { startDate: new Date(year, quarter * 3, 1), endDate: new Date(year, (quarter + 1) * 3, 0) };
    }
    case 'yearly':
      return { startDate: new Date(year, 0, 1), endDate: new Date(year, 11, 31) };
    case 'monthly':
    default:
      return { startDate: new Date(year, month, 1), endDate: new Date(year, month + 1, 0) };
  }
}

/**
 * Rows -> the structure `/api/import-data` writes from.
 *
 * A file with no `dataType` column is a plain transactions table (that is what every export
 * from another app is), so every row is read as a transaction. A file that has the column is
 * read row by row as before. Any unusable row aborts the whole file with its row number, which
 * is the behaviour the screen reports.
 */
export function csvRowsToImportData(rows: Row[]): ImportData {
  const result: ImportData = {
    incomes: [],
    expenses: [],
    categories: [],
    budgets: [],
    goals: [],
    collaborativeGoals: [],
  };

  const errors: string[] = [];
  const hasDataTypeColumn = rows.some((row) => pick(row, 'dataType') !== undefined);

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // header is line 1
    const dataType = (pick(row, 'dataType') ?? (hasDataTypeColumn ? '' : 'transaction')).toLowerCase();

    if (!dataType) {
      errors.push(`Row ${rowNumber}: missing dataType`);
      return;
    }

    try {
      if (dataType === 'transaction') {
        const amount = readCsvAmount(pick(row, 'amount'));
        if (amount === null) {
          errors.push(`Row ${rowNumber}: amount is required and must be a valid number`);
          return;
        }

        const date = cleanDateValue(pick(row, 'date'));
        if (!date) {
          errors.push(`Row ${rowNumber}: date is required`);
          return;
        }

        const rawDirection = pick(row, 'transactionType', 'type', 'direction', 'tipo');
        const direction = readDirection(rawDirection);
        if (rawDirection && !direction) {
          errors.push(`Row ${rowNumber}: transactionType must be either "income" or "expense"`);
          return;
        }

        const recurringFlag = pick(row, 'isRecurring')?.toLowerCase() === 'true';
        const frequency = pick(row, 'recurringFrequency')?.toLowerCase();
        if (recurringFlag && frequency && !['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(frequency)) {
          errors.push(
            `Row ${rowNumber}: recurringFrequency must be one of: daily, weekly, monthly, quarterly, yearly`,
          );
          return;
        }

        const categoryName = pick(row, 'category', 'categoryName');
        const recurringEnd = recurringFlag ? cleanDateValue(pick(row, 'recurringEndDate')) : null;
        const transaction: ImportTransactionRow = {
          amount: amount.toFixed(2),
          description: pick(row, 'description', 'memo', 'details') ?? 'Imported transaction',
          type: direction ?? 'expense',
          date,
          ...(categoryName ? { categoryName } : {}),
          isRecurring: recurringFlag,
          ...(recurringFlag && frequency ? { recurringFrequency: frequency } : {}),
          ...(recurringEnd ? { recurringEndDate: recurringEnd } : {}),
        };

        if (transaction.type === 'income') result.incomes.push(transaction);
        else result.expenses.push(transaction);
        return;
      }

      if (dataType === 'budget') {
        const categoryName = pick(row, 'category', 'categoryName');
        if (!categoryName) {
          errors.push(`Row ${rowNumber}: category is required for budgets`);
          return;
        }
        const amount = readCsvAmount(pick(row, 'budgetAmount', 'amount'));
        if (amount === null) {
          errors.push(`Row ${rowNumber}: budgetAmount is required and must be a valid number`);
          return;
        }
        const period = (pick(row, 'budgetPeriod', 'period') ?? 'monthly').toLowerCase();
        if (!['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(period)) {
          errors.push(`Row ${rowNumber}: budgetPeriod must be one of: daily, weekly, monthly, quarterly, yearly`);
          return;
        }
        const { startDate, endDate } = budgetWindow(period);
        result.budgets.push({ categoryName, amount: amount.toFixed(2), period, startDate, endDate });
        return;
      }

      if (dataType === 'goal') {
        const targetAmount = readCsvAmount(pick(row, 'goalTargetAmount', 'targetAmount'));
        if (targetAmount === null) {
          errors.push(`Row ${rowNumber}: goalTargetAmount is required and must be a valid number`);
          return;
        }
        const targetDate = cleanDateValue(pick(row, 'goalTargetDate', 'targetDate'));
        if (!targetDate) {
          errors.push(`Row ${rowNumber}: goalTargetDate is required`);
          return;
        }
        const category = pick(row, 'goalCategory', 'category') ?? 'Other';
        const currentAmount = readCsvAmount(pick(row, 'goalCurrentAmount', 'currentAmount')) ?? 0;

        result.goals.push({
          name: category,
          description: `Goal for ${category}`,
          targetAmount: targetAmount.toFixed(2),
          currentAmount: currentAmount.toFixed(2),
          targetDate,
          category,
        });
        return;
      }

      errors.push(`Row ${rowNumber}: unknown dataType "${dataType}"`);
    } catch (error) {
      errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : 'processing error'}`);
    }
  });

  if (errors.length > 0) {
    throw new Error(`CSV validation errors:\n${errors.join('\n')}`);
  }

  return result;
}
