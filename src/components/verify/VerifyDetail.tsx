import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HashDisplay } from "@/components/shared/HashDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FieldRow } from "@/components/shared/FieldRow";
import { Download, ExternalLink, CheckCircle2, XCircle, Server, Globe, Monitor } from "lucide-react";
import type { JobVerification } from "@/lib/api";
import type { VerificationResult } from "@epsilon-data/nitro-verify";

const PCR_REGISTRY_URL = "https://github.com/Epsilon-Data/epsilon-enclave/tree/main/published";

function StepTimingBadge({ stepId, result }: { stepId: string; result: VerificationResult }) {
  const step = result.steps.find((s) => s.id === stepId);
  if (!step?.durationMs) return null;
  return (
    <span className="text-xs text-muted-foreground/60 font-mono">
      Verified in {step.durationMs}ms
    </span>
  );
}

export function HardwareDetail({ job, result }: { job: JobVerification; result: VerificationResult }) {
  const att = job.attestation?.attestation;
  const sigStep = result.steps.find((s) => s.id === "signature");
  const sigStatus = sigStep?.status === "passed" ? "verified"
    : sigStep?.status === "failed" ? "failed"
    : sigStep?.status === "running" ? "checking"
    : "unknown";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Hardware Attestation</CardTitle>
          <StepTimingBadge stepId="signature" result={result} />
        </div>
        <CardDescription>
          This proves your code ran on genuine AWS Nitro hardware.
          The attestation is a COSE_Sign1 document signed by the Nitro Hypervisor.
          It cannot be forged or replicated outside of AWS Nitro Enclaves.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`border rounded-lg p-4 flex items-start gap-3 ${sigStatus === "verified" ? "bg-green-50 border-green-200" : sigStatus === "failed" ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}`}>
          <StatusBadge status={sigStatus} />
          <p className={`text-sm ${sigStatus === "verified" ? "text-green-800" : sigStatus === "failed" ? "text-red-800" : "text-yellow-800"}`}>
            {sigStatus === "verified"
              ? "ECDSA P-384/SHA-384 signature verified — this attestation was signed by genuine AWS Nitro hardware."
              : sigStatus === "failed"
                ? `Signature verification failed: ${sigStep?.message || "Unknown error"}`
                : sigStatus === "checking"
                  ? "Verifying COSE_Sign1 signature..."
                  : att
                    ? "Signature verification pending."
                    : "No attestation data available for this job."}
          </p>
        </div>
        {att && (
          <div className="divide-y">
            <FieldRow label="Format" value={att.format} />
            <FieldRow label="Signed By" value={att.signed_by} />
            <FieldRow label="Document Size" value={`${att.attestation_document_length} bytes`} />
            <FieldRow label="User Data Included" value={att.user_data_included ? "Yes" : "No"} />
            <FieldRow label="Nonce Included" value={att.nonce_included ? "Yes" : "No"} />
            {result.attestation && (
              <>
                <FieldRow label="Module ID" value={result.attestation.moduleId} mono />
                <FieldRow label="Attestation Time" value={new Date(result.attestation.timestamp).toLocaleString()} />
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PCRSourceRow({
  source,
  icon: Icon,
  value,
  referenceValue,
  href,
}: {
  source: string;
  icon: React.ElementType;
  value: string | undefined;
  referenceValue?: string;
  href?: string;
}) {
  const hasValue = !!value;
  const matches = hasValue && referenceValue ? value === referenceValue : null;

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex items-center gap-2 w-36 shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1">
            {source} <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="text-xs font-medium text-muted-foreground">{source}</span>
        )}
      </div>
      <code className="text-xs font-mono break-all flex-1">
        {hasValue ? value : <span className="text-muted-foreground italic">Not available</span>}
      </code>
      {matches !== null && (
        <div className="shrink-0">
          {matches ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
        </div>
      )}
    </div>
  );
}

function PCRComparisonRow({
  label,
  serverValue,
  registryValue,
  browserValue,
}: {
  label: string;
  serverValue?: string;
  registryValue?: string;
  browserValue?: string;
}) {
  // Use browser (client-side) value as the attestation source, registry as expected
  const attestationValue = browserValue || serverValue;
  const expectedValue = registryValue;
  const allMatch = attestationValue && expectedValue && attestationValue === expectedValue;

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold">{label}</h4>
        {attestationValue && expectedValue && (
          <Badge variant={allMatch ? "success" : "destructive"} className="text-xs">
            {allMatch ? "Match" : "Mismatch"}
          </Badge>
        )}
      </div>
      <div className="divide-y">
        <PCRSourceRow source="Attestation" icon={Monitor} value={attestationValue} referenceValue={expectedValue} />
        <PCRSourceRow source="Published" icon={Globe} value={expectedValue} referenceValue={expectedValue} href={PCR_REGISTRY_URL} />
      </div>
    </div>
  );
}

export function EnclaveImageDetail({ job, result }: { job: JobVerification; result: VerificationResult }) {
  const serverVerification = job.server_verification;
  const registry = job.pcr_registry;
  const expected = job.enclave_pcrs?.expected;
  const pcrStep = result.steps.find((s) => s.id === "pcr-match");
  const parsed = result.attestation;

  // Three sources of PCR values
  const serverPcrs = serverVerification?.pcrs;
  const registryPcrs = registry ? { pcr0: registry.pcr0, pcr1: registry.pcr1, pcr2: registry.pcr2 } : expected;
  const browserPcrs = parsed ? { pcr0: parsed.pcrs[0], pcr1: parsed.pcrs[1], pcr2: parsed.pcrs[2] } : undefined;

  const hasAnyPcrs = serverPcrs || registryPcrs || browserPcrs;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Enclave Image (PCR Values)</CardTitle>
          <StepTimingBadge stepId="pcr-match" result={result} />
        </div>
        <CardDescription>
          Platform Configuration Registers (PCRs) are hardware-measured hashes that
          identify the exact code running in the enclave. The attestation values are
          compared against the published registry for verification.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Verification status banner */}
        <div className="grid grid-cols-1 gap-3">
          <div className={`rounded-lg border p-3 flex items-center gap-2 ${pcrStep?.status === "passed" ? "bg-green-50 border-green-200" : pcrStep?.status === "failed" ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}`}>
            <Monitor className="h-4 w-4 shrink-0" />
            <div>
              <p className={`text-sm font-medium ${pcrStep?.status === "passed" ? "text-green-800" : pcrStep?.status === "failed" ? "text-red-800" : "text-yellow-800"}`}>
                {pcrStep?.status === "passed"
                  ? "PCR verified"
                  : pcrStep?.status === "failed"
                    ? "PCR mismatch"
                    : "Checking PCRs..."}
              </p>
              <p className="text-xs text-muted-foreground">Verified client-side in your browser</p>
            </div>
          </div>
        </div>

        {/* PCR comparison table */}
        {hasAnyPcrs ? (
          <div className="space-y-3">
            <PCRComparisonRow
              label="PCR0 (Enclave Image)"
              serverValue={serverPcrs?.pcr0}
              registryValue={registryPcrs?.pcr0}
              browserValue={browserPcrs?.pcr0}
            />
            <PCRComparisonRow
              label="PCR1 (Linux Kernel)"
              serverValue={serverPcrs?.pcr1}
              registryValue={registryPcrs?.pcr1}
              browserValue={browserPcrs?.pcr1}
            />
            <PCRComparisonRow
              label="PCR2 (Application)"
              serverValue={serverPcrs?.pcr2}
              registryValue={registryPcrs?.pcr2}
              browserValue={browserPcrs?.pcr2}
            />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">PCR values not available for this job.</p>
        )}

        {/* Registry provenance card */}
        {registry && (
          <div className="bg-muted/50 border rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold">Registry Provenance</h4>
            <div className="divide-y">
              <FieldRow label="Version" value={registry.version} />
              <FieldRow label="Release Date" value={registry.release_date} />
              <FieldRow label="Docker Image" value={registry.docker_image} mono />
              {registry.source_commit && (
                <FieldRow label="Source Commit" value={registry.source_commit} mono />
              )}
            </div>
            {registry.source_url && (
              <a
                href={registry.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-2"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View source on GitHub
              </a>
            )}
          </div>
        )}

        {/* Educational note */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>How verification works:</strong> Your browser parses the attestation document client-side
            using CBOR decoding and extracts the PCR values. These are compared against the{" "}
            <a href={PCR_REGISTRY_URL} target="_blank" rel="noopener noreferrer" className="underline font-medium">
              published PCR registry
            </a>{" "}
            on GitHub. If both match, the enclave image is genuine.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function CertificateChainDetail({ job, result }: { job: JobVerification; result: VerificationResult }) {
  const att = job.attestation?.attestation;
  const certStep = result.steps.find((s) => s.id === "cert-chain");
  const chainInfo = result.certChainInfo;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Certificate Chain</CardTitle>
          <StepTimingBadge stepId="cert-chain" result={result} />
        </div>
        <CardDescription>
          The attestation document is signed using a certificate chain that traces
          back to the AWS Nitro Enclaves root certificate. This chain proves the
          document was signed by genuine AWS hardware.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {certStep?.status === "passed" && chainInfo ? (
          <>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
              Certificate chain verified: {chainInfo.depth} certificates from leaf to root.
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                <div>
                  <p className="text-sm font-medium">AWS Nitro Enclaves Root (Trust Anchor)</p>
                  <p className="text-xs text-muted-foreground">
                    CN: {chainInfo.root.cn} | Fingerprint: {chainInfo.root.fingerprint.substring(0, 16)}...
                  </p>
                </div>
                <Badge variant="success" className="ml-auto">Root</Badge>
              </div>
              {chainInfo.intermediateCount > 0 && (
                <div className="ml-4 border-l-2 border-blue-200 pl-4">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                    <div>
                      <p className="text-sm font-medium">{chainInfo.intermediateCount} Intermediate Certificate{chainInfo.intermediateCount > 1 ? "s" : ""}</p>
                      <p className="text-xs text-muted-foreground">
                        From cabundle in attestation document
                      </p>
                    </div>
                    <Badge variant="secondary" className="ml-auto">Intermediate</Badge>
                  </div>
                </div>
              )}
              <div className={`${chainInfo.intermediateCount > 0 ? "ml-8" : "ml-4"} border-l-2 border-green-200 pl-4`}>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                  <div className="w-2 h-2 rounded-full bg-green-600"></div>
                  <div>
                    <p className="text-sm font-medium">Enclave Certificate</p>
                    <p className="text-xs text-muted-foreground">
                      CN: {chainInfo.endEntity.cn}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Valid: {new Date(chainInfo.endEntity.validFrom).toLocaleString()} — {new Date(chainInfo.endEntity.validTo).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="success" className="ml-auto">Enclave</Badge>
                </div>
              </div>
            </div>
          </>
        ) : certStep?.status === "failed" ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
            {certStep.message}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
              <div className="w-2 h-2 rounded-full bg-blue-600"></div>
              <div>
                <p className="text-sm font-medium">AWS Nitro Enclaves Root (Trust Anchor)</p>
                <p className="text-xs text-muted-foreground">
                  CN: aws.nitro-enclaves | Self-signed root certificate
                </p>
              </div>
              <Badge variant="success" className="ml-auto">Root</Badge>
            </div>
            <div className="ml-4 border-l-2 border-blue-200 pl-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                <div>
                  <p className="text-sm font-medium">Intermediate Certificate(s)</p>
                  <p className="text-xs text-muted-foreground">From cabundle in attestation document</p>
                </div>
                <Badge variant="secondary" className="ml-auto">Intermediate</Badge>
              </div>
            </div>
            <div className="ml-8 border-l-2 border-green-200 pl-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                <div className="w-2 h-2 rounded-full bg-green-600"></div>
                <div>
                  <p className="text-sm font-medium">Enclave Certificate</p>
                  <p className="text-xs text-muted-foreground">End-entity cert from attestation document</p>
                </div>
                <Badge variant="success" className="ml-auto">Enclave</Badge>
              </div>
            </div>
          </div>
        )}
        {att?.aws_root_cert_url && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Verify independently:</strong> Download the AWS root certificate from{" "}
              <a href={att.aws_root_cert_url} target="_blank" rel="noopener noreferrer" className="underline">
                AWS official source
              </a>{" "}
              and verify the certificate chain yourself.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ExecutionProofDetail({ job, result }: { job: JobVerification; result: VerificationResult }) {
  const proof = job.attestation?.proof;
  const parsed = result.attestation;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Execution Proof</CardTitle>
          <StepTimingBadge stepId="parse" result={result} />
        </div>
        <CardDescription>
          These values are embedded in the attestation document's user_data field,
          binding the attestation to this specific job execution. The nonce prevents
          replay attacks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {proof ? (
          <>
            <div className="divide-y">
              <FieldRow label="Job ID" value={proof.job_id} mono />
              <FieldRow
                label="Timestamp"
                value={new Date(proof.timestamp * 1000).toLocaleString()}
              />
              {parsed && (
                <FieldRow label="Module ID" value={parsed.moduleId} mono />
              )}
            </div>
            <HashDisplay label="Output Hash (SHA-256)" hash={proof.output_hash} truncate={false} />
            <HashDisplay label="Nonce" hash={proof.nonce} truncate={false} />
            <div className="divide-y">
              <FieldRow label="Commit SHA" value={job.commit_sha} mono />
            </div>
            {parsed?.userData && (
              <div className="bg-muted/50 rounded-lg p-3 border">
                <p className="text-xs font-medium text-muted-foreground mb-1">Parsed user_data from attestation:</p>
                <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(parsed.userData, null, 2)}
                </pre>
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">No execution proof available.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function OutputIntegrityDetail({ job, result }: { job: JobVerification; result: VerificationResult }) {
  const proofHash = job.attestation?.proof?.output_hash;
  const computedHash = job.execution_output_hash;
  const match = proofHash && computedHash && proofHash === computedHash;
  const outputStep = result.steps.find((s) => s.id === "output-hash");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Output Integrity</CardTitle>
          <StepTimingBadge stepId="output-hash" result={result} />
        </div>
        <CardDescription>
          The SHA-256 hash of the execution output is embedded in the attestation.
          If the output was tampered with after execution, the hashes will not match.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {proofHash ? (
          <>
            <HashDisplay label="Hash in Attestation (from enclave)" hash={proofHash} truncate={false} />
            {computedHash && (
              <HashDisplay label="Computed Hash (from stored output)" hash={computedHash} truncate={false} />
            )}
            <div className={`p-4 rounded-lg border ${match ? "bg-green-50 border-green-200" : computedHash ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}`}>
              <div className="flex items-center gap-2">
                <StatusBadge
                  status={match ? "verified" : computedHash ? "failed" : "unknown"}
                  label={match ? "Hashes Match" : computedHash ? "Hashes Do Not Match" : "Cannot verify (no stored output)"}
                />
              </div>
              <p className={`text-sm mt-2 ${match ? "text-green-800" : computedHash ? "text-red-800" : "text-yellow-800"}`}>
                {match
                  ? "The output you received matches exactly what the enclave produced."
                  : computedHash
                    ? "WARNING: The output may have been tampered with after execution."
                    : "The stored output is not available for comparison."}
              </p>
            </div>
            {outputStep?.status === "passed" && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                {outputStep.message}
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">No output hash available in attestation.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function RawDocumentDetail({ job }: { job: JobVerification }) {
  const doc = job.attestation?.attestation?.attestation_document;

  function handleDownload() {
    if (!doc) return;
    const blob = new Blob([doc], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job.job_id}-attestation.b64`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Raw Attestation Document</CardTitle>
        <CardDescription>
          The raw CBOR-encoded COSE_Sign1 attestation document in base64.
          You can decode and verify this independently using the AWS Nitro CLI
          or the Epsilon attestation verifier.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {doc ? (
          <>
            <div className="divide-y">
              <FieldRow
                label="Document Length"
                value={`${job.attestation?.attestation?.attestation_document_length ?? doc.length} bytes`}
              />
              <FieldRow label="Encoding" value="Base64 (CBOR/COSE_Sign1)" />
            </div>
            <div className="bg-muted rounded-lg p-4 border">
              <pre className="text-xs font-mono overflow-x-auto max-h-64 whitespace-pre-wrap break-all">
                {doc}
              </pre>
            </div>
            <div className="flex items-center gap-3">
              <HashDisplay label="Full Document (copy)" hash={doc} truncate={false} className="flex-1" />
              <Button variant="outline" size="sm" onClick={handleDownload} className="shrink-0 mt-5">
                <Download className="h-4 w-4 mr-1" />
                Download .b64
              </Button>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">No raw attestation document available.</p>
        )}

        {/* Verification guide */}
        {job.attestation?.verification_guide && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 mb-2">How to Verify Independently</h4>
            <ol className="text-sm text-green-800 space-y-1 list-decimal list-inside">
              {Object.entries(job.attestation.verification_guide).map(([key, step]) => (
                <li key={key}>{step}</li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

