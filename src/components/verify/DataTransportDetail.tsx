import { useState } from "react";
import { Lock, Shield, CheckCircle, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function DataTransportDetail() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Lock className="h-5 w-5 text-green-600" />
          Data Transport Encrypted
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Source-Side Encryption via{" "}
          <a
            href="https://github.com/Epsilon-Data/epsilon-proxy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            epsilon-proxy
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </div>

      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Data is encrypted on the data owner's machine before entering the network.
            </p>
            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
              Only the verified TEE enclave can decrypt — the platform never sees plaintext.
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {expanded ? "Hide details" : "Show details"}
      </button>

      {expanded && (
        <div className="space-y-6">
          {/* Encryption */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Encryption</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Payload Encryption</p>
                <p className="text-sm font-mono font-medium mt-1">RSA-2048-OAEP + AES-256-CBC</p>
                <p className="text-xs text-muted-foreground mt-1">Data encrypted with enclave's attested public key</p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Tunnel Encryption</p>
                <p className="text-sm font-mono font-medium mt-1">Noise Protocol (rathole)</p>
                <p className="text-xs text-muted-foreground mt-1">Encrypted channel between proxy and platform</p>
              </div>
            </div>
          </div>

          {/* Attestation Checks */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Attestation Verified Before Data Sent</h4>
            <div className="space-y-2">
              {[
                "COSE_Sign1 signature",
                "AWS Nitro root certificate chain",
                "PCR0 matches deployed enclave image",
                "Public key matches attestation document",
              ].map((check) => (
                <div key={check} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-sm">{check}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Data Path */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Data Path</h4>
            <div className="bg-muted rounded-lg p-4 font-mono text-xs leading-relaxed">
              <pre className="whitespace-pre">
{`┌─────────────┐      ┌──────────┐      ┌─────────┐
│ Data Owner  │ ───> │ Platform │ ───> │ Enclave │
│ (proxy)     │      │          │      │ (TEE)   │
│ Encrypts    │      │ Sees only│      │ Decrypts│
│ locally     │      │ ciphertext│     │ inside  │
└─────────────┘      └──────────┘      └─────────┘`}
              </pre>
            </div>
          </div>

          {/* Access Controls */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Access Controls</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="shrink-0 text-xs">Platform</Badge>
                <span className="text-muted-foreground">Ciphertext only — cannot decrypt</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="shrink-0 text-xs">Credentials</Badge>
                <span className="text-muted-foreground">Stored locally on data owner's machine — never sent to platform</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="shrink-0 text-xs">Revocation</Badge>
                <span className="text-muted-foreground">Data owner stops proxy = immediate access cut-off</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
