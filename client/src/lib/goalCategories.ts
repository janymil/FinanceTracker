/**
 * A goal stores its category as text: the predefined goal category's name as it was shown when
 * the goal was created, lower-cased with spaces as underscores ("fondo_de_emergencia"), or an older
 * English label ("Emergency Fund"). Whatever language created it, show it in the page language.
 */
type Lang = "en-us" | "es-pe" | "sk-sk";

const LABELS: Record<string, Record<Lang, string>> = {
  emergency_fund: { "en-us": "Emergency fund", "es-pe": "Fondo de emergencia", "sk-sk": "Núdzový fond" },
  vacation: { "en-us": "Vacation", "es-pe": "Vacaciones", "sk-sk": "Dovolenka" },
  house_down_payment: { "en-us": "Home down payment", "es-pe": "Pago inicial de casa", "sk-sk": "Záloha na dom" },
  car_purchase: { "en-us": "Car", "es-pe": "Compra de auto", "sk-sk": "Kúpa auta" },
  debt_payoff: { "en-us": "Paying off debt", "es-pe": "Pago de deudas", "sk-sk": "Splácanie dlhov" },
  retirement: { "en-us": "Retirement", "es-pe": "Jubilación", "sk-sk": "Dôchodok" },
  wedding: { "en-us": "Wedding", "es-pe": "Boda", "sk-sk": "Svadba" },
  home: { "en-us": "Home", "es-pe": "Casa", "sk-sk": "Dom" },
  education: { "en-us": "Education", "es-pe": "Educación", "sk-sk": "Vzdelanie" },
  emergency: { "en-us": "Emergency", "es-pe": "Emergencia", "sk-sk": "Núdzové" },
  other: { "en-us": "Other", "es-pe": "Otro", "sk-sk": "Iné" },
};

/** Every spelling seen in stored goals, mapped to the label key above. */
const ALIASES: Record<string, string> = {
  emergency_fund: "emergency_fund",
  fondo_de_emergencia: "emergency_fund",
  "núdzový_fond": "emergency_fund",
  vacation: "vacation",
  vacaciones: "vacation",
  dovolenka: "vacation",
  house_down_payment: "house_down_payment",
  pago_inicial_de_casa: "house_down_payment",
  "záloha_na_dom": "house_down_payment",
  car_purchase: "car_purchase",
  compra_de_auto: "car_purchase",
  "kúpa_auta": "car_purchase",
  debt_payoff: "debt_payoff",
  pago_de_deudas: "debt_payoff",
  "splácanie_dlhov": "debt_payoff",
  retirement: "retirement",
  "jubilación": "retirement",
  "dôchodok": "retirement",
  wedding: "wedding",
  boda: "wedding",
  svadba: "wedding",
  home: "home",
  casa: "home",
  dom: "home",
  education: "education",
  "educación": "education",
  vzdelanie: "education",
  emergency: "emergency",
  emergencia: "emergency",
  "núdzové": "emergency",
  other: "other",
  otro: "other",
  "iné": "other",
};

export function goalCategorySlug(name: string): string {
  return name.trim().toLocaleLowerCase().replace(/\s+/g, "_");
}

export function goalCategoryLabel(category: string | null | undefined, language: string): string {
  if (!category) return "";
  const lang: Lang = language.startsWith("es") ? "es-pe" : language.startsWith("sk") ? "sk-sk" : "en-us";
  const key = ALIASES[goalCategorySlug(category)];
  return key ? LABELS[key][lang] : category.replace(/_/g, " ");
}
