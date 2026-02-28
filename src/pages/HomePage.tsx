import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Search, Shield, ShieldCheck, Hash, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { fetchJobs, fetchStats } from "@/lib/api";
import { truncateHash, formatTimeAgo } from "@/lib/utils";
import type { PaginatedJobs, Stats } from "@/lib/api";

export default function HomePage() {
  const [searchValue, setSearchValue] = useState("");
  const [page, setPage] = useState(1);
  const [, navigate] = useLocation();

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/stats"],
    queryFn: () => fetchStats(),
  });

  const { data: jobsData, isLoading } = useQuery<PaginatedJobs>({
    queryKey: ["/api/jobs", page],
    queryFn: () => fetchJobs(page, 25),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchValue.trim();
    if (trimmed) {
      navigate(`/verify/${trimmed}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-3">
          Trust Verification Center
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
          Verify that code executed inside a genuine AWS Nitro Enclave.
          Every execution is publicly verifiable. No login required.
        </p>

        <form onSubmit={handleSearch} className="flex items-center gap-2 max-w-lg mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Enter Job ID (e.g. JOB-A1B2C)"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-9 h-11 text-base"
            />
          </div>
          <Button type="submit" size="lg">Verify</Button>
        </form>
        <p className="text-sm text-muted-foreground mt-3">
          Or{" "}
          <Link href="/verify" className="text-primary hover:underline font-medium">
            verify your own attestation
          </Link>{" "}
          by pasting raw base64
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <ShieldCheck className="h-6 w-6 text-green-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.total_verified ?? "..."}</p>
              <p className="text-sm text-muted-foreground">Total Verified</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Shield className="h-6 w-6 text-blue-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.verified_today ?? "..."}</p>
              <p className="text-sm text-muted-foreground">Verified Today</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <Hash className="h-6 w-6 text-emerald-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {stats?.success_rate != null ? `${stats.success_rate}%` : "..."}
              </p>
              <p className="text-sm text-muted-foreground">Success Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trust Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {[
          {
            title: "Hardware Attestation",
            desc: "AWS Nitro hardware cryptographically signs every execution. Cannot be forged.",
            color: "text-green-600",
          },
          {
            title: "Enclave Image Verified",
            desc: "PCR values prove the exact enclave binary that ran your code.",
            color: "text-blue-600",
          },
          {
            title: "Output Integrity",
            desc: "SHA-256 hash of execution output is embedded in the attestation.",
            color: "text-purple-600",
          },
        ].map((pillar) => (
          <Card key={pillar.title} className="border-t-4 border-t-primary/20">
            <CardContent className="p-6">
              <ShieldCheck className={`h-8 w-8 ${pillar.color} mb-3`} />
              <h3 className="font-semibold mb-1">{pillar.title}</h3>
              <p className="text-sm text-muted-foreground">{pillar.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Jobs Table */}
      <Card>
        <div className="p-6 pb-0 flex items-center justify-between">
          <h2 className="text-xl font-semibold">All Verified Executions</h2>
          <Badge variant="secondary">
            {jobsData?.pagination.total ?? 0} total
          </Badge>
        </div>
        <CardContent className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Job ID</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Verified</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">PCR Match</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Commit</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : !jobsData?.jobs?.length ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      No verified executions yet
                    </td>
                  </tr>
                ) : (
                  jobsData.jobs.map((job) => (
                    <tr key={job.job_id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4">
                        <Link
                          href={`/verify/${job.job_id}`}
                          className="font-mono text-primary hover:underline font-medium"
                        >
                          {job.job_id}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge
                          status={job.server_verified === true ? "verified" : job.server_verified === false ? "failed" : job.has_attestation ? "checking" : "unknown"}
                          label={job.server_verified === true ? "Verified" : job.server_verified === false ? "Failed" : job.has_attestation ? "Attested" : "None"}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge
                          status={job.pcr0_match === true ? "verified" : job.pcr0_match === false ? "failed" : "unknown"}
                          label={job.pcr0_match === true ? "Match" : job.pcr0_match === false ? "Mismatch" : "N/A"}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <code className="text-xs font-mono text-muted-foreground">
                          {truncateHash(job.commit_sha, 6)}
                        </code>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">
                        {formatTimeAgo(job.completed_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {jobsData && jobsData.pagination.total_pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {jobsData.pagination.page} of {jobsData.pagination.total_pages}
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
                  disabled={page >= jobsData.pagination.total_pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer link */}
      <div className="text-center mt-8">
        <Link href="/about" className="text-sm text-primary hover:underline">
          Learn how Epsilon enclave verification works
        </Link>
      </div>
    </div>
  );
}
