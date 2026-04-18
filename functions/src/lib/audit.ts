/**
 * Emit a structured audit line Cloud Logging will parse as JSON.
 * Focused on who called which callable, when, how long it took,
 * and whether Gemini was invoked (for cost/abuse correlation).
 */
export interface AuditPayload {
  endpoint: string;
  email: string;
  durationMs: number;
  geminiCalled?: boolean;
  [key: string]: unknown;
}

export function auditLog(payload: AuditPayload) {
  console.log(JSON.stringify({
    severity: 'INFO',
    event: 'callable_invoked',
    ...payload,
  }));
}
