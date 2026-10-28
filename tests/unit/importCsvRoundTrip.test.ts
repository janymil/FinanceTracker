import { describe, expect, it } from 'vitest';
import {
  buildTransactionsCsv,
  csvRowsToImportData,
  parseCsvRows,
} from '../../shared/importCsv';

/**
 * Export CSV -> import CSV, as one test.
 *
 * The two halves used to disagree: the export wrote `Date,Description,Amount,Type,Category` and
 * the importer demanded a `dataType` column, so a file this app produced was rejected row by row
 * and the screen answered "Failed to import data". This is the file the owner exported and could
 * not import back.
 */

const rows = [
  {
    date: '2026-08-05',
    description: 'ROXANNA LUZ REYES TELLO',
    amount: '40.00',
    type: 'expense',
    categoryName: 'Otro',
  },
  {
    // A comma and an accent inside a field: the common way a CSV breaks.
    date: '2026-08-06',
    description: 'Farmacia, turno mañana',
    amount: '125.50',
    type: 'expense',
    categoryName: 'Salud',
  },
  {
    date: '2026-08-01',
    description: 'Sueldo agosto',
    amount: 2500,
    type: 'income',
    categoryName: '',
  },
];

describe('the transactions CSV this app writes', () => {
  it('reads back as the same transactions', () => {
    const csv = buildTransactionsCsv(rows);
    const data = csvRowsToImportData(parseCsvRows(csv));

    expect(data.expenses).toHaveLength(2);
    expect(data.incomes).toHaveLength(1);

    expect(data.expenses[0]).toMatchObject({
      amount: '40.00',
      description: 'ROXANNA LUZ REYES TELLO',
      type: 'expense',
      categoryName: 'Otro',
    });
    expect(data.expenses[0].date.toISOString().slice(0, 10)).toBe('2026-08-05');

    // The quoting survived: the comma stayed inside the description.
    expect(data.expenses[1].description).toBe('Farmacia, turno mañana');

    expect(data.incomes[0]).toMatchObject({ amount: '2500.00', type: 'income' });
    // No category stays no category; the old export wrote "Uncategorized", which the import
    // would have created as a real user category.
    expect(data.incomes[0].categoryName).toBeUndefined();
  });

  it('has the header the importer reads', () => {
    const [header] = buildTransactionsCsv(rows).replace(/^\uFEFF/, '').split('\r\n');
    expect(header).toBe('dataType,date,description,amount,transactionType,category');
  });

  it('writes nothing but the header when there is nothing to export', () => {
    const csv = buildTransactionsCsv([]);
    expect(parseCsvRows(csv)).toEqual([]);
  });
});

describe('files that already exist in the wild', () => {
  it('imports the old export shape, which had no dataType column', () => {
    const legacy = [
      '\uFEFFDate,Description,Amount,Type,Category\r\n',
      '2026-08-05,"ROXANNA LUZ REYES TELLO",40.00,expense,Otra\r\n',
      '2026-08-01,"Sueldo agosto",2500.00,income,\r\n',
    ].join('');

    const data = csvRowsToImportData(parseCsvRows(legacy));

    expect(data.expenses[0]).toMatchObject({ amount: '40.00', categoryName: 'Otra' });
    expect(data.incomes[0]).toMatchObject({ amount: '2500.00' });
  });

  it('does not care how the header is spelled', () => {
    const file = 'Data Type;Transaction Type;Date;Description;Amount;Category\n' +
      'transaction;expense;2026-08-05;Pan;12,50;Alimentos\n';

    const data = csvRowsToImportData(parseCsvRows(file));

    expect(data.expenses).toHaveLength(1);
    expect(data.expenses[0]).toMatchObject({ amount: '12.50', categoryName: 'Alimentos' });
  });

  it('reads an unambiguous direction word from another language', () => {
    const file = 'date;description;amount;tipo\n2026-08-05;Sueldo;100;ingreso\n';
    const data = csvRowsToImportData(parseCsvRows(file));
    expect(data.incomes).toHaveLength(1);
  });

  it('still reads the documented budget and goal rows', () => {
    const file = [
      'dataType,category,budgetAmount,budgetPeriod,goalTargetAmount,goalTargetDate,goalCategory,goalCurrentAmount',
      'budget,Alimentos,500.00,monthly,,,,',
      'goal,,,,1200.00,2027-03-01,Viaje,300.00',
    ].join('\n');

    const data = csvRowsToImportData(parseCsvRows(file));

    expect(data.budgets[0]).toMatchObject({ categoryName: 'Alimentos', amount: '500.00', period: 'monthly' });
    expect(data.goals[0]).toMatchObject({ targetAmount: '1200.00', currentAmount: '300.00', category: 'Viaje' });
  });
});

describe('when a row cannot be read', () => {
  it('names the row instead of failing silently', () => {
    const file = 'dataType,date,description,amount,transactionType\n' +
      'transaction,2026-08-05,Pan,abc,expense\n';

    expect(() => csvRowsToImportData(parseCsvRows(file))).toThrow(/Row 2: amount/);
  });

  it('refuses a row with no date', () => {
    const file = 'Date,Description,Amount,Type\n,Pan,12.50,expense\n';
    expect(() => csvRowsToImportData(parseCsvRows(file))).toThrow(/Row 2: date is required/);
  });

  it('refuses a direction it cannot read', () => {
    const file = 'Date,Description,Amount,Type\n2026-08-05,Pan,12.50,transfer\n';
    expect(() => csvRowsToImportData(parseCsvRows(file))).toThrow(/transactionType/);
  });
});
