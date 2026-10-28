/**
 * The sentence to show for a failed request.
 *
 * `apiRequest` throws `Error("400: {\"message\":\"…\"}")`; printing that raw put a status code and
 * JSON in front of the person. This keeps the server's own message when there is one.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const text = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const body = text.replace(/^\d{3}:\s*/, "");
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed.message === "string" && parsed.message.trim()) return parsed.message;
    if (parsed && typeof parsed.error === "string" && parsed.error.trim()) return parsed.error;
  } catch {
    // Not JSON: fall through.
  }
  return body && body.length < 200 && !/^</.test(body) ? body : fallback;
}

/** The `code` field of a failed request's JSON body ("ai_quota_exceeded"), if any. */
export function apiErrorCode(error: unknown): string | null {
  const text = error instanceof Error ? error.message : "";
  try {
    const parsed = JSON.parse(text.replace(/^\d{3}:\s*/, ""));
    return typeof parsed?.code === "string" ? parsed.code : null;
  } catch {
    return null;
  }
}
