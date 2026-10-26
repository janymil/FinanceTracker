import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { complaints } from "../shared/schema";
import { sendEmail } from "./emailService";
import { rateLimit } from "./middleware/rateLimit";
import { log } from './logger';

const SUPPORT_ADDRESS = "info@kaptia.app";
/**
 * The consumer's copy goes out from a no-reply address, never from the support mailbox.
 *
 * The submission form is public and the `email` field is whatever the sender typed, so using
 * `info@kaptia.app` as the sender let anyone mail their own text to any address under our
 * support identity (a phishing gift). The address still receives the copy it is legally owed;
 * replies simply do not come back to the support inbox.
 */
const NO_REPLY_ADDRESS =
  process.env.EMAIL_NO_REPLY || process.env.EMAIL_FROM || "no-reply@kaptia.app";
const RESPONSE_DAYS = 30;

const trimmed = (max: number) => z.string().trim().min(1).max(max);

const complaintSchema = z
  .object({
    kind: z.enum(["reclamo", "queja"]),
    fullName: trimmed(160),
    documentType: z.enum(["dni", "ce", "passport", "ruc"]),
    documentNumber: z.string().trim().regex(/^[A-Za-z0-9]{5,20}$/),
    address: trimmed(240),
    email: z.string().trim().max(160).email(),
    phone: z.string().trim().max(32).optional().or(z.literal("")),
    service: trimmed(160),
    amountClaimed: z.string().trim().max(32).optional().or(z.literal("")),
    detail: z.string().trim().min(10).max(4000),
    request: z.string().trim().min(5).max(2000),
    language: z.enum(["en", "es", "sk"]).default("es"),
    truth: z.literal(true),
  })
  .refine((data) => data.documentType !== "dni" || /^\d{8}$/.test(data.documentNumber), {
    path: ["documentNumber"],
  })
  .refine((data) => data.documentType !== "ruc" || /^\d{11}$/.test(data.documentNumber), {
    path: ["documentNumber"],
  });

type ComplaintInput = z.infer<typeof complaintSchema>;

function complaintCode(id: number, createdAt: Date): string {
  return `RC-${createdAt.getUTCFullYear()}-${String(id).padStart(6, "0")}`;
}

/** The consumer's copy and the provider's record are the same text. */
function complaintText(code: string, data: ComplaintInput, createdAt: Date): string {
  return [
    `Libro de Reclamaciones - Kaptia (NutriNova LLC)`,
    `Hoja de ${data.kind === "reclamo" ? "Reclamo" : "Queja"} N.º ${code}`,
    `Fecha: ${createdAt.toISOString().slice(0, 10)}`,
    ``,
    `1. Identificación del consumidor`,
    `Nombre: ${data.fullName}`,
    `Documento: ${data.documentType.toUpperCase()} ${data.documentNumber}`,
    `Domicilio: ${data.address}`,
    `Correo: ${data.email}`,
    `Teléfono: ${data.phone || "-"}`,
    ``,
    `2. Identificación del servicio contratado`,
    `Servicio: ${data.service}`,
    `Monto reclamado: ${data.amountClaimed || "-"}`,
    ``,
    `3. Detalle`,
    `${data.detail}`,
    ``,
    `Pedido del consumidor: ${data.request}`,
    ``,
    `Respuesta: el proveedor responderá en un plazo máximo de ${RESPONSE_DAYS} días calendario.`,
  ].join("\n");
}

export function registerComplaintRoutes(app: Express) {
  // Public by design (no account needed), so it has a tight per-address limit.
  app.post(
    "/api/complaints",
    rateLimit({ windowMs: 60 * 60 * 1000, max: 5, keyPrefix: "complaints" }),
    async (req: Request, res: Response) => {
      const parsed = complaintSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid complaint",
          fields: parsed.error.issues.map((issue) => issue.path.join(".")),
        });
      }

      const data = parsed.data;

      try {
        // The code needs the row id, so the row is created with a throw-away code first.
        const [row] = await db
          .insert(complaints)
          .values({
            code: `TMP-${crypto.randomUUID().slice(0, 18)}`,
            kind: data.kind,
            fullName: data.fullName,
            documentType: data.documentType,
            documentNumber: data.documentNumber,
            address: data.address,
            email: data.email,
            phone: data.phone || null,
            service: data.service,
            amountClaimed: data.amountClaimed || null,
            detail: data.detail,
            request: data.request,
            language: data.language,
          })
          .returning();

        const code = complaintCode(row.id, row.createdAt);
        await db.update(complaints).set({ code }).where(eq(complaints.id, row.id));

        const text = complaintText(code, data, row.createdAt);
        const subject = `[Libro de Reclamaciones] ${code}`;

        // The consumer must get a copy; the team must get the record. Neither failure
        // loses the complaint, which is already stored.
        const [copySent] = await Promise.all([
          sendEmail({ to: data.email, from: NO_REPLY_ADDRESS, subject, text }),
          sendEmail({ to: process.env.EMAIL_TO || SUPPORT_ADDRESS, from: SUPPORT_ADDRESS, subject, text }),
        ]);

        return res.status(201).json({ success: true, code, copySent });
      } catch (error) {
        log.error("Complaint registration failed:", error instanceof Error ? error.message : error);
        return res.status(500).json({ success: false, error: "Could not register the complaint" });
      }
    }
  );
}
