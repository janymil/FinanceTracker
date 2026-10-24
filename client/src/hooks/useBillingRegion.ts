import { useQuery } from "@tanstack/react-query";
import { regionForCountry, type BillingRegion } from "@shared/billingRegion";

/**
 * Gateway and currency for this visitor, decided by the server from their country.
 * While loading (or if the call fails) it falls back to the page language.
 */
export function useBillingRegion(language: string): BillingRegion {
  const { data } = useQuery<BillingRegion>({
    queryKey: ["/api/billing-region", language],
    queryFn: async () => {
      const response = await fetch(`/api/billing-region?lang=${encodeURIComponent(language)}`);
      if (!response.ok) throw new Error("billing region unavailable");
      return response.json();
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  return data ?? regionForCountry(null, language);
}
