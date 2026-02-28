import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Loader2, Monitor, Server, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrustFlowGraph } from "@/components/verify/TrustFlowGraph";
import { VerificationStepCard } from "@/components/verify/VerificationStepCard";
import { CLIVerificationCommands } from "@/components/verify/CLIVerificationCommands";
import {
  HardwareDetail,
  EnclaveImageDetail,
  CertificateChainDetail,
  ExecutionProofDetail,
  OutputIntegrityDetail,
  RawDocumentDetail,
} from "@/components/verify/VerifyDetail";
import { sections, sectionStepMap, getStepStatus } from "@/lib/verify-sections";
import { fetchJobVerification } from "@/lib/api";
import { useVerification } from "@/hooks/useVerification";
import type { JobVerification } from "@/lib/api";
import type { SidebarSection } from "@/lib/types";

interface VerifyPageProps {
  params: { jobId: string };
}

export default function VerifyPage({ params }: VerifyPageProps) {
  const jobId = params.jobId;
  const [expandedSections, setExpandedSections] = useState<Set<SidebarSection>>(
    new Set(["hardware"])
  );
  const [activeGraphSection, setActiveGraphSection] = useState<SidebarSection>("hardware");
  const [highlightedSection, setHighlightedSection] = useState<SidebarSection | null>(null);

  const { data: job, isLoading, error } = useQuery<JobVerification>({
    queryKey: ["/api/verify", jobId],
    queryFn: () => fetchJobVerification(jobId),
  });

  const { result: verificationResult } = useVerification(job);

  // Clear highlight after animation
  useEffect(() => {
    if (!highlightedSection) return;
    const timer = setTimeout(() => setHighlightedSection(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightedSection]);

  const toggleSection = useCallback((section: SidebarSection) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
    setActiveGraphSection(section);
  }, []);

  const handleGraphNodeClick = useCallback((section: SidebarSection) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.add(section);
      return next;
    });
    setActiveGraphSection(section);
    setHighlightedSection(section);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading attestation for {jobId}...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Job not found</h2>
          <p className="text-muted-foreground mb-4">
            {(error as Error)?.message || `No attestation found for ${jobId}`}
          </p>
          <Link href="/">
            <Button>Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const hasAttestation = !!job.attestation;

  function renderDetailContent(sectionId: SidebarSection) {
    switch (sectionId) {
      case "hardware": return <HardwareDetail job={job!} result={verificationResult} />;
      case "enclave-image": return <EnclaveImageDetail job={job!} result={verificationResult} />;
      case "certificate-chain": return <CertificateChainDetail job={job!} result={verificationResult} />;
      case "execution-proof": return <ExecutionProofDetail job={job!} result={verificationResult} />;
      case "output-integrity": return <OutputIntegrityDetail job={job!} result={verificationResult} />;
      case "raw-document": return <RawDocumentDetail job={job!} />;
    }
  }

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="border-b px-4 py-3 flex items-center justify-between bg-background">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold font-mono">{job.job_id}</h1>
            <p className="text-xs text-muted-foreground">
              Completed {job.completed_at ? new Date(job.completed_at).toLocaleString() : "N/A"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasAttestation ? (
            <Badge variant="success" className="text-sm px-3 py-1">ATTESTED</Badge>
          ) : (
            <Badge variant="outline" className="text-sm px-3 py-1">NO ATTESTATION</Badge>
          )}
          <Badge variant="secondary">{job.status}</Badge>
        </div>
      </div>

      {/* Dual verification banners */}
      {hasAttestation && (
        <>
          <ServerVerificationBanner serverVerification={job.server_verification} />
          <ClientVerificationBanner
            status={verificationResult.status}
            valid={verificationResult.valid}
            error={verificationResult.error}
          />
        </>
      )}

      {/* Linear layout */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Trust Flow Graph — always visible */}
        {hasAttestation && (
          <div className="border rounded-lg bg-card overflow-hidden">
            <div className="h-[300px] sm:h-[400px] w-full">
              <TrustFlowGraph
                selectedSection={activeGraphSection}
                onSelectSection={handleGraphNodeClick}
                verificationResult={verificationResult}
              />
            </div>
          </div>
        )}

        {/* Expandable verification cards */}
        <div className="space-y-3">
          {sections.map((section) => {
            const status = hasAttestation
              ? getStepStatus(section.id, verificationResult)
              : "na";
            const stepId = sectionStepMap[section.id];
            const step = verificationResult.steps.find((s) => s.id === stepId);

            return (
              <VerificationStepCard
                key={section.id}
                id={section.id}
                label={section.label}
                description={section.description}
                icon={section.icon}
                status={status}
                timing={step?.durationMs}
                expanded={expandedSections.has(section.id)}
                highlighted={highlightedSection === section.id}
                onToggle={() => toggleSection(section.id)}
              >
                {renderDetailContent(section.id)}
              </VerificationStepCard>
            );
          })}
        </div>

        {/* CLI Verification Commands */}
        <CLIVerificationCommands
          jobId={job.job_id}
          attestationB64={job.attestation?.attestation?.attestation_document}
          outputHash={job.attestation?.proof?.output_hash}
        />
      </div>
    </div>
  );
}

