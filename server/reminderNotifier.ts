import { log } from './logger';
import { and, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "./db";
import { expenseReminders, users } from "../shared/schema";
import { sendEmail } from "./emailService";
import { withJobRun } from "./errorGuard/jobs.js";
import { formatCurrencyAmount, resolveStoredCurrency } from "../shared/currencies";
import { decryptField } from "./fieldCrypto";

type Language = "en" | "es" | "sk";

interface ReminderEmailInput {
  language: string | null | undefined;
  firstName: string | null | undefined;
  title: string;
  dueDate: Date;
  amount: string | null | undefined;
  currencySymbol: string | null | undefined;
  paymentUrl: string | null | undefined;
  appUrl: string;
}

const COPY: Record<Language, {
  subject: (title: string, date: string) => string;
  greeting: (name: string) => string;
  line: (title: string, date: string) => string;
  amount: (value: string) => string;
  pay: string;
  open: string;
  footer: string;
}> = {
  en: {
    subject: (title, date) => `Reminder: ${title} is due ${date}`,
    greeting: (name) => `Hi ${name},`,
    line: (title, date) => `This is a reminder that "${title}" is due on ${date}.`,
    amount: (value) => `Amount: ${value}`,
    pay: 'Pay it here:',
    open: 'Open Kaptia:',
    footer: 'You get this because bill reminders are on. Turn them off any time in Profile → Preferences.',
  },
  es: {
    subject: (title, date) => `Recordatorio: ${title} vence el ${date}`,
    greeting: (name) => `Hola ${name},`,
    line: (title, date) => `Te recordamos que "${title}" vence el ${date}.`,
    amount: (value) => `Monto: ${value}`,
    pay: 'Págalo aquí:',
    open: 'Abrir Kaptia:',
    footer: 'Recibes este correo porque tienes activados los recordatorios de pagos. Puedes desactivarlos cuando quieras en Perfil → Preferencias.',
  },
  sk: {
    subject: (title, date) => `Pripomienka: ${title} má splatnosť ${date}`,
    greeting: (name) => `Ahoj ${name},`,
    line: (title, date) => `Pripomíname, že „${title}“ má splatnosť ${date}.`,
    amount: (value) => `Suma: ${value}`,
    pay: 'Zaplatiť tu:',
    open: 'Otvoriť Kaptiu:',
    footer: 'Tento e-mail dostávate, pretože máte zapnuté pripomienky platieb. Vypnúť ich môžete kedykoľvek v Profil → Predvoľby.',
  },
};

const LOCALES: Record<Language, string> = { en: "en-US", es: "es-PE", sk: "sk-SK" };

function languageOf(value: string | null | undefined): Language {
  return value === "es" || value === "sk" ? value : "en";
}

/** Only web links go into an e-mail; anything else (javascript:, data:) is dropped. */
function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function buildReminderEmail(input: ReminderEmailInput): { subject: string; text: string } {
  const language = languageOf(input.language);
  const copy = COPY[language];
  const date = new Intl.DateTimeFormat(LOCALES[language], { dateStyle: "long", timeZone: "UTC" }).format(input.dueDate);
  const name = (input.firstName || "").trim() || (language === "es" ? "" : "there");

  const lines = [copy.greeting(name).replace(/\s+,/, ","), "", copy.line(input.title, date)];

  if (input.amount && Number(input.amount) > 0) {
    const currency = resolveStoredCurrency(input.currencySymbol);
    lines.push(copy.amount(currency ? formatCurrencyAmount(Number(input.amount), currency.code, language) : Number(input.amount).toFixed(2)));
  }
  const pay = safeUrl(input.paymentUrl);
  if (pay) lines.push("", `${copy.pay} ${pay}`);
  lines.push("", `${copy.open} ${input.appUrl}/${language}/dashboard`, "", copy.footer);

  return { subject: copy.subject(input.title, date), text: lines.join("\n") };
}

export interface ReminderRunResult {
  sent: number;
  skipped: number;
}

/**
 * E-mails bill reminders whose "remind me N days before" moment has arrived.
 * `last_reminded` is set only after the e-mail was handed over, and a reminder is sent at
 * most once per due date (a recurring bill that rolls forward becomes eligible again).
 */
export async function sendDueReminderEmails(now: Date = new Date()): Promise<ReminderRunResult> {
  const appUrl = (process.env.APP_URL || "https://kaptia.app").replace(/\/+$/, "");
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      reminder: expenseReminders,
      email: users.email,
      firstName: users.firstName,
      language: users.language,
      currency: users.currency,
    })
    .from(expenseReminders)
    .innerJoin(users, eq(expenseReminders.userId, users.id))
    .where(
      and(
        eq(expenseReminders.isActive, true),
        eq(expenseReminders.isCompleted, false),
        eq(users.emailNotifications, true),
        sql`${users.plan} <> 'free'`,
        gte(expenseReminders.dueDate, yesterday),
        // Remind window opened: due_date - reminder_days_before <= now
        sql`${expenseReminders.dueDate} - (COALESCE(${expenseReminders.reminderDaysBefore}, 1) * interval '1 day') <= ${now}`,
        // Not already reminded for this due date
        or(
          isNull(expenseReminders.lastReminded),
          sql`${expenseReminders.lastReminded} < ${expenseReminders.dueDate} - (COALESCE(${expenseReminders.reminderDaysBefore}, 1) * interval '1 day')`
        ),
        lte(expenseReminders.dueDate, new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000))
      )
    )
    .limit(200);

  let sent = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.email || row.email.endsWith("@clerk.user")) {
      skipped++;
      continue;
    }

    const { subject, text } = buildReminderEmail({
      language: row.language,
      firstName: row.firstName,
      // The reminder row is stored encrypted; the e-mail is the one place it must be readable.
      title: decryptField(row.reminder.title) as string,
      dueDate: row.reminder.dueDate,
      amount: row.reminder.amount,
      currencySymbol: row.currency,
      paymentUrl: row.reminder.paymentUrl,
      appUrl,
    });

    const ok = await sendEmail({ to: row.email, from: "Kaptia <info@kaptia.app>", subject, text });
    if (!ok) {
      skipped++;
      continue;
    }

    await db.update(expenseReminders).set({ lastReminded: now }).where(eq(expenseReminders.id, row.reminder.id));
    sent++;
  }

  return { sent, skipped };
}

const HOUR_MS = 60 * 60 * 1000;

export function startReminderScheduler(): void {
  const run = () => void withJobRun("reminder-emails", async () => {
    const result = await sendDueReminderEmails();
    if (result.sent > 0) log.info(`[reminders] sent ${result.sent} e-mail(s), skipped ${result.skipped}`);
  });

  setTimeout(run, 60_000);
  setInterval(run, HOUR_MS);
}
