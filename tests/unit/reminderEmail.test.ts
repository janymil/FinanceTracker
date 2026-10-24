import { describe, expect, it, vi } from 'vitest';

// The module imports the database and the mailer at load time; the builder under test
// is pure, so both are replaced with empty stand-ins.
vi.mock('../../server/db', () => ({ db: {} }));
vi.mock('../../server/emailService', () => ({ sendEmail: vi.fn() }));
vi.mock('../../server/errorGuard/jobs.js', () => ({ withJobRun: vi.fn() }));

import { buildReminderEmail } from '../../server/reminderNotifier';

const base = {
  firstName: 'Ana',
  title: 'Luz del Sur',
  dueDate: new Date('2026-11-05T12:00:00Z'),
  amount: '85.50',
  currencySymbol: 'PEN',
  paymentUrl: null,
  appUrl: 'https://kaptia.app',
};

describe('buildReminderEmail', () => {
  it('writes in the person\'s language and includes the amount', () => {
    const es = buildReminderEmail({ ...base, language: 'es' });
    expect(es.subject).toContain('Recordatorio');
    expect(es.text).toContain('Hola Ana');
    expect(es.text).toMatch(/S\/\s?85\.50/);
    expect(es.text).toContain('https://kaptia.app/es/dashboard');

    const sk = buildReminderEmail({ ...base, language: 'sk' });
    expect(sk.subject).toContain('Pripomienka');
  });

  it('falls back to English for an unknown or missing language', () => {
    expect(buildReminderEmail({ ...base, language: null }).subject).toContain('Reminder');
    expect(buildReminderEmail({ ...base, language: 'fr' }).subject).toContain('Reminder');
  });

  it('only puts web links in the message', () => {
    const safe = buildReminderEmail({ ...base, language: 'en', paymentUrl: 'https://pay.example.com/bill/1' });
    expect(safe.text).toContain('https://pay.example.com/bill/1');

    const unsafe = buildReminderEmail({ ...base, language: 'en', paymentUrl: 'javascript:alert(1)' });
    expect(unsafe.text).not.toContain('javascript:');
  });

  it('leaves the amount out when there is none', () => {
    const none = buildReminderEmail({ ...base, language: 'en', amount: null });
    expect(none.text).not.toContain('Amount');
  });
});
