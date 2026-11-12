import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import type { VerificationResult } from "@epsilon-data/nitro-verify";
import { EMPTY_SHA256, ledgerOutcome, loadRunRecord, summarizeRunRecord } from "./run-record.js";
import { checkRunRecord, outcomeLabel, type RunRecord, type RunRecordJob } from "../src/lib/run-record.js";

const sha256 = (data: string) => crypto.createHash("sha256").update(data).digest("hex");

const JOB_ID = "JOB-TC-1";
const ATTEMPT = "a1".repeat(16);
const OTHER_ATTEMPT = "b2".repeat(16);
const ERROR = "Execution failed: Script failed (exit code 3)";

const failedProof = {
  job_id: "rsa-session-0a1b2c3d", output_hash: EMPTY_SHA256, outcome: "failed", exit_code: 3,
  error_hash: sha256(ERROR), platform_job_id: JOB_ID, attempt_id: ATTEMPT,
};
const receipt = { valid: true, outcome: "failed", expected_attempt_id: ATTEMPT, attempt_binding: "bound" };
const heldError = { kind: "error", content_sha256: sha256(ERROR) };

function job(status: string, runRecord: RunRecord | null): RunRecordJob {
  return { job_id: JOB_ID, status, run_record: runRecord };
}

// The verification result once the browser has parsed the signed user_data (null: not parsed yet)
function parsed(userData: Record<string, unknown> | null): VerificationResult {
  return { attestation: userData ? { userData } : null } as unknown as VerificationResult;
}

describe("summarizeRunRecord", () => {
  it("reads the signed fields, the coordinator's attempt check and the released error hash", () => {
    assert.deepEqual(summarizeRunRecord({ proof: failedProof }, receipt, heldError), {
      outcome: "failed", exit_code: 3, error_hash: sha256(ERROR), platform_job_id: JOB_ID, attempt_id: ATTEMPT,
      expected_attempt_id: ATTEMPT, attempt_binding: "bound", released_error_sha256: sha256(ERROR),
    });
  });

  it("a record from an older enclave image has no signed fields", () => {
    const summary = summarizeRunRecord({ proof: { job_id: "s", output_hash: "ab".repeat(32) } }, { valid: true }, null);
    assert.deepEqual(Object.values(summary), Array(8).fill(null));
  });

  it("a held result has no released error hash", () => {
    const summary = summarizeRunRecord({ proof: failedProof }, receipt, { kind: "result", content_sha256: sha256("x") });
    assert.equal(summary.released_error_sha256, null);
  });

  it("drops malformed values", () => {
    const proof = { outcome: "anything", exit_code: "3", error_hash: "zz", platform_job_id: 5, attempt_id: [] };
    const summary = summarizeRunRecord({ proof }, { attempt_binding: "sure", expected_attempt_id: 7 }, null);
    assert.deepEqual(Object.values(summary), Array(8).fill(null));
  });

  it("missing attestation and receipt", () => {
    assert.deepEqual(Object.values(summarizeRunRecord(null, null, null)), Array(8).fill(null));
  });
});

describe("loadRunRecord", () => {
  it("reads the kind and hash of the held text, never the text", async () => {
    const queries: string[] = [];
    const db = {
      query: async (text: string, params?: unknown[]) => {
        queries.push(text);
        assert.deepEqual(params, [JOB_ID]);
        return { rows: [heldError] };
      },
    };
    const summary = await loadRunRecord(db, JOB_ID, { proof: failedProof }, receipt);
    assert.equal(summary.released_error_sha256, sha256(ERROR));
    assert.equal(queries.length, 1);
    assert.match(queries[0], /SELECT kind, content_sha256 FROM job_outputs/);
  });

  it("job without a job_outputs row", async () => {
    const summary = await loadRunRecord({ query: async () => ({ rows: [] }) }, JOB_ID, { proof: failedProof }, receipt);
    assert.equal(summary.released_error_sha256, null);
    assert.equal(summary.outcome, "failed");
  });
});

