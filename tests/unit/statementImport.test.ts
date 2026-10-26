import { describe, expect, it } from 'vitest';
import {
  detectDateOrder,
  parseCsvText,
  parseStatementAmount,
  parseStatementDate,
  parseStatementTable,
} from '../../shared/statementImport';

describe('parseStatementDate', () => {
  it('reads day-first dates, the rule in Peru', () => {
    expect(parseStatementDate('05/11/2026')).toBe('2026-11-05');
    expect(parseStatementDate('05-11-2026')).toBe('2026-11-05');
    expect(parseStatementDate('5/11/26')).toBe('2026-11-05');
  });

  it('falls back to month-first only when day-first is impossible', () => {
    expect(parseStatementDate('11/25/2026')).toBe('2026-11-25');
  });

  it('reads ISO dates, Excel serial numbers and Spanish month names', () => {
    expect(parseStatementDate('2026-11-05')).toBe('2026-11-05');
    expect(parseStatementDate('2026-11-05T10:20:00')).toBe('2026-11-05');
    expect(parseStatementDate(46331)).toBe('2026-11-05'); // Excel serial for 5 Nov 2026
    expect(parseStatementDate('05 Nov 2026')).toBe('2026-11-05');
    expect(parseStatementDate('5 de noviembre de 2026')).toBe('2026-11-05');
    expect(parseStatementDate('12-ene-26')).toBe('2026-01-12');
  });

  it('rejects things that are not dates', () => {
    expect(parseStatementDate('')).toBeNull();
    expect(parseStatementDate('SALDO INICIAL')).toBeNull();
    expect(parseStatementDate('31/02/2026')).toBeNull();
  });
});

describe('parseStatementAmount', () => {
  it('reads Peruvian and Spanish-style numbers', () => {
    expect(parseStatementAmount('S/ 1,234.56')).toBe(1234.56);
    expect(parseStatementAmount('1.234,56')).toBe(1234.56);
    expect(parseStatementAmount('12,50')).toBe(12.5);
    expect(parseStatementAmount('1,234')).toBe(1234);
    expect(parseStatementAmount('250.00')).toBe(250);
    expect(parseStatementAmount('1 234,5')).toBe(1234.5);
    expect(parseStatementAmount('0.500')).toBe(0.5);
  });

  it('reads the signs banks use', () => {
    expect(parseStatementAmount('-80.00')).toBe(-80);
    expect(parseStatementAmount('(250.00)')).toBe(-250);
    expect(parseStatementAmount('250.00-')).toBe(-250);
    expect(parseStatementAmount('+100')).toBe(100);
    expect(parseStatementAmount(-12.3)).toBe(-12.3);
  });

  it('returns null for text', () => {
    expect(parseStatementAmount('')).toBeNull();
    expect(parseStatementAmount('n/a')).toBeNull();
  });
});

