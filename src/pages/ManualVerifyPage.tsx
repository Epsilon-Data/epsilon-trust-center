import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield, ChevronDown, Loader2, ShieldCheck, ShieldAlert, Monitor } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusIcon } from "@/components/shared/StatusIcon";
import { FieldRow } from "@/components/shared/FieldRow";
import { CLIVerificationCommands } from "@/components/verify/CLIVerificationCommands";
import { cn } from "@/lib/utils";
import { fetchPCRRegistry } from "@/lib/api";
import {
  verifyAttestation,
  type VerificationResult,
  type VerificationStep,
} from "@epsilon-data/nitro-verify";
import type { PCRRegistry } from "@/lib/api";

const INITIAL_RESULT: VerificationResult = {
  status: "idle",
  valid: null,
  steps: [],
  attestation: null,
  certChainInfo: null,
};

const STEP_LABELS: Record<string, string> = {
  parse: "Parse Attestation",
  "cert-chain": "Certificate Chain",
  signature: "COSE Signature",
  "pcr-match": "PCR Values",
  "output-hash": "Output Hash",
};

export default function ManualVerifyPage() {
  const [attestationInput, setAttestationInput] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expectedPcr0, setExpectedPcr0] = useState("");
  const [expectedPcr1, setExpectedPcr1] = useState("");
  const [expectedPcr2, setExpectedPcr2] = useState("");
  const [expectedOutputHash, setExpectedOutputHash] = useState("");
  const [result, setResult] = useState<VerificationResult>(INITIAL_RESULT);
  const [isVerifying, setIsVerifying] = useState(false);

  const { data: pcrRegistry } = useQuery<PCRRegistry>({
    queryKey: ["/api/pcr-registry"],
    queryFn: () => fetchPCRRegistry(),
  });

  const onStepUpdate = useCallback(
    (stepId: string, update: Partial<VerificationStep>) => {
      setResult((prev) => ({
        ...prev,
        status: "running",
        steps: prev.steps.map((s) =>
          s.id === stepId ? { ...s, ...update } : s
        ),
      }));
    },
    []
  );

  const handleVerify = async () => {
    const trimmed = attestationInput.trim();
    if (!trimmed) return;

    setIsVerifying(true);
    setResult({
      ...INITIAL_RESULT,
      status: "running",
      steps: [
        { id: "parse", label: "Parse Attestation Document", status: "pending" },
        { id: "cert-chain", label: "Verify Certificate Chain", status: "pending" },
        { id: "signature", label: "Verify COSE Signature", status: "pending" },
        { id: "pcr-match", label: "Compare PCR Values", status: "pending" },
        { id: "output-hash", label: "Verify Output Hash", status: "pending" },
      ],
    });

    const expectedPcrs =
      expectedPcr0 || expectedPcr1 || expectedPcr2
        ? {
            pcr0: expectedPcr0 || undefined,
            pcr1: expectedPcr1 || undefined,
            pcr2: expectedPcr2 || undefined,
          }
        : undefined;

    try {
      const verifyResult = await verifyAttestation(trimmed, {
        allowExpired: true,
        onStepUpdate,
        expectedPcrs,
        expectedOutputHash: expectedOutputHash || undefined,
      });
      setResult(verifyResult);
    } catch (err) {
      setResult({
        ...INITIAL_RESULT,
        status: "complete",
        valid: false,
        error: err instanceof Error ? err.message : "Failed to parse attestation document",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const hasResult = result.status === "complete";
  const parsed = result.attestation;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hero */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
          <Shield className="h-4 w-4" />
          Zero-trust verification
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">
          Verify Your Own Attestation
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Paste a raw base64-encoded AWS Nitro Enclave attestation document below.
          Verification runs entirely in your browser — nothing is sent to any server.
        </p>
      </div>

      {/* Input Card */}
      <Card>
        <CardHeader>
          <CardTitle>Attestation Document</CardTitle>
          <CardDescription>
            Paste the base64-encoded COSE_Sign1 attestation document (CBOR format)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="hEShATgioFkRH..."
            value={attestationInput}
            onChange={(e) => setAttestationInput(e.target.value)}
            className="min-h-[120px] font-mono text-xs"
          />

          {/* Advanced Options */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              aria-expanded={showAdvanced}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  showAdvanced && "rotate-180"
                )}
              />
              Advanced Options
            </button>
            <div
              className={cn(
                "overflow-hidden transition-all duration-200",
                showAdvanced ? "max-h-[400px] opacity-100 mt-3" : "max-h-0 opacity-0"
              )}
            >
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                <p className="text-xs text-muted-foreground mb-2">
                  Provide expected values to compare against the parsed attestation.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Expected PCR0</label>
                    <Input
                      placeholder="sha384 hex..."
                      value={expectedPcr0}
                      onChange={(e) => setExpectedPcr0(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Expected PCR1</label>
                    <Input
                      placeholder="sha384 hex..."
                      value={expectedPcr1}
                      onChange={(e) => setExpectedPcr1(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Expected PCR2</label>
                    <Input
                      placeholder="sha384 hex..."
                      value={expectedPcr2}
                      onChange={(e) => setExpectedPcr2(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Expected Output Hash (SHA-256)</label>
                  <Input
                    placeholder="sha256 hex..."
                    value={expectedOutputHash}
                    onChange={(e) => setExpectedOutputHash(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={handleVerify}
            disabled={!attestationInput.trim() || isVerifying}
            size="lg"
            className="w-full"
          >
            {isVerifying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Verifying...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Verify Attestation
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result.status !== "idle" && (
        <div className="space-y-6">
          {/* Status Banner */}
          {result.status === "running" && (
            <div className="border px-4 py-3 bg-yellow-50 border-yellow-200 rounded-lg flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-yellow-700" />
              <span className="text-sm text-yellow-800 font-medium">
                Verifying cryptographic proofs in your browser...
              </span>
              <Badge variant="outline" className="ml-auto text-xs gap-1">
                <Monitor className="h-3 w-3" />
                Client-side
              </Badge>
            </div>
          )}
          {hasResult && result.valid && (
            <div className="border px-4 py-3 bg-green-50 border-green-200 rounded-lg flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-green-700" />
              <span className="text-sm text-green-800 font-medium">
                All checks passed — this is a valid AWS Nitro Enclave attestation
              </span>
              <Badge variant="outline" className="ml-auto text-xs gap-1 border-green-300 text-green-700">
                <Monitor className="h-3 w-3" />
                Client-side
              </Badge>
            </div>
          )}
          {hasResult && result.valid === false && (
            <div className="border px-4 py-3 bg-red-50 border-red-200 rounded-lg flex items-center gap-3">
              <ShieldAlert className="h-4 w-4 text-red-700" />
              <span className="text-sm text-red-800 font-medium">
                Verification failed: {result.error || "One or more checks did not pass"}
              </span>
              <Badge variant="outline" className="ml-auto text-xs gap-1 border-red-300 text-red-700">
                <Monitor className="h-3 w-3" />
                Client-side
              </Badge>
            </div>
          )}

          {/* Steps Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Verification Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {result.steps.map((step) => {
                  const status =
                    step.status === "passed" ? "verified" as const
                    : step.status === "failed" ? "failed" as const
                    : step.status === "running" || step.status === "pending" ? "checking" as const
                    : "na" as const;
                  return (
                    <div
                      key={step.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      <StatusIcon status={status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{STEP_LABELS[step.id] || step.label}</p>
                        {step.message && (
                          <p className="text-xs text-muted-foreground mt-0.5">{step.message}</p>
                        )}
                      </div>
                      {step.durationMs !== undefined && (
                        <span className="text-xs text-muted-foreground/60 font-mono">
                          {step.durationMs}ms
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Parsed Attestation */}
          {parsed && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Parsed Attestation</CardTitle>
                <CardDescription>
                  Values extracted from the CBOR-encoded attestation document in your browser
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="divide-y">
                  <FieldRow label="Module ID" value={parsed.moduleId} mono />
                  <FieldRow label="Timestamp" value={new Date(parsed.timestamp).toLocaleString()} />
                  <FieldRow label="Digest" value={parsed.digest} mono />
                  <FieldRow label="PCR0 (Enclave Image)" value={parsed.pcrs[0] || "N/A"} mono />
                  <FieldRow label="PCR1 (Kernel)" value={parsed.pcrs[1] || "N/A"} mono />
                  <FieldRow label="PCR2 (Application)" value={parsed.pcrs[2] || "N/A"} mono />
                  <FieldRow label="User Data" value={parsed.userData ? JSON.stringify(parsed.userData) : "None"} mono />
                  <FieldRow label="Nonce" value={parsed.nonce ? Array.from(parsed.nonce).map(b => b.toString(16).padStart(2, "0")).join("") : "None"} mono />
                </div>
              </CardContent>
            </Card>
          )}

          {/* PCR Registry Comparison */}
          {parsed && pcrRegistry && pcrRegistry.versions.length > 0 && (
            <PCRRegistryComparison parsed={parsed} pcrRegistry={pcrRegistry} />
          )}

          {/* CLI Commands */}
          <CLIVerificationCommands
            attestationB64={attestationInput.trim()}
          />
        </div>
      )}
    </div>
  );
}

function PCRRegistryComparison({
  parsed,
  pcrRegistry,
}: {
  parsed: NonNullable<VerificationResult["attestation"]>;
  pcrRegistry: PCRRegistry;
}) {
  const matchedVersion = pcrRegistry.versions.find(
    (v) =>
      v.pcr0 === parsed.pcrs[0] &&
      v.pcr1 === parsed.pcrs[1] &&
      v.pcr2 === parsed.pcrs[2]
  );
  const compareVersion = matchedVersion || pcrRegistry.versions[0];
  const pcrLabels = ["PCR0 (Enclave Image)", "PCR1 (Kernel)", "PCR2 (Application)"];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">PCR Registry Comparison</CardTitle>
        <CardDescription>
          Comparing parsed PCR values against the published Epsilon enclave registry
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {matchedVersion ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="h-4 w-4 text-green-700" />
              <p className="text-sm font-medium text-green-800">
                PCR values match registry version: {matchedVersion.version}
              </p>
            </div>
            <div className="text-xs text-green-700 space-y-0.5">
              <p>Release date: {matchedVersion.release_date}</p>
              <p>Docker image: {matchedVersion.docker_image}</p>
              {matchedVersion.source_commit && (
                <p>Source commit: {matchedVersion.source_commit}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="h-4 w-4 text-yellow-700" />
              <p className="text-sm font-medium text-yellow-800">
                No matching version found in the registry
              </p>
            </div>
            <p className="text-xs text-yellow-700">
              The parsed PCR values do not match any published enclave version.
              This may indicate an unrecognized or development build.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {pcrLabels.map((label, i) => {
            const browserVal = parsed.pcrs[i];
            const registryVal = i === 0 ? compareVersion?.pcr0 : i === 1 ? compareVersion?.pcr1 : compareVersion?.pcr2;
            const match = browserVal && registryVal && browserVal === registryVal;

            return (
              <div key={i} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{label}</span>
                  {browserVal && registryVal && (
                    <Badge variant={match ? "success" : "destructive"} className="text-xs">
                      {match ? "Match" : "Mismatch"}
                    </Badge>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">Browser:</span>
                    <code className="text-xs font-mono break-all">{browserVal || "N/A"}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">Registry:</span>
                    <code className="text-xs font-mono break-all">{registryVal || "N/A"}</code>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