describe("ledgerOutcome", () => {
  it("uses the signed outcome from the receipt", () => {
    assert.equal(ledgerOutcome("failed", { outcome: "timed_out" }), "timed_out");
    assert.equal(ledgerOutcome("failed", { outcome: "succeeded" }), "succeeded");
  });

  it("falls back to the job status for older records", () => {
    assert.equal(ledgerOutcome("success", { valid: true }), "succeeded");
    assert.equal(ledgerOutcome("failed", null), "failed");
    assert.equal(ledgerOutcome("success", { outcome: "anything" }), "succeeded");
  });
});

describe("checkRunRecord (browser)", () => {
  const server = summarizeRunRecord({ proof: failedProof }, receipt, heldError);

  it("a failed run signed for this job, attempt and error text passes", () => {
    const check = checkRunRecord(job("failed", server), parsed(failedProof));
    assert.equal(check.failure, null);
    assert.deepEqual([check.job, check.attempt, check.error], ["match", "match", "match"]);
    assert.equal(outcomeLabel(check.outcome, check.exitCode), "Failed (exit code 3)");
  });

  it("the signed user_data wins over the server's copy", () => {
    const check = checkRunRecord(job("failed", server), parsed({ ...failedProof, platform_job_id: "JOB-OTHER" }));
    assert.equal(check.job, "mismatch");
    assert.equal(check.failure, "The signed record belongs to another job");
  });

  it("the server's copy is used until the document is parsed", () => {
    const check = checkRunRecord(job("failed", server), parsed(null));
    assert.equal(check.outcome, "failed");
    assert.equal(check.failure, null);
  });

  it("a record of another attempt fails", () => {
    const check = checkRunRecord(job("failed", server), parsed({ ...failedProof, attempt_id: OTHER_ATTEMPT }));
    assert.equal(check.failure, "The signed record belongs to another execution attempt of this job");
  });

  it("a released error text with another hash fails", () => {
    const altered = { ...server, released_error_sha256: sha256(ERROR + " altered") };
    const check = checkRunRecord(job("failed", altered), parsed(failedProof));
    assert.equal(check.error, "mismatch");
    assert.equal(check.failure, "The released error text does not match the signed error hash");
  });

  it("a released error text without a signed error hash fails", () => {
    const check = checkRunRecord(job("failed", server), parsed({ ...failedProof, error_hash: undefined }));
    assert.equal(check.failure, "The released error text does not match the signed error hash");
  });

  it("a signed outcome that disagrees with the job status fails", () => {
    const succeeded = { ...failedProof, outcome: "succeeded", exit_code: 0 };
    assert.equal(
      checkRunRecord(job("failed", server), parsed(succeeded)).failure,
      "The signed outcome does not agree with the job's status"
    );
    assert.equal(
      checkRunRecord(job("success", server), parsed(failedProof)).failure,
      "The signed outcome does not agree with the job's status"
    );
  });

  it("a succeeded run compares no error text", () => {
    const succeeded = { output_hash: "ab".repeat(32), outcome: "succeeded", exit_code: 0, platform_job_id: JOB_ID, attempt_id: ATTEMPT };
    const check = checkRunRecord(job("success", { ...server, released_error_sha256: null }), parsed(succeeded));
    assert.equal(check.failure, null);
    assert.equal(check.error, "nothing-to-compare");
    assert.equal(check.succeeded, true);
  });

  it("a record from an older enclave image is not signed and does not fail", () => {
    const check = checkRunRecord(job("success", null), parsed({ job_id: "s", output_hash: "ab".repeat(32) }));
    assert.equal(check.signed, false);
    assert.equal(check.failure, null);
    assert.deepEqual([check.job, check.attempt], ["not-signed", "not-signed"]);
    assert.equal(outcomeLabel(check.outcome), "Not signed");
  });

  it("without a recorded attempt there is nothing to compare", () => {
    const check = checkRunRecord(job("failed", { ...server, expected_attempt_id: null }), parsed(failedProof));
    assert.equal(check.attempt, "nothing-to-compare");
    assert.equal(check.failure, null);
  });
});
