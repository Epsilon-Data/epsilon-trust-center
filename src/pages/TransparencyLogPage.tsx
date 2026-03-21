import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  TreePine,
  Shield,
  ShieldCheck,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  AlertTriangle,
  Settings,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HashDisplay } from "@/components/shared/HashDisplay";
import { MerkleTreeGraph } from "@/components/transparency/MerkleTreeGraph";
import { fetchATLEntries, fetchATLStats, fetchATLSTH, fetchATLSTHHistory } from "@/lib/api";
import { formatTimeAgo, truncateHash } from "@/lib/utils";
import type { PaginatedATLEntries, ATLStats, ATLSTH, ATLSTHHistory } from "@/lib/api";

const entryTypeConfig = {
  1: { label: "HA", color: "bg-green-100 text-green-800", icon: ShieldCheck, desc: "High-Assurance" },
  2: { label: "LA", color: "bg-amber-100 text-amber-800", icon: AlertTriangle, desc: "Low-Assurance" },
  3: { label: "Config", color: "bg-blue-100 text-blue-800", icon: Settings, desc: "Key Lifecycle" },
} as const;

export default function TransparencyLogPage() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<number | undefined>();

  const { data: stats } = useQuery<ATLStats>({
    queryKey: ["/api/atl/stats"],
    queryFn: () => fetchATLStats(),
  });

  const { data: sth } = useQuery<ATLSTH>({
    queryKey: ["/api/atl/sth"],
    queryFn: () => fetchATLSTH(),
    retry: false,
  });

  const { data: sthHistory } = useQuery<ATLSTHHistory>({
    queryKey: ["/api/atl/sth/history"],
    queryFn: () => fetchATLSTHHistory(),
    retry: false,
  });

  const { data: entriesData, isLoading } = useQuery<PaginatedATLEntries>({
    queryKey: ["/api/atl/entries", page, typeFilter],
    queryFn: () => fetchATLEntries(page, 25, typeFilter),
  });

  // Fetch all entries for tree visualization (capped at 64 for readability)
  const { data: treeEntries } = useQuery<PaginatedATLEntries>({
    queryKey: ["/api/atl/entries/tree"],
    queryFn: () => fetchATLEntries(1, 64),
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <TreePine className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Transparency Log</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl">
          Append-only Merkle tree log of all TEE attestation records.
          Every entry is cryptographically committed — suppression or deletion is detectable.
        </p>
      </div>

      {/* STH Card */}
      {sth && (
        <Card className="mb-6 border-l-4 border-l-primary">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Signed Tree Head</h2>
              </div>
              <Badge variant="secondary" className="font-mono">
                {sth.tree_size.toLocaleString()} entries
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Tree Size</p>
                <p className="text-2xl font-bold font-mono">{sth.tree_size.toLocaleString()}</p>
              </div>
              <div>
                <HashDisplay hash={sth.root_hash} label="Root Hash" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Last Signed</p>
                <p className="text-sm font-mono">
                  {new Date(sth.timestamp * 1000).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatTimeAgo(new Date(sth.timestamp * 1000))}
                </p>
              </div>
            </div>

            {sth.signature && (
              <div className="mt-4 pt-4 border-t">
                <HashDisplay hash={sth.signature} label="Ed25519 Signature" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Merkle Tree Visualization */}
      {treeEntries && treeEntries.entries.length > 0 && sth && (
        <Card className="mb-6">
          <div className="p-4 pb-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TreePine className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Merkle Tree</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-600" /> HA
                <span className="inline-block w-3 h-3 rounded bg-amber-100 border border-amber-600 ml-2" /> LA
                <span className="inline-block w-3 h-3 rounded bg-blue-100 border border-blue-600 ml-2" /> Config
              </div>
            </div>
          </div>
          <CardContent className="p-4">
            <div className="h-[400px] border rounded-lg bg-muted/20">
              <MerkleTreeGraph
                entries={treeEntries.entries}
                rootHash={sth.root_hash}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TreePine className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold">{stats?.total_entries?.toLocaleString() ?? "..."}</p>
              <p className="text-xs text-muted-foreground">Total Entries</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <ShieldCheck className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <p className="text-xl font-bold">{stats?.by_type?.ha?.toLocaleString() ?? "0"}</p>
              <p className="text-xs text-muted-foreground">High-Assurance</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xl font-bold">{stats?.by_type?.la?.toLocaleString() ?? "0"}</p>
              <p className="text-xs text-muted-foreground">Low-Assurance</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Settings className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <p className="text-xl font-bold">{stats?.by_type?.config?.toLocaleString() ?? "0"}</p>
              <p className="text-xs text-muted-foreground">Config Events</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* STH History Timeline */}
      {sthHistory && sthHistory.history.length > 1 && (
        <Card className="mb-6">
          <div className="p-4 pb-0">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Tree Head History</h3>
            </div>
          </div>
          <CardContent className="p-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {sthHistory.history.slice(0, 10).map((h, i) => (
                <div
                  key={i}
                  className="shrink-0 px-3 py-2 rounded-md border bg-muted/30 text-xs"
                >
                  <p className="font-mono font-medium">{h.tree_size.toLocaleString()}</p>
                  <p className="text-muted-foreground">
                    {truncateHash(h.root_hash, 6)}
                  </p>
                  <p className="text-muted-foreground">
                    {formatTimeAgo(new Date(h.timestamp * 1000))}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entries Table */}
      <Card>
        <div className="p-4 pb-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Log Entries</h2>
            <Badge variant="secondary">
              {entriesData?.pagination.total ?? 0} total
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex gap-1">
              <Button
                variant={typeFilter === undefined ? "default" : "outline"}
                size="sm"
                onClick={() => { setTypeFilter(undefined); setPage(1); }}
              >
                All
              </Button>
              {([1, 2, 3] as const).map((t) => {
                const cfg = entryTypeConfig[t];
                return (
                  <Button
                    key={t}
                    variant={typeFilter === t ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setTypeFilter(t); setPage(1); }}
                  >
                    {cfg.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground w-20">Index</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground w-24">Type</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">Leaf Hash</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">Job ID</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">Submitter</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground w-28">Time</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : !entriesData?.entries?.length ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      No entries in the transparency log
                    </td>
                  </tr>
                ) : (
                  entriesData.entries.map((entry) => {
                    const cfg = entryTypeConfig[entry.entry_type as 1 | 2 | 3] || entryTypeConfig[1];
                    const TypeIcon = cfg.icon;
                    return (
                      <tr key={entry.leaf_index} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-3">
                          <span className="font-mono text-sm font-medium">
                            #{entry.leaf_index}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                            <TypeIcon className="h-3 w-3" />
                            {cfg.desc}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <code className="text-xs font-mono text-muted-foreground">
                            {truncateHash(entry.leaf_hash, 10)}
                          </code>
                        </td>
                        <td className="py-3 px-3">
                          {entry.job_id ? (
                            <Link
                              href={`/verify/${entry.job_id}`}
                              className="font-mono text-xs text-primary hover:underline"
                            >
                              {entry.job_id}
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <code className="text-xs font-mono text-muted-foreground">
                            {entry.submitter_id}
                          </code>
                        </td>
                        <td className="py-3 px-3 text-xs text-muted-foreground">
                          {formatTimeAgo(entry.submitted_at)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {entriesData && entriesData.pagination.total_pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {entriesData.pagination.page} of {entriesData.pagination.total_pages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= entriesData.pagination.total_pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Explainer */}
      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
          This log uses a Merkle tree to ensure append-only integrity.
          Each Signed Tree Head (STH) commits to all entries via a single root hash.
          Any tampering is cryptographically detectable via inclusion and consistency proofs.
        </p>
      </div>
    </div>
  );
}
