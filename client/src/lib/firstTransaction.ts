import { cleanPositiveAmount, cleanText, MAX_DESCRIPTION_LENGTH } from "@shared/trackingInput";

/**
 * The welcome form's two fields as the server will accept them, or null when something is
 * missing. People type "12,50" (comma decimals) as often as "12.50"; both are understood.
 */
export function parseFirstTransaction(
  amountText: string,
  descriptionText: string,
): { amount: string; description: string } | null {
  const normalised = amountText.trim().replace(/\s/g, "").replace(",", ".");
  const amount = cleanPositiveAmount(normalised);
  const description = cleanText(descriptionText, MAX_DESCRIPTION_LENGTH);
  return amount && description ? { amount, description } : null;
}
