# Registro de bancos de datos personales — Kaptia

Preparado el 2026-10-29 a partir del código (`shared/schema.ts`, `server/`, `lib/`) y de la
base de datos en producción. **No es un documento firmado**: es el hecho base para que el
responsable del tratamiento (o su abogado) llene las fichas del SIPDP
(`sipdp.minjus.gob.pe`) y para que el Oficial de Datos redacte el Documento de Seguridad.

Registro gratuito, de aprobación automática: una ficha y un código por banco. Los campos que
dicen `[PENDIENTE]` no se pueden inventar: los llena el responsable.

## Datos del responsable

| Campo | Valor |
|---|---|
| Razón social | NutriNova LLC |
| Domicilio | 2105 Vista Oeste NW, Albuquerque, NM 87120, Estados Unidos |
| RUC en Perú | `[PENDIENTE: en trámite]` |
| Representante en Perú | `[PENDIENTE: nombre, documento, domicilio]` |
| Oficial de Datos (ODP) | `[PENDIENTE: interno o externo. Aún no obligatorio para este tamaño; es la vía más barata de tener el resto escrito]` |
| Correo para derechos ARCO | info@kaptia.app |

## Los nueve bancos

| N.º | Banco | Finalidad en una línea | Titulares | Tablas / almacenes |
|---|---|---|---|---|
| 1 | Usuarios y cuentas | Crear y mantener la cuenta, plan y preferencias | Clientes | `users`, `sessions` |
| 2 | Registros financieros | Registrar y ordenar ingresos, gastos, presupuestos, metas y recordatorios | Clientes | `transactions`, `categories`, `budgets`, `recurring_transactions`, `expense_reminders`, `goals`, `backup_settings` |
| 3 | Recibos y estados de cuenta | Leer boletas y estados de cuenta para no escribir a mano | Clientes | imágenes en Cloudflare R2, `import_logs`, `ai_cache` |
| 4 | Voz y transcripciones | Convertir una nota de voz en un gasto | Clientes | audio en memoria (no se guarda), `ai_cache`, `merchant_learning.transcript` |
| 5 | Metas colaborativas y mensajes | Ahorrar en grupo: metas, aportes, mensajes y logros | Clientes | `collaborative_goals`, `collaborative_goal_participants`, `goal_contributions`, `goal_messages`, `challenge_activities`, `milestone_achievements`, `friendships` |
| 6 | Invitados que no son usuarios | Invitar por correo a una meta compartida | Terceros (no clientes) | no se almacena: el correo solo se usa para enviar la invitación |
| 7 | Libro de Reclamaciones | Atender reclamos y quejas (Ley 29571) | Consumidores, con o sin cuenta | `complaints` |
| 8 | Seguridad, logs y analítica | Detectar abuso, diagnosticar errores, cumplir obligaciones | Clientes, visitantes | `error_groups`, `error_events`, `error_rollups`, `job_runs`, `webhook_events`, `ai_usage`, `blocked_countries` |
| 9 | Facturación y pagos | Cobrar la suscripción y emitir boleta o factura | Clientes | `billing_profiles`, `billing_documents`, `manual_payments`, `payment_failures` |

---

## 1. Usuarios y cuentas

- **Finalidad:** crear la cuenta, autenticar, guardar preferencias (idioma, zona horaria,
  moneda, avisos) y saber qué plan está activo.
- **Base legal:** consentimiento del titular al aceptar Términos y Política; ejecución de la
  relación contractual para el plan de pago.
- **Datos:** nombre, correo electrónico, identificador de Clerk, idioma, zona horaria, moneda,
  `ai_enabled`, plan, suscripción, identificadores de pago (sin datos de tarjeta).
- **Titulares:** clientes con cuenta.
- **Origen:** el propio titular, y Clerk para la autenticación.
- **Destinatarios:** Clerk (autenticación), Neon (alojamiento de la base de datos en EE. UU.),
  Cloudflare.
- **Transferencia internacional:** sí, a Estados Unidos. `[PENDIENTE: evaluación de
  transferencia y cláusulas contractuales]`
- **Conservación:** mientras la cuenta exista; al eliminar la cuenta se borra en cascada.
  Sesiones: 24 horas.
- **Medidas de seguridad:** TLS en tránsito; cifrado en reposo; contraseñas gestionadas por
  Clerk y nunca almacenadas por Kaptia.

## 2. Registros financieros

