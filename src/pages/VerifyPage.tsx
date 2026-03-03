import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Loader2, Monitor, Server, ShieldCheck, ShieldAlert, CheckCircle2, XCircle, Eye, EyeOff, Lock, Cpu, FileCheck, Building2 } from "lucide-react";
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
  const [viewMode, setViewMode] = useState<"simple" | "advanced">("simple");
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
          {hasAttestation && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === "simple" ? "advanced" : "simple")}
              className="gap-1.5"
            >
              {viewMode === "simple" ? (
                <><Eye className="h-3.5 w-3.5" /> Advanced</>
              ) : (
                <><EyeOff className="h-3.5 w-3.5" /> Simple</>
              )}
            </Button>
          )}
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

      {/* Content */}
      {viewMode === "simple" && hasAttestation ? (
        <SimpleVerificationView job={job} verificationResult={verificationResult} />
      ) : (
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
      )}
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

function SimpleVerificationView({
  job,
  verificationResult,
}: {
  job: JobVerification;
  verificationResult: ReturnType<typeof useVerification>["result"];
}) {
  const allPassed =
    job.server_verification?.valid && verificationResult.valid;
  const outputHash = job.attestation?.proof?.output_hash;
  const metadata = job.attestation?.proof as Record<string, unknown> | undefined;
  const completedAt = job.completed_at
    ? new Date(job.completed_at).toLocaleString()
    : "N/A";

  const checks = [
    {
      icon: Cpu,
      title: "Ran on secure hardware",
      description:
        "Your analysis ran inside an AWS Nitro Enclave — an isolated, tamper-proof environment. Not even AWS administrators can access data inside it.",
      passed: getStepStatus("hardware", verificationResult) === "verified",
    },
    {
      icon: Lock,
      title: "Code integrity verified",
      description:
        "The exact code that ran matches the published open-source version. No modifications were made before or during execution.",
      passed: getStepStatus("enclave-image", verificationResult) === "verified",
    },
    {
      icon: Building2,
      title: "Certificate chain trusted",
      description:
        "The security certificate traces back to Amazon's root authority, confirming this is genuine AWS hardware — not a simulation.",
      passed: getStepStatus("certificate-chain", verificationResult) === "verified",
    },
    {
      icon: FileCheck,
      title: "Output has not been tampered with",
      description:
        "The results you received match exactly what the secure enclave produced. The output hash was locked inside the hardware attestation before delivery.",
      passed: getStepStatus("output-integrity", verificationResult) === "verified",
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Big status */}
      <div className="text-center space-y-4">
        {allPassed ? (
          <>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
              <ShieldCheck className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-800">
              Verified — You can trust this result
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              This analysis ran inside a secure, isolated hardware environment.
              The results were cryptographically sealed before leaving the enclave.
              Nobody — not even Epsilon — could see or modify the data.
            </p>
          </>
        ) : (
          <>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100">
              <ShieldAlert className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-red-800">
              Verification failed
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              One or more security checks did not pass. Switch to Advanced view for details.
            </p>
          </>
        )}
      </div>

      {/* Simple checklist */}
      <div className="space-y-4">
        {checks.map((check, i) => (
          <div
            key={i}
            className={`border rounded-lg p-5 flex items-start gap-4 ${
              check.passed
                ? "bg-green-50/50 border-green-200"
                : "bg-red-50/50 border-red-200"
            }`}
          >
            <div
              className={`mt-0.5 flex-shrink-0 rounded-full p-2 ${
                check.passed ? "bg-green-100" : "bg-red-100"
              }`}
            >
              <check.icon
                className={`h-5 w-5 ${
                  check.passed ? "text-green-600" : "text-red-600"
                }`}
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{check.title}</h3>
                {check.passed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {check.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* What this means */}
      <div className="border rounded-lg p-6 bg-blue-50/50 border-blue-200 space-y-3">
        <h3 className="font-semibold text-blue-900">What does this mean?</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-600" />
            <span>
              <strong>Your data stayed private</strong> — the raw data was encrypted and only accessible inside the secure enclave. Epsilon never saw it.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-600" />
            <span>
              <strong>The results are authentic</strong> — the output is cryptographically linked to the hardware that produced it. Tampering is mathematically impossible.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-600" />
            <span>
              <strong>Anyone can verify independently</strong> — all proofs are based on open standards (AWS Nitro Attestation) and can be checked without trusting Epsilon.
            </span>
          </li>
        </ul>
      </div>

      {/* Job details */}
      <div className="border rounded-lg p-5 space-y-3 bg-card">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Execution Details
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Job ID</span>
            <p className="font-mono font-medium">{job.job_id}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Completed</span>
            <p className="font-medium">{completedAt}</p>
          </div>
          {outputHash && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Output Fingerprint</span>
              <p className="font-mono text-xs break-all">{outputHash}</p>
            </div>
          )}
        </div>
      </div>
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
