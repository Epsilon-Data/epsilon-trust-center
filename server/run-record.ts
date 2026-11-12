// The signed record of one run: what happened to the script (outcome, exit code and, for a run that
// did not succeed, the SHA-256 of its error text) and which platform job and execution attempt it
// belongs to. The enclave signs these in the attestation user_data; the browser reads the signed
// values itself, so the copies here are for display before that finishes and for the ledger.
// Records from enclave images before 1.7.0 sign none of them: every field is then null.

export const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

export const SUCCEEDED = "succeeded";
const OUTCOMES = new Set([SUCCEEDED, "failed", "timed_out", "invalid_bundle", "output_rejected", "error"]);
const ATTEMPT_BINDINGS = new Set(["bound", "mismatch", "unbound_legacy", "no_expected_attempt"]);

export interface RunRecordSummary {
  // From the attestation proof (the enclave's own copy of the signed fields)
  outcome: string | null;
  exit_code: number | null;
  error_hash: string | null;
  platform_job_id: string | null;
  attempt_id: string | null;
  // From the coordinator's verification receipt: the attempt it recorded before dispatch and
  // its comparison with the signed one
  expected_attempt_id: string | null;
  attempt_binding: string | null;
  // SHA-256 of the released error text (job_outputs.content_sha256); null when a result is held
  released_error_sha256: string | null;
}

interface Queryable {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
}

const text = (value: unknown): string | null => (typeof value === "string" && value ? value : null);
const sha256Hex = (value: unknown): string | null =>
  typeof value === "string" && /^[0-9a-fA-F]{64}$/.test(value) ? value.toLowerCase() : null;

export function summarizeRunRecord(
  attestation: unknown,
  receipt: unknown,
  held: { kind: unknown; content_sha256: unknown } | null
): RunRecordSummary {
  const proof = (attestation as { proof?: Record<string, unknown> } | null)?.proof ?? {};
  const checked = (receipt as Record<string, unknown> | null) ?? {};
  const outcome = text(proof.outcome);
  const binding = text(checked.attempt_binding);
  return {
    outcome: outcome && OUTCOMES.has(outcome) ? outcome : null,
    exit_code: Number.isInteger(proof.exit_code) ? (proof.exit_code as number) : null,
    error_hash: sha256Hex(proof.error_hash),
    platform_job_id: text(proof.platform_job_id),
    attempt_id: text(proof.attempt_id),
    expected_attempt_id: text(checked.expected_attempt_id),
    attempt_binding: binding && ATTEMPT_BINDINGS.has(binding) ? binding : null,
    released_error_sha256: held?.kind === "error" ? sha256Hex(held.content_sha256) : null,
  };
}

// Callers must only pass released jobs. Reads the hash of the held text, never the text
export async function loadRunRecord(
  db: Queryable,
  jobId: string,
  attestation: unknown,
  receipt: unknown
): Promise<RunRecordSummary> {
  const result = await db.query(`SELECT kind, content_sha256 FROM job_outputs WHERE job_id = $1`, [jobId]);
  const row = result.rows[0];
  return summarizeRunRecord(attestation, receipt, row ? { kind: row.kind, content_sha256: row.content_sha256 } : null);
}

// Outcome for the ledger: the signed one when the receipt has it, else what the job status says
export function ledgerOutcome(status: string, receipt: unknown): string {
  const outcome = text((receipt as Record<string, unknown> | null)?.outcome);
  if (outcome && OUTCOMES.has(outcome)) return outcome;
  return status === "success" ? SUCCEEDED : "failed";
}