- **Finalidad:** registrar gastos e ingresos, categorizar, presupuestar, recordar pagos y
  mostrar la evolución del dinero del titular.
- **Base legal:** ejecución de la relación contractual (es el servicio); consentimiento para
  las funciones de IA.
- **Datos:** importes, fechas, descripción, categoría, presupuesto, meta de ahorro,
  recordatorios (que pueden incluir números de cuenta escritos por el titular).
- **Titulares:** clientes.
- **Atención:** la descripción libre puede contener datos sensibles que nadie pidió (salud,
  religión, sindicato). No se solicita ninguno; se tratan solo porque el titular los escribe, y
  el titular puede borrarlos.
- **Destinatarios:** Neon, Cloudflare R2 (respaldo). Proveedores de IA solo si `ai_enabled`.
- **Conservación:** hasta que el titular lo borre; copias de respaldo cifradas con rotación de
  30 días.
- **Medidas:** cifrado a nivel de campo de descripción, texto OCR, recordatorios, pagos
  recurrentes y nombres de metas (`server/fieldCrypto.ts`).

## 3. Recibos y estados de cuenta

- **Finalidad:** leer una boleta o un estado de cuenta para no escribir cada línea a mano.
- **Base legal:** consentimiento, dentro de las funciones opcionales de IA.
- **Datos:** imagen del recibo o estado de cuenta, texto extraído, hash de la entrada y
  resultado de la IA.
- **Titulares:** clientes que suben un archivo.
- **Destinatarios:** Cloudflare R2 (imagen), Mistral y Google Vision (lectura), y OpenAI,
  Mistral, DeepSeek o Groq para el texto ya depurado.
- **Conservación:** la imagen, hasta que el titular la borre o elimine la cuenta; `ai_cache`,
  de 24 horas a 7 días; `import_logs`, `[PENDIENTE: definir plazo]`.
- **Medidas:** las líneas con nombre, documento, dirección y números de cuenta se tapan en la
  imagen antes de salir (`server/imageAnonymizer.ts`) y el texto se depura otra vez
  (`shared/aiAnonymizer.ts`). Es seudonimización: nosotros seguimos pudiendo vincular el
  contenido con la persona, y así se describe ahora en la política.

## 4. Voz y transcripciones

- **Finalidad:** dictar un gasto en lugar de escribirlo.
- **Base legal:** consentimiento (función opcional de IA).
- **Datos:** audio de la nota de voz (se procesa en memoria — `multer.memoryStorage()`, no se
  escribe en disco), transcripción, resultado del parseo.
- **Titulares:** clientes que usan el micrófono.
- **Destinatarios:** Groq y Mistral (conversión de voz a texto).
- **Atención — esto es lo que la política decía mal:** el audio **no** va anonimizado. Se envía
  tal como se grabó, porque el audio es justo lo que hay que transcribir. La política ya lo dice
  así desde el 2026-10-29.
- **Conservación:** el audio no se conserva; la transcripción puede quedar en
  `merchant_learning.transcript` cuando el sistema aprende de una corrección. `[VERIFICAR antes
  de firmar: no se encontró el punto de escritura de esa columna en server/; confirmar si hoy se
  escribe y desde dónde]`.
- **Medidas:** el logger tiene `transcript` entre las claves que nunca se escriben en un log
  (`server/logger.ts`).

## 5. Metas colaborativas y mensajes

- **Finalidad:** ahorrar en grupo, con aportes, mensajes y logros.
- **Base legal:** ejecución del servicio entre los participantes; consentimiento de cada uno
  para entrar a la meta.
- **Datos:** nombre y descripción de la meta, importes y aportes, mensajes, rol y estado.
- **Titulares:** clientes, incluidos los que solo participan.
- **Atención:** una meta puede marcarse **pública** (`collaborative_goals.is_public`), y entonces
  la ven personas que no participan. Eso hay que decirlo en el aviso de la pantalla.
- **Destinatarios:** Neon; nadie más.
- **Conservación:** mientras la meta exista; al borrar la cuenta se borran sus aportes.
- **Medidas:** cifrado a nivel de campo del nombre de la meta.

## 6. Invitados que no son usuarios

- **Finalidad:** enviar la invitación a una meta compartida a alguien que todavía no tiene
  cuenta.
- **Base legal:** interés del titular que invita; el invitado recibe un solo correo y puede pedir
  que no se le vuelva a escribir.