function ServerVerificationBanner({
  serverVerification,
}: {
  serverVerification: JobVerification["server_verification"];
}) {
  if (!serverVerification) return null;

  if (serverVerification.valid) {
    return (
      <div className="border-b px-4 py-2.5 bg-green-50 border-green-200 flex items-center gap-3">
        <ShieldCheck className="h-4 w-4 text-green-700" />
        <span className="text-sm text-green-800 font-medium">
          Server verification: all checks passed
        </span>
        <Badge variant="outline" className="ml-auto text-xs gap-1 border-green-300 text-green-700">
          <Server className="h-3 w-3" />
          Pre-computed
        </Badge>
      </div>
    );
  }

  return (
    <div className="border-b px-4 py-2.5 bg-red-50 border-red-200 flex items-center gap-3">
      <ShieldAlert className="h-4 w-4 text-red-700" />
      <span className="text-sm text-red-800 font-medium">
        Server verification: one or more checks failed
      </span>
      <Badge variant="outline" className="ml-auto text-xs gap-1 border-red-300 text-red-700">
        <Server className="h-3 w-3" />
        Pre-computed
      </Badge>
    </div>
  );
}

function ClientVerificationBanner({
  status,
  valid,
  error,
}: {
  status: "idle" | "running" | "complete";
  valid: boolean | null;
  error?: string;
}) {
  if (status === "idle") return null;

  if (status === "running") {
    return (
      <div className="border-b px-4 py-2.5 bg-yellow-50 border-yellow-200 flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-yellow-700" />
        <span className="text-sm text-yellow-800 font-medium">
          Verifying cryptographic proofs in your browser...
        </span>
        <Badge variant="outline" className="ml-auto text-xs gap-1">
          <Monitor className="h-3 w-3" />
          Client-side
        </Badge>
      </div>
    );
  }

  if (valid) {
    return (
      <div className="border-b px-4 py-2.5 bg-green-50 border-green-200 flex items-center gap-3">
        <ShieldCheck className="h-4 w-4 text-green-700" />
        <span className="text-sm text-green-800 font-medium">
          All checks passed — verified client-side on your device
        </span>
        <Badge variant="outline" className="ml-auto text-xs gap-1 border-green-300 text-green-700">
          <Monitor className="h-3 w-3" />
          Client-side
        </Badge>
      </div>
    );
  }

  return (
    <div className="border-b px-4 py-2.5 bg-red-50 border-red-200 flex items-center gap-3">
      <ShieldAlert className="h-4 w-4 text-red-700" />
      <span className="text-sm text-red-800 font-medium">
        Verification failed: {error || "Unknown error"}
      </span>
      <Badge variant="outline" className="ml-auto text-xs gap-1 border-red-300 text-red-700">
        <Monitor className="h-3 w-3" />
        Client-side
      </Badge>
    </div>
  );
}