describe('parseCsvText', () => {
  it('handles quotes, commas inside quotes and semicolon delimiters', () => {
    expect(parseCsvText('a,b\n"x, y",2')).toEqual([['a', 'b'], ['x, y', '2']]);
    expect(parseCsvText('fecha;monto\n05/11/2026;1.234,56')).toEqual([['fecha', 'monto'], ['05/11/2026', '1.234,56']]);
    expect(parseCsvText('﻿a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('parseStatementTable', () => {
  it('reads a debit/credit statement with a title block above the header', () => {
    const rows = [
      ['Estado de cuenta', '', '', ''],
      ['Cuenta: 193-1234567-0-12', '', '', ''],
      ['Fecha', 'Descripción', 'Cargo', 'Abono'],
      ['02/11/2026', 'PLIN A JUAN PEREZ', '45.00', ''],
      ['03/11/2026', 'ABONO SUELDO', '', '3,200.00'],
      ['04/11/2026', 'COMPRA WONG, SAN ISIDRO', '120.50', ''],
      ['', 'TOTALES', '165.50', '3,200.00'],
    ];
    const result = parseStatementTable(rows);
    expect(result.error).toBeUndefined();
    expect(result.transactions).toEqual([
      { date: '2026-11-02', description: 'PLIN A JUAN PEREZ', amount: 45, type: 'expense' },
      { date: '2026-11-03', description: 'ABONO SUELDO', amount: 3200, type: 'income' },
      { date: '2026-11-04', description: 'COMPRA WONG, SAN ISIDRO', amount: 120.5, type: 'expense' },
    ]);
    expect(result.skipped).toBe(1);
  });

  it('reads one signed amount column', () => {
    const result = parseStatementTable([
      ['Fecha operación', 'Concepto', 'Importe', 'Saldo'],
      ['01/11/2026', 'Pago de servicios', '-89.90', '1,000.00'],
      ['02/11/2026', 'Depósito', '500.00', '1,500.00'],
    ]);
    expect(result.transactions.map((t) => [t.type, t.amount])).toEqual([['expense', 89.9], ['income', 500]]);
  });

  it('uses a cargo/abono type column when the amount is unsigned', () => {
    const result = parseStatementTable([
      ['Fecha', 'Detalle', 'Monto', 'Tipo'],
      ['01/11/2026', 'Retiro cajero', '100.00', 'Cargo'],
      ['02/11/2026', 'Transferencia recibida', '250.00', 'Abono'],
    ]);
    expect(result.transactions.map((t) => t.type)).toEqual(['expense', 'income']);
  });

  it('works on English headers too', () => {
    const result = parseStatementTable([
      ['Date', 'Description', 'Amount'],
      ['2026-11-01', 'Coffee', '-4.50'],
    ]);
    expect(result.transactions).toEqual([{ date: '2026-11-01', description: 'Coffee', amount: 4.5, type: 'expense' }]);
  });

  it('reports a missing header instead of guessing', () => {
    const result = parseStatementTable([['hello', 'world'], ['1', '2']]);
    expect(result.error).toBe('no_header');
    expect(result.transactions).toEqual([]);
  });
});

describe('parseStatementTable: headers seen in real exports', () => {
  it('accepts headers that carry the currency', () => {
    const result = parseStatementTable([
      ['Fecha', 'Descripción', 'Cargo (S/)', 'Abono (S/)'],
      ['01/11/2026', 'COMPRA', '30.00', ''],
      ['02/11/2026', 'DEPOSITO', '', '100.00'],
    ]);
    expect(result.transactions.map((t) => [t.type, t.amount])).toEqual([['expense', 30], ['income', 100]]);

    const single = parseStatementTable([
      ['Fecha', 'Detalle', 'Monto USD'],
      ['01/11/2026', 'Pago', '-12.00'],
    ]);
    expect(single.transactions[0].type).toBe('expense');
  });

  it('uses a "Tipo de transacción" column on unsigned amounts (Yape style)', () => {
    const result = parseStatementTable([
      ['Fecha', 'Mensaje', 'Monto', 'Tipo de Transacción'],
      ['01/11/2026', 'Almuerzo', '15.00', 'Pagaste'],
      ['02/11/2026', 'Devolución', '20.00', 'Te yapearon'],
    ]);
    expect(result.transactions.map((t) => t.type)).toEqual(['expense', 'income']);
  });
});

describe('detectDateOrder', () => {
  it('reads a file as day-first unless a row can only be month-first', () => {
    expect(detectDateOrder(['05/11/2026', '06/11/2026'])).toBe('day-first');
    expect(detectDateOrder(['05/11/2026', '03/15/2026'])).toBe('month-first');
    expect(detectDateOrder(['25/11/2026', '03/04/2026'])).toBe('day-first');
    // A file that shows both is not trustworthy: the local default stays.
    expect(detectDateOrder(['13/01/2026', '01/13/2026'])).toBe('day-first');
  });

  it('ignores serial numbers, real dates and words', () => {
    expect(detectDateOrder([46331, new Date('2026-11-05'), 'SALDO INICIAL', '2026-11-05'])).toBe('day-first');
  });
});

describe('parseStatementTable date order', () => {
  it('reads a month-first file the same way on every row', () => {
    const result = parseStatementTable([
      ['Date', 'Description', 'Amount'],
      ['03/04/2026', 'Coffee', '5.00'],
      ['03/15/2026', 'Rent', '500.00'],
    ]);
    // Both rows are March: 4 March and 15 March. Row-by-row reading made the first 3 April.
    expect(result.transactions.map((t) => t.date)).toEqual(['2026-03-04', '2026-03-15']);
  });

  it('keeps the Latin American reading when the file is ambiguous', () => {
    const result = parseStatementTable([
      ['Fecha', 'Detalle', 'Monto'],
      ['05/11/2026', 'Almuerzo', '15.00'],
      ['06/11/2026', 'Taxi', '8.00'],
    ]);
    expect(result.transactions.map((t) => t.date)).toEqual(['2026-11-05', '2026-11-06']);
  });
});