- **Datos:** dirección de correo del invitado, nombre de quien invita, nombre de la meta.
- **Titulares:** terceros que no son clientes — por eso es un banco propio y no una fila más del
  banco 1.
- **Destinatarios:** SendGrid o el servidor SMTP.
- **Conservación:** no se almacena en base de datos; vive en el buzón del proveedor de correo.
- **Aviso al invitado:** desde el 2026-10-29, el correo de invitación dice de dónde salió la
  dirección, que no hemos creado cuenta ni añadido a ninguna lista, enlaza la política de
  privacidad y ofrece una vía para no recibir más (`server/emailService.ts`,
  `invitationNotice`).

## 7. Libro de Reclamaciones

- **Finalidad:** atender reclamos y quejas conforme a la Ley 29571 y llevar el registro legal.
- **Base legal:** obligación legal.
- **Datos:** nombre completo, tipo y número de documento, domicilio, correo, teléfono, servicio
  contratado, monto reclamado, hechos y pedido.
- **Titulares:** consumidores, tengan o no cuenta.
- **Destinatarios:** Neon, SendGrid (copia al consumidor y al equipo).
- **Conservación:** `[PENDIENTE: fijar el plazo exacto — sugerencia: mientras el reclamo pueda ser
  exigido]`. La política de privacidad ya lo menciona en su tabla de retención desde el
  2026-10-29 (fila "Reclamos y quejas").
- **Medidas:** la hoja lleva número correlativo y fecha/hora; el consumidor recibe copia.

## 8. Seguridad, logs y analítica

- **Finalidad:** detectar abuso y fraude, diagnosticar errores, bloquear países, medir el coste
  de la IA y cumplir las obligaciones de seguridad del tratamiento.
- **Base legal:** interés en la seguridad del servicio y obligación legal de seguridad.
- **Datos:** dirección IP, user agent, modelo y tamaño de la petición, errores, trazas, país.
- **Titulares:** clientes y visitantes.
- **Destinatarios:** Neon; GeoJS e ipapi (país a partir de la IP); Google Analytics solo si el
  visitante acepta las cookies de analítica.
- **Conservación:** errores y logs, 30 días; `ai_usage` y `webhook_events`, `[PENDIENTE: definir
  plazo]`.
- **Medidas:** el logger depura claves sensibles antes de escribir (`server/logger.ts`).

## 9. Facturación y pagos

- **Finalidad:** cobrar, reintentar cobros fallidos, emitir boleta o factura y sostener el
  historial fiscal.
- **Base legal:** ejecución del contrato y obligación legal tributaria.
- **Datos:** identificadores de cliente y suscripción en Stripe y Mercado Pago, importes, moneda,
  periodo, datos fiscales (documento, razón social, domicilio fiscal) y estado del documento
  emitido.
- **Titulares:** clientes de pago.
- **Destinatarios:** Stripe, Mercado Pago, Neon, SendGrid.
- **Conservación:** `[PENDIENTE: la normativa tributaria peruana exige conservar los comprobantes
  varios años — confirmar el plazo con el contador antes de fijarlo]`.
- **Medidas:** no se almacenan datos de tarjeta; los cobros los ejecuta el proveedor de pagos.

---

## Lo que hay que resolver antes de presentar

1. **RUC y representante.** Sin ellos las fichas quedan incompletas y el banco 9 no tiene emisor.
2. ~~`ai_enabled` viene en `true`.~~ **Resuelto el 2026-10-29:** las cuentas nuevas nacen con la
   IA apagada y se pregunta una vez al entrar (`migrations/0008_users_ai_consent.sql`,
   `AiConsentDialog`). Las cuentas existentes conservan su ajuste y no se les vuelve a preguntar.
3. ~~Banco 6 (invitados): falta el aviso al invitado.~~ **Resuelto el 2026-10-29.**
4. ~~Banco 7 (reclamos): falta en la tabla de retención.~~ **Resuelto el 2026-10-29**; el plazo
   exacto sigue pendiente de que el responsable lo fije.
5. **Plazos de conservación** de `import_logs`, `ai_usage`, `webhook_events` y comprobantes: los
   define el responsable, no el código.
6. **Documento de Seguridad:** este registro describe *qué* se trata; el Documento de Seguridad
   describe *cómo se protege*, con fecha cierta, inventario de accesos y revisión de privilegios
   cada seis meses. Es otro documento y lo firma el responsable.


