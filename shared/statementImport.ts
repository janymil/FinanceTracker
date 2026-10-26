/**
 * Reads the movement tables that banks let people download (CSV or Excel), without
 * hard-coding one template per bank. Peruvian banks (BCP, Interbank, BBVA, Scotiabank,
 * Banco de la Nación, Yape/Plin exports) and others differ in column names and number
 * formats but share the same shape: a header row, then one row per movement with a date,
 * a description and either one signed amount or separate debit/credit columns.
 *
 * Pure: it takes a matrix of cells (so the caller can feed CSV text or a spreadsheet) and
 * returns normalised rows. It never throws on bad rows; they are counted as skipped.
 */

export interface ParsedMovement {
  /** yyyy-MM-dd */
  date: string;
  description: string;
  /** Always positive. */
  amount: number;
  type: "income" | "expense";
}

export interface StatementParseResult {
  transactions: ParsedMovement[];
  skipped: number;
  /** Which header the parser used for each role, for showing the person what it understood. */
  columns: { date: string; description: string; amount?: string; debit?: string; credit?: string; kind?: string } | null;
  error?: "no_header" | "no_rows";
}

type Cell = unknown;

const norm = (value: Cell): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const DATE_HEADERS = ["fecha", "fecha operacion", "fecha proceso", "fecha movimiento", "fecha de operacion", "fecha valor", "fecha contable", "date", "dátum", "datum", "f operacion", "f proceso"];
const DESCRIPTION_HEADERS = ["descripcion", "concepto", "detalle", "glosa", "movimiento", "descripcion operacion", "operacion", "referencia", "description", "details", "popis", "detalle del movimiento", "nombre"];
const AMOUNT_HEADERS = ["monto", "importe", "amount", "valor", "suma", "monto s", "importe s", "monto total"];
const DEBIT_HEADERS = ["cargo", "cargos", "debito", "debitos", "retiro", "retiros", "egreso", "egresos", "debit", "withdrawal", "gasto", "salida", "salidas"];
const CREDIT_HEADERS = ["abono", "abonos", "credito", "creditos", "deposito", "depositos", "ingreso", "ingresos", "credit", "deposit", "entrada", "entradas"];
const KIND_HEADERS = ["tipo", "tipo de movimiento", "tipo movimiento", "tipo de transaccion", "naturaleza", "type", "cargo abono", "cargo/abono", "dc", "d c"];

// Exact, or the option followed by more words: "monto usd", "cargo s", "tipo de transaccion".
const matchesAny = (header: string, options: string[]) =>
  options.some((option) => {
    const wanted = norm(option);
    return header === wanted || header.startsWith(wanted + " ");
  });

