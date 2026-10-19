import { HashDisplay } from "@/components/shared/HashDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { checkOutputFiles, formatFileSize } from "@/lib/output-files";
import type { JobVerification } from "@/lib/api";
import type { VerificationResult } from "@epsilon-data/nitro-verify";

// Released output files: metadata and manifest hash only (contents are never served here)
export function OutputFilesInfo({ job, result }: { job: JobVerification; result: VerificationResult }) {
  const check = checkOutputFiles(job.output_files, result);
  const files = job.output_files?.files ?? [];

  if (check.status === "none") {
    return <p className="text-muted-foreground text-sm">No output files.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm">
        {files.length === 0 ? "No output files" : `${files.length} output file${files.length === 1 ? "" : "s"}`}
      </p>
      {files.length > 0 && (
        <div className="divide-y border rounded-md">
          {files.map((file) => (
            <div key={file.name} className="px-3 py-2 space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-mono break-all">{file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {file.type} · {formatFileSize(file.size)}
                </span>
              </div>
              <code className="block text-xs font-mono text-muted-foreground break-all">{file.sha256}</code>
            </div>
          ))}
        </div>
      )}
      {check.attested && (
        <HashDisplay label="Manifest Hash in Attestation (from enclave)" hash={check.attested} truncate={false} />
      )}
      {check.stored && (
        <HashDisplay label="Manifest Hash (released files)" hash={check.stored} truncate={false} />
      )}
      <StatusBadge
        status={check.status === "match" ? "verified" : check.status === "mismatch" ? "failed" : "unknown"}
        label={
          check.status === "match"
            ? "Manifest Matches"
            : check.status === "mismatch"
              ? "Manifest Does Not Match"
              : "Cannot verify (no manifest hash in attestation)"
        }
      />
    </div>
  );
}
