import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';

/** The path shape `/api/receipts/...` answers only the owner; anything else is a public link. */
const PRIVATE_RECEIPT_PREFIX = '/api/receipts/';

/**
 * A receipt photo ready for `<img src>`.
 *
 * A stored receipt is streamed by `/api/receipts/<userId>/<file>`, an owner-only route. An
 * `<img src="/api/receipts/...">` is a plain GET: the browser sends no session token with it, so
 * the route answered 401/503 and the modal showed a broken image where the scanned receipt
 * should be. The photo is fetched here with the token the rest of the app uses, turned into a
 * blob URL, and released when the path changes or the component unmounts.
 *
 * Rows written before receipts became private carry the bucket's public URL; those are passed
 * through untouched.
 */
export function useReceiptImageSrc(path: string | null | undefined): string | null {
  const { getToken } = useAuth();
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setSrc(null);
      return;
    }
    if (!path.startsWith(PRIVATE_RECEIPT_PREFIX)) {
      setSrc(path);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error(`Receipt image unavailable (${response.status})`);
        const blob = await response.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch (error) {
        if (!cancelled) setSrc(null);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, getToken]);

  return src;
}

export default useReceiptImageSrc;
