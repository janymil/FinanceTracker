import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { resetRateLimits } from '../../server/middleware/rateLimit';

/**
 * Libro de Reclamaciones (Peru, Ley 29571).
 *
 * The form is public and the row is the legal record, so what is worth pinning down is: what
 * gets written, that both copies (consumer and team) go out, that a mail failure does not lose
 * the sheet, and that one address cannot flood the book.
 *
 * The database and the mail transport are mocked on purpose: a test must never create a real
 * "Hoja de Reclamo" in the legal record or send mail to a real inbox.
 */
const rowReturning = vi.hoisted(() => vi.fn());
const rowValues = vi.hoisted(() =>
  vi.fn((_values: Record<string, unknown>) => ({ returning: rowReturning })),
);
const codeWhere = vi.hoisted(() => vi.fn(async () => undefined));
const codeSet = vi.hoisted(() => vi.fn(() => ({ where: codeWhere })));
const insert = vi.hoisted(() => vi.fn(() => ({ values: rowValues })));
const update = vi.hoisted(() => vi.fn(() => ({ set: codeSet })));
const sendEmail = vi.hoisted(() => vi.fn(async (_params: any) => true));

vi.mock('../../server/db', () => ({ db: { insert, update } }));
vi.mock('../../server/emailService', () => ({ sendEmail }));

const CREATED_AT = new Date('2026-03-04T10:00:00.000Z');
const CONSUMER_COPY = 'no-reply@test.local';
const TEAM_COPY = 'team@test.local';

const VALID = {
  kind: 'reclamo',
  fullName: 'Rosa Quispe',
  documentType: 'dni',
  documentNumber: '12345678',
  address: 'Av. Larco 123, Miraflores, Lima',
  email: 'rosa@example.com',
  phone: '+51987654321',
  service: 'Plan Premium mensual',
  amountClaimed: '39.90',
  detail: 'Me cobraron dos veces el mismo mes y el plan no se activo.',
  request: 'Devolucion del segundo cobro.',
  language: 'es',
  truth: true,
};

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  // Set before the module is imported: both sender addresses are read at import time.
  process.env.EMAIL_NO_REPLY = CONSUMER_COPY;
  process.env.EMAIL_TO = TEAM_COPY;
  process.env.EMAIL_FROM = 'ignored@test.local';

  const { registerComplaintRoutes } = await import('../../server/complaints');
  const app = express();
  app.use(express.json());
  registerComplaintRoutes(app);
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
  delete process.env.EMAIL_NO_REPLY;
  delete process.env.EMAIL_TO;
  delete process.env.EMAIL_FROM;
});

beforeEach(() => {
  resetRateLimits();
  insert.mockClear();
  rowValues.mockClear();
  codeSet.mockClear();
  codeWhere.mockClear();
  rowReturning.mockReset();
  rowReturning.mockResolvedValue([{ id: 42, createdAt: CREATED_AT }]);
  sendEmail.mockReset();
  sendEmail.mockResolvedValue(true);
});

function submit(body: Record<string, unknown> = VALID) {
  return fetch(`${baseUrl}/api/complaints`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}


describe('POST /api/complaints', () => {
  it('stores the sheet, stamps the legal code and mails both copies', async () => {
    const response = await submit();
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({ success: true, code: 'RC-2026-000042', copySent: true });

    // What is written: the row is created with a throw-away code, then stamped with the real one.
    expect(rowValues).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'reclamo',
        fullName: 'Rosa Quispe',
        documentType: 'dni',
        documentNumber: '12345678',
        email: 'rosa@example.com',
        phone: '+51987654321',
        service: 'Plan Premium mensual',
        amountClaimed: '39.90',
        language: 'es',
      }),
    );
    expect(String(rowValues.mock.calls[0][0].code)).toMatch(/^TMP-/);
    expect(codeSet).toHaveBeenCalledWith({ code: 'RC-2026-000042' });

    // Consumer copy from no-reply (the public form must not speak as the support mailbox),
    // team copy to the support address. Same text for both.
    expect(sendEmail).toHaveBeenCalledTimes(2);
    const [consumer, team] = sendEmail.mock.calls.map((call) => call[0] as any);
    expect(consumer.to).toBe('rosa@example.com');
    expect(consumer.from).toBe(CONSUMER_COPY);
    expect(team.to).toBe(TEAM_COPY);
    expect(team.from).toBe('info@kaptia.app');
    expect(consumer.subject).toBe('[Libro de Reclamaciones] RC-2026-000042');
    expect(consumer.text).toContain('Hoja de Reclamo N.º RC-2026-000042');
    expect(consumer.text).toContain('Fecha: 2026-03-04');
    expect(consumer.text).toContain('Monto reclamado: 39.90');
    expect(consumer.text).toContain('15 días calendario');
    expect(team.text).toBe(consumer.text);
  });

  it('rejects a DNI that is not eight digits and writes nothing', async () => {
    const response = await submit({ ...VALID, documentNumber: '1234567' });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.fields).toContain('documentNumber');
    expect(insert).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('requires a RUC of eleven digits but lets a passport use the generic format', async () => {
    const badRuc = await submit({ ...VALID, documentType: 'ruc', documentNumber: '2012345678' });
    expect(badRuc.status).toBe(400);

    const passport = await submit({ ...VALID, documentType: 'passport', documentNumber: 'AB123456' });
    expect(passport.status).toBe(201);
  });

  it('refuses a sheet without the truth declaration', async () => {
    const response = await submit({ ...VALID, truth: false });

    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('keeps the sheet when the mail transport fails, and says the copy was not sent', async () => {
    sendEmail.mockResolvedValue(false);

    const response = await submit();
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.copySent).toBe(false);
    // The record is written before any mail is attempted.
    expect(rowValues).toHaveBeenCalledTimes(1);
    expect(codeSet).toHaveBeenCalledTimes(1);
  });

  it('answers 500 and sends nothing when the record cannot be written', async () => {
    rowReturning.mockRejectedValue(new Error('insert failed'));

    const response = await submit();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('limits one address to five sheets per hour', async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await submit()).status).toBe(201);
    }

    const sixth = await submit();
    expect(sixth.status).toBe(429);
    expect(rowValues).toHaveBeenCalledTimes(5);
  });
});
