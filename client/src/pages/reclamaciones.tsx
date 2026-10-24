import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { BookOpen, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SEO } from "@/components/SEO";
import { AppLayout } from "@/components/AppLayout";

type Kind = "reclamo" | "queja";
type DocumentType = "dni" | "ce" | "passport" | "ruc";

const LABEL = "block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5";
const FIELD = "rounded-xl bg-white/90 dark:bg-[#0f111a]/90 text-sm";

const emptyForm = {
  kind: "reclamo" as Kind,
  fullName: "",
  documentType: "dni" as DocumentType,
  documentNumber: "",
  address: "",
  email: "",
  phone: "",
  service: "",
  amountClaimed: "",
  detail: "",
  request: "",
  truth: false,
};

export default function Reclamaciones() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const lang = location.match(/^\/([a-z]{2})(?:\/|$)/)?.[1] || localStorage.getItem("preferredLanguage") || "es";
  const language = ["en", "es", "sk"].includes(lang) ? lang : "es";

  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState<{ code: string; email: string } | null>(null);

  const set = <K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFailed(false);
    try {
      const response = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, language }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        setDone({ code: data.code, email: form.email });
        setForm(emptyForm);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout isPublicPage={true}>
      <SEO
        title={t("reclamaciones.seo.title")}
        description={t("reclamaciones.seo.description")}
        canonical={`https://kaptia.app/${language}/reclamaciones`}
      />

      <div className="min-h-screen bg-[#f7f8fc] dark:bg-[#07080f] text-gray-900 dark:text-white pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8">
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 dark:border-white/10 bg-indigo-50/70 dark:bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
              <BookOpen className="h-3.5 w-3.5" />
              Libro de Reclamaciones
            </span>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-4">{t("reclamaciones.title")}</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-3">{t("reclamaciones.subtitle")}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">{t("reclamaciones.provider")}</p>
          </div>

          {done ? (
            <div className="rounded-2xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-6 text-center" role="status">
              <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-3" />
              <h2 className="text-xl font-bold mb-2">{t("reclamaciones.success_title")}</h2>
              <p>{t("reclamaciones.success_desc", { code: done.code, email: done.email })}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="glass-card rounded-2xl p-6 sm:p-8 border border-gray-200/80 dark:border-white/10 space-y-6">
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <p>{t("reclamaciones.explain_claim")}</p>
                <p>{t("reclamaciones.explain_grievance")}</p>
              </div>

              <fieldset className="space-y-4">
                <legend className="font-display text-lg font-bold mb-2">{t("reclamaciones.section_consumer")}</legend>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label htmlFor="rc-name" className={LABEL}>{t("reclamaciones.full_name")}</label>
                    <Input id="rc-name" required maxLength={160} autoComplete="name" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} className={FIELD} />
                  </div>
                  <div>
                    <label htmlFor="rc-doctype" className={LABEL}>{t("reclamaciones.doc_type")}</label>
                    <select
                      id="rc-doctype"
                      value={form.documentType}
                      onChange={(e) => set("documentType", e.target.value as DocumentType)}
                      className={`${FIELD} flex h-10 w-full border border-input px-3 py-2`}
                    >
                      <option value="dni">{t("reclamaciones.doc_dni")}</option>
                      <option value="ce">{t("reclamaciones.doc_ce")}</option>
                      <option value="passport">{t("reclamaciones.doc_passport")}</option>
                      <option value="ruc">{t("reclamaciones.doc_ruc")}</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="rc-docnumber" className={LABEL}>{t("reclamaciones.doc_number")}</label>
                    <Input
                      id="rc-docnumber"
                      required
                      inputMode={form.documentType === "dni" || form.documentType === "ruc" ? "numeric" : "text"}
                      pattern={form.documentType === "dni" ? "\\d{8}" : form.documentType === "ruc" ? "\\d{11}" : "[A-Za-z0-9]{5,20}"}
                      maxLength={20}
                      value={form.documentNumber}
                      onChange={(e) => set("documentNumber", e.target.value)}
                      className={FIELD}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="rc-address" className={LABEL}>{t("reclamaciones.address")}</label>
                    <Input id="rc-address" required maxLength={240} autoComplete="street-address" value={form.address} onChange={(e) => set("address", e.target.value)} className={FIELD} />
                  </div>
                  <div>
                    <label htmlFor="rc-email" className={LABEL}>{t("reclamaciones.email")}</label>
                    <Input id="rc-email" type="email" required maxLength={160} autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={FIELD} />
                  </div>
                  <div>
                    <label htmlFor="rc-phone" className={LABEL}>{t("reclamaciones.phone")}</label>
                    <Input id="rc-phone" type="tel" maxLength={32} autoComplete="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={FIELD} />
                  </div>
                </div>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="font-display text-lg font-bold mb-2">{t("reclamaciones.section_service")}</legend>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="rc-service" className={LABEL}>{t("reclamaciones.service")}</label>
                    <Input id="rc-service" required maxLength={160} placeholder={t("reclamaciones.service_placeholder")} value={form.service} onChange={(e) => set("service", e.target.value)} className={FIELD} />
                  </div>
                  <div>
                    <label htmlFor="rc-amount" className={LABEL}>{t("reclamaciones.amount")}</label>
                    <Input id="rc-amount" maxLength={32} inputMode="decimal" value={form.amountClaimed} onChange={(e) => set("amountClaimed", e.target.value)} className={FIELD} />
                  </div>
                </div>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="font-display text-lg font-bold mb-2">{t("reclamaciones.section_detail")}</legend>
                <div className="flex flex-wrap gap-6" role="radiogroup" aria-label={t("reclamaciones.kind")}>
                  {(["reclamo", "queja"] as Kind[]).map((kind) => (
                    <label key={kind} className="flex items-center gap-2 text-sm">
                      <input type="radio" name="rc-kind" checked={form.kind === kind} onChange={() => set("kind", kind)} />
                      {kind === "reclamo" ? t("reclamaciones.kind_claim") : t("reclamaciones.kind_grievance")}
                    </label>
                  ))}
                </div>
                <div>
                  <label htmlFor="rc-detail" className={LABEL}>{t("reclamaciones.detail")}</label>
                  <Textarea id="rc-detail" required minLength={10} maxLength={4000} rows={5} value={form.detail} onChange={(e) => set("detail", e.target.value)} className={FIELD} />
                </div>
                <div>
                  <label htmlFor="rc-request" className={LABEL}>{t("reclamaciones.request")}</label>
                  <Textarea id="rc-request" required minLength={5} maxLength={2000} rows={3} value={form.request} onChange={(e) => set("request", e.target.value)} className={FIELD} />
                </div>
              </fieldset>

              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" required checked={form.truth} onChange={(e) => set("truth", e.target.checked)} className="mt-1" />
                {t("reclamaciones.truth")}
              </label>

              {failed && (
                <p className="text-sm text-red-600" role="alert">{t("reclamaciones.error")}</p>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl h-11 font-medium"
              >
                <Send className="h-4 w-4 mr-2" />
                {submitting ? t("reclamaciones.submitting") : t("reclamaciones.submit")}
              </Button>

              <p className="text-xs text-gray-500 dark:text-gray-400">{t("reclamaciones.note")}</p>
            </form>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
