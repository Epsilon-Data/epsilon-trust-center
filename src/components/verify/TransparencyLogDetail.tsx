import { useQuery } from "@tanstack/react-query";
import { TreePine, ShieldCheck, ShieldAlert, Clock, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HashDisplay } from "@/components/shared/HashDisplay";
import { FieldRow } from "@/components/shared/FieldRow";
import { fetchATLEntries, fetchATLSTH } from "@/lib/api";
import { formatTimeAgo } from "@/lib/utils";
import type { JobVerification } from "@/lib/api";

interface TransparencyLogDetailProps {
  job: JobVerification;
}

export function TransparencyLogDetail({ job }: TransparencyLogDetailProps) {
  // Search for this job's entry in the ATL
  const { data: atlEntries, isLoading: entriesLoading } = useQuery({
    queryKey: ["/api/atl/entries/job", job.job_id],
    queryFn: async () => {
      // Search through entries to find matching job_id
      // In practice we'd want a search endpoint, but we scan recent entries
      const result = await fetchATLEntries(1, 100);
      const match = result.entries.find((e) => e.job_id === job.job_id);
      return match || null;
    },
    retry: false,
  });

  const { data: sth, isLoading: sthLoading } = useQuery({
    queryKey: ["/api/atl/sth"],
    queryFn: () => fetchATLSTH(),
    retry: false,
  });

  const isLoading = entriesLoading || sthLoading;
  const inLog = !!atlEntries;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Checking transparency log...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <TreePine className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Transparency Log</h3>
      </div>

      {/* Log Status */}
      <Card className={inLog ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50"}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {inLog ? (
              <>
                <ShieldCheck className="h-5 w-5 text-green-700" />
                <div>
                  <p className="text-sm font-medium text-green-800">
                    Attestation recorded in transparency log
                  </p>
                  <p className="text-xs text-green-700">
                    This entry is cryptographically committed and cannot be suppressed or deleted
                  </p>
                </div>
              </>
            ) : (
              <>
                <ShieldAlert className="h-5 w-5 text-amber-700" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Entry not found in transparency log
                  </p>
                  <p className="text-xs text-amber-700">
                    This job may not have been submitted to the ATL yet
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Entry Details */}
      {inLog && atlEntries && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Log Entry</h4>
            <FieldRow label="Leaf Index" mono>
              #{atlEntries.leaf_index}
            </FieldRow>
            <FieldRow label="Entry Type">
              <Badge
                variant="secondary"
                className={
                  atlEntries.entry_type === 1
                    ? "bg-green-100 text-green-800"
                    : atlEntries.entry_type === 2
                    ? "bg-amber-100 text-amber-800"
                    : "bg-blue-100 text-blue-800"
                }
              >
                {atlEntries.entry_type_label}
                {atlEntries.entry_type === 1
                  ? " (High-Assurance)"
                  : atlEntries.entry_type === 2
                  ? " (Low-Assurance)"
                  : " (Key Lifecycle)"}
              </Badge>
            </FieldRow>
            <HashDisplay hash={atlEntries.leaf_hash} label="Leaf Hash (SHA-256)" />
            <FieldRow label="Submitter" mono>
              {atlEntries.submitter_id}
            </FieldRow>
            <FieldRow label="Submitted">
              {new Date(atlEntries.submitted_at).toLocaleString()}
              <span className="text-muted-foreground ml-2">
                ({formatTimeAgo(atlEntries.submitted_at)})
              </span>
            </FieldRow>
          </CardContent>
        </Card>
      )}

      {/* Current Tree Head */}
      {sth && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">Signed Tree Head</h4>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatTimeAgo(new Date(sth.timestamp * 1000))}
              </div>
            </div>
            <FieldRow label="Tree Size" mono>
              {sth.tree_size.toLocaleString()} entries
            </FieldRow>
            <HashDisplay hash={sth.root_hash} label="Root Hash" />
            {sth.signature && (
              <HashDisplay hash={sth.signature} label="Ed25519 Signature" />
            )}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        The transparency log uses an RFC 9162 Merkle tree. Each entry's inclusion can be
        verified against the signed tree head using an inclusion proof. The log operator
        cannot delete or modify entries without invalidating the root hash.
      </p>
    </div>
  );
}
