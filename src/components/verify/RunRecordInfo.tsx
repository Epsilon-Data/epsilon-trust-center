import { FieldRow } from "@/components/shared/FieldRow";
import { HashDisplay } from "@/components/shared/HashDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { checkRunRecord, outcomeLabel, type Comparison } from "@/lib/run-record";
import type { JobVerification } from "@/lib/api";
import type { VerificationResult } from "@epsilon-data/nitro-verify";

function ComparisonBadge({ comparison, match, mismatch, notSigned, nothing }: {
  comparison: Comparison;
  match: string;
  mismatch: string;
  notSigned: string;
  nothing: string;
}) {
  if (comparison === "match") return <StatusBadge status="verified" label={match} />;
  if (comparison === "mismatch") return <StatusBadge status="failed" label={mismatch} />;
  return <StatusBadge status="unknown" label={comparison === "not-signed" ? notSigned : nothing} />;
}

// What the enclave signed about the run: its outcome, and the job and execution attempt it belongs to
export function RunRecordInfo({ job, result }: { job: JobVerification; result: VerificationResult }) {
  const check = checkRunRecord(job, result);

  if (!check.signed && check.attemptId === null && check.jobId === null) {
    return (
      <p className="text-muted-foreground text-sm">
        This record was signed by an enclave image that does not sign the run's outcome or its execution attempt.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="divide-y">
        <FieldRow label="Outcome" value={outcomeLabel(check.outcome, check.exitCode)} />
        {check.jobId && <FieldRow label="Platform Job ID" value={check.jobId} mono />}
        {check.attemptId && <FieldRow label="Attempt ID" value={check.attemptId} mono />}
      </div>
      <div className="flex flex-wrap gap-2">
        {!check.outcomeConsistent && (
          <StatusBadge status="failed" label={`Signed outcome does not agree with job status "${job.status}"`} />
        )}
        <ComparisonBadge
          comparison={check.job}
          match="Signed for this job"
          mismatch="Signed for another job"
          notSigned="Job ID not signed"
          nothing="Job ID not compared"
        />
        <ComparisonBadge
          comparison={check.attempt}
          match="Signed for the recorded attempt"
          mismatch="Signed for another attempt"
          notSigned="Attempt not signed"
          nothing="No recorded attempt to compare"
        />
      </div>
      {check.signed && !check.succeeded && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            This run did not succeed. The enclave attests no output for it; it signs the hash of its error text.
          </p>
          {check.errorHash && (
            <HashDisplay label="Error Hash in Attestation (from enclave)" hash={check.errorHash} truncate={false} />
          )}
          {check.releasedErrorHash && (
            <HashDisplay label="Hash of Released Error Text" hash={check.releasedErrorHash} truncate={false} />
          )}
          <ComparisonBadge
            comparison={check.error}
            match="Error Text Matches"
            mismatch="Error Text Does Not Match"
            notSigned="Error hash not signed"
            nothing="No released error text to compare"
          />
        </div>
      )}
    </div>
  );
}
