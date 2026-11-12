import type { VerificationResult } from "@epsilon-data/nitro-verify";

// Signed outcome and job/attempt binding of the run as the server reports them (the browser reads
// the signed user_data itself). All null for records from enclave images before 1.7.0
export interface RunRecord {
  outcome: string | null;
  exit_code: number | null;
  error_hash: string | null;
  platform_job_id: string | null;
  attempt_id: string | null;
  // The attempt the coordinator recorded before dispatch, and its comparison with the signed one
  expected_attempt_id: string | null;
  attempt_binding: string | null;
  // SHA-256 of the released error text; null when a result was released
  released_error_sha256: string | null;
}

export interface RunRecordJob {
  job_id: string;
  status: string;
  run_record?: RunRecord | null;
}

export type Comparison = "match" | "mismatch" | "not-signed" | "nothing-to-compare";

export interface RunRecordCheck {
  // False for a record from an enclave image that signs no outcome (before 1.7.0)
  signed: boolean;
  outcome: string | null;
  exitCode: number | null;
  succeeded: boolean;
  // The signed outcome agrees with the job's status (a succeeded run is a success, any other is not)
  outcomeConsistent: boolean;
  // Signed platform_job_id against the job being viewed
  job: Comparison;
  jobId: string | null;
  // Signed attempt_id against the attempt the coordinator recorded before dispatch
  attempt: Comparison;
  attemptId: string | null;
  expectedAttemptId: string | null;
  // Signed error_hash against the SHA-256 of the released error text (runs that did not succeed)
  error: Comparison;
  errorHash: string | null;
  releasedErrorHash: string | null;
  // Why the record does not belong to this run, or null
  failure: string | null;
}

const OUTCOME_LABELS: Record<string, string> = {
  succeeded: "Succeeded",
  failed: "Failed",
  timed_out: "Timed out",
  invalid_bundle: "Invalid code bundle",
  output_rejected: "Output rejected",
  error: "Error",
};

export function outcomeLabel(outcome: string | null, exitCode?: number | null): string {
  if (!outcome) return "Not signed";
  const label = OUTCOME_LABELS[outcome] ?? outcome;
  return outcome === "failed" && typeof exitCode === "number" ? `${label} (exit code ${exitCode})` : label;
}

const text = (value: unknown): string | null => (typeof value === "string" && value ? value : null);

function compare(signed: string | null, expected: string | null): Comparison {
  if (signed === null) return "not-signed";
  if (expected === null) return "nothing-to-compare";
  return signed.toLowerCase() === expected.toLowerCase() ? "match" : "mismatch";
}

// Read the run's outcome and identifiers from the hardware-signed user_data parsed in the browser
// (before that is available, from the server's copy) and compare them with the job being viewed
export function checkRunRecord(job: RunRecordJob, result: VerificationResult): RunRecordCheck {
  const server = job.run_record ?? null;
  const signed = result.attestation?.userData ?? null;
  const read = (name: "outcome" | "error_hash" | "platform_job_id" | "attempt_id"): string | null =>
    signed ? text(signed[name]) : server?.[name] ?? null;

  const outcome = read("outcome");
  const signedExitCode = signed ? signed.exit_code : server?.exit_code;
  const exitCode = typeof signedExitCode === "number" ? signedExitCode : null;
  const succeeded = outcome === "succeeded";
  const jobId = read("platform_job_id");
  const attemptId = read("attempt_id");
  const errorHash = read("error_hash");
  const expectedAttemptId = server?.expected_attempt_id ?? null;
  const releasedErrorHash = server?.released_error_sha256 ?? null;

  const check: RunRecordCheck = {
    signed: outcome !== null,
    outcome,
    exitCode,
    succeeded,
    outcomeConsistent: outcome === null || succeeded === (job.status === "success"),
    job: compare(jobId, job.job_id),
    jobId,
    attempt: compare(attemptId, expectedAttemptId),
    attemptId,
    expectedAttemptId,
    error: outcome === null || succeeded ? "nothing-to-compare" : compare(errorHash, releasedErrorHash),
    errorHash,
    releasedErrorHash,
    failure: null,
  };

  if (check.job === "mismatch") {
    check.failure = "The signed record belongs to another job";
  } else if (check.attempt === "mismatch") {
    check.failure = "The signed record belongs to another execution attempt of this job";
  } else if (!check.outcomeConsistent) {
    check.failure = "The signed outcome does not agree with the job's status";
  } else if (check.error === "mismatch" || (check.signed && !succeeded && releasedErrorHash !== null && errorHash === null)) {
    check.failure = "The released error text does not match the signed error hash";
  }
  return check;
}