const MONTHS: Record<string, number> = {
  ene: 1, enero: 1, jan: 1, january: 1,
  feb: 2, febrero: 2, february: 2,
  mar: 3, marzo: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6, june: 6,
  jul: 7, julio: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8,
  sep: 9, set: 9, sept: 9, septiembre: 9, setiembre: 9, september: 9,
  oct: 10, octubre: 10, october: 10,
  nov: 11, noviembre: 11, november: 11,
  dic: 12, diciembre: 12, dec: 12, december: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

function validYmd(year: number, month: number, day: number): string | null {
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1) return null; // e.g. 31 February
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Excel stores dates as days since 1899-12-30. */
function fromExcelSerial(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return null;
  const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
  return validYmd(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export type DateOrder = "day-first" | "month-first";

/**
 * Which way one file writes dd/mm/yyyy, decided once for the whole file.
 *
 * Reading each row on its own made a mixed file: 03/04 became 3 April (day-first, the Latin
 * American rule) while 03/15 became 15 March one row later. A single row that can only be
 * month-first fixes the convention for every row, and one that can only be day-first fixes it
 * the other way. A file that shows both is not trustworthy, so the local default stays.
 */
export function detectDateOrder(values: Cell[]): DateOrder {
  let dayFirst = false;
  let monthFirst = false;

  for (const value of values) {
    // Serial numbers and real dates carry no day/month ambiguity.
    if (value instanceof Date || typeof value === "number") continue;

    const text = String(value ?? "").trim();
    if (!text || /^\d{5}(\.\d+)?$/.test(text)) continue;

    const match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?:[ T].*)?$/);
    if (!match) continue;

    const first = +match[1];
    const second = +match[2];
    if (first > 12 && second <= 12) dayFirst = true;
    else if (second > 12 && first <= 12) monthFirst = true;
  }

  return monthFirst && !dayFirst ? "month-first" : "day-first";
}

/**
 * Day-first is the rule in Peru and the rest of Latin America (05/11/2026 = 5 November),
 * which is why a US-style month-first reading is only used when day-first is impossible —
 * or when the whole file has shown it is month-first (see `detectDateOrder`).
 */
export function parseStatementDate(value: Cell, order: DateOrder = "day-first"): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return validYmd(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === "number") return fromExcelSerial(value);

  const text = String(value ?? "").trim();
  if (!text) return null;

  if (/^\d{5}(\.\d+)?$/.test(text)) return fromExcelSerial(Number(text));

  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/);
  if (match) return validYmd(+match[1], +match[2], +match[3]);

  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?:[ T].*)?$/);
  if (match) {
    const a = +match[1];
    const b = +match[2];
    const year = match[3].length === 2 ? 2000 + +match[3] : +match[3];
    return order === "month-first"
      ? validYmd(year, a, b) ?? validYmd(year, b, a)
      : validYmd(year, b, a) ?? validYmd(year, a, b);
  }

  // "05 Nov 2026", "5-nov-26", "5 de noviembre de 2026"
  match = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .match(/^(\d{1,2})[ \-/.]*(?:de )?([a-z]{3,10})\.?[ \-/.]*(?:de )?(\d{4}|\d{2})\b/);
  if (match && MONTHS[match[2]]) {
    const year = match[3].length === 2 ? 2000 + +match[3] : +match[3];
    return validYmd(year, MONTHS[match[2]], +match[1]);
  }

  return null;
}

/**
 * Numbers as banks print them: "S/ 1,234.56", "1.234,56", "(250.00)", "250.00-", "-80", "1 234,5".
 * Returns a signed number, or null when the cell is not a number.
 */
export function parseStatementAmount(value: Cell): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let text = String(value ?? "").trim();
  if (!text) return null;

  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (/-\s*$/.test(text)) {
    negative = true;
    text = text.replace(/-\s*$/, "");
  }
  if (/\b(dr|db|cargo|debito)\b/i.test(text)) negative = true;

  text = text.replace(/(?:s\/\.?|us\$|r\$|\$|usd|pen|eur|€|£|cr|dr|db)/gi, "").replace(/\s/g, "");
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  } else if (text.startsWith("+")) {
    text = text.slice(1);
  }
  if (!/^[\d.,]+$/.test(text) || !/\d/.test(text)) return null;

  const lastDot = text.lastIndexOf(".");
  const lastComma = text.lastIndexOf(",");

  // A lone separator followed by exactly three digits (after one to three digits) is a
  // thousands separator: bank amounts nearly always have two decimals, so "1,234" and
  // "1.234" mean one thousand two hundred thirty-four. "0.500" stays a decimal.
  const isThousandsOnly = (separator: "." | ",") => {
    const parts = text.split(separator);
    if (parts.length > 2) return parts.slice(1).every((part) => part.length === 3);
    return parts.length === 2 && parts[1].length === 3 && /^[1-9]\d{0,2}$/.test(parts[0]);
  };

  let normalized: string;
  if (lastDot !== -1 && lastComma !== -1) {
    // Both present: whichever comes last is the decimal separator.
    normalized = lastDot > lastComma ? text.replace(/,/g, "") : text.replace(/\./g, "").replace(",", ".");
  } else if (lastComma !== -1) {
    normalized = isThousandsOnly(",") ? text.replace(/,/g, "") : text.replace(",", ".");
  } else if (lastDot !== -1) {
    normalized = isThousandsOnly(".") ? text.replace(/\./g, "") : text;
  } else {
    normalized = text;
  }

  const number = Number(normalized);
  if (!Number.isFinite(number)) return null;
  return negative ? -number : number;
}

interface Detected {
  headerRow: number;
  date: number;
  description: number;
  amount: number;
  debit: number;
  credit: number;
  kind: number;
}

function findColumns(rows: Cell[][]): Detected | null {
  const limit = Math.min(rows.length, 25);
  for (let r = 0; r < limit; r++) {
    const headers = rows[r].map(norm);
    const find = (options: string[]) => headers.findIndex((header) => header && matchesAny(header, options));

    const date = find(DATE_HEADERS);
    if (date === -1) continue;

    const amount = find(AMOUNT_HEADERS);
    const debit = find(DEBIT_HEADERS);
    const credit = find(CREDIT_HEADERS);
    if (amount === -1 && debit === -1 && credit === -1) continue;

    let description = find(DESCRIPTION_HEADERS);
    if (description === -1) {
      // Fall back to the first text-looking header that is not one of the numeric roles.
      description = headers.findIndex((header, index) => header && ![date, amount, debit, credit].includes(index));
    }
    if (description === -1) continue;

    return { headerRow: r, date, description, amount, debit, credit, kind: find(KIND_HEADERS) };
  }
  return null;
}

export function parseStatementTable(rows: Cell[][]): StatementParseResult {
  const cleaned = rows.filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? "").trim() !== ""));
  const columns = findColumns(cleaned);
  if (!columns) return { transactions: [], skipped: 0, columns: null, error: "no_header" };

  const header = cleaned[columns.headerRow].map((cell) => String(cell ?? "").trim());
  const transactions: ParsedMovement[] = [];
  let skipped = 0;

  // Decided once for the file, never per row: see detectDateOrder.
  const dataRows = cleaned.slice(columns.headerRow + 1);
  const dateOrder = detectDateOrder(dataRows.map((row) => row[columns.date]));

  for (const row of dataRows) {
    const date = parseStatementDate(row[columns.date], dateOrder);
    const description = String(row[columns.description] ?? "").replace(/\s+/g, " ").trim();
    if (!date || !description) {
      skipped++;
      continue;
    }

    let signed: number | null = null;

    if (columns.debit !== -1 || columns.credit !== -1) {
      const debit = columns.debit !== -1 ? parseStatementAmount(row[columns.debit]) : null;
      const credit = columns.credit !== -1 ? parseStatementAmount(row[columns.credit]) : null;
      if (debit !== null && debit !== 0) signed = -Math.abs(debit);
      else if (credit !== null && credit !== 0) signed = Math.abs(credit);
    }

    if (signed === null && columns.amount !== -1) {
      const amount = parseStatementAmount(row[columns.amount]);
      if (amount !== null && amount !== 0) {
        signed = amount;
        // A single unsigned column plus a "cargo/abono" style column says which way it goes.
        if (columns.kind !== -1 && amount > 0) {
          const kind = norm(row[columns.kind]);
          if (/\b(cargo|debito|retiro|egreso|debit|dr|d|gasto|withdrawal|pago|pagaste|enviaste|envio|enviado|compra|salida)\b/.test(kind)) signed = -amount;
        }
      }
    }

    if (signed === null) {
      skipped++;
      continue;
    }

    transactions.push({
      date,
      description,
      amount: Math.round(Math.abs(signed) * 100) / 100,
      type: signed < 0 ? "expense" : "income",
    });
  }

  return {
    transactions,
    skipped,
    columns: {
      date: header[columns.date],
      description: header[columns.description],
      amount: columns.amount !== -1 ? header[columns.amount] : undefined,
      debit: columns.debit !== -1 ? header[columns.debit] : undefined,
      credit: columns.credit !== -1 ? header[columns.credit] : undefined,
      kind: columns.kind !== -1 ? header[columns.kind] : undefined,
    },
    error: transactions.length === 0 ? "no_rows" : undefined,
  };
}

/**
 * CSV text -> cell matrix. Handles quoted fields (with commas, doubled quotes and line
 * breaks inside) and picks the delimiter that fits the first lines: `,` `;` tab or `|`.
 * Latin American exports commonly use `;` because `,` is their decimal separator.
 */
export function parseCsvText(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const sample = source.split(/\r?\n/).slice(0, 10).join("\n");
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0, "|": 0 };
  let inQuotes = false;
  for (const char of sample) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && char in counts) counts[char]++;
  }
  const delimiter = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : ",");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  inQuotes = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
